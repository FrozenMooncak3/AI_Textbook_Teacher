import { generateText } from 'ai'
import {
  AI_MODEL_FALLBACK_ID,
  AI_MODEL_ID,
  getFallbackModel,
  getModel,
  timeout,
} from '../ai'
import { pool, query, queryOne, run } from '../db'
import { SystemError } from '../errors'
import { mergeChunkResults, mergeModuleGroups } from '../kp-merger'
import { logAction } from '../log'
import { getPrompt } from '../prompt-templates'
import { chunkText } from '../text-chunker'
import { computeMessageCost } from './cost-estimator'
import { writeCacheFromBook } from './kp-cache-service'
import { recordCost } from './cost-meter-service'
import type {
  Stage0Result,
  Stage1Result,
  Stage2Result,
  RawKP,
  Section,
} from './kp-extraction-types'

const MAX_CHARS_PER_CALL = 120_000

interface ModelCallResult {
  text: string
  usage: { promptTokens: number; completionTokens: number }
  modelUsed: string
}

function splitIntoLines(text: string): string[] {
  return text.split('\n')
}

function addLineNumbers(lines: string[], startLine = 0): string {
  return lines.map((line, index) => `${startLine + index}: ${line}`).join('\n')
}

function buildStructureScanText(lines: string[]): string {
  const rawText = lines.join('\n')
  if (rawText.length <= MAX_CHARS_PER_CALL) {
    return addLineNumbers(lines)
  }

  return lines
    .map((line, index) => (index % 5 < 3 ? `${index}: ${line}` : null))
    .filter((line): line is string => line !== null)
    .join('\n')
}

async function callModel(
  prompt: string,
  maxOutputTokens: number,
  model: ReturnType<typeof getModel>,
  modelUsed: string
): Promise<ModelCallResult> {
  const result = await generateText({
    model,
    maxOutputTokens,
    prompt,
    temperature: 0,
    seed: 42,
    abortSignal: AbortSignal.timeout(timeout),
  })

  return {
    text: result.text,
    usage: {
      promptTokens: result.usage.inputTokens ?? 0,
      completionTokens: result.usage.outputTokens ?? 0,
    },
    modelUsed,
  }
}

async function callModelChain<T>(
  prompt: string,
  maxOutputTokens: number,
  context: string,
  bookId: number
): Promise<T> {
  const attempts = [
    { model: getModel(), modelId: AI_MODEL_ID },
    { model: getModel(), modelId: AI_MODEL_ID },
    { model: getFallbackModel(), modelId: AI_MODEL_FALLBACK_ID },
  ]
  let lastError: unknown = new SystemError(`${context}: no model attempts executed`)

  for (const attempt of attempts) {
    try {
      const result = await callModel(prompt, maxOutputTokens, attempt.model, attempt.modelId)

      try {
        const costYuan = computeMessageCost(result.modelUsed, result.usage)
        void recordCost({
          bookId,
          userId: null,
          callType: 'kp_extraction',
          model: result.modelUsed,
          inputTokens: result.usage.promptTokens,
          outputTokens: result.usage.completionTokens,
          costYuan,
        }).catch((error) => {
          void logAction(
            'kp_cost_log_failed',
            `bookId=${bookId}, model=${result.modelUsed}, context=${context}: ${String(error)}`,
            'error'
          )
        })
      } catch (error) {
        void logAction(
          'kp_cost_log_failed',
          `bookId=${bookId}, model=${result.modelUsed}, context=${context}: ${String(error)}`,
          'error'
        )
      }

      return parseJSON<T>(result.text, context)
    } catch (error) {
      lastError = error
    }
  }

  await logAction(
    'kp_fallback_chain_exhausted',
    `bookId=${bookId}, context=${context}: ${String(lastError)}`,
    'error'
  )
  throw lastError
}

function repairLooseJSON(candidate: string): string {
  let repaired = ''
  let inString = false

  for (let index = 0; index < candidate.length; index++) {
    const char = candidate[index]

    if (char === '\\') {
      repaired += char
      if (index + 1 < candidate.length) {
        repaired += candidate[index + 1]
        index += 1
      }
      continue
    }

    if (char === '"') {
      if (!inString) {
        inString = true
        repaired += char
        continue
      }

      let lookahead = index + 1
      while (lookahead < candidate.length && /\s/.test(candidate[lookahead])) {
        lookahead += 1
      }

      const nextChar = candidate[lookahead]
      if (nextChar === ',' || nextChar === '}' || nextChar === ']' || nextChar === ':') {
        inString = false
        repaired += char
      } else {
        repaired += '\\"'
      }
      continue
    }

    repaired += char
  }

  return repaired
}

function parseJSON<T>(text: string, context: string): T {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i)
  const candidate = fencedMatch?.[1] ?? text.match(/\{[\s\S]*\}/)?.[0]

  if (!candidate) {
    throw new SystemError(`${context}: Claude did not return JSON`)
  }

  try {
    return JSON.parse(candidate) as T
  } catch (error) {
    const repaired = repairLooseJSON(candidate)
    try {
      return JSON.parse(repaired) as T
    } catch (repairError) {
      throw new SystemError(
        `${context}: JSON parse failed`,
        repairError instanceof Error ? repairError : error
      )
    }
  }
}

async function structureScan(rawText: string, bookId: number): Promise<Stage0Result> {
  const lines = splitIntoLines(rawText)
  const prompt = await getPrompt('extractor', 'structure_scan', {
    ocr_text: buildStructureScanText(lines),
  })
  return callModelChain<Stage0Result>(prompt, 4_096, 'Stage 0', bookId)
}

async function blockExtract(rawText: string, sections: Section[], bookId: number): Promise<RawKP[]> {
  const lines = splitIntoLines(rawText)
  const allKPs: RawKP[] = []
  let previousTail = '无'

  for (const section of sections) {
    const start = Math.max(0, section.line_start)
    const end = Math.min(lines.length - 1, section.line_end)
    const blockLines = lines.slice(start, end + 1)
    const textBlock = blockLines.join('\n')

    if (!textBlock.trim()) {
      await logAction('KP extraction skipped', `Section "${section.title}" has empty text`, 'warn')
      continue
    }

    const prompt = await getPrompt('extractor', 'kp_extraction', {
      section_name: section.title,
      text_block: textBlock,
      previous_block_tail: previousTail,
    })

    try {
      const result = await callModelChain<Stage1Result>(
        prompt,
        8_192,
        `Stage 1: ${section.title}`,
        bookId
      )

      allKPs.push(...result.knowledge_points)

      const lastKP = result.knowledge_points[result.knowledge_points.length - 1]
      previousTail = lastKP?.cross_block_risk ? JSON.stringify(lastKP) : '无'

      await logAction(
        'KP extraction',
        `Section "${section.title}" extracted ${result.knowledge_points.length} KPs`
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await logAction('KP extraction failed', `Section "${section.title}" failed: ${message}`, 'warn')
    }
  }

  return allKPs
}

async function qualityCheck(
  rawKPs: RawKP[],
  modules: Stage0Result['modules'],
  bookId: number
): Promise<Stage2Result> {
  const prompt = await getPrompt('extractor', 'quality_check', {
    kp_table: JSON.stringify(rawKPs, null, 2),
    module_structure: JSON.stringify(modules, null, 2),
  })

  return callModelChain<Stage2Result>(prompt, 16_384, 'Stage 2', bookId)
}

async function extractChunk(
  rawText: string,
  bookId: number,
  chunkLabel?: string
): Promise<{ stage0: Stage0Result; stage2: Stage2Result }> {
  const labelPrefix = chunkLabel ? `${chunkLabel} ` : ''

  const stage0 = await structureScan(rawText, bookId)
  await logAction(
    'Stage 0 complete',
    `${labelPrefix}sections=${stage0.sections.length}, modules=${stage0.modules.length}`
  )

  const rawKPs = await blockExtract(rawText, stage0.sections, bookId)
  await logAction('Stage 1 complete', `${labelPrefix}raw_kps=${rawKPs.length}`)

  const stage2 = await qualityCheck(rawKPs, stage0.modules, bookId)
  await logAction(
    'Stage 2 complete',
    `${labelPrefix}final_kps=${stage2.final_knowledge_points.length}, clusters=${stage2.clusters.length}`
  )

  return { stage0, stage2 }
}

async function writeResultsToDB(
  bookId: number,
  stage0: Stage0Result,
  stage2: Stage2Result
): Promise<void> {
  const client = await pool.connect()
  let committed = false

  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM modules WHERE book_id = $1', [bookId])

    const moduleIdMap = new Map<number, number>()
    const clusterIdMap = new Map<string, number>()

    for (const module_ of [...stage0.modules].sort((left, right) => left.group_id - right.group_id)) {
      const moduleKPs = stage2.final_knowledge_points.filter((kp) => kp.module_group === module_.group_id)
      const moduleClusters = stage2.clusters.filter((cluster) => cluster.module_group === module_.group_id)

      const result = await client.query<{ id: number }>(
        `
          INSERT INTO modules (
            book_id,
            title,
            summary,
            order_index,
            page_start,
            page_end,
            kp_count,
            cluster_count
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `,
        [
          bookId,
          module_.title,
          module_.sections.join(' / '),
          module_.group_id,
          module_.page_start,
          module_.page_end,
          moduleKPs.length,
          moduleClusters.length,
        ]
      )

      moduleIdMap.set(module_.group_id, result.rows[0].id)
    }

    for (const cluster of stage2.clusters) {
      const moduleId = moduleIdMap.get(cluster.module_group)
      if (!moduleId) {
        continue
      }

      const result = await client.query<{ id: number }>(
        'INSERT INTO clusters (module_id, name) VALUES ($1, $2) RETURNING id',
        [moduleId, cluster.name]
      )

      clusterIdMap.set(`${cluster.module_group}:${cluster.name}`, result.rows[0].id)
    }

    for (const kp of stage2.final_knowledge_points) {
      const moduleId = moduleIdMap.get(kp.module_group)
      if (!moduleId) {
        continue
      }

      const clusterId = clusterIdMap.get(`${kp.module_group}:${kp.cluster_name}`) ?? null

      await client.query(
        `
          INSERT INTO knowledge_points (
            module_id,
            kp_code,
            section_name,
            description,
            type,
            importance,
            detailed_content,
            cluster_id,
            ocr_quality
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          moduleId,
          kp.kp_code,
          kp.section_name,
          kp.description,
          kp.type,
          kp.importance,
          kp.detailed_content,
          clusterId,
          kp.ocr_quality,
        ]
      )
    }

    await client.query("UPDATE books SET kp_extraction_status = 'completed' WHERE id = $1", [bookId])
    await client.query('COMMIT')
    committed = true
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  if (committed) {
    void maybeWriteCacheForCompletedBook(bookId)
  }
}

async function writeModuleResults(
  moduleId: number,
  stage2: Stage2Result
): Promise<void> {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM knowledge_points WHERE module_id = $1', [moduleId])
    await client.query('DELETE FROM clusters WHERE module_id = $1', [moduleId])

    const clusterIdByName = new Map<string, number>()

    for (const cluster of stage2.clusters) {
      if (clusterIdByName.has(cluster.name)) {
        continue
      }

      const result = await client.query<{ id: number }>(
        'INSERT INTO clusters (module_id, name) VALUES ($1, $2) RETURNING id',
        [moduleId, cluster.name]
      )

      clusterIdByName.set(cluster.name, result.rows[0].id)
    }

    for (const kp of stage2.final_knowledge_points) {
      const clusterId = clusterIdByName.get(kp.cluster_name) ?? null

      await client.query(
        `
          INSERT INTO knowledge_points (
            module_id,
            kp_code,
            section_name,
            description,
            type,
            importance,
            detailed_content,
            cluster_id,
            ocr_quality
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          moduleId,
          kp.kp_code,
          kp.section_name,
          kp.description,
          kp.type,
          kp.importance,
          kp.detailed_content,
          clusterId,
          kp.ocr_quality,
        ]
      )
    }

    await client.query(
      'UPDATE modules SET kp_count = $1, cluster_count = $2 WHERE id = $3',
      [stage2.final_knowledge_points.length, clusterIdByName.size, moduleId]
    )

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function syncBookKpStatus(bookId: number): Promise<void> {
  const rows = await query<{ kp_extraction_status: string }>(
    'SELECT kp_extraction_status FROM modules WHERE book_id = $1',
    [bookId]
  )

  if (rows.length === 0) {
    return
  }

  const statuses = rows.map((row) => row.kp_extraction_status)
  let bookStatus: string

  if (statuses.every((status) => status === 'completed')) {
    bookStatus = 'completed'
  } else if (statuses.some((status) => status === 'processing')) {
    bookStatus = 'processing'
  } else if (statuses.some((status) => status === 'failed')) {
    bookStatus = 'failed'
  } else {
    bookStatus = 'pending'
  }

  await run('UPDATE books SET kp_extraction_status = $1 WHERE id = $2', [bookStatus, bookId])

  if (bookStatus === 'completed') {
    void maybeWriteCacheForCompletedBook(bookId)
  }
}

async function maybeWriteCacheForCompletedBook(bookId: number): Promise<void> {
  try {
    const meta = await queryOne<{
      file_md5: string | null
      text_pages_count: number | null
      scanned_pages_count: number | null
    }>(
      'SELECT file_md5, text_pages_count, scanned_pages_count FROM books WHERE id = $1',
      [bookId]
    )

    if (!meta?.file_md5) {
      await logAction('kp_cache_skip_no_md5', `bookId=${bookId}: file_md5 null, skipping cache write`, 'warn')
      return
    }

    const pageCount = Math.max(1, (meta.text_pages_count ?? 0) + (meta.scanned_pages_count ?? 0))
    void writeCacheFromBook(bookId, meta.file_md5, pageCount, 'zh', AI_MODEL_ID).catch((error) => {
      void logAction('kp_cache_write_failed', `bookId=${bookId}, err=${String(error)}`, 'error')
    })
  } catch (error) {
    await logAction('kp_cache_write_failed', `bookId=${bookId}, err=${String(error)}`, 'error')
  }
}

/**
 * Slice book raw_text between `--- PAGE pageStart ---` and `--- PAGE pageEnd+1 ---` markers.
 * If pageStart or pageEnd is null, returns empty string.
 */
export async function getModuleText(
  bookId: number,
  pageStart: number | null,
  pageEnd: number | null
): Promise<string> {
  if (pageStart === null || pageEnd === null) {
    return ''
  }

  const book = await queryOne<{ raw_text: string | null }>(
    'SELECT raw_text FROM books WHERE id = $1',
    [bookId]
  )
  const rawText = book?.raw_text ?? ''

  if (!rawText) {
    return ''
  }

  const startMarker = `--- PAGE ${pageStart} ---`
  const endMarker = `--- PAGE ${pageEnd + 1} ---`
  const startIndex = rawText.indexOf(startMarker)

  if (startIndex < 0) {
    return ''
  }

  const endIndex = rawText.indexOf(endMarker, startIndex + startMarker.length)
  if (endIndex < 0) {
    return rawText.slice(startIndex).trim()
  }

  return rawText.slice(startIndex, endIndex).trim()
}

export async function extractModule(
  bookId: number,
  moduleId: number,
  moduleText: string,
  moduleName: string
): Promise<void> {
  await run(
    "UPDATE modules SET kp_extraction_status = 'processing' WHERE id = $1",
    [moduleId]
  )

  try {
    await logAction(
      'Module KP extraction started',
      `bookId=${bookId}, moduleId=${moduleId}, title=${moduleName}`
    )

    if (!moduleText.trim()) {
      await logAction(
        'Module KP extraction skipped',
        `bookId=${bookId}, moduleId=${moduleId}: empty text`,
        'warn'
      )
      await run(
        "UPDATE modules SET kp_extraction_status = 'completed', kp_count = 0, cluster_count = 0 WHERE id = $1",
        [moduleId]
      )
      await syncBookKpStatus(bookId)
      return
    }

    const chunks = chunkText(moduleText)
    let stage2: Stage2Result

    if (chunks.length === 1) {
      const extracted = await extractChunk(moduleText, bookId, `module ${moduleId}: ${moduleName}`)
      stage2 = extracted.stage2
    } else {
      await logAction(
        'Module KP extraction chunking',
        `bookId=${bookId}, moduleId=${moduleId}, chunks=${chunks.length}`
      )

      const chunkStage2Results: Stage2Result[] = []
      for (const [chunkIndex, chunk] of chunks.entries()) {
        const chunkLabel = `module ${moduleId} chunk ${chunkIndex + 1}/${chunks.length}: ${chunk.title}`
        const extracted = await extractChunk(chunk.text, bookId, chunkLabel)
        chunkStage2Results.push(extracted.stage2)
      }

      stage2 = mergeChunkResults(chunkStage2Results)
    }

    await writeModuleResults(moduleId, stage2)
    await run(
      "UPDATE modules SET kp_extraction_status = 'completed' WHERE id = $1",
      [moduleId]
    )
    await syncBookKpStatus(bookId)

    await logAction(
      'Module KP extraction completed',
      `bookId=${bookId}, moduleId=${moduleId}, final_kps=${stage2.final_knowledge_points.length}, clusters=${stage2.clusters.length}`
    )
  } catch (error) {
    await run(
      "UPDATE modules SET kp_extraction_status = 'failed' WHERE id = $1",
      [moduleId]
    )
    await syncBookKpStatus(bookId)
    const errorMessage = error instanceof Error ? error.message : String(error)
    await logAction(
      'Module KP extraction failed',
      `bookId=${bookId}, moduleId=${moduleId}: ${errorMessage}`,
      'error'
    )
    throw error
  }
}

export async function triggerReadyModulesExtraction(bookId: number): Promise<void> {
  const readyModules = await query<{
    id: number
    title: string
    page_start: number | null
    page_end: number | null
  }>(
    `
      SELECT id, title, page_start, page_end
      FROM modules
      WHERE book_id = $1
        AND text_status = 'ready'
        AND ocr_status IN ('done', 'skipped')
        AND kp_extraction_status = 'pending'
      ORDER BY order_index ASC
    `,
    [bookId]
  )

  for (const moduleRow of readyModules) {
    try {
      const moduleText = await getModuleText(bookId, moduleRow.page_start, moduleRow.page_end)
      await extractModule(bookId, moduleRow.id, moduleText, moduleRow.title)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await logAction(
        'Ready-modules extraction error',
        `bookId=${bookId}, moduleId=${moduleRow.id}: ${errorMessage}`,
        'error'
      )
    }
  }
}

export async function extractKPs(bookId: number): Promise<void> {
  const book = await queryOne<{ id: number; title: string; raw_text: string | null }>(
    'SELECT id, title, raw_text FROM books WHERE id = $1',
    [bookId]
  )

  if (!book) {
    throw new SystemError(`Book ${bookId} not found`)
  }

  if (!book.raw_text) {
    throw new SystemError(`Book ${bookId} has no OCR text; run OCR before extraction`)
  }

  await run("UPDATE books SET kp_extraction_status = 'processing' WHERE id = $1", [bookId])

  try {
    await logAction('KP extraction started', `bookId=${bookId}, title=${book.title}`)
    const chunks = chunkText(book.raw_text)

    let stage0: Stage0Result
    let stage2: Stage2Result

    if (chunks.length === 1) {
      const extracted = await extractChunk(book.raw_text, bookId)
      stage0 = extracted.stage0
      stage2 = extracted.stage2
    } else {
      await logAction('KP extraction chunking', `bookId=${bookId}, chunks=${chunks.length}`)

      const chunkResults: Array<{ stage0: Stage0Result; stage2: Stage2Result }> = []

      for (const [chunkIndex, chunk] of chunks.entries()) {
        const chunkLabel = `chunk ${chunkIndex + 1}/${chunks.length}: ${chunk.title}`
        await logAction('KP extraction chunk started', `bookId=${bookId}, ${chunkLabel}`)
        const extracted = await extractChunk(chunk.text, bookId, chunkLabel)
        chunkResults.push(extracted)
        await logAction(
          'KP extraction chunk completed',
          `bookId=${bookId}, ${chunkLabel}, final_kps=${extracted.stage2.final_knowledge_points.length}`
        )
      }

      const mergedModules = mergeModuleGroups(chunkResults.map((result) => result.stage0.modules))
      stage0 = {
        sections: [],
        modules: mergedModules.modules,
      }
      stage2 = mergeChunkResults(
        chunkResults.map((result) => result.stage2),
        mergedModules.mappings
      )

      await logAction(
        'KP extraction chunks merged',
        `bookId=${bookId}, merged_modules=${stage0.modules.length}, merged_kps=${stage2.final_knowledge_points.length}`
      )
    }

    const failedGates = Object.entries(stage2.quality_gates)
      .filter(([, passed]) => !passed)
      .map(([name]) => name)

    if (failedGates.length > 0) {
      await logAction('Quality gates failed', `failed=${failedGates.join(', ')}`, 'warn')
      if (stage2.issues.length > 0) {
        await logAction('Quality issues', JSON.stringify(stage2.issues), 'warn')
      }
    }

    await writeResultsToDB(bookId, stage0, stage2)
    await logAction(
      'KP extraction completed',
      `bookId=${bookId}, final_kps=${stage2.final_knowledge_points.length}, clusters=${stage2.clusters.length}, modules=${stage0.modules.length}`
    )
  } catch (error) {
    await run("UPDATE books SET kp_extraction_status = 'failed' WHERE id = $1", [bookId])
    const errorMessage = error instanceof Error ? error.message : String(error)
    await logAction('KP extraction failed', `bookId=${bookId}: ${errorMessage}`, 'error')
    throw error
  }
}

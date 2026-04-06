import { generateText } from 'ai'
import { getModel, timeout } from '../ai'
import { pool, queryOne, run } from '../db'
import { SystemError } from '../errors'
import { logAction } from '../log'
import { getPrompt } from '../prompt-templates'
import type {
  Stage0Result,
  Stage1Result,
  Stage2Result,
  RawKP,
  Section,
} from './kp-extraction-types'

const MAX_CHARS_PER_CALL = 120_000

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

async function callModel(prompt: string, maxOutputTokens: number): Promise<string> {
  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens,
    prompt,
    abortSignal: AbortSignal.timeout(timeout),
  })

  return text
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

async function structureScan(rawText: string): Promise<Stage0Result> {
  const lines = splitIntoLines(rawText)
  const prompt = await getPrompt('extractor', 'structure_scan', {
    ocr_text: buildStructureScanText(lines),
  })
  const response = await callModel(prompt, 4_096)
  return parseJSON<Stage0Result>(response, 'Stage 0')
}

async function blockExtract(rawText: string, sections: Section[]): Promise<RawKP[]> {
  const lines = splitIntoLines(rawText)
  const allKPs: RawKP[] = []
  let previousTail = '无'

  for (const section of sections) {
    const start = Math.max(0, section.line_start)
    const end = Math.min(lines.length - 1, section.line_end)
    const blockLines = lines.slice(start, end + 1)
    const textBlock = blockLines.join('\n')
    let rawResponse = ''

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
      const response = await callModel(prompt, 8_192)
      rawResponse = response
      const result = parseJSON<Stage1Result>(response, `Stage 1: ${section.title}`)

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
      if (rawResponse) {
        await logAction(
          'KP raw response',
          `Section "${section.title}" first 500 chars: ${rawResponse.slice(0, 500)}`,
          'warn'
        )
      }
    }
  }

  return allKPs
}

async function qualityCheck(rawKPs: RawKP[], modules: Stage0Result['modules']): Promise<Stage2Result> {
  const prompt = await getPrompt('extractor', 'quality_check', {
    kp_table: JSON.stringify(rawKPs, null, 2),
    module_structure: JSON.stringify(modules, null, 2),
  })

  const response = await callModel(prompt, 16_384)
  return parseJSON<Stage2Result>(response, 'Stage 2')
}

async function writeResultsToDB(
  bookId: number,
  stage0: Stage0Result,
  stage2: Stage2Result
): Promise<void> {
  const client = await pool.connect()

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
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
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

    const stage0 = await structureScan(book.raw_text)
    await logAction(
      'Stage 0 complete',
      `sections=${stage0.sections.length}, modules=${stage0.modules.length}`
    )

    const rawKPs = await blockExtract(book.raw_text, stage0.sections)
    await logAction('Stage 1 complete', `raw_kps=${rawKPs.length}`)

    const stage2 = await qualityCheck(rawKPs, stage0.modules)
    await logAction(
      'Stage 2 complete',
      `final_kps=${stage2.final_knowledge_points.length}, clusters=${stage2.clusters.length}`
    )

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
    await logAction('KP extraction failed', `bookId=${bookId}: ${String(error)}`, 'error')
    throw error
  }
}

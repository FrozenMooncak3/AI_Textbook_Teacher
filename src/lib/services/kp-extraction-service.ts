import { getClaudeClient, CLAUDE_MODEL } from '../claude'
import { getDb } from '../db'
import { SystemError } from '../errors'
import { logAction } from '../log'
import { getPrompt } from '../prompt-templates'
import type {
  ClusterDef,
  FinalKP,
  ModuleGroup,
  QualityIssue,
  RawKP,
  Section,
  Stage0Result,
  Stage1Result,
  Stage2Result,
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

async function callClaude(prompt: string, maxTokens: number): Promise<string> {
  const claude = getClaudeClient()
  const message = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  })

  const textBlock = message.content.find((block) => block.type === 'text') as
    | { type: 'text'; text: string }
    | undefined

  if (!textBlock) {
    throw new SystemError('Claude 杩斿洖闈炴枃鏈唴瀹?')
  }

  return textBlock.text
}

function parseJSON<T>(text: string, context: string): T {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i)
  const candidate = fencedMatch?.[1] ?? text.match(/\{[\s\S]*\}/)?.[0]

  if (!candidate) {
    throw new SystemError(`${context}: 鏈湪 Claude 鍝嶅簲涓壘鍒?JSON`)
  }

  try {
    return JSON.parse(candidate) as T
  } catch (error) {
    throw new SystemError(`${context}: JSON 瑙ｆ瀽澶辫触`, error)
  }
}

async function structureScan(rawText: string): Promise<Stage0Result> {
  const lines = splitIntoLines(rawText)
  const prompt = getPrompt('extractor', 'structure_scan', {
    ocr_text: buildStructureScanText(lines),
  })
  const response = await callClaude(prompt, 4_096)
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

    if (!textBlock.trim()) {
      logAction('KP 鎻愬彇璺宠繃', `灏忚妭"${section.title}"鏂囨湰涓虹┖`, 'warn')
      continue
    }

    const prompt = getPrompt('extractor', 'kp_extraction', {
      section_name: section.title,
      text_block: textBlock,
      previous_block_tail: previousTail,
    })

    try {
      const response = await callClaude(prompt, 8_192)
      const result = parseJSON<Stage1Result>(response, `Stage 1: ${section.title}`)

      allKPs.push(...result.knowledge_points)

      const lastKP = result.knowledge_points[result.knowledge_points.length - 1]
      previousTail = lastKP?.cross_block_risk ? JSON.stringify(lastKP) : '无'

      logAction('KP 鎻愬彇', `灏忚妭"${section.title}"鎻愬彇鍒?${result.knowledge_points.length} 涓?KP`)
    } catch (err) {
      logAction(
        'KP 鎻愬彇澶辫触',
        `灏忚妭"${section.title}"鎻愬彇澶辫触锛岃烦杩? ${err instanceof Error ? err.message : String(err)}`,
        'warn'
      )
    }
  }

  return allKPs
}

async function qualityCheck(rawKPs: RawKP[], modules: ModuleGroup[]): Promise<Stage2Result> {
  const prompt = getPrompt('extractor', 'quality_check', {
    kp_table: JSON.stringify(rawKPs, null, 2),
    module_structure: JSON.stringify(modules, null, 2),
  })

  const response = await callClaude(prompt, 16_384)
  return parseJSON<Stage2Result>(response, 'Stage 2')
}

function writeResultsToDB(bookId: number, stage0: Stage0Result, stage2: Stage2Result): void {
  const db = getDb()

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM modules WHERE book_id = ?').run(bookId)

    const moduleInsert = db.prepare(
      `INSERT INTO modules (book_id, title, summary, order_index, page_start, page_end, kp_count, cluster_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const clusterInsert = db.prepare('INSERT INTO clusters (module_id, name) VALUES (?, ?)')
    const kpInsert = db.prepare(
      `INSERT INTO knowledge_points
       (module_id, kp_code, section_name, description, type, importance, detailed_content, cluster_id, ocr_quality)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )

    const moduleIdMap = new Map<number, number>()
    const clusterIdMap = new Map<string, number>()

    for (const module of [...stage0.modules].sort((a, b) => a.group_id - b.group_id)) {
      const moduleKPs = stage2.final_knowledge_points.filter((kp) => kp.module_group === module.group_id)
      const moduleClusters = stage2.clusters.filter((cluster) => cluster.module_group === module.group_id)

      const result = moduleInsert.run(
        bookId,
        module.title,
        module.sections.join(' / '),
        module.group_id,
        module.page_start,
        module.page_end,
        moduleKPs.length,
        moduleClusters.length
      )

      moduleIdMap.set(module.group_id, Number(result.lastInsertRowid))
    }

    for (const cluster of stage2.clusters) {
      const moduleId = moduleIdMap.get(cluster.module_group)
      if (!moduleId) continue

      const result = clusterInsert.run(moduleId, cluster.name)
      clusterIdMap.set(`${cluster.module_group}:${cluster.name}`, Number(result.lastInsertRowid))
    }

    for (const kp of stage2.final_knowledge_points) {
      const moduleId = moduleIdMap.get(kp.module_group)
      if (!moduleId) continue

      const clusterId = clusterIdMap.get(`${kp.module_group}:${kp.cluster_name}`) ?? null

      kpInsert.run(
        moduleId,
        kp.kp_code,
        kp.section_name,
        kp.description,
        kp.type,
        kp.importance,
        kp.detailed_content,
        clusterId,
        kp.ocr_quality
      )
    }

    db.prepare("UPDATE books SET kp_extraction_status = 'completed' WHERE id = ?").run(bookId)
  })

  tx()
}

export async function extractKPs(bookId: number): Promise<void> {
  const db = getDb()
  const book = db
    .prepare('SELECT id, title, raw_text FROM books WHERE id = ?')
    .get(bookId) as { id: number; title: string; raw_text: string | null } | undefined

  if (!book) {
    throw new SystemError(`鏁欐潗 ${bookId} 涓嶅瓨鍦?`)
  }

  if (!book.raw_text) {
    throw new SystemError(`鏁欐潗 ${bookId} 鏃?OCR 鏂囨湰锛岃鍏堝畬鎴?OCR`)
  }

  db.prepare("UPDATE books SET kp_extraction_status = 'processing' WHERE id = ?").run(bookId)

  try {
    logAction('KP 鎻愬彇寮€濮?', `bookId=${bookId}锛屾暀鏉愶細${book.title}`)

    const stage0 = await structureScan(book.raw_text)
    logAction('Stage 0 瀹屾垚', `璇嗗埆鍒?${stage0.sections.length} 涓皬鑺傦紝${stage0.modules.length} 涓ā鍧?`)

    const rawKPs = await blockExtract(book.raw_text, stage0.sections)
    logAction('Stage 1 瀹屾垚', `鍒濇彁鍙?${rawKPs.length} 涓?KP`)

    const stage2 = await qualityCheck(rawKPs, stage0.modules)
    logAction(
      'Stage 2 瀹屾垚',
      `鏈€缁?${stage2.final_knowledge_points.length} 涓?KP锛?${stage2.clusters.length} 涓仛绫?`
    )

    const failedGates = Object.entries(stage2.quality_gates)
      .filter(([, passed]) => !passed)
      .map(([name]) => name)

    if (failedGates.length > 0) {
      logAction('璐ㄩ噺闂ㄦ湭閫氳繃', `澶辫触椤? ${failedGates.join(', ')}`, 'warn')
      if (stage2.issues.length > 0) {
        logAction('璐ㄩ噺闂璇︽儏', JSON.stringify(stage2.issues), 'warn')
      }
    }

    writeResultsToDB(bookId, stage0, stage2)
    logAction(
      'KP 鎻愬彇瀹屾垚',
      `bookId=${bookId}锛?${stage2.final_knowledge_points.length} 涓?KP锛?${stage2.clusters.length} 涓仛绫伙紝${stage0.modules.length} 涓ā鍧?`
    )
  } catch (error) {
    db.prepare("UPDATE books SET kp_extraction_status = 'failed' WHERE id = ?").run(bookId)
    logAction('KP 鎻愬彇澶辫触', `bookId=${bookId}: ${String(error)}`, 'error')
    throw error
  }
}

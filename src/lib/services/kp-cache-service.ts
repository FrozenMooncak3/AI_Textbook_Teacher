import { pool, query, queryOne, run } from '@/lib/db'
import { logAction } from '@/lib/log'

export interface CachePayload {
  raw_text?: string
  modules: Array<{
    title: string
    summary: string
    order_index: number
    page_start: number | null
    page_end: number | null
    text_status: string
    ocr_status: string
    kp_extraction_status: string
    knowledge_points: Array<{
      kp_code: string
      section_name: string
      description: string
      type: string
      importance: number
      detailed_content: string
      ocr_quality: string
      cluster_name?: string
    }>
    clusters: Array<{ name: string }>
  }>
}

export type LookupResult =
  | { hit: true; payload: CachePayload; modelUsed: string }
  | { hit: false }

export async function lookupCache(
  pdfMd5: string,
  pageCount: number,
  language: 'zh' | 'en'
): Promise<LookupResult> {
  const row = await queryOne<{ kp_payload: CachePayload; model_used: string }>(
    `SELECT kp_payload, model_used FROM kp_cache
     WHERE pdf_md5 = $1 AND page_count = $2 AND language = $3`,
    [pdfMd5, pageCount, language]
  )
  if (!row) return { hit: false }
  return { hit: true, payload: row.kp_payload, modelUsed: row.model_used }
}

/**
 * 事务复用：把 cache payload 中的 modules + KPs 写到 bookId 名下，
 * 同步 UPDATE books.parse_status='done' / kp_extraction_status='completed' / cache_hit=TRUE。
 * 失败时回滚。成功后 UPDATE kp_cache.hit_count += 1。
 *
 * 实现要点（Codex 补全）：
 * - 使用 `pool.connect()` 拿一个 client
 * - BEGIN
 * - INSERT modules（按 order_index 顺序），保留 module_id 映射
 * - 对每个 module，先 INSERT clusters 拿 cluster_ids 映射，再 INSERT knowledge_points
 *   （按 cluster_name 关联）
 * - UPDATE books SET parse_status='done', kp_extraction_status='completed',
 *   cache_hit=TRUE, raw_text=COALESCE($payload.raw_text, raw_text)
 * - UPDATE kp_cache SET hit_count = hit_count + 1, last_hit_at = NOW()
 *   WHERE pdf_md5 = $pdfMd5
 * - COMMIT
 *
 * 异常处理：catch 全部异常 ROLLBACK + 抛 + logAction
 */
export async function applyCacheToBook(
  bookId: number,
  payload: CachePayload,
  pdfMd5: string
): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const moduleIdMap = new Map<number, number>()
    for (const m of payload.modules) {
      const r = await client.query<{ id: number }>(
        `INSERT INTO modules (book_id, title, summary, order_index, page_start, page_end,
                              text_status, ocr_status, kp_extraction_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [bookId, m.title, m.summary, m.order_index, m.page_start, m.page_end,
          m.text_status, m.ocr_status, m.kp_extraction_status]
      )
      moduleIdMap.set(m.order_index, r.rows[0].id)
    }

    for (const m of payload.modules) {
      const moduleId = moduleIdMap.get(m.order_index)!
      const clusterNameToId = new Map<string, number>()
      for (const c of m.clusters) {
        const r = await client.query<{ id: number }>(
          `INSERT INTO clusters (module_id, name) VALUES ($1, $2) RETURNING id`,
          [moduleId, c.name]
        )
        clusterNameToId.set(c.name, r.rows[0].id)
      }
      for (const kp of m.knowledge_points) {
        const clusterId = kp.cluster_name ? clusterNameToId.get(kp.cluster_name) ?? null : null
        await client.query(
          `INSERT INTO knowledge_points (module_id, kp_code, section_name, description,
                                         type, importance, detailed_content, cluster_id, ocr_quality)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [moduleId, kp.kp_code, kp.section_name, kp.description, kp.type,
            kp.importance, kp.detailed_content, clusterId, kp.ocr_quality]
        )
      }
    }

    await client.query(
      `UPDATE books
       SET parse_status = 'done',
           kp_extraction_status = 'completed',
           cache_hit = TRUE,
           raw_text = COALESCE($2, raw_text)
       WHERE id = $1`,
      [bookId, payload.raw_text ?? null]
    )

    await client.query(
      `UPDATE kp_cache SET hit_count = hit_count + 1, last_hit_at = NOW()
       WHERE pdf_md5 = $1`,
      [pdfMd5]
    )

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    void logAction('kp_cache_apply_failed', `bookId=${bookId}, md5=${pdfMd5}, err=${String(err)}`, 'error')
    throw err
  } finally {
    client.release()
  }
}

/**
 * 聚合 book 当前所有 modules + KPs → CachePayload → INSERT INTO kp_cache。
 * 时机：当 books.kp_extraction_status 从 processing 转 completed 时调用。
 * ON CONFLICT (pdf_md5) DO NOTHING — 并发安全。
 */
export async function writeCacheFromBook(
  bookId: number,
  pdfMd5: string,
  pageCount: number,
  language: 'zh' | 'en',
  modelUsed: string
): Promise<void> {
  const modules = await query<{
    id: number
    title: string
    summary: string
    order_index: number
    page_start: number | null
    page_end: number | null
    text_status: string
    ocr_status: string
    kp_extraction_status: string
  }>(
    `SELECT id, title, summary, order_index, page_start, page_end,
            text_status, ocr_status, kp_extraction_status
     FROM modules WHERE book_id = $1 ORDER BY order_index`,
    [bookId]
  )

  const bookRow = await queryOne<{ raw_text: string | null }>(
    `SELECT raw_text FROM books WHERE id = $1`,
    [bookId]
  )

  const modulePayloads: CachePayload['modules'] = []
  for (const m of modules) {
    const kps = await query<{
      kp_code: string
      section_name: string
      description: string
      type: string
      importance: number
      detailed_content: string
      ocr_quality: string
      cluster_id: number | null
    }>(
      `SELECT kp_code, section_name, description, type, importance,
              detailed_content, ocr_quality, cluster_id
       FROM knowledge_points WHERE module_id = $1`,
      [m.id]
    )

    const clusters = await query<{ id: number; name: string }>(
      `SELECT id, name FROM clusters WHERE module_id = $1`,
      [m.id]
    )

    const clusterIdToName = new Map(clusters.map((c) => [c.id, c.name]))
    modulePayloads.push({
      title: m.title,
      summary: m.summary,
      order_index: m.order_index,
      page_start: m.page_start,
      page_end: m.page_end,
      text_status: m.text_status,
      ocr_status: m.ocr_status,
      kp_extraction_status: m.kp_extraction_status,
      knowledge_points: kps.map((kp) => ({
        kp_code: kp.kp_code,
        section_name: kp.section_name,
        description: kp.description,
        type: kp.type,
        importance: kp.importance,
        detailed_content: kp.detailed_content,
        ocr_quality: kp.ocr_quality,
        cluster_name: kp.cluster_id ? clusterIdToName.get(kp.cluster_id) : undefined,
      })),
      clusters: clusters.map((c) => ({ name: c.name })),
    })
  }

  const payload: CachePayload = {
    raw_text: bookRow?.raw_text ?? undefined,
    modules: modulePayloads,
  }

  await run(
    `INSERT INTO kp_cache (pdf_md5, page_count, language, model_used, kp_payload)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (pdf_md5) DO NOTHING`,
    [pdfMd5, pageCount, language, modelUsed, JSON.stringify(payload)]
  )

  void logAction('kp_cache_written', `bookId=${bookId}, md5=${pdfMd5}, pages=${pageCount}`)
}

export async function getCacheHitCount(pdfMd5: string): Promise<number> {
  const row = await queryOne<{ hit_count: number }>(
    `SELECT hit_count FROM kp_cache WHERE pdf_md5 = $1`,
    [pdfMd5]
  )
  return row?.hit_count ?? 0
}

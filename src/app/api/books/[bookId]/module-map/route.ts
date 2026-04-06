import { handleRoute } from '@/lib/handle-route'
import { query, queryOne } from '@/lib/db'
import { UserError } from '@/lib/errors'
import type {
  ModuleMapCluster,
  ModuleMapKP,
  ModuleMapModule,
  ModuleMapResponse,
} from '@/lib/services/kp-extraction-types'

interface BookRow {
  id: number
  title: string
  kp_extraction_status: string
}

interface ModuleRow {
  id: number
  title: string
  summary: string
  order_index: number
  kp_count: number
  cluster_count: number
  page_start: number | null
  page_end: number | null
  learning_status: string
}

export const GET = handleRoute(async (_req, context) => {
  const { bookId } = await context!.params
  const id = Number(bookId)

  if (Number.isNaN(id)) {
    throw new UserError('Invalid book ID', 'INVALID_ID', 400)
  }

  const book = await queryOne<BookRow>(
    'SELECT id, title, kp_extraction_status FROM books WHERE id = $1',
    [id]
  )

  if (!book) {
    throw new UserError('Book not found', 'NOT_FOUND', 404)
  }

  if (book.kp_extraction_status !== 'completed') {
    const response: ModuleMapResponse = {
      book_id: id,
      book_title: book.title,
      kp_extraction_status: book.kp_extraction_status,
      total_kp_count: 0,
      total_module_count: 0,
      modules: [],
    }

    return { data: response }
  }

  const modules = await query<ModuleRow>(
    'SELECT * FROM modules WHERE book_id = $1 ORDER BY order_index',
    [id]
  )

  const result: ModuleMapModule[] = await Promise.all(
    modules.map(async (module) => {
      const knowledgePoints = await query<ModuleMapKP>(
        `
          SELECT kp.id, kp.kp_code, kp.description, kp.type, kp.importance, kp.ocr_quality,
                 c.name AS cluster_name
          FROM knowledge_points kp
          LEFT JOIN clusters c ON kp.cluster_id = c.id
          WHERE kp.module_id = $1
          ORDER BY kp.kp_code
        `,
        [module.id]
      )

      const clusters = await query<ModuleMapCluster>(
        `
          SELECT c.id, c.name, COUNT(kp.id)::int AS kp_count
          FROM clusters c
          LEFT JOIN knowledge_points kp ON kp.cluster_id = c.id
          WHERE c.module_id = $1
          GROUP BY c.id
          ORDER BY c.id
        `,
        [module.id]
      )

      return {
        id: module.id,
        title: module.title,
        summary: module.summary,
        order_index: module.order_index,
        kp_count: module.kp_count,
        cluster_count: module.cluster_count,
        page_start: module.page_start,
        page_end: module.page_end,
        learning_status: module.learning_status,
        knowledge_points: knowledgePoints,
        clusters,
      }
    })
  )

  const response: ModuleMapResponse = {
    book_id: id,
    book_title: book.title,
    kp_extraction_status: book.kp_extraction_status,
    total_kp_count: result.reduce((sum, module) => sum + module.kp_count, 0),
    total_module_count: result.length,
    modules: result,
  }

  return { data: response }
})

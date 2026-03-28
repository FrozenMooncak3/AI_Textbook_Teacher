import { handleRoute } from '@/lib/handle-route'
import { getDb } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { logAction } from '@/lib/log'
import { extractKPs } from '@/lib/services/kp-extraction-service'

export const POST = handleRoute(async (_req, context) => {
  const { bookId } = await context!.params
  const id = Number(bookId)

  if (Number.isNaN(id)) {
    throw new UserError('鏃犳晥鐨勬暀鏉怲D', 'INVALID_ID', 400)
  }

  const db = getDb()
  const book = db
    .prepare('SELECT id, title, parse_status, kp_extraction_status FROM books WHERE id = ?')
    .get(id) as
    | { id: number; title: string; parse_status: string; kp_extraction_status: string }
    | undefined

  if (!book) {
    throw new UserError('鏁欐潗涓嶅瓨鍦?', 'NOT_FOUND', 404)
  }

  if (book.parse_status !== 'done') {
    throw new UserError('OCR 灏氭湭瀹屾垚', 'OCR_NOT_DONE', 409)
  }

  if (book.kp_extraction_status === 'processing') {
    throw new UserError('KP 鎻愬彇姝ｅ湪杩涜涓紝璇风瓑寰呭畬鎴?', 'ALREADY_PROCESSING', 409)
  }

  db.prepare("UPDATE books SET kp_extraction_status = 'pending' WHERE id = ?").run(id)

  logAction('閲嶆柊鎻愬彇 KP', `bookId=${id}锛屾暀鏉愶細${book.title}`)

  extractKPs(id).catch((error) => {
    logAction('KP 閲嶆柊鎻愬彇鍚庡彴閿欒', `bookId=${id}: ${String(error)}`, 'error')
  })

  return { data: { status: 'processing', bookId: id }, status: 202 }
})

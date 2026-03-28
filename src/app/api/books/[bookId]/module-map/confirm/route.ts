import { handleRoute } from '@/lib/handle-route'
import { getDb } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { logAction } from '@/lib/log'

export const POST = handleRoute(async (_req, context) => {
  const { bookId } = await context!.params
  const id = Number(bookId)

  if (Number.isNaN(id)) {
    throw new UserError('鏃犳晥鐨勬暀鏉怲D', 'INVALID_ID', 400)
  }

  const db = getDb()
  const book = db
    .prepare('SELECT id, title, kp_extraction_status FROM books WHERE id = ?')
    .get(id) as { id: number; title: string; kp_extraction_status: string } | undefined

  if (!book) {
    throw new UserError('鏁欐潗涓嶅瓨鍦?', 'NOT_FOUND', 404)
  }

  if (book.kp_extraction_status !== 'completed') {
    throw new UserError('KP 鎻愬彇灏氭湭瀹屾垚', 'NOT_READY', 409)
  }

  const firstModule = db
    .prepare(
      "SELECT id FROM modules WHERE book_id = ? AND learning_status = 'unstarted' ORDER BY order_index LIMIT 1"
    )
    .get(id) as { id: number } | undefined

  if (firstModule) {
    db.prepare("UPDATE modules SET learning_status = 'reading' WHERE id = ?").run(firstModule.id)
  }

  logAction('妯″潡鍦板浘宸茬‘璁?', `bookId=${id}锛屾暀鏉愶細${book.title}`)

  return { data: { confirmed: true, firstModuleId: firstModule?.id ?? null } }
})

import { handleRoute } from '@/lib/handle-route'
import { queryOne, run } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { logAction } from '@/lib/log'

interface BookRow {
  id: number
  title: string
  kp_extraction_status: string
}

export const POST = handleRoute(async (_req, context) => {
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
    throw new UserError('KP extraction is not ready yet', 'NOT_READY', 409)
  }

  const firstModule = await queryOne<{ id: number }>(
    "SELECT id FROM modules WHERE book_id = $1 AND learning_status = 'unstarted' ORDER BY order_index LIMIT 1",
    [id]
  )

  if (firstModule) {
    await run("UPDATE modules SET learning_status = 'reading' WHERE id = $1", [firstModule.id])
  }

  await logAction('module_map_confirmed', `bookId=${id}, book=${book.title}`)

  return { data: { confirmed: true, firstModuleId: firstModule?.id ?? null } }
})

import { requireBookOwner } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { handleRoute } from '@/lib/handle-route'

export const GET = handleRoute(async (req, context) => {
  const { bookId } = await context!.params
  const id = Number(bookId)

  await requireBookOwner(req, id)

  const book = await queryOne<{ id: number; title: string }>(
    'SELECT id, title FROM books WHERE id = $1',
    [id]
  )

  return { data: book }
})

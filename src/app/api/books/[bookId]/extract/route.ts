import { handleRoute } from '@/lib/handle-route'
import { queryOne } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { logAction } from '@/lib/log'
import { extractKPs } from '@/lib/services/kp-extraction-service'

interface BookRow {
  id: number
  title: string
  parse_status: string
  kp_extraction_status: string
}

export const POST = handleRoute(async (_req, context) => {
  const { bookId } = await context!.params
  const id = Number(bookId)

  if (Number.isNaN(id)) {
    throw new UserError('Invalid book ID', 'INVALID_ID', 400)
  }

  const book = await queryOne<BookRow>(
    'SELECT id, title, parse_status, kp_extraction_status FROM books WHERE id = $1',
    [id]
  )

  if (!book) {
    throw new UserError('Book not found', 'NOT_FOUND', 404)
  }

  if (book.parse_status !== 'done') {
    throw new UserError('OCR is not done yet', 'OCR_NOT_DONE', 409)
  }

  if (book.kp_extraction_status === 'processing') {
    throw new UserError('KP extraction is already processing', 'ALREADY_PROCESSING', 409)
  }

  if (book.kp_extraction_status === 'completed') {
    throw new UserError('KP extraction already completed; use regenerate', 'ALREADY_COMPLETED', 409)
  }

  extractKPs(id).catch(async (error) => {
    await logAction('KP extraction background error', `bookId=${id}: ${String(error)}`, 'error')
  })

  return { data: { status: 'processing', bookId: id }, status: 202 }
})

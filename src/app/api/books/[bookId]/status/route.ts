import { requireBookOwner } from '@/lib/auth'
import { handleRoute } from '@/lib/handle-route'
import { queryOne } from '@/lib/db'
import { UserError } from '@/lib/errors'

interface BookStatusRow {
  parse_status: string
  kp_extraction_status: string
  ocr_current_page: number
  ocr_total_pages: number
}

interface BookStatusResponse {
  parseStatus: string
  ocrCurrentPage: number
  ocrTotalPages: number
  parse_status: string
  kp_extraction_status: string
  ocr_current_page: number
  ocr_total_pages: number
}

export const GET = handleRoute(async (req, context) => {
  const { bookId } = await context!.params
  const id = Number(bookId)

  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid book ID', 'INVALID_ID', 400)
  }

  await requireBookOwner(req, id)

  const book = await queryOne<BookStatusRow>(
    'SELECT parse_status, kp_extraction_status, ocr_current_page, ocr_total_pages FROM books WHERE id = $1',
    [id]
  )

  if (!book) {
    throw new UserError('Book not found', 'NOT_FOUND', 404)
  }

  let parseStatus = book.parse_status
  if (parseStatus === 'done') {
    parseStatus = 'completed'
  } else if (parseStatus === 'error') {
    parseStatus = 'failed'
  }

  const response: BookStatusResponse = {
    parseStatus,
    ocrCurrentPage: book.ocr_current_page,
    ocrTotalPages: book.ocr_total_pages,
    parse_status: book.parse_status,
    kp_extraction_status: book.kp_extraction_status,
    ocr_current_page: book.ocr_current_page,
    ocr_total_pages: book.ocr_total_pages,
  }

  return { data: response }
})

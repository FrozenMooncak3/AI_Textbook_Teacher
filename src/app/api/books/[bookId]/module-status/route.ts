import { NextRequest } from 'next/server'
import { requireBookOwner } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'

interface BookRow {
  id: number
  parse_status: string
  ocr_current_page: number | null
  ocr_total_pages: number | null
  kp_extraction_status: string
}

interface ModuleStatusRow {
  id: number
  title: string
  order_index: number
  text_status: string
  ocr_status: string
  kp_extraction_status: string
  page_start: number | null
  page_end: number | null
}

export const GET = handleRoute(async (req: NextRequest, context) => {
  const { bookId } = await context!.params
  const id = Number(bookId)

  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid book ID', 'INVALID_ID', 400)
  }

  await requireBookOwner(req, id)

  const book = await queryOne<BookRow>(
    `
      SELECT id, parse_status, ocr_current_page, ocr_total_pages, kp_extraction_status
      FROM books
      WHERE id = $1
    `,
    [id]
  )

  if (!book) {
    throw new UserError('Book not found', 'NOT_FOUND', 404)
  }

  const modules = await query<ModuleStatusRow>(
    `
      SELECT id, title, order_index, text_status, ocr_status, kp_extraction_status, page_start, page_end
      FROM modules
      WHERE book_id = $1
      ORDER BY order_index ASC
    `,
    [id]
  )

  return {
    data: {
      bookId: id,
      parseStatus: book.parse_status,
      kpExtractionStatus: book.kp_extraction_status,
      ocrCurrentPage: book.ocr_current_page ?? 0,
      ocrTotalPages: book.ocr_total_pages ?? 0,
      modules: modules.map((m) => ({
        id: m.id,
        title: m.title,
        orderIndex: m.order_index,
        textStatus: m.text_status,
        ocrStatus: m.ocr_status,
        kpStatus: m.kp_extraction_status,
        pageStart: m.page_start,
        pageEnd: m.page_end,
      })),
    },
  }
})

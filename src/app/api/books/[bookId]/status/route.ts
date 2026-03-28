import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

interface BookStatus {
  parse_status: string
  ocr_current_page: number
  ocr_total_pages: number
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const { bookId } = await params
  const id = Number(bookId)
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: 'Invalid book ID', code: 'INVALID_ID' }, { status: 400 })
  }

  const db = getDb()
  const book = db
    .prepare('SELECT parse_status, ocr_current_page, ocr_total_pages FROM books WHERE id = ?')
    .get(id) as BookStatus | undefined

  if (!book) {
    return NextResponse.json({ error: 'Book not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  let parseStatus = book.parse_status
  if (parseStatus === 'done') parseStatus = 'completed'
  else if (parseStatus === 'error') parseStatus = 'failed'

  return NextResponse.json({
    parseStatus,
    ocrCurrentPage: book.ocr_current_page,
    ocrTotalPages: book.ocr_total_pages,
    parse_status: book.parse_status,
    ocr_current_page: book.ocr_current_page,
    ocr_total_pages: book.ocr_total_pages,
  })
}

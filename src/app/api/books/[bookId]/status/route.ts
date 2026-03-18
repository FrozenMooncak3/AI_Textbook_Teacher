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
  if (isNaN(id)) {
    return NextResponse.json({ error: '无效的教材 ID', code: 'INVALID_ID' }, { status: 400 })
  }

  const db = getDb()
  const book = db
    .prepare('SELECT parse_status, ocr_current_page, ocr_total_pages FROM books WHERE id = ?')
    .get(id) as BookStatus | undefined

  if (!book) {
    return NextResponse.json({ error: '教材不存在', code: 'NOT_FOUND' }, { status: 404 })
  }

  // 兼容旧数据：parse_status='done' 映射为 'completed'，'error' 映射为 'failed'
  let parseStatus = book.parse_status
  if (parseStatus === 'done') parseStatus = 'completed'
  else if (parseStatus === 'error') parseStatus = 'failed'

  return NextResponse.json({
    parseStatus,
    ocrCurrentPage: book.ocr_current_page,
    ocrTotalPages: book.ocr_total_pages,
  })
}

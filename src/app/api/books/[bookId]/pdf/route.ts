import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const { bookId } = await params
  const id = Number(bookId)
  if (isNaN(id)) {
    return NextResponse.json({ error: '无效的书籍 ID', code: 'INVALID_ID' }, { status: 400 })
  }

  const db = getDb()
  const book = db.prepare('SELECT id FROM books WHERE id = ?').get(id) as { id: number } | undefined
  if (!book) {
    return NextResponse.json({ error: '书籍不存在', code: 'NOT_FOUND' }, { status: 404 })
  }

  const pdfPath = join(process.cwd(), 'data', 'uploads', `${id}.pdf`)
  try {
    const fileBuffer = await readFile(pdfPath)
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'PDF 文件不存在', code: 'FILE_NOT_FOUND' }, { status: 404 })
  }
}

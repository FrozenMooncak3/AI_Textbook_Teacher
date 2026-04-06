import { NextRequest, NextResponse } from 'next/server'
import { requireBookOwner } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const { bookId } = await params
  const id = Number(bookId)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid book ID', code: 'INVALID_ID' }, { status: 400 })
  }

  try {
    await requireBookOwner(_req, id)
  } catch (error) {
    if (error instanceof UserError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }

    throw error
  }

  const book = await queryOne<{ id: number }>('SELECT id FROM books WHERE id = $1', [id])
  if (!book) {
    return NextResponse.json({ error: 'Book not found', code: 'NOT_FOUND' }, { status: 404 })
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
    return NextResponse.json({ error: 'PDF file not found', code: 'FILE_NOT_FOUND' }, { status: 404 })
  }
}

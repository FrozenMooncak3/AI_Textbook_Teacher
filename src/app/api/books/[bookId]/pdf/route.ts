import { NextRequest, NextResponse } from 'next/server'
import { requireBookOwner } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { buildObjectKey, getSignedPdfUrl } from '@/lib/r2-client'

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

  const objectKey = buildObjectKey(id)
  try {
    const signedUrl = await getSignedPdfUrl(objectKey, 3600)
    return NextResponse.redirect(signedUrl, 302)
  } catch (error) {
    return NextResponse.json(
      { error: 'PDF file not accessible', code: 'FILE_NOT_FOUND', details: String(error) },
      { status: 404 }
    )
  }
}

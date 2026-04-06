import { NextRequest, NextResponse } from 'next/server'
import { query, run, insert } from '@/lib/db'

interface NoteRow {
  id: number
  book_id: number
  page_number: number
  content: string
  created_at: string
  updated_at: string
}

type Params = { params: Promise<{ bookId: string }> }

function parseBookId(bookId: string): number | null {
  const id = Number(bookId)
  return isNaN(id) ? null : id
}

export async function GET(req: NextRequest, { params }: Params) {
  const id = parseBookId((await params).bookId)
  if (!id) {
    return NextResponse.json({ error: 'Invalid book ID', code: 'INVALID_ID' }, { status: 400 })
  }

  const url = new URL(req.url)
  const page = url.searchParams.get('page')

  let rows: NoteRow[]
  if (page) {
    rows = await query<NoteRow>(
      'SELECT * FROM notes WHERE book_id = $1 AND page_number = $2 ORDER BY created_at',
      [id, Number(page)]
    )
  } else {
    rows = await query<NoteRow>(
      'SELECT * FROM notes WHERE book_id = $1 ORDER BY page_number, created_at',
      [id]
    )
  }

  return NextResponse.json({
    notes: rows.map((row) => ({
      id: row.id,
      pageNumber: row.page_number,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  })
}

export async function POST(req: NextRequest, { params }: Params) {
  const id = parseBookId((await params).bookId)
  if (!id) {
    return NextResponse.json({ error: 'Invalid book ID', code: 'INVALID_ID' }, { status: 400 })
  }

  let body: { pageNumber?: number; content?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const { pageNumber, content } = body
  if (typeof pageNumber !== 'number' || !content?.trim()) {
    return NextResponse.json({ error: 'Missing pageNumber or content', code: 'MISSING_FIELDS' }, { status: 400 })
  }

  const noteId = await insert(
    'INSERT INTO notes (book_id, page_number, content) VALUES ($1, $2, $3)',
    [id, pageNumber, content.trim()]
  )

  return NextResponse.json({ id: noteId }, { status: 201 })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const bookId = parseBookId((await params).bookId)
  if (!bookId) {
    return NextResponse.json({ error: 'Invalid book ID', code: 'INVALID_ID' }, { status: 400 })
  }

  let body: { id?: number; content?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const { id: noteId, content } = body
  if (!noteId || !content?.trim()) {
    return NextResponse.json({ error: 'Missing id or content', code: 'MISSING_FIELDS' }, { status: 400 })
  }

  const result = await run(
    'UPDATE notes SET content = $1, updated_at = NOW() WHERE id = $2 AND book_id = $3',
    [content.trim(), noteId, bookId]
  )

  if ((result.rowCount ?? 0) === 0) {
    return NextResponse.json({ error: 'Note not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  return NextResponse.json({ updated: true })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const bookId = parseBookId((await params).bookId)
  if (!bookId) {
    return NextResponse.json({ error: 'Invalid book ID', code: 'INVALID_ID' }, { status: 400 })
  }

  const url = new URL(req.url)
  const noteId = Number(url.searchParams.get('id'))
  if (!noteId) {
    return NextResponse.json({ error: 'Missing id parameter', code: 'MISSING_ID' }, { status: 400 })
  }

  const result = await run('DELETE FROM notes WHERE id = $1 AND book_id = $2', [noteId, bookId])
  if ((result.rowCount ?? 0) === 0) {
    return NextResponse.json({ error: 'Note not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  return NextResponse.json({ deleted: true })
}

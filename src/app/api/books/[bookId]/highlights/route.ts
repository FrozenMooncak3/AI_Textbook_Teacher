import { NextRequest, NextResponse } from 'next/server'
import { query, run, insert } from '@/lib/db'

interface HighlightRow {
  id: number
  book_id: number
  page_number: number
  text: string
  color: string
  rects_json: string
  created_at: string
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

  let rows: HighlightRow[]
  if (page) {
    rows = await query<HighlightRow>(
      'SELECT * FROM highlights WHERE book_id = $1 AND page_number = $2 ORDER BY created_at',
      [id, Number(page)]
    )
  } else {
    rows = await query<HighlightRow>(
      'SELECT * FROM highlights WHERE book_id = $1 ORDER BY page_number, created_at',
      [id]
    )
  }

  return NextResponse.json({
    highlights: rows.map((row) => ({
      id: row.id,
      pageNumber: row.page_number,
      text: row.text,
      color: row.color,
      rects: JSON.parse(row.rects_json),
      createdAt: row.created_at,
    })),
  })
}

export async function POST(req: NextRequest, { params }: Params) {
  const id = parseBookId((await params).bookId)
  if (!id) {
    return NextResponse.json({ error: 'Invalid book ID', code: 'INVALID_ID' }, { status: 400 })
  }

  let body: { pageNumber?: number; text?: string; color?: string; rects?: unknown[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const { pageNumber, text, color = 'yellow', rects = [] } = body
  if (typeof pageNumber !== 'number' || !text?.trim()) {
    return NextResponse.json({ error: 'Missing pageNumber or text', code: 'MISSING_FIELDS' }, { status: 400 })
  }

  const highlightId = await insert(
    'INSERT INTO highlights (book_id, page_number, text, color, rects_json) VALUES ($1, $2, $3, $4, $5)',
    [id, pageNumber, text.trim(), color, JSON.stringify(rects)]
  )

  return NextResponse.json({ id: highlightId }, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const bookId = parseBookId((await params).bookId)
  if (!bookId) {
    return NextResponse.json({ error: 'Invalid book ID', code: 'INVALID_ID' }, { status: 400 })
  }

  const url = new URL(req.url)
  const highlightId = Number(url.searchParams.get('id'))
  if (!highlightId) {
    return NextResponse.json({ error: 'Missing id parameter', code: 'MISSING_ID' }, { status: 400 })
  }

  const result = await run('DELETE FROM highlights WHERE id = $1 AND book_id = $2', [
    highlightId,
    bookId,
  ])

  if ((result.rowCount ?? 0) === 0) {
    return NextResponse.json({ error: 'Highlight not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  return NextResponse.json({ deleted: true })
}

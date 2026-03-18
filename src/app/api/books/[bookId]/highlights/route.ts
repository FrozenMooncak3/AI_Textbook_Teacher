import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

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

/** GET /api/books/[bookId]/highlights?page=N — 查询高亮（可按页筛选） */
export async function GET(_req: NextRequest, { params }: Params) {
  const id = parseBookId((await params).bookId)
  if (!id) return NextResponse.json({ error: '无效的教材 ID', code: 'INVALID_ID' }, { status: 400 })

  const db = getDb()
  const url = new URL(_req.url)
  const page = url.searchParams.get('page')

  let rows: HighlightRow[]
  if (page) {
    rows = db.prepare(
      'SELECT * FROM highlights WHERE book_id = ? AND page_number = ? ORDER BY created_at'
    ).all(id, Number(page)) as HighlightRow[]
  } else {
    rows = db.prepare(
      'SELECT * FROM highlights WHERE book_id = ? ORDER BY page_number, created_at'
    ).all(id) as HighlightRow[]
  }

  return NextResponse.json({
    highlights: rows.map((r) => ({
      id: r.id,
      pageNumber: r.page_number,
      text: r.text,
      color: r.color,
      rects: JSON.parse(r.rects_json),
      createdAt: r.created_at,
    })),
  })
}

/** POST /api/books/[bookId]/highlights — 新增高亮 */
export async function POST(req: NextRequest, { params }: Params) {
  const id = parseBookId((await params).bookId)
  if (!id) return NextResponse.json({ error: '无效的教材 ID', code: 'INVALID_ID' }, { status: 400 })

  let body: { pageNumber?: number; text?: string; color?: string; rects?: unknown[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '请求格式错误', code: 'INVALID_BODY' }, { status: 400 })
  }

  const { pageNumber, text, color = 'yellow', rects = [] } = body
  if (typeof pageNumber !== 'number' || !text?.trim()) {
    return NextResponse.json({ error: '缺少 pageNumber 或 text', code: 'MISSING_FIELDS' }, { status: 400 })
  }

  const db = getDb()
  const result = db.prepare(
    'INSERT INTO highlights (book_id, page_number, text, color, rects_json) VALUES (?, ?, ?, ?, ?)'
  ).run(id, pageNumber, text.trim(), color, JSON.stringify(rects))

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 })
}

/** DELETE /api/books/[bookId]/highlights?id=N — 删除高亮 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const bookId = parseBookId((await params).bookId)
  if (!bookId) return NextResponse.json({ error: '无效的教材 ID', code: 'INVALID_ID' }, { status: 400 })

  const url = new URL(req.url)
  const highlightId = Number(url.searchParams.get('id'))
  if (!highlightId) {
    return NextResponse.json({ error: '缺少 id 参数', code: 'MISSING_ID' }, { status: 400 })
  }

  const db = getDb()
  const result = db.prepare('DELETE FROM highlights WHERE id = ? AND book_id = ?').run(highlightId, bookId)
  if (result.changes === 0) {
    return NextResponse.json({ error: '高亮不存在', code: 'NOT_FOUND' }, { status: 404 })
  }

  return NextResponse.json({ deleted: true })
}

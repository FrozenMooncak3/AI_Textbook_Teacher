import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

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

/** GET /api/books/[bookId]/notes?page=N — 查询笔记（可按页筛选） */
export async function GET(_req: NextRequest, { params }: Params) {
  const id = parseBookId((await params).bookId)
  if (!id) return NextResponse.json({ error: '无效的教材 ID', code: 'INVALID_ID' }, { status: 400 })

  const db = getDb()
  const url = new URL(_req.url)
  const page = url.searchParams.get('page')

  let rows: NoteRow[]
  if (page) {
    rows = db.prepare(
      'SELECT * FROM notes WHERE book_id = ? AND page_number = ? ORDER BY created_at'
    ).all(id, Number(page)) as NoteRow[]
  } else {
    rows = db.prepare(
      'SELECT * FROM notes WHERE book_id = ? ORDER BY page_number, created_at'
    ).all(id) as NoteRow[]
  }

  return NextResponse.json({
    notes: rows.map((r) => ({
      id: r.id,
      pageNumber: r.page_number,
      content: r.content,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  })
}

/** POST /api/books/[bookId]/notes — 新增笔记 */
export async function POST(req: NextRequest, { params }: Params) {
  const id = parseBookId((await params).bookId)
  if (!id) return NextResponse.json({ error: '无效的教材 ID', code: 'INVALID_ID' }, { status: 400 })

  let body: { pageNumber?: number; content?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '请求格式错误', code: 'INVALID_BODY' }, { status: 400 })
  }

  const { pageNumber, content } = body
  if (typeof pageNumber !== 'number' || !content?.trim()) {
    return NextResponse.json({ error: '缺少 pageNumber 或 content', code: 'MISSING_FIELDS' }, { status: 400 })
  }

  const db = getDb()
  const result = db.prepare(
    'INSERT INTO notes (book_id, page_number, content) VALUES (?, ?, ?)'
  ).run(id, pageNumber, content.trim())

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 })
}

/** PUT /api/books/[bookId]/notes — 更新笔记 */
export async function PUT(req: NextRequest, { params }: Params) {
  const bookId = parseBookId((await params).bookId)
  if (!bookId) return NextResponse.json({ error: '无效的教材 ID', code: 'INVALID_ID' }, { status: 400 })

  let body: { id?: number; content?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '请求格式错误', code: 'INVALID_BODY' }, { status: 400 })
  }

  const { id: noteId, content } = body
  if (!noteId || !content?.trim()) {
    return NextResponse.json({ error: '缺少 id 或 content', code: 'MISSING_FIELDS' }, { status: 400 })
  }

  const db = getDb()
  const result = db.prepare(
    "UPDATE notes SET content = ?, updated_at = datetime('now') WHERE id = ? AND book_id = ?"
  ).run(content.trim(), noteId, bookId)

  if (result.changes === 0) {
    return NextResponse.json({ error: '笔记不存在', code: 'NOT_FOUND' }, { status: 404 })
  }

  return NextResponse.json({ updated: true })
}

/** DELETE /api/books/[bookId]/notes?id=N — 删除笔记 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const bookId = parseBookId((await params).bookId)
  if (!bookId) return NextResponse.json({ error: '无效的教材 ID', code: 'INVALID_ID' }, { status: 400 })

  const url = new URL(req.url)
  const noteId = Number(url.searchParams.get('id'))
  if (!noteId) {
    return NextResponse.json({ error: '缺少 id 参数', code: 'MISSING_ID' }, { status: 400 })
  }

  const db = getDb()
  const result = db.prepare('DELETE FROM notes WHERE id = ? AND book_id = ?').run(noteId, bookId)
  if (result.changes === 0) {
    return NextResponse.json({ error: '笔记不存在', code: 'NOT_FOUND' }, { status: 404 })
  }

  return NextResponse.json({ deleted: true })
}

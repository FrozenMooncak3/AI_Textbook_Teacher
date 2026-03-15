import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { extractText } from '@/lib/parse-file'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const title = formData.get('title') as string | null

  if (!file) {
    return NextResponse.json({ error: '请选择文件' }, { status: 400 })
  }
  if (!title || !title.trim()) {
    return NextResponse.json({ error: '请填写教材名称' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  let rawText: string
  try {
    rawText = await extractText(buffer, file.name)
  } catch (err) {
    const message = err instanceof Error ? err.message : '文件解析失败'
    return NextResponse.json({ error: message }, { status: 422 })
  }

  if (rawText.length < 100) {
    return NextResponse.json({ error: '文件内容过短，请确认文件内容正确' }, { status: 422 })
  }

  const db = getDb()
  const result = db
    .prepare('INSERT INTO books (title, raw_text, parse_status) VALUES (?, ?, ?)')
    .run(title.trim(), rawText, 'done')

  return NextResponse.json({ bookId: result.lastInsertRowid }, { status: 201 })
}

export async function GET() {
  const db = getDb()
  const books = db
    .prepare('SELECT id, title, created_at, parse_status FROM books ORDER BY created_at DESC')
    .all()
  return NextResponse.json({ books })
}

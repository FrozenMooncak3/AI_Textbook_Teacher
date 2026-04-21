import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { insert, query } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'

interface BookListRow {
  id: number
  title: string
  parse_status: string
  created_at: string
}

export const GET = handleRoute(async (req) => {
  const user = await requireUser(req)
  const books = await query<BookListRow>(
    `
      SELECT id, title, parse_status, created_at
      FROM books
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
    [user.id]
  )
  return { data: books }
})

export async function POST(req: NextRequest) {
  let userId = 0
  try {
    const user = await requireUser(req)
    userId = user.id
  } catch (error) {
    if (error instanceof UserError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }

    throw error
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const title = formData.get('title') as string | null

  if (!file) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Missing title' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !['pdf', 'txt'].includes(ext)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 422 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  await logAction('book_upload_started', `file=${file.name}, title=${title}`)

  if (ext === 'txt') {
    const rawText = buffer.toString('utf-8').trim()
    if (rawText.length < 100) {
      await logAction('book_upload_short_text', `chars=${rawText.length}`, 'warn')
      return NextResponse.json({ error: 'Text file content is too short' }, { status: 422 })
    }

    const bookId = await insert(
      'INSERT INTO books (user_id, title, raw_text, parse_status) VALUES ($1, $2, $3, $4)',
      [userId, title.trim(), rawText, 'done']
    )

    await logAction('book_upload_completed_txt', `bookId=${bookId}, chars=${rawText.length}`)
    return NextResponse.json({ bookId }, { status: 201 })
  }

  if (ext === 'pdf') {
    await logAction('book_upload_pdf_via_old_endpoint', `user=${userId}`, 'error')
    return NextResponse.json(
      {
        error: 'PDF uploads must use /api/uploads/presign',
        code: 'USE_PRESIGN_ENDPOINT',
      },
      { status: 400 }
    )
  }

  return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
}

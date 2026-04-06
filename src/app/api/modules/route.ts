import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { getModel, timeout } from '@/lib/ai'
import { requireUser } from '@/lib/auth'
import { insert, query, queryOne } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { logAction } from '@/lib/log'

interface BookRow {
  id: number
  title: string
  raw_text: string | null
}

interface ModuleRow {
  id: number
  book_id: number
  title: string
  summary: string
  order_index: number
  kp_count: number
  cluster_count: number
  page_start: number | null
  page_end: number | null
  learning_status: string
  guide_json: string | null
  created_at: string
}

interface GeneratedModule {
  title: string
  summary: string
  kp_count: number
  dependency: string
}

function parseJsonObject(text: string): { modules: GeneratedModule[] } {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in model response')
  }

  const parsed = JSON.parse(jsonMatch[0]) as { modules?: GeneratedModule[] }
  if (!Array.isArray(parsed.modules)) {
    throw new Error('Missing modules array')
  }

  return { modules: parsed.modules }
}

async function listModules(bookId: number, userId: number): Promise<ModuleRow[]> {
  return query<ModuleRow>(
    `
      SELECT m.*
      FROM modules m
      JOIN books b ON b.id = m.book_id
      WHERE m.book_id = $1 AND b.user_id = $2
      ORDER BY m.order_index ASC
    `,
    [bookId, userId]
  )
}

async function getAuthenticatedUserId(req: NextRequest): Promise<number | NextResponse> {
  try {
    const user = await requireUser(req)
    return user.id
  } catch (error) {
    if (error instanceof UserError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }

    throw error
  }
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req)
  if (userId instanceof NextResponse) {
    return userId
  }

  const { bookId } = await req.json() as { bookId?: number }
  const normalizedBookId = Number(bookId)
  if (!Number.isInteger(normalizedBookId) || normalizedBookId <= 0) {
    return NextResponse.json({ error: 'Missing bookId' }, { status: 400 })
  }

  const book = await queryOne<BookRow>(
    'SELECT id, title, raw_text FROM books WHERE id = $1 AND user_id = $2',
    [normalizedBookId, userId]
  )

  if (!book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  }

  if (!book.raw_text?.trim()) {
    return NextResponse.json({ error: 'Book text is empty and cannot be mapped' }, { status: 409 })
  }

  const existing = await query<{ id: number }>('SELECT id FROM modules WHERE book_id = $1', [normalizedBookId])
  if (existing.length > 0) {
    return NextResponse.json({ error: 'Modules already exist for this book' }, { status: 409 })
  }

  await logAction('module_map_generation_started', `bookId=${normalizedBookId}, title=${book.title}`)

  const prompt = `You are designing a study module map from textbook content.
Return strict JSON only:
{
  "modules": [
    {
      "title": "Module title",
      "summary": "1-2 sentence learning summary",
      "kp_count": 8,
      "dependency": "none or prerequisite note"
    }
  ]
}

Rules:
1. Split by natural sections, not arbitrary page counts.
2. Balance module difficulty and knowledge-point counts.
3. Preserve prerequisite ordering where needed.
4. Use the same language as the textbook.

Textbook title: ${book.title}
Textbook content:
${book.raw_text.slice(0, 50_000)}`

  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens: 8192,
    prompt,
    abortSignal: AbortSignal.timeout(timeout),
  })

  let parsed: { modules: GeneratedModule[] }
  try {
    parsed = parseJsonObject(text)
  } catch {
    await logAction('module_map_generation_parse_failed', text.slice(-500), 'error')
    return NextResponse.json({ error: 'AI response could not be parsed as JSON' }, { status: 500 })
  }

  for (const [index, module_] of parsed.modules.entries()) {
    await insert(
      'INSERT INTO modules (book_id, title, summary, order_index, kp_count) VALUES ($1, $2, $3, $4, $5)',
      [normalizedBookId, module_.title, module_.summary, index + 1, module_.kp_count]
    )
  }

  const modules = await listModules(normalizedBookId, userId)
  await logAction('module_map_generated', `bookId=${normalizedBookId}, count=${modules.length}`)

  return NextResponse.json({ modules }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req)
  if (userId instanceof NextResponse) {
    return userId
  }

  const bookId = Number(req.nextUrl.searchParams.get('bookId'))
  if (!Number.isInteger(bookId) || bookId <= 0) {
    return NextResponse.json({ error: 'Missing bookId' }, { status: 400 })
  }

  const modules = await listModules(bookId, userId)
  return NextResponse.json({ modules })
}

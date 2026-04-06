import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { requireUser } from '@/lib/auth'
import { getModel, timeout } from '@/lib/ai'
import { query, queryOne, run } from '@/lib/db'
import { logAction } from '@/lib/log'

interface Conversation {
  id: number
  book_id: number
  page_number: number
  screenshot_text: string
}

interface DbMessage {
  role: string
  content: string
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params
  const user = await requireUser(req)
  const convId = Number(conversationId)

  if (Number.isNaN(convId)) {
    return NextResponse.json({ error: 'Invalid conversation ID', code: 'INVALID_ID' }, { status: 400 })
  }

  const conversation = await queryOne<Conversation>(
    `
      SELECT c.id, c.book_id, c.page_number, c.screenshot_text
      FROM conversations c
      JOIN books b ON b.id = c.book_id
      WHERE c.id = $1 AND b.user_id = $2
    `,
    [convId, user.id]
  )

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  let body: { message?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const { message } = body
  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: 'Missing message field', code: 'MISSING_FIELDS' }, { status: 400 })
  }

  const history = await query<DbMessage>(
    'SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY id ASC',
    [convId]
  )

  const claudeMessages = history.map((entry) => ({
    role: entry.role as 'user' | 'assistant',
    content: entry.content,
  }))
  claudeMessages.push({ role: 'user', content: message })

  const book = await queryOne<{ title: string }>('SELECT title FROM books WHERE id = $1', [conversation.book_id])
  const bookTitle = book?.title ?? 'textbook'
  const systemPrompt = `You are a textbook tutor helping a student understand page ${conversation.page_number} of ${bookTitle}. Keep answers concise, clear, and focused on the page context.`

  let answer = ''
  try {
    const result = await generateText({
      model: getModel(),
      maxOutputTokens: 1024,
      system: systemPrompt,
      messages: claudeMessages,
      abortSignal: AbortSignal.timeout(timeout),
    })
    answer = result.text
  } catch (error) {
    await logAction('conversation_ai_failed', `conversationId=${convId}, ${String(error)}`, 'error', {
      userId: user.id,
    })
    return NextResponse.json({ error: 'AI service unavailable', code: 'AI_ERROR' }, { status: 500 })
  }

  await run('INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)', [
    convId,
    'user',
    message,
  ])
  await run('INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)', [
    convId,
    'assistant',
    answer,
  ])

  await logAction('conversation_ai_completed', `conversationId=${convId}`, 'info', {
    userId: user.id,
  })

  return NextResponse.json({ answer })
}

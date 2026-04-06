import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, run } from '@/lib/db'
import { generateText } from 'ai'
import { getModel, timeout } from '@/lib/ai'
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
  const convId = Number(conversationId)
  if (isNaN(convId)) {
    return NextResponse.json({ error: 'Invalid conversation ID', code: 'INVALID_ID' }, { status: 400 })
  }

  const conv = await queryOne<Conversation>(
    'SELECT id, book_id, page_number, screenshot_text FROM conversations WHERE id = $1',
    [convId]
  )
  if (!conv) {
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

  const book = await queryOne<{ title: string }>('SELECT title FROM books WHERE id = $1', [conv.book_id])
  const bookTitle = book?.title ?? '教材'
  const systemPrompt = `你是一位财务教材辅导老师，正在帮助学生理解《${bookTitle}》第${conv.page_number}页的内容。回答简洁清晰，重点突出。`

  let answer = ''
  try {
    const { text } = await generateText({
      model: getModel(),
      maxOutputTokens: 1024,
      system: systemPrompt,
      messages: claudeMessages,
      abortSignal: AbortSignal.timeout(timeout),
    })
    answer = text
  } catch (error) {
    await logAction('追问AI失败', `conversationId=${convId}，${String(error)}`, 'error')
    return NextResponse.json({ error: 'AI 服务暂时不可用', code: 'AI_ERROR' }, { status: 500 })
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

  await logAction('追问AI完成', `conversationId=${convId}`)

  return NextResponse.json({ answer })
}

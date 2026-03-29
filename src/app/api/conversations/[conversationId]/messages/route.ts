import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
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
    return NextResponse.json({ error: '无效的对话 ID', code: 'INVALID_ID' }, { status: 400 })
  }

  const db = getDb()
  const conv = db.prepare('SELECT id, book_id, page_number, screenshot_text FROM conversations WHERE id = ?').get(convId) as Conversation | undefined
  if (!conv) {
    return NextResponse.json({ error: '对话不存在', code: 'NOT_FOUND' }, { status: 404 })
  }

  let body: { message?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '请求格式错误', code: 'INVALID_BODY' }, { status: 400 })
  }

  const { message } = body
  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: '缺少 message 字段', code: 'MISSING_FIELDS' }, { status: 400 })
  }

  // 查询历史消息作为上下文
  const history = db.prepare(
    'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id ASC'
  ).all(convId) as DbMessage[]

  // 构建 Claude messages 数组
  const claudeMessages = history.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))
  claudeMessages.push({ role: 'user', content: message })

  const book = db.prepare('SELECT title FROM books WHERE id = ?').get(conv.book_id) as { title: string } | undefined
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
  } catch (e) {
    logAction('追问AI失败', `conversationId=${convId}，${String(e)}`, 'error')
    return NextResponse.json({ error: 'AI 服务暂时不可用', code: 'AI_ERROR' }, { status: 500 })
  }

  // 存储用户消息和 AI 回复
  db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').run(convId, 'user', message)
  db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').run(convId, 'assistant', answer)

  logAction('追问AI完成', `conversationId=${convId}`)

  return NextResponse.json({ answer })
}

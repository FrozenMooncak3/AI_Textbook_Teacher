import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getClaudeClient, CLAUDE_MODEL } from '@/lib/claude'
import { logAction } from '@/lib/log'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { tmpdir } from 'os'

const execFileAsync = promisify(execFile)

async function ocrImage(imagePath: string): Promise<string> {
  const scriptPath = join(process.cwd(), 'scripts', 'ocr_image.py')
  try {
    const { stdout } = await execFileAsync('python', [scriptPath, imagePath], {
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    })
    return stdout.trim()
  } catch {
    return ''
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const { bookId } = await params
  const id = Number(bookId)
  if (isNaN(id)) {
    return NextResponse.json({ error: '无效的书籍 ID', code: 'INVALID_ID' }, { status: 400 })
  }

  const db = getDb()
  const book = db.prepare('SELECT id, title FROM books WHERE id = ?').get(id) as { id: number; title: string } | undefined
  if (!book) {
    return NextResponse.json({ error: '书籍不存在', code: 'NOT_FOUND' }, { status: 404 })
  }

  let body: { imageBase64?: string; pageNumber?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '请求格式错误', code: 'INVALID_BODY' }, { status: 400 })
  }

  const { imageBase64, pageNumber } = body
  if (!imageBase64 || typeof pageNumber !== 'number') {
    return NextResponse.json({ error: '缺少 imageBase64 或 pageNumber', code: 'MISSING_FIELDS' }, { status: 400 })
  }

  logAction('截图问AI', `bookId=${id}，第${pageNumber}页`)

  // base64 → 临时 PNG 文件
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
  const tmpPath = join(tmpdir(), `screenshot_${Date.now()}.png`)
  await writeFile(tmpPath, Buffer.from(base64Data, 'base64'))

  // PaddleOCR 提取文字
  const extractedText = await ocrImage(tmpPath)
  await unlink(tmpPath).catch(() => {})

  // Claude 解读
  const claude = getClaudeClient()
  const userContent = extractedText
    ? `我截取了《${book.title}》第${pageNumber}页的一段内容，OCR识别结果如下：\n\n${extractedText}\n\n请帮我解读这段内容，说明核心概念和重点。`
    : `我截取了《${book.title}》第${pageNumber}页的一段内容（图片无法识别文字），请根据这是一本财务教材，给出通用的阅读建议。`

  let answer = ''
  try {
    const message = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: '你是一位财务教材辅导老师，帮助学生理解教材内容。回答简洁清晰，重点突出。',
      messages: [{ role: 'user', content: userContent }],
    })
    answer = message.content[0].type === 'text' ? message.content[0].text : ''
  } catch (e) {
    logAction('截图问AI失败', String(e), 'error')
    return NextResponse.json({ error: 'AI 服务暂时不可用', code: 'AI_ERROR' }, { status: 500 })
  }

  // 存储对话记录
  const conv = db.prepare(
    'INSERT INTO conversations (book_id, page_number, screenshot_text) VALUES (?, ?, ?)'
  ).run(id, pageNumber, extractedText)
  const conversationId = conv.lastInsertRowid as number

  db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').run(conversationId, 'user', userContent)
  db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').run(conversationId, 'assistant', answer)

  logAction('截图问AI完成', `bookId=${id}，conversationId=${conversationId}`)

  return NextResponse.json({ conversationId, extractedText, answer })
}

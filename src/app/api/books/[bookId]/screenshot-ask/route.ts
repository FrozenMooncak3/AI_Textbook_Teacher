import { NextRequest } from 'next/server'
import { generateText } from 'ai'
import { getDb } from '@/lib/db'
import { getModel, timeout } from '@/lib/ai'
import { UserError, SystemError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'
import { getPrompt } from '@/lib/prompt-templates'
import { normalizeBase64Image } from '@/lib/screenshot-ocr'

interface BookRow {
  id: number
}

interface ScreenshotAskBody {
  image?: unknown
  text?: unknown
  question?: unknown
  pageNumber?: unknown
}

function parseBookId(value: string): number {
  const bookId = Number(value)
  if (!Number.isInteger(bookId) || bookId <= 0) {
    throw new UserError('Invalid book ID', 'INVALID_ID', 400)
  }

  return bookId
}

function parseBody(body: unknown): {
  image: string
  text: string
  question: string
  pageNumber: number
} {
  if (body === null || typeof body !== 'object') {
    throw new UserError('Invalid request body', 'INVALID_BODY', 400)
  }

  const parsed = body as ScreenshotAskBody
  const image = typeof parsed.image === 'string' ? normalizeBase64Image(parsed.image) : ''
  const text = typeof parsed.text === 'string' ? parsed.text.trim() : ''
  const question = typeof parsed.question === 'string' ? parsed.question.trim() : ''
  const pageNumber = typeof parsed.pageNumber === 'number' && Number.isInteger(parsed.pageNumber)
    ? parsed.pageNumber
    : 0

  if (!image || !question) {
    throw new UserError('image and question are required', 'MISSING_FIELDS', 400)
  }

  return { image, text, question, pageNumber }
}

const SCREENSHOT_ASK_SYSTEM_PROMPT = `你是一个教材学习助手。用户会给你一段教材内容（文字+截图），并提出问题。
规则：
1. 只根据提供的内容回答，不要编造内容之外的信息
2. 用与教材内容相同的语言回答（中文内容用中文，英文内容用英文）
3. 回答要清晰、有条理，使用 Markdown 格式`

export const POST = handleRoute(async (req: NextRequest, context) => {
  const { bookId: rawBookId } = await context!.params
  const bookId = parseBookId(rawBookId)
  const db = getDb()

  const book = db.prepare('SELECT id FROM books WHERE id = ?').get(bookId) as BookRow | undefined
  if (!book) {
    throw new UserError('Book not found', 'NOT_FOUND', 404)
  }

  const body = parseBody(await req.json())
  logAction('screenshot_ask_started', `bookId=${bookId}, page=${body.pageNumber}`)

  const userPrompt = getPrompt('assistant', 'screenshot_qa', {
    screenshot_text: body.text || '(无文字识别结果)',
    user_question: body.question,
    conversation_history: '',
  })

  let answer = ''
  try {
    const result = await generateText({
      model: getModel(),
      maxOutputTokens: 8192,
      system: SCREENSHOT_ASK_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              image: Buffer.from(body.image, 'base64'),
              mediaType: 'image/png',
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
      abortSignal: AbortSignal.timeout(timeout),
    })

    answer = result.text
  } catch (error) {
    logAction('screenshot_ask_failed', String(error), 'error')
    throw new SystemError('AI service unavailable', error)
  }

  const conversation = db
    .prepare('INSERT INTO conversations (book_id, page_number, screenshot_text) VALUES (?, ?, ?)')
    .run(bookId, body.pageNumber, body.text)
  const conversationId = Number(conversation.lastInsertRowid)

  db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').run(
    conversationId,
    'user',
    body.question
  )
  db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').run(
    conversationId,
    'assistant',
    answer
  )

  logAction('screenshot_ask_completed', `bookId=${bookId}, conversationId=${conversationId}`)

  return {
    data: {
      conversationId,
      answer,
    },
  }
})

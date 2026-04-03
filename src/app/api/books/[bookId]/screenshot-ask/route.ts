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

const SCREENSHOT_ASK_SYSTEM_PROMPT = `你是一位专业的教材学习导师。用户会给你一段教材内容（文字+截图），并提出问题。
你的职责：
1. 以教材内容为基础，结合你自身的专业知识，帮助学生真正理解概念。不要只复述教材原文，要解释“为什么”，用类比、举例、对比等方式让学生彻底搞懂。
2. 如果教材内容不够详细或学生的问题超出截图范围，主动补充必要的背景知识和解释。
3. 用与教材内容相同的语言回答（中文内容用中文，英文内容用英文）。
4. 回答要清晰、有条理，使用 Markdown 格式。适当使用加粗、列表、分步骤等让回答易读。
5. 如果学生的问题比较简单，简洁回答即可，不要过度展开。如果问题涉及复杂概念，则深入讲解。`

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

import { NextRequest } from 'next/server'
import { generateText } from 'ai'
import { queryOne, run, insert } from '@/lib/db'
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

const SCREENSHOT_ASK_SYSTEM_PROMPT = `你是一位专业的教材学习导师。

基于教材内容和截图回答学生问题，不要只复述原文，要解释清楚原因、概念和解题思路。
如果教材片段不足以回答问题，可以补充必要的背景知识，但要优先围绕教材语境。
使用与教材相同的语言回答，并使用清晰的 Markdown 排版。
简单问题简洁作答，复杂问题分步骤讲解。`

export const POST = handleRoute(async (req: NextRequest, context) => {
  const { bookId: rawBookId } = await context!.params
  const bookId = parseBookId(rawBookId)

  const book = await queryOne<BookRow>('SELECT id FROM books WHERE id = $1', [bookId])
  if (!book) {
    throw new UserError('Book not found', 'NOT_FOUND', 404)
  }

  const body = parseBody(await req.json())
  await logAction('screenshot_ask_started', `bookId=${bookId}, page=${body.pageNumber}`)

  const userPrompt = await getPrompt('assistant', 'screenshot_qa', {
    screenshot_text: body.text || '(鏃犳枃瀛楄瘑鍒粨鏋?',
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
    await logAction('screenshot_ask_failed', String(error), 'error')
    throw new SystemError('AI service unavailable', error)
  }

  const conversationId = await insert(
    'INSERT INTO conversations (book_id, page_number, screenshot_text) VALUES ($1, $2, $3)',
    [bookId, body.pageNumber, body.text]
  )

  await run('INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)', [
    conversationId,
    'user',
    body.question,
  ])
  await run('INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)', [
    conversationId,
    'assistant',
    answer,
  ])

  await logAction('screenshot_ask_completed', `bookId=${bookId}, conversationId=${conversationId}`)

  return {
    data: {
      conversationId,
      answer,
    },
  }
})

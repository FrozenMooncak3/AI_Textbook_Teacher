import { NextRequest } from 'next/server'
import { generateText } from 'ai'
import { requireBookOwner } from '@/lib/auth'
import { insert, queryOne, run } from '@/lib/db'
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

const SCREENSHOT_ASK_SYSTEM_PROMPT = `浣犳槸涓€浣嶄笓涓氱殑鏁欐潗瀛︿範瀵煎笀銆?鍩轰簬鏁欐潗鎴浘鍜岃瘑鍒枃鏈洖绛斿鐢熼棶棰橈紝涓嶈鍙噸澶嶅師鏂囷紝瑕佽В閲婂師鍥犮€佹蹇靛拰瑙ｉ鎬濊矾銆?濡傛灉鎴浘鍐呭涓嶈冻浠ュ畬鏁村洖绛旈棶棰橈紝鍙互琛ュ厖蹇呰鑳屾櫙锛屼絾浼樺厛鍥寸粫鏁欐潗璇銆?浣跨敤涓庢暀鏉愪竴鑷寸殑璇█鍥炵瓟锛屽苟鐢ㄦ竻鏅扮殑 Markdown 鎺掔増銆俙`

export const POST = handleRoute(async (req: NextRequest, context) => {
  const { bookId: rawBookId } = await context!.params
  const bookId = parseBookId(rawBookId)

  await requireBookOwner(req, bookId)

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

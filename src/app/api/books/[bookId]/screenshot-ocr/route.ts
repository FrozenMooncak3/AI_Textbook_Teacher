import { requireBookOwner } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { UserError, SystemError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'
import { normalizeBase64Image, ocrImage } from '@/lib/screenshot-ocr'

interface BookRow {
  id: number
}

interface ScreenshotOcrBody {
  imageBase64?: unknown
}

function parseBookId(value: string): number {
  const bookId = Number(value)
  if (!Number.isInteger(bookId) || bookId <= 0) {
    throw new UserError('Invalid book ID', 'INVALID_ID', 400)
  }

  return bookId
}

function parseBody(body: unknown): { imageBase64: string } {
  if (body === null || typeof body !== 'object') {
    throw new UserError('Invalid request body', 'INVALID_BODY', 400)
  }

  const { imageBase64 } = body as ScreenshotOcrBody
  if (typeof imageBase64 !== 'string' || normalizeBase64Image(imageBase64).length === 0) {
    throw new UserError('imageBase64 is required', 'MISSING_FIELDS', 400)
  }

  return { imageBase64 }
}

export const POST = handleRoute(async (req, context) => {
  const { bookId: rawBookId } = await context!.params
  const bookId = parseBookId(rawBookId)

  await requireBookOwner(req, bookId)

  const book = await queryOne<BookRow>('SELECT id FROM books WHERE id = $1', [bookId])
  if (!book) {
    throw new UserError('Book not found', 'NOT_FOUND', 404)
  }

  const { imageBase64 } = parseBody(await req.json())
  const normalizedBase64 = normalizeBase64Image(imageBase64)
  const imageBuffer = Buffer.from(normalizedBase64, 'base64')

  let ocrResult
  try {
    ocrResult = await ocrImage(imageBuffer)
  } catch (error) {
    throw new SystemError('Failed to process screenshot OCR request', error)
  }

  await logAction(
    'screenshot_ocr_completed',
    `bookId=${bookId}, confidence=${ocrResult.confidence.toFixed(2)}, chars=${ocrResult.text.trim().length}`
  )

  return {
    data: {
      text: ocrResult.text,
      confidence: ocrResult.confidence,
    },
  }
})

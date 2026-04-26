import { buildOcrHeaders } from '@/lib/ocr-auth'

export interface PptxSlide {
  index: number
  title: string
  body: string
  notes: string
}

export interface PptxParseResult {
  slides: PptxSlide[]
  slideCount: number
  rawText: string
}

interface PptxParseRawResponse {
  slides: PptxSlide[]
  slide_count: number
  raw_text: string
}

export async function parsePptx(
  objectKey: string,
  bookId: number
): Promise<PptxParseResult> {
  const ocrBase = process.env.OCR_SERVER_URL || 'http://127.0.0.1:8000'
  const url = `${ocrBase}/parse-pptx`
  const headers = await buildOcrHeaders(url)

  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ r2_object_key: objectKey, book_id: bookId }),
    signal: AbortSignal.timeout(60_000),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`parsePptx failed status=${res.status}: ${errBody.slice(0, 500)}`)
  }

  const data = (await res.json()) as PptxParseRawResponse
  return {
    slides: data.slides,
    slideCount: data.slide_count,
    rawText: data.raw_text,
  }
}

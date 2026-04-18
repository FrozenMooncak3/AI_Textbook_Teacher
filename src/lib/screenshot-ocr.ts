import { logAction } from './log'

interface OcrResponseBody {
  text?: string
  confidence?: number
  error?: string
}

export interface OcrResult {
  text: string
  confidence: number
}

export function normalizeBase64Image(image: string): string {
  return image.replace(/^data:image\/\w+;base64,/, '').trim()
}

export function isUsefulOcrText(text: string, confidence: number): boolean {
  const normalized = text.trim()
  if (!normalized || normalized.includes('\uFFFD')) {
    return false
  }

  return confidence >= 0.5 || normalized.length >= 24
}

export async function ocrImage(imageBuffer: Buffer): Promise<OcrResult> {
  const ocrBase = process.env.OCR_SERVER_URL || 'http://127.0.0.1:8000'
  const ocrToken = process.env.OCR_SERVER_TOKEN || ''

  const base64 = imageBuffer.toString('base64')

  try {
    const response = await fetch(`${ocrBase}/ocr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ocrToken}`,
      },
      body: JSON.stringify({ image_base64: base64 }),
      signal: AbortSignal.timeout(60_000),
    })

    const json = (await response.json()) as OcrResponseBody
    if (!response.ok || json.error) {
      await logAction(
        'screenshot_ocr_failed',
        `HTTP ${response.status}: ${json.error ?? 'unknown'}`,
        'error'
      )
      return { text: '', confidence: 0 }
    }

    return {
      text: json.text ?? '',
      confidence: typeof json.confidence === 'number' ? json.confidence : 0,
    }
  } catch (error) {
    await logAction('screenshot_ocr_failed', String(error), 'error')
    return { text: '', confidence: 0 }
  }
}

import http from 'http'
import { logAction } from './log'

const OCR_SERVER_PORT = 9876

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
  if (!normalized || normalized.includes('�')) {
    return false
  }

  return confidence >= 0.5 || normalized.length >= 24
}

export async function ocrImage(imagePath: string): Promise<OcrResult> {
  try {
    return await new Promise<OcrResult>((resolve, reject) => {
      const postData = JSON.stringify({ image_path: imagePath })
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: OCR_SERVER_PORT,
          path: '/ocr',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
          timeout: 60_000,
        },
        (res) => {
          let data = ''

          res.on('data', (chunk: Buffer) => {
            data += chunk.toString()
          })

          res.on('end', () => {
            try {
              const json = JSON.parse(data) as OcrResponseBody
              if (res.statusCode !== 200 || json.error) {
                logAction(
                  'screenshot_ocr_failed',
                  `${imagePath}: ${json.error ?? `HTTP ${res.statusCode}`}`,
                  'error'
                )
                resolve({ text: '', confidence: 0 })
                return
              }

              resolve({
                text: json.text ?? '',
                confidence: typeof json.confidence === 'number' ? json.confidence : 0,
              })
            } catch {
              logAction('screenshot_ocr_failed', `${imagePath}: invalid OCR response`, 'error')
              resolve({ text: '', confidence: 0 })
            }
          })
        }
      )

      req.on('error', (error) => reject(error))
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('OCR request timed out'))
      })
      req.write(postData)
      req.end()
    })
  } catch (error) {
    logAction('screenshot_ocr_failed', `${imagePath}: ${String(error)}`, 'error')
    return { text: '', confidence: 0 }
  }
}

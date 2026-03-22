import { NextRequest, NextResponse } from 'next/server'
import http from 'http'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { getDb } from '@/lib/db'
import { getClaudeClient, CLAUDE_MODEL } from '@/lib/claude'
import { logAction } from '@/lib/log'

const OCR_SERVER_PORT = 9876

interface OcrResult {
  text: string
  confidence: number
}

async function ocrImage(imagePath: string): Promise<OcrResult> {
  try {
    const result = await new Promise<OcrResult>((resolve, reject) => {
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
              const json = JSON.parse(data) as { text?: string; confidence?: number; error?: string }
              if (res.statusCode !== 200 || json.error) {
                logAction('screenshot_ocr_failed', `${imagePath}: ${json.error ?? `HTTP ${res.statusCode}`}`, 'error')
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

    return result
  } catch (error) {
    logAction('screenshot_ocr_failed', `${imagePath}: ${String(error)}`, 'error')
    return { text: '', confidence: 0 }
  }
}

function isUsefulOcrText(text: string, confidence: number): boolean {
  const normalized = text.trim()
  if (!normalized || normalized.includes('�')) {
    return false
  }

  return confidence >= 0.5 || normalized.length >= 24
}

function buildScreenshotPrompt(title: string, pageNumber: number, ocr: OcrResult): string {
  if (isUsefulOcrText(ocr.text, ocr.confidence)) {
    return [
      `You are helping a student read "${title}" on page ${pageNumber}.`,
      'Use the screenshot image as the primary source of truth.',
      'The OCR text below is supplemental context and may contain mistakes.',
      `OCR text:\n${ocr.text}`,
      'Explain the passage, identify the main concept, and point out what the student should focus on.',
    ].join('\n\n')
  }

  return [
    `You are helping a student read "${title}" on page ${pageNumber}.`,
    'Use the screenshot image itself as the source of truth.',
    'The OCR result was empty or unreliable, so do not say that the image cannot be recognized.',
    'Instead, explain what is visible in the screenshot, summarize the likely topic, and call out any terms or formulas you can identify.',
  ].join('\n\n')
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const { bookId } = await params
  const id = Number(bookId)
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: 'Invalid book ID', code: 'INVALID_ID' }, { status: 400 })
  }

  const db = getDb()
  const book = db.prepare('SELECT id, title FROM books WHERE id = ?').get(id) as { id: number; title: string } | undefined
  if (!book) {
    return NextResponse.json({ error: 'Book not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  let body: { imageBase64?: string; pageNumber?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const { imageBase64, pageNumber } = body
  if (!imageBase64 || typeof pageNumber !== 'number') {
    return NextResponse.json({ error: 'Missing imageBase64 or pageNumber', code: 'MISSING_FIELDS' }, { status: 400 })
  }

  logAction('screenshot_ask_started', `bookId=${id}, page=${pageNumber}`)

  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
  const tmpPath = join(tmpdir(), `screenshot_${Date.now()}.png`)
  await writeFile(tmpPath, Buffer.from(base64Data, 'base64'))

  const ocr = await ocrImage(tmpPath)
  await unlink(tmpPath).catch(() => {})

  if (!isUsefulOcrText(ocr.text, ocr.confidence)) {
    logAction(
      'screenshot_ocr_low_confidence',
      `bookId=${id}, page=${pageNumber}, confidence=${ocr.confidence.toFixed(2)}, chars=${ocr.text.trim().length}`,
      'warn'
    )
  }

  const userPrompt = buildScreenshotPrompt(book.title, pageNumber, ocr)

  const claude = getClaudeClient()
  let answer = ''
  try {
    const message = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system:
        'You are a patient textbook tutor. Explain the selected screenshot clearly, focus on the visible content, and avoid claiming failure when the image contains usable information.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
    })

    answer = message.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .filter(Boolean)
      .join('\n\n')
  } catch (error) {
    logAction('screenshot_ask_failed', String(error), 'error')
    return NextResponse.json({ error: 'AI service unavailable', code: 'AI_ERROR' }, { status: 500 })
  }

  const conv = db
    .prepare('INSERT INTO conversations (book_id, page_number, screenshot_text) VALUES (?, ?, ?)')
    .run(id, pageNumber, ocr.text)
  const conversationId = conv.lastInsertRowid as number

  db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').run(conversationId, 'user', userPrompt)
  db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').run(conversationId, 'assistant', answer)

  logAction('screenshot_ask_completed', `bookId=${id}, conversationId=${conversationId}`)

  return NextResponse.json({ conversationId, extractedText: ocr.text, answer })
}

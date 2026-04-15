import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { insert, query, run } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'
import { buildObjectKey, uploadPdf } from '@/lib/r2-client'
import { triggerReadyModulesExtraction } from '@/lib/services/kp-extraction-service'
import { chunkText } from '@/lib/text-chunker'

interface BookListRow {
  id: number
  title: string
  parse_status: string
  created_at: string
}

export const GET = handleRoute(async (req) => {
  const user = await requireUser(req)
  const books = await query<BookListRow>(
    `
      SELECT id, title, parse_status, created_at
      FROM books
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
    [user.id]
  )
  return { data: books }
})

export async function POST(req: NextRequest) {
  let userId = 0
  try {
    const user = await requireUser(req)
    userId = user.id
  } catch (error) {
    if (error instanceof UserError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }

    throw error
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const title = formData.get('title') as string | null

  if (!file) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Missing title' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !['pdf', 'txt'].includes(ext)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 422 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  await logAction('book_upload_started', `file=${file.name}, title=${title}`)

  if (ext === 'txt') {
    const rawText = buffer.toString('utf-8').trim()
    if (rawText.length < 100) {
      await logAction('book_upload_short_text', `chars=${rawText.length}`, 'warn')
      return NextResponse.json({ error: 'Text file content is too short' }, { status: 422 })
    }

    const bookId = await insert(
      'INSERT INTO books (user_id, title, raw_text, parse_status) VALUES ($1, $2, $3, $4)',
      [userId, title.trim(), rawText, 'done']
    )

    await logAction('book_upload_completed_txt', `bookId=${bookId}, chars=${rawText.length}`)
    return NextResponse.json({ bookId }, { status: 201 })
  }

  const bookId = await insert(
    'INSERT INTO books (user_id, title, raw_text, parse_status) VALUES ($1, $2, $3, $4)',
    [userId, title.trim(), '', 'processing']
  )

  const r2ObjectKey = buildObjectKey(bookId)
  await uploadPdf(bookId, buffer)

  const markOcrFailure = async (details: string) => {
    try {
      await run("UPDATE books SET parse_status = 'error' WHERE id = $1", [bookId])
    } catch {
      // Ignore update failures while surfacing OCR failures.
    }

    try {
      await logAction('book_ocr_failed', `bookId=${bookId}, ${details}`, 'error')
    } catch {
      // Ignore logging failures in background OCR paths.
    }
  }

  const ocrHost = process.env.OCR_SERVER_HOST || '127.0.0.1'
  const ocrPort = process.env.OCR_SERVER_PORT || '8000'
  const ocrBase = `http://${ocrHost}:${ocrPort}`

  try {
    const classifyRes = await fetch(`${ocrBase}/classify-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf_path: r2ObjectKey, book_id: bookId }),
    })
    if (!classifyRes.ok) {
      await markOcrFailure(`classify-pdf HTTP ${classifyRes.status}`)
      return NextResponse.json({ bookId, processing: true }, { status: 201 })
    }

    const classifyJson = (await classifyRes.json()) as {
      text_count: number
      scanned_count: number
      mixed_count: number
    }
    const { text_count, scanned_count, mixed_count } = classifyJson
    const nonTextPages = scanned_count + mixed_count

    const extractRes = await fetch(`${ocrBase}/extract-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf_path: r2ObjectKey, book_id: bookId }),
    })
    if (!extractRes.ok) {
      await markOcrFailure(`extract-text HTTP ${extractRes.status}`)
      return NextResponse.json({ bookId, processing: true }, { status: 201 })
    }

    const extractJson = (await extractRes.json()) as { text: string }
    const rawText = extractJson.text ?? ''

    if (rawText) {
      const chunks = chunkText(rawText)
      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index]
        await insert(
          `INSERT INTO modules (book_id, title, order_index, page_start, page_end, text_status, ocr_status, kp_extraction_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            bookId,
            chunk.title,
            index,
            chunk.pageStart,
            chunk.pageEnd,
            'ready',
            nonTextPages > 0 ? 'pending' : 'skipped',
            'pending',
          ]
        )
      }
    }

    if (nonTextPages > 0) {
      void fetch(`${ocrBase}/ocr-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf_path: r2ObjectKey, book_id: bookId }),
      })
        .then(async (response) => {
          if (response.ok) {
            return
          }

          const responseText = await response.text().catch(() => '')
          const failureDetails = responseText.trim()
            ? `ocr-pdf HTTP ${response.status}: ${responseText.trim().slice(0, 500)}`
            : `ocr-pdf HTTP ${response.status}`

          await markOcrFailure(failureDetails)
        })
        .catch(async (error) => {
          await markOcrFailure(`ocr-pdf call failed: ${String(error)}`)
        })
    } else {
      await run("UPDATE books SET parse_status = 'done' WHERE id = $1", [bookId])
    }

    void triggerReadyModulesExtraction(bookId).catch(async (error) => {
      await logAction('triggerReadyModulesExtraction error', `bookId=${bookId}: ${String(error)}`, 'error')
    })

    await logAction(
      'book_upload_classified',
      `bookId=${bookId}, text=${text_count}, scanned=${scanned_count}, mixed=${mixed_count}`
    )
    return NextResponse.json({ bookId, processing: true }, { status: 201 })
  } catch (error) {
    await markOcrFailure(`upload flow error: ${String(error)}`)
    return NextResponse.json({ bookId, processing: true }, { status: 201 })
  }
}

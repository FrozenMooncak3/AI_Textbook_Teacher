import { insert, run } from '@/lib/db'
import { logAction } from '@/lib/log'
import { buildOcrHeaders } from '@/lib/ocr-auth'
import { retryWithBackoff } from '@/lib/retry'
import { triggerReadyModulesExtraction } from '@/lib/services/kp-extraction-service'
import { chunkText } from '@/lib/text-chunker'

interface ClassificationPage {
  page: number
  type: string
}

interface ClassifyResponse {
  pages: ClassificationPage[]
  text_count: number
  scanned_count: number
  mixed_count: number
  total_pages: number
}

interface ExtractResponse {
  text: string
  page_count: number
}

async function markOcrFailure(bookId: number, details: string): Promise<void> {
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

export async function runClassifyAndExtract(
  bookId: number,
  r2ObjectKey: string
): Promise<void> {
  const ocrBase = process.env.OCR_SERVER_URL || 'http://127.0.0.1:8000'

  try {
    const classifyUrl = `${ocrBase}/classify-pdf`
    const classifyRes = await retryWithBackoff(
      async () => fetch(classifyUrl, {
        method: 'POST',
        headers: await buildOcrHeaders(classifyUrl),
        body: JSON.stringify({ r2_object_key: r2ObjectKey, book_id: bookId }),
        signal: AbortSignal.timeout(30_000),
      }),
      { maxAttempts: 2, baseMs: 1000 }
    )

    if (!classifyRes.ok) {
      await markOcrFailure(bookId, `classify-pdf HTTP ${classifyRes.status}`)
      return
    }

    const classifyJson = await classifyRes.json() as ClassifyResponse
    const { pages, text_count, scanned_count, mixed_count, total_pages } = classifyJson
    const nonTextPages = scanned_count + mixed_count

    await run(
      `UPDATE books SET
         page_classifications = $1,
         text_pages_count = $2,
         scanned_pages_count = $3,
         ocr_total_pages = $4
       WHERE id = $5`,
      [JSON.stringify(pages), text_count, nonTextPages, total_pages, bookId]
    )

    const extractUrl = `${ocrBase}/extract-text`
    const extractRes = await retryWithBackoff(
      async () => fetch(extractUrl, {
        method: 'POST',
        headers: await buildOcrHeaders(extractUrl),
        body: JSON.stringify({
          r2_object_key: r2ObjectKey,
          book_id: bookId,
          classifications: pages,
        }),
        signal: AbortSignal.timeout(30_000),
      }),
      { maxAttempts: 2, baseMs: 1000 }
    )

    if (!extractRes.ok) {
      await markOcrFailure(bookId, `extract-text HTTP ${extractRes.status}`)
      return
    }

    const extractJson = await extractRes.json() as ExtractResponse
    const rawText = extractJson.text ?? ''

    if (rawText) {
      await run('UPDATE books SET raw_text = $1 WHERE id = $2', [rawText, bookId])

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
      const ocrPdfUrl = `${ocrBase}/ocr-pdf`
      const ocrPdfHeaders = await buildOcrHeaders(ocrPdfUrl)
      void fetch(ocrPdfUrl, {
        method: 'POST',
        headers: ocrPdfHeaders,
        body: JSON.stringify({
          r2_object_key: r2ObjectKey,
          book_id: bookId,
          classifications: pages,
        }),
        signal: AbortSignal.timeout(30_000),
      })
        .then(async (response) => {
          if (response.ok) {
            return
          }

          const responseText = await response.text().catch(() => '')
          const failureDetails = responseText.trim()
            ? `ocr-pdf HTTP ${response.status}: ${responseText.trim().slice(0, 500)}`
            : `ocr-pdf HTTP ${response.status}`

          await markOcrFailure(bookId, failureDetails)
        })
        .catch(async (error) => {
          await markOcrFailure(bookId, `ocr-pdf call failed: ${String(error)}`)
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
  } catch (error) {
    await markOcrFailure(bookId, `upload flow error: ${String(error)}`)
  }
}

import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { after } from 'next/server'
import { z } from 'zod'
import { PDFParse } from 'pdf-parse'
import { requireUser } from '@/lib/auth'
import { insert, queryOne, run } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'
import { parsePptx } from '@/lib/pptx-parse'
import {
  buildObjectKey,
  getR2Bucket,
  getR2Client,
  getR2ObjectBuffer,
} from '@/lib/r2-client'
import { runClassifyAndExtract } from '@/lib/upload-flow'
import { computePdfMd5FromR2 } from '@/lib/pdf-md5'
import { triggerReadyModulesExtraction } from '@/lib/services/kp-extraction-service'
import { AI_MODEL_ID } from '@/lib/ai'
import { estimateBookCostYuan, assertWithinBookBudget } from '@/lib/services/cost-estimator'
import { applyCacheToBook, lookupCache } from '@/lib/services/kp-cache-service'
import { consumeQuotaAndLogUpload } from '@/lib/services/quota-service'
import { chunkText } from '@/lib/text-chunker'

const MAX_PAGES = 100
const MAX_PPTX_SLIDES = 200
const PDF_CONTENT_TYPE = 'application/pdf'
const PPTX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'

const RequestSchema = z.object({
  bookId: z.number().int().positive(),
  title: z.string().trim().min(1).max(255),
  contentType: z.enum([PDF_CONTENT_TYPE, PPTX_CONTENT_TYPE]),
})

interface BookRow {
  id: number
  user_id: number
  upload_status: string
  parse_status: string
  file_size: string
}

export const POST = handleRoute(async (req) => {
  const user = await requireUser(req)
  const body: unknown = await req.json()
  const parsed = RequestSchema.safeParse(body)

  if (!parsed.success) {
    throw new UserError(
      parsed.error.issues[0]?.message ?? 'Invalid request',
      'INVALID_REQUEST',
      400
    )
  }

  const { bookId, title, contentType } = parsed.data
  const book = await queryOne<BookRow>(
    `SELECT id, user_id, upload_status, parse_status, file_size
     FROM books
     WHERE id = $1 AND user_id = $2`,
    [bookId, user.id]
  )

  if (!book) {
    throw new UserError('Book not found', 'NOT_FOUND', 404)
  }

  if (book.upload_status === 'confirmed') {
    if (book.parse_status === 'error') {
      await logAction('book_confirm_already_failed', `bookId=${bookId}`, 'error')
      throw new UserError('上一次处理失败，请删除书重新上传', 'PROCESSING_FAILED', 409)
    }

    return { data: { bookId, processing: true } }
  }

  const objectKey = buildObjectKey(bookId, contentType)
  await verifyR2HeadObject(objectKey, Number(book.file_size), bookId)
  const fileMd5 = await computePdfMd5FromR2(objectKey)

  if (contentType === PDF_CONTENT_TYPE) {
    return handlePdfConfirm({
      bookId,
      userId: user.id,
      objectKey,
      title,
      fileMd5,
    })
  }

  return handlePptxConfirm({
    bookId,
    userId: user.id,
    objectKey,
    title,
    fileMd5,
  })
})

async function handlePdfConfirm({
  bookId,
  userId,
  objectKey,
  title,
  fileMd5,
}: {
  bookId: number
  userId: number
  objectKey: string
  title: string
  fileMd5: string
}) {
  const buffer = await getR2ObjectBuffer(objectKey)
  const parser = new PDFParse({ data: buffer })

  let pageCount = 0
  let extractedText = ''
  try {
    const parsed = await parser.getText()
    pageCount = parsed.total
    extractedText = parsed.text
  } finally {
    await parser.destroy()
  }

  if (pageCount > MAX_PAGES) {
    throw new UserError(`PDF 页数 ${pageCount} 超过 100 页上限`, 'TOO_MANY_PAGES', 400)
  }

  const textRatio = extractedText.trim().length / Math.max(pageCount, 1)
  if (textRatio < 50) {
    throw new UserError(
      '检测到这是扫描版 PDF，目前仅支持文字版 PDF',
      'SCANNED_PDF_REJECTED',
      400
    )
  }

  const cache = await lookupCache(fileMd5, pageCount, 'zh')
  if (cache.hit) {
    await run(
      `UPDATE books
       SET file_md5 = $1,
           cache_hit = TRUE,
           upload_status = 'confirmed',
           title = $2
       WHERE id = $3`,
      [fileMd5, title, bookId]
    )
    await applyCacheToBook(bookId, cache.payload, fileMd5)

    const consumed = await consumeQuotaAndLogUpload(userId, bookId)
    if (!consumed) {
      throw new UserError('额度同时被消耗，请刷新页面重试', 'QUOTA_RACE', 409)
    }

    await logAction('book_confirmed_cache_hit', `bookId=${bookId}, md5=${fileMd5}`)
    return { data: { bookId, processing: false, cacheHit: true } }
  }

  const estimateYuan = estimateBookCostYuan(pageCount, AI_MODEL_ID)
  assertWithinBookBudget(estimateYuan)

  const updateResult = await run(
    `UPDATE books
     SET file_md5 = $1,
         upload_status = 'confirmed',
         parse_status = 'processing',
         title = $2
     WHERE id = $3 AND upload_status = 'pending'`,
    [fileMd5, title, bookId]
  )

  if ((updateResult.rowCount ?? 0) === 0) {
    return { data: { bookId, processing: true } }
  }

  const consumed = await consumeQuotaAndLogUpload(userId, bookId)
  if (!consumed) {
    throw new UserError('额度同时被消耗，请刷新页面重试', 'QUOTA_RACE', 409)
  }

  after(async () => {
    try {
      await runClassifyAndExtract(bookId, objectKey)
    } catch (error) {
      await logAction('runClassifyAndExtract unhandled', `bookId=${bookId}: ${String(error)}`, 'error')
    }
  })

  await logAction(
    'book_confirmed_pdf',
    `bookId=${bookId}, md5=${fileMd5}, pages=${pageCount}, est=${estimateYuan}`
  )

  return { data: { bookId, processing: true } }
}

async function handlePptxConfirm({
  bookId,
  userId,
  objectKey,
  title,
  fileMd5,
}: {
  bookId: number
  userId: number
  objectKey: string
  title: string
  fileMd5: string
}) {
  const { slideCount, rawText: parsedRawText } = await parsePptx(objectKey, bookId)
  const rawText = parsedRawText.replace(/^--- SLIDE (\d+) ---$/gm, '--- PAGE $1 ---')

  if (slideCount > MAX_PPTX_SLIDES) {
    throw new UserError(
      `PPT 张数 ${slideCount} 超过 ${MAX_PPTX_SLIDES} 张上限`,
      'TOO_MANY_SLIDES',
      400
    )
  }

  const cache = await lookupCache(fileMd5, slideCount, 'zh')
  if (cache.hit) {
    await run(
      `UPDATE books
       SET file_md5 = $1,
           cache_hit = TRUE,
           upload_status = 'confirmed',
           title = $2,
           raw_text = $3
       WHERE id = $4`,
      [fileMd5, title, rawText, bookId]
    )
    await applyCacheToBook(bookId, cache.payload, fileMd5)

    const consumed = await consumeQuotaAndLogUpload(userId, bookId)
    if (!consumed) {
      throw new UserError('额度同时被消耗，请刷新页面重试', 'QUOTA_RACE', 409)
    }

    await logAction(
      'book_confirmed_pptx_cache_hit',
      `bookId=${bookId}, md5=${fileMd5}, slides=${slideCount}`
    )
    return { data: { bookId, processing: false, cacheHit: true } }
  }

  const updateResult = await run(
    `UPDATE books
     SET file_md5 = $1,
         upload_status = 'confirmed',
         parse_status = 'done',
         title = $2,
         raw_text = $3
     WHERE id = $4 AND upload_status = 'pending'`,
    [fileMd5, title, rawText, bookId]
  )

  if ((updateResult.rowCount ?? 0) === 0) {
    return { data: { bookId, processing: true } }
  }

  const consumed = await consumeQuotaAndLogUpload(userId, bookId)
  if (!consumed) {
    throw new UserError('额度同时被消耗，请刷新页面重试', 'QUOTA_RACE', 409)
  }

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
        'skipped',
        'pending',
      ]
    )
  }

  after(async () => {
    try {
      await triggerReadyModulesExtraction(bookId)
    } catch (err) {
      await logAction('pptx_kp_trigger_failed', `bookId=${bookId}: ${String(err)}`, 'error')
    }
  })

  await logAction(
    'book_confirmed_pptx',
    `bookId=${bookId}, md5=${fileMd5}, slides=${slideCount}`
  )

  return { data: { bookId, processing: true } }
}

async function verifyR2HeadObject(objectKey: string, expectedSize: number, bookId: number) {
  const client = getR2Client()
  const bucket = getR2Bucket()

  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }))
    const actualSize = head.ContentLength ?? 0

    if (expectedSize > 0 && actualSize !== expectedSize) {
      await logAction(
        'book_upload_size_mismatch',
        `bookId=${bookId}, expected=${expectedSize}, actual=${actualSize}`,
        'error'
      )
      throw new UserError('Upload size mismatch', 'UPLOAD_INCOMPLETE', 400)
    }
  } catch (error) {
    if (error instanceof UserError) {
      throw error
    }

    await logAction('book_upload_missing_object', `bookId=${bookId}, err=${String(error)}`, 'error')
    throw new UserError('Upload not found in storage', 'UPLOAD_INCOMPLETE', 400)
  }
}

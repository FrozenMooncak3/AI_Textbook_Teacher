import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { queryOne, run } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'
import { buildObjectKey } from '@/lib/r2-client'
import { runClassifyAndExtract } from '@/lib/upload-flow'

const RequestSchema = z.object({
  bookId: z.number().int().positive(),
  title: z.string().trim().min(1).max(255),
})

interface BookRow {
  id: number
  user_id: number
  upload_status: string
  parse_status: string
  file_size: number
}

interface R2Config {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}

let cachedClient: S3Client | null = null

function readR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('R2 env vars missing: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET all required')
  }

  return { accountId, accessKeyId, secretAccessKey, bucket }
}

function getR2Client(): S3Client {
  if (cachedClient) {
    return cachedClient
  }

  const { accountId, accessKeyId, secretAccessKey } = readR2Config()
  cachedClient = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  })

  return cachedClient
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

  const { bookId, title } = parsed.data
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

  const objectKey = buildObjectKey(bookId)
  const { bucket } = readR2Config()

  try {
    const headResult = await getR2Client().send(
      new HeadObjectCommand({ Bucket: bucket, Key: objectKey })
    )
    const actualSize = headResult.ContentLength ?? 0

    if (book.file_size > 0 && actualSize !== book.file_size) {
      await logAction(
        'book_upload_size_mismatch',
        `bookId=${bookId}, expected=${book.file_size}, actual=${actualSize}`,
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

  const updateResult = await run(
    `UPDATE books
     SET upload_status = 'confirmed', parse_status = 'processing', title = $1
     WHERE id = $2 AND upload_status = 'pending'`,
    [title, bookId]
  )

  if ((updateResult.rowCount ?? 0) === 0) {
    return { data: { bookId, processing: true } }
  }

  void runClassifyAndExtract(bookId, objectKey).catch(async (error) => {
    await logAction('runClassifyAndExtract unhandled', `bookId=${bookId}: ${String(error)}`, 'error')
  })

  await logAction('book_confirmed', `bookId=${bookId}, title="${title}"`)

  return { data: { bookId, processing: true } }
})

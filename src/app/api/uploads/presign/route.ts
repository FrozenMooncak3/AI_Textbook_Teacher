import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { insert } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'
import { buildPresignedPutUrl } from '@/lib/r2-client'

const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024

const RequestSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  size: z.number().int().positive().max(MAX_PDF_SIZE_BYTES),
  contentType: z.literal('application/pdf'),
})

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

  const { filename, size } = parsed.data

  const bookId = await insert(
    `INSERT INTO books (
       user_id,
       title,
       raw_text,
       parse_status,
       kp_extraction_status,
       upload_status,
       file_size
     )
     VALUES ($1, $2, '', 'pending', 'pending', 'pending', $3)
     RETURNING id`,
    [user.id, filename, size]
  )

  const { uploadUrl, objectKey } = await buildPresignedPutUrl(bookId)

  await logAction(
    'book_presign_issued',
    `bookId=${bookId}, filename=${filename}, size=${size}`
  )

  return {
    data: {
      bookId,
      uploadUrl,
      objectKey,
    },
  }
})

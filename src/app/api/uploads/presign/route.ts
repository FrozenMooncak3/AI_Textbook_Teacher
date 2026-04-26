import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { insert } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'
import { buildPresignedPutUrl } from '@/lib/r2-client'
import { isBudgetExceeded } from '@/lib/services/cost-meter-service'
import { checkQuotaAndRateLimit } from '@/lib/services/quota-service'

// D0 lock: 10 MB
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const PDF_CONTENT_TYPE = 'application/pdf'
const PPTX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'

const RequestSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  size: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
  contentType: z.enum([PDF_CONTENT_TYPE, PPTX_CONTENT_TYPE]),
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

  const { filename, size, contentType } = parsed.data

  const quotaCheck = await checkQuotaAndRateLimit(user.id)
  if (!quotaCheck.ok) {
    if (quotaCheck.reason === 'quota_exceeded') {
      throw new UserError('上传额度已用完，邀请好友可获取 +1 本额度', 'QUOTA_EXCEEDED', 403)
    }
    throw new UserError('上传太频繁，1 小时后再试', 'RATE_LIMIT_1H', 429)
  }

  if (await isBudgetExceeded()) {
    throw new UserError(
      '本月预算已用完，请下月再试或联系我们升级',
      'MONTHLY_BUDGET_EXCEEDED',
      503
    )
  }

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

  const { uploadUrl, objectKey } = await buildPresignedPutUrl(bookId, contentType)

  await logAction(
    'book_presign_issued',
    `bookId=${bookId}, filename=${filename}, size=${size}, contentType=${contentType}`
  )

  return {
    data: {
      bookId,
      uploadUrl,
      objectKey,
    },
  }
})

import { z } from 'zod'
import { run } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'

const RequestSchema = z.object({
  email: z.string().email(),
  rejectReason: z.enum([
    'scanned_pdf',
    'too_large',
    'too_many_pages',
    'too_many_slides',
    'unsupported_type',
  ]),
  bookFilename: z.string().max(255).optional(),
  bookSizeBytes: z.number().int().nonnegative().optional(),
})

export const POST = handleRoute(async (req) => {
  const body: unknown = await req.json()
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    throw new UserError(
      parsed.error.issues[0]?.message ?? 'Invalid request',
      'INVALID_REQUEST',
      400
    )
  }

  const { email, rejectReason, bookFilename, bookSizeBytes } = parsed.data

  await run(
    `INSERT INTO email_collection_list (email, reject_reason, book_filename, book_size_bytes)
     VALUES ($1, $2, $3, $4)`,
    [email, rejectReason, bookFilename ?? null, bookSizeBytes ?? null]
  )

  await logAction('email_collected', `email=${email}, reason=${rejectReason}`)
  return { data: { ok: true } }
})

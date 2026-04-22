import { NextRequest, NextResponse } from 'next/server'
import { query, run } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'
import { triggerReadyModulesExtraction } from '@/lib/services/kp-extraction-service'

interface ProgressEvent {
  event: 'progress'
  book_id: number
  module_id?: number
  pages_done: number
  pages_total: number
}

interface PageResultEvent {
  event: 'page_result'
  book_id: number
  module_id: number
  page_number: number
  text: string
}

interface ModuleCompleteEvent {
  event: 'module_complete'
  book_id: number
  module_id: number
  status: 'success' | 'error'
  error?: string
}

type CallbackEvent = ProgressEvent | PageResultEvent | ModuleCompleteEvent

function requireBearer(req: NextRequest): void {
  const expected = process.env.OCR_SERVER_TOKEN
  if (!expected) {
    throw new Error('OCR_SERVER_TOKEN env var is not configured')
  }
  const header = req.headers.get('authorization') ?? ''
  if (!header.startsWith('Bearer ')) {
    throw new UserError('Missing Bearer token', 'UNAUTHENTICATED', 401)
  }
  const received = header.slice('Bearer '.length).trim()
  if (received !== expected) {
    throw new UserError('Invalid token', 'UNAUTHENTICATED', 401)
  }
}

async function handleProgress(event: ProgressEvent): Promise<void> {
  await run(
    `UPDATE books
       SET ocr_current_page = $1, ocr_total_pages = $2, parse_status = 'processing'
     WHERE id = $3`,
    [event.pages_done, event.pages_total, event.book_id]
  )
}

async function handlePageResult(event: PageResultEvent): Promise<void> {
  const rows = await query<{ raw_text: string | null }>(
    'SELECT raw_text FROM books WHERE id = $1',
    [event.book_id]
  )
  const rawText = rows[0]?.raw_text ?? ''
  const placeholder = `--- PAGE ${event.page_number} ---\n[OCR_PENDING]`
  const replacement = `--- PAGE ${event.page_number} ---\n${event.text}`
  const updated = rawText.replace(placeholder, replacement)
  await run('UPDATE books SET raw_text = $1 WHERE id = $2', [updated, event.book_id])
}

function triggerKpExtraction(bookId: number): void {
  void triggerReadyModulesExtraction(bookId).catch(async (error) => {
    await logAction('triggerReadyModulesExtraction error', `bookId=${bookId}: ${String(error)}`, 'error')
  })
}

async function handleModuleComplete(event: ModuleCompleteEvent): Promise<void> {
  const nextStatus = event.status === 'success' ? 'done' : 'error'

  if (event.module_id === 0) {
    await run(
      "UPDATE modules SET ocr_status = $1 WHERE book_id = $2 AND ocr_status IN ('pending', 'processing')",
      [nextStatus, event.book_id]
    )
    await run(
      `UPDATE books SET parse_status = $1 WHERE id = $2`,
      [event.status === 'success' ? 'done' : 'error', event.book_id]
    )
    if (event.status === 'success') {
      triggerKpExtraction(event.book_id)
      return
    }
    if (event.status === 'error') {
      await logAction(
        'ocr_callback_book_error',
        `bookId=${event.book_id}, error=${(event.error ?? '').slice(0, 500)}`,
        'error'
      )
    }
    return
  }

  await run('UPDATE modules SET ocr_status = $1 WHERE id = $2', [nextStatus, event.module_id])
  if (event.status === 'success') {
    triggerKpExtraction(event.book_id)
  }

  const pendingModules = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM modules
      WHERE book_id = $1 AND ocr_status NOT IN ('done', 'skipped')`,
    [event.book_id]
  )
  if (Number(pendingModules[0]?.count ?? '0') === 0) {
    await run("UPDATE books SET parse_status = 'done' WHERE id = $1", [event.book_id])
  }

  if (event.status === 'error') {
    await logAction(
      'ocr_callback_module_error',
      `bookId=${event.book_id}, moduleId=${event.module_id}, error=${(event.error ?? '').slice(0, 500)}`,
      'error'
    )
  }
}

export const POST = handleRoute(async (req) => {
  requireBearer(req)
  const body = (await req.json()) as CallbackEvent

  switch (body.event) {
    case 'progress':
      await handleProgress(body)
      break
    case 'page_result':
      await handlePageResult(body)
      break
    case 'module_complete':
      await handleModuleComplete(body)
      break
    default:
      throw new UserError('Unknown event type', 'INVALID_EVENT', 400)
  }

  return { data: { ok: true } }
})

import { NextRequest } from 'next/server'
import { requireBookOwner } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'
import {
  extractModule,
  getModuleText,
  triggerReadyModulesExtraction,
} from '@/lib/services/kp-extraction-service'

interface ModuleRow {
  id: number
  title: string
  text_status: string
  ocr_status: string
  kp_extraction_status: string
  page_start: number | null
  page_end: number | null
}

export const POST = handleRoute(async (req: NextRequest, context) => {
  const { bookId } = await context!.params
  const id = Number(bookId)

  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid book ID', 'INVALID_ID', 400)
  }

  await requireBookOwner(req, id)

  const url = new URL(req.url)
  const moduleIdParam = url.searchParams.get('moduleId')

  if (moduleIdParam) {
    const moduleId = Number(moduleIdParam)
    if (!Number.isInteger(moduleId) || moduleId <= 0) {
      throw new UserError('Invalid module ID', 'INVALID_ID', 400)
    }

    const mod = await queryOne<ModuleRow>(
      `
        SELECT id, title, text_status, ocr_status, kp_extraction_status, page_start, page_end
        FROM modules
        WHERE id = $1 AND book_id = $2
      `,
      [moduleId, id]
    )

    if (!mod) {
      throw new UserError('Module not found', 'NOT_FOUND', 404)
    }

    const textReady = (
      mod.text_status === 'ready' &&
      (mod.ocr_status === 'done' || mod.ocr_status === 'skipped')
    )
    if (!textReady) {
      throw new UserError('Module text not ready', 'MODULE_NOT_READY', 409)
    }

    if (mod.kp_extraction_status === 'processing') {
      throw new UserError('Module KP extraction already processing', 'ALREADY_PROCESSING', 409)
    }

    const moduleText = await getModuleText(id, mod.page_start, mod.page_end)
    void extractModule(id, moduleId, moduleText, mod.title).catch(async (error) => {
      await logAction(
        'extract route single-module error',
        `bookId=${id}, moduleId=${moduleId}: ${String(error)}`,
        'error'
      )
    })

    return { data: { status: 'processing', bookId: id, moduleId }, status: 202 }
  }

  void triggerReadyModulesExtraction(id).catch(async (error) => {
    await logAction('extract route all-ready error', `bookId=${id}: ${String(error)}`, 'error')
  })

  return { data: { status: 'processing', bookId: id }, status: 202 }
})

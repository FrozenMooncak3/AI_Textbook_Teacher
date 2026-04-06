import { requireModuleOwner } from '@/lib/auth'
import { insert, query, queryOne, run } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'

interface ReadingNote {
  id: number
  book_id: number
  module_id: number
  page_number: number | null
  content: string
  created_at: string
}

export const GET = handleRoute(async (req, context) => {
  const { moduleId } = await context!.params
  const id = Number(moduleId)

  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid module ID', 'INVALID_ID', 400)
  }

  await requireModuleOwner(req, id)

  const notes = await query<ReadingNote>(
    'SELECT * FROM reading_notes WHERE module_id = $1 ORDER BY created_at ASC',
    [id]
  )

  return { data: { notes } }
})

export const POST = handleRoute(async (req, context) => {
  const { moduleId } = await context!.params
  const id = Number(moduleId)

  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid module ID', 'INVALID_ID', 400)
  }

  await requireModuleOwner(req, id)

  const { content, page_number } = await req.json() as {
    content?: string
    page_number?: number
  }

  if (!content || !content.trim()) {
    throw new UserError('Content is required', 'MISSING_CONTENT', 400)
  }

  const module_ = await queryOne<{ book_id: number }>(
    'SELECT book_id FROM modules WHERE id = $1',
    [id]
  )

  if (!module_) {
    throw new UserError('Module not found', 'NOT_FOUND', 404)
  }

  const normalizedPageNumber = Number.isInteger(page_number) ? page_number : null
  const noteId = await insert(
    'INSERT INTO reading_notes (book_id, module_id, page_number, content) VALUES ($1, $2, $3, $4)',
    [module_.book_id, id, normalizedPageNumber, content.trim()]
  )

  return { data: { id: noteId }, status: 201 }
})

export const DELETE = handleRoute(async (req, context) => {
  const { moduleId } = await context!.params
  const id = Number(moduleId)

  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid module ID', 'INVALID_ID', 400)
  }

  await requireModuleOwner(req, id)

  const url = new URL(req.url)
  const noteId = Number(url.searchParams.get('noteId'))

  if (!Number.isInteger(noteId) || noteId <= 0) {
    throw new UserError('Invalid note ID', 'INVALID_NOTE_ID', 400)
  }

  const result = await run('DELETE FROM reading_notes WHERE id = $1 AND module_id = $2', [noteId, id])
  if ((result.rowCount ?? 0) === 0) {
    throw new UserError('Note not found', 'NOT_FOUND', 404)
  }

  return { data: { deleted: true } }
})

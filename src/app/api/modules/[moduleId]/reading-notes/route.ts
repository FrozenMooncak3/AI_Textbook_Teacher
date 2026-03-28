import { handleRoute } from '@/lib/handle-route'
import { getDb } from '@/lib/db'
import { UserError } from '@/lib/errors'

interface ReadingNote {
  id: number
  book_id: number
  module_id: number
  page_number: number | null
  content: string
  created_at: string
}

export const GET = handleRoute(async (_req, context) => {
  const { moduleId } = await context!.params
  const id = Number(moduleId)

  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid module ID', 'INVALID_ID', 400)
  }

  const db = getDb()
  const notes = db
    .prepare('SELECT * FROM reading_notes WHERE module_id = ? ORDER BY created_at ASC')
    .all(id) as ReadingNote[]

  return { data: { notes } }
})

export const POST = handleRoute(async (req, context) => {
  const { moduleId } = await context!.params
  const id = Number(moduleId)

  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid module ID', 'INVALID_ID', 400)
  }

  const { content, page_number } = await req.json() as {
    content?: string
    page_number?: number
  }

  if (!content || !content.trim()) {
    throw new UserError('Content is required', 'MISSING_CONTENT', 400)
  }

  const db = getDb()
  const module_ = db
    .prepare('SELECT book_id FROM modules WHERE id = ?')
    .get(id) as { book_id: number } | undefined

  if (!module_) {
    throw new UserError('Module not found', 'NOT_FOUND', 404)
  }

  const normalizedPageNumber = Number.isInteger(page_number) ? page_number : null

  const result = db
    .prepare(
      'INSERT INTO reading_notes (book_id, module_id, page_number, content) VALUES (?, ?, ?, ?)'
    )
    .run(module_.book_id, id, normalizedPageNumber, content.trim())

  return { data: { id: result.lastInsertRowid }, status: 201 }
})

export const DELETE = handleRoute(async (req, context) => {
  const { moduleId } = await context!.params
  const id = Number(moduleId)

  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid module ID', 'INVALID_ID', 400)
  }

  const url = new URL(req.url)
  const noteId = Number(url.searchParams.get('noteId'))

  if (!Number.isInteger(noteId) || noteId <= 0) {
    throw new UserError('Invalid note ID', 'INVALID_NOTE_ID', 400)
  }

  const db = getDb()
  const result = db
    .prepare('DELETE FROM reading_notes WHERE id = ? AND module_id = ?')
    .run(noteId, id)

  if (result.changes === 0) {
    throw new UserError('Note not found', 'NOT_FOUND', 404)
  }

  return { data: { deleted: true } }
})

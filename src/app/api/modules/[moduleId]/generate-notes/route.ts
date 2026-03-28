import { handleRoute } from '@/lib/handle-route'
import { getDb } from '@/lib/db'
import { UserError, SystemError } from '@/lib/errors'
import { getPrompt } from '@/lib/prompt-templates'
import { getClaudeClient, CLAUDE_MODEL } from '@/lib/claude'
import { logAction } from '@/lib/log'

interface ModuleRow {
  id: number
  title: string
  learning_status: string
}

interface KnowledgePointRow {
  kp_code: string
  description: string
  type: string
  detailed_content: string
}

interface ReadingNoteRow {
  content: string
}

interface QAResultRow {
  question_text: string
  question_type: string
  correct_answer: string | null
  user_answer: string
  is_correct: number | null
  score: number | null
  ai_feedback: string | null
}

export const POST = handleRoute(async (_req, context) => {
  const { moduleId } = await context!.params
  const id = Number(moduleId)

  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid module ID', 'INVALID_ID', 400)
  }

  const db = getDb()
  const module_ = db
    .prepare('SELECT id, title, learning_status FROM modules WHERE id = ?')
    .get(id) as ModuleRow | undefined

  if (!module_) {
    throw new UserError('Module not found', 'NOT_FOUND', 404)
  }

  if (module_.learning_status === 'notes_generated' || module_.learning_status === 'completed') {
    const existing = db
      .prepare('SELECT * FROM module_notes WHERE module_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(id) as { id: number; content: string; generated_from: string | null } | undefined

    if (existing) {
      return { data: { noteId: existing.id, content: existing.content, cached: true } }
    }
  }

  if (module_.learning_status !== 'qa') {
    throw new UserError('Q&A must be completed before generating notes', 'INVALID_STATUS', 409)
  }

  const totalQ = db
    .prepare('SELECT COUNT(*) as count FROM qa_questions WHERE module_id = ?')
    .get(id) as { count: number }
  const answeredQ = db
    .prepare(`
      SELECT COUNT(*) as count FROM qa_responses r
      JOIN qa_questions q ON q.id = r.question_id
      WHERE q.module_id = ?
    `)
    .get(id) as { count: number }

  if (answeredQ.count < totalQ.count) {
    throw new UserError(
      `Not all questions answered (${answeredQ.count}/${totalQ.count})`,
      'INCOMPLETE_QA',
      409
    )
  }

  const kps = db
    .prepare(`
      SELECT kp_code, description, type, detailed_content
      FROM knowledge_points
      WHERE module_id = ?
    `)
    .all(id) as KnowledgePointRow[]

  const kpTable = kps
    .map((kp) => `- [${kp.kp_code}] (${kp.type}) ${kp.description}: ${kp.detailed_content}`)
    .join('\n')

  const readingNotes = db
    .prepare('SELECT content FROM reading_notes WHERE module_id = ? ORDER BY created_at ASC')
    .all(id) as ReadingNoteRow[]
  const userNotes = readingNotes.length > 0
    ? readingNotes.map((note) => note.content).join('\n---\n')
    : '(No reading notes)'

  const qaResults = db
    .prepare(`
      SELECT q.question_text, q.question_type, q.correct_answer,
             r.user_answer, r.is_correct, r.score, r.ai_feedback
      FROM qa_questions q
      JOIN qa_responses r ON r.question_id = q.id
      WHERE q.module_id = ?
      ORDER BY q.order_index ASC
    `)
    .all(id) as QAResultRow[]

  const qaResultsText = qaResults
    .map(
      (row, index) =>
        `Q${index + 1} (${row.question_type}): ${row.question_text}\nAnswer: ${row.user_answer}\nCorrect: ${row.is_correct ? 'Yes' : 'No'} (score: ${row.score})\nFeedback: ${row.ai_feedback || 'N/A'}`
    )
    .join('\n---\n')

  logAction('Note generation started', `moduleId=${id}`)

  const prompt = getPrompt('coach', 'note_generation', {
    kp_table: kpTable,
    user_notes: userNotes,
    qa_results: qaResultsText,
  })

  const claude = getClaudeClient()
  const message = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const rawContent = message.content[0]
  if (rawContent.type !== 'text') {
    throw new SystemError('Claude returned non-text response')
  }

  const noteContent = rawContent.text.trim()
  const kpCodes = kps.map((kp) => kp.kp_code)
  const generatedFrom = JSON.stringify({
    kp_codes: kpCodes,
    reading_notes: readingNotes.length,
    qa_count: qaResults.length,
  })

  const result = db
    .prepare('INSERT INTO module_notes (module_id, content, generated_from) VALUES (?, ?, ?)')
    .run(id, noteContent, generatedFrom)

  db.prepare('UPDATE modules SET learning_status = ? WHERE id = ?').run('notes_generated', id)

  logAction('Note generation complete', `moduleId=${id}`)

  return { data: { noteId: Number(result.lastInsertRowid), content: noteContent } }
})

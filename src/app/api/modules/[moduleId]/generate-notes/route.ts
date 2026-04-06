import { requireModuleOwner } from '@/lib/auth'
import { generateText } from 'ai'
import { getModel, timeout } from '@/lib/ai'
import { insert, query, queryOne, run } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'
import { getPrompt } from '@/lib/prompt-templates'

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

export const POST = handleRoute(async (req, context) => {
  const { moduleId } = await context!.params
  const id = Number(moduleId)

  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid module ID', 'INVALID_ID', 400)
  }

  await requireModuleOwner(req, id)

  const module_ = await queryOne<ModuleRow>(
    'SELECT id, title, learning_status FROM modules WHERE id = $1',
    [id]
  )

  if (!module_) {
    throw new UserError('Module not found', 'NOT_FOUND', 404)
  }

  if (module_.learning_status === 'notes_generated' || module_.learning_status === 'completed') {
    const existing = await queryOne<{ id: number; content: string; generated_from: string | null }>(
      `
        SELECT id, content, generated_from
        FROM module_notes
        WHERE module_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [id]
    )

    if (existing) {
      return { data: { noteId: existing.id, content: existing.content, cached: true } }
    }
  }

  if (module_.learning_status !== 'qa') {
    throw new UserError('Q&A must be completed before generating notes', 'INVALID_STATUS', 409)
  }

  const totalQ = await queryOne<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM qa_questions WHERE module_id = $1',
    [id]
  )
  const answeredQ = await queryOne<{ count: number }>(
    `
      SELECT COUNT(*)::int AS count
      FROM qa_responses r
      JOIN qa_questions q ON q.id = r.question_id
      WHERE q.module_id = $1
    `,
    [id]
  )

  if ((answeredQ?.count ?? 0) < (totalQ?.count ?? 0)) {
    throw new UserError(
      `Not all questions answered (${answeredQ?.count ?? 0}/${totalQ?.count ?? 0})`,
      'INCOMPLETE_QA',
      409
    )
  }

  const kps = await query<KnowledgePointRow>(
    `
      SELECT kp_code, description, type, detailed_content
      FROM knowledge_points
      WHERE module_id = $1
    `,
    [id]
  )

  const kpTable = kps
    .map((kp) => `- [${kp.kp_code}] (${kp.type}) ${kp.description}: ${kp.detailed_content}`)
    .join('\n')

  const readingNotes = await query<ReadingNoteRow>(
    'SELECT content FROM reading_notes WHERE module_id = $1 ORDER BY created_at ASC',
    [id]
  )
  const userNotes = readingNotes.length > 0
    ? readingNotes.map((note) => note.content).join('\n---\n')
    : '(No reading notes)'

  const qaResults = await query<QAResultRow>(
    `
      SELECT
        q.question_text,
        q.question_type,
        q.correct_answer,
        r.user_answer,
        r.is_correct,
        r.score,
        r.ai_feedback
      FROM qa_questions q
      JOIN qa_responses r ON r.question_id = q.id
      WHERE q.module_id = $1
      ORDER BY q.order_index ASC
    `,
    [id]
  )

  const qaResultsText = qaResults
    .map(
      (row, index) =>
        `Q${index + 1} (${row.question_type}): ${row.question_text}\nAnswer: ${row.user_answer}\nCorrect: ${row.is_correct ? 'Yes' : 'No'} (score: ${row.score})\nFeedback: ${row.ai_feedback || 'N/A'}`
    )
    .join('\n---\n')

  await logAction('Note generation started', `moduleId=${id}`)

  const prompt = await getPrompt('coach', 'note_generation', {
    kp_table: kpTable,
    user_notes: userNotes,
    qa_results: qaResultsText,
  })

  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens: 16384,
    prompt,
    abortSignal: AbortSignal.timeout(timeout),
  })

  const noteContent = text.trim()
  const generatedFrom = JSON.stringify({
    kp_codes: kps.map((kp) => kp.kp_code),
    reading_notes: readingNotes.length,
    qa_count: qaResults.length,
  })

  const noteId = await insert(
    'INSERT INTO module_notes (module_id, content, generated_from) VALUES ($1, $2, $3)',
    [id, noteContent, generatedFrom]
  )

  await run('UPDATE modules SET learning_status = $1 WHERE id = $2', ['notes_generated', id])

  await logAction('Note generation complete', `moduleId=${id}`)

  return { data: { noteId, content: noteContent } }
})

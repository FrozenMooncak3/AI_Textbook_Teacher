import { requireModuleOwner } from '@/lib/auth'
import { generateText } from 'ai'
import { getModel, timeout } from '@/lib/ai'
import { insert, query, queryOne, run } from '@/lib/db'
import { UserError, SystemError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'
import { getPrompt } from '@/lib/prompt-templates'

interface ModuleRow {
  id: number
  book_id: number
  title: string
  learning_status: string
}

interface KP {
  id: number
  kp_code: string
  section_name: string
  description: string
  type: string
  importance: number
  detailed_content: string
}

interface ConversationRow {
  id: number
  screenshot_text: string
  role: string
  content: string
}

interface GeneratedQuestion {
  kp_id: number
  type: string
  text: string
  correct_answer: string
  scaffolding?: string
}

interface InsertedQuestion {
  id: number
  module_id: number
  kp_id: number | null
  question_type: string
  question_text: string
  correct_answer: string | null
  scaffolding: string | null
  order_index: number
}

const VALID_TYPES = new Set([
  'worked_example',
  'scaffolded_mc',
  'short_answer',
  'comparison',
])

export const POST = handleRoute(async (_req, context) => {
  const { moduleId } = await context!.params
  const id = Number(moduleId)

  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid module ID', 'INVALID_ID', 400)
  }

  await requireModuleOwner(_req, id)

  const module_ = await queryOne<ModuleRow>(
    'SELECT id, book_id, title, learning_status FROM modules WHERE id = $1',
    [id]
  )

  if (!module_) {
    throw new UserError('Module not found', 'NOT_FOUND', 404)
  }

  const existingQuestions = await query<InsertedQuestion>(
    `
      SELECT id, module_id, kp_id, question_type, question_text, correct_answer, scaffolding, order_index
      FROM qa_questions
      WHERE module_id = $1
      ORDER BY order_index ASC
    `,
    [id]
  )

  if (module_.learning_status === 'qa' && existingQuestions.length > 0) {
    return { data: { questions: existingQuestions, cached: true } }
  }

  if (module_.learning_status !== 'reading' && module_.learning_status !== 'qa') {
    throw new UserError(
      'Module must be in reading status to generate questions',
      'INVALID_STATUS',
      409
    )
  }

  const kps = await query<KP>(
    `
      SELECT id, kp_code, section_name, description, type, importance, detailed_content
      FROM knowledge_points
      WHERE module_id = $1
    `,
    [id]
  )

  if (kps.length === 0) {
    throw new UserError('No knowledge points found for this module', 'NO_KPS', 409)
  }

  const kpTable = kps
    .map(
      (kp) =>
        `- [${kp.kp_code}] (${kp.type}, importance=${kp.importance}) ${kp.description}\n  Detail: ${kp.detailed_content}`
    )
    .join('\n')

  const notes = await query<{ content: string }>(
    'SELECT content FROM reading_notes WHERE module_id = $1 ORDER BY created_at ASC',
    [id]
  )
  const userNotes = notes.length > 0 ? notes.map((note) => note.content).join('\n---\n') : '(No reading notes)'

  const conversations = await query<ConversationRow>(
    `
      SELECT c.id, c.screenshot_text, m.role, m.content
      FROM conversations c
      JOIN messages m ON m.conversation_id = c.id
      WHERE c.book_id = $1
      ORDER BY c.id ASC, m.id ASC
    `,
    [module_.book_id]
  )

  let qaHistory = '(No screenshot Q&A)'
  if (conversations.length > 0) {
    const grouped = new Map<number, { text: string; messages: string[] }>()

    for (const row of conversations) {
      if (!grouped.has(row.id)) {
        grouped.set(row.id, { text: row.screenshot_text, messages: [] })
      }

      grouped.get(row.id)?.messages.push(`${row.role}: ${row.content}`)
    }

    qaHistory = Array.from(grouped.values())
      .map((group) => `Screenshot: ${group.text}\n${group.messages.join('\n')}`)
      .join('\n---\n')
  }

  const qaRules = `
- Question types: worked_example (for procedural KPs), scaffolded_mc, short_answer, comparison
- For procedural KPs: generate 3 questions in sequence: worked example -> progressive -> independent (Sweller method)
- For other KP types: 1-2 questions per KP, mix of types
- scaffolded_mc questions MUST include a "scaffolding" field with a hint
- Total questions roughly 1-2 per KP (procedural KPs may have 3)
- Output language should match the KP content language
- Do NOT include review questions from other modules
`.trim()

  await logAction('Q&A generation started', `moduleId=${id}, kpCount=${kps.length}`)

  const prompt = await getPrompt('coach', 'qa_generation', {
    qa_rules: qaRules,
    kp_table: kpTable,
    user_notes: userNotes,
    user_qa_history: qaHistory,
    past_mistakes: '(No past mistakes - first learning cycle)',
  })

  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens: 16384,
    prompt,
    abortSignal: AbortSignal.timeout(timeout),
  })

  let generated: { questions: GeneratedQuestion[] }
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    generated = JSON.parse(jsonMatch[0]) as { questions: GeneratedQuestion[] }
    if (!Array.isArray(generated.questions) || generated.questions.length === 0) {
      throw new Error('Empty questions array')
    }
  } catch (err) {
    await logAction('Q&A generation parse error', text.slice(0, 500), 'error')
    throw new SystemError('Failed to parse Claude response for Q&A generation', err)
  }

  const kpIds = new Set(kps.map((kp) => kp.id))
  const insertedQuestions: InsertedQuestion[] = []

  for (const [index, question] of generated.questions.entries()) {
    const kpId = kpIds.has(question.kp_id) ? question.kp_id : null
    const questionType = VALID_TYPES.has(question.type) ? question.type : 'short_answer'
    const questionId = await insert(
      `
        INSERT INTO qa_questions (
          module_id,
          kp_id,
          question_type,
          question_text,
          correct_answer,
          scaffolding,
          order_index,
          is_review
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
      `,
      [
        id,
        kpId,
        questionType,
        question.text,
        question.correct_answer || null,
        question.scaffolding || null,
        index + 1,
      ]
    )

    insertedQuestions.push({
      id: questionId,
      module_id: id,
      kp_id: kpId,
      question_type: questionType,
      question_text: question.text,
      correct_answer: question.correct_answer || null,
      scaffolding: question.scaffolding || null,
      order_index: index + 1,
    })
  }

  await run('UPDATE modules SET learning_status = $1 WHERE id = $2', ['qa', id])

  await logAction('Q&A generation complete', `moduleId=${id}, questionCount=${insertedQuestions.length}`)

  return { data: { questions: insertedQuestions } }
})

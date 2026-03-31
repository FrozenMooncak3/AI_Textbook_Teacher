import { generateText } from 'ai'
import { getModel, timeout } from '@/lib/ai'
import { getDb } from '@/lib/db'
import { UserError, SystemError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'
import { getPrompt } from '@/lib/prompt-templates'

type QuestionType = 'single_choice' | 'c2_evaluation' | 'calculation' | 'essay'

interface ModuleRow {
  id: number
  title: string
  learning_status: string
}

interface KnowledgePointRow {
  id: number
  kp_code: string
  description: string
  type: string
  importance: number
  detailed_content: string
}

interface MistakeRow {
  kp_id: number | null
  knowledge_point: string | null
  error_type: string
  remediation: string | null
}

interface TestPaperRow {
  id: number
  attempt_number: number
}

interface StoredQuestionRow {
  id: number
  kp_id: number | null
  kp_ids: string | null
  question_type: QuestionType
  question_text: string
  options: string | null
  order_index: number
}

interface GeneratedQuestion {
  kp_ids: number[]
  type: string
  text: string
  options: string[] | null
  correct_answer: string
  explanation: string
}

interface QuestionResponse {
  id: number
  kp_id: number | null
  kp_ids: number[]
  question_type: QuestionType
  question_text: string
  options: string[] | null
  order_index: number
}

const VALID_TYPES = new Set<QuestionType>([
  'single_choice',
  'c2_evaluation',
  'calculation',
  'essay',
])

function parseRequestBody(body: unknown): { retake: boolean } {
  if (body === null || body === undefined) {
    return { retake: false }
  }

  if (typeof body !== 'object') {
    throw new UserError('Invalid request body', 'INVALID_INPUT', 400)
  }

  const parsed = body as { retake?: unknown }
  if (parsed.retake !== undefined && typeof parsed.retake !== 'boolean') {
    throw new UserError('Invalid retake flag', 'INVALID_INPUT', 400)
  }

  return { retake: parsed.retake === true }
}

function parseJsonArray<T>(value: string | null, fallback: T[]): T[] {
  if (!value) {
    return fallback
  }

  const parsed = JSON.parse(value) as unknown
  if (!Array.isArray(parsed)) {
    throw new Error('Expected JSON array')
  }

  return parsed as T[]
}

function formatQuestion(row: StoredQuestionRow): QuestionResponse {
  try {
    return {
      id: row.id,
      kp_id: row.kp_id,
      kp_ids: parseJsonArray<number>(row.kp_ids, []),
      question_type: row.question_type,
      question_text: row.question_text,
      options: row.options ? parseJsonArray<string>(row.options, []) : null,
      order_index: row.order_index,
    }
  } catch (error) {
    throw new SystemError('Failed to parse stored test question', error)
  }
}

function formatKnowledgePointTable(kps: KnowledgePointRow[]): string {
  return kps
    .map(
      (kp) =>
        `- [ID=${kp.id}] [${kp.kp_code}] (${kp.type}, importance=${kp.importance}) ${kp.description}\n  Detail: ${kp.detailed_content}`
    )
    .join('\n')
}

function formatPastMistakes(mistakes: MistakeRow[]): string {
  if (mistakes.length === 0) {
    return '(No past mistakes)'
  }

  return mistakes
    .map((mistake) => {
      const kpLabel = mistake.kp_id === null ? 'KP ?' : `KP ${mistake.kp_id}`
      const knowledgePoint = mistake.knowledge_point ?? 'Unknown knowledge point'
      const remediation = mistake.remediation ? `; remediation=${mistake.remediation}` : ''
      return `- ${kpLabel}: ${knowledgePoint} (${mistake.error_type}${remediation})`
    })
    .join('\n')
}

function parseGeneratedQuestions(text: string): GeneratedQuestion[] {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON object found in model response')
  }

  const parsed = JSON.parse(jsonMatch[0]) as unknown
  if (parsed === null || typeof parsed !== 'object' || !('questions' in parsed)) {
    throw new Error('Missing questions field in model response')
  }

  const { questions } = parsed as { questions?: unknown }
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('Questions array is empty')
  }

  return questions as GeneratedQuestion[]
}

function validateQuestion(
  question: GeneratedQuestion,
  index: number,
  validKpIds: Set<number>
): {
  kpIds: number[]
  type: QuestionType
  text: string
  options: string[] | null
  correctAnswer: string
  explanation: string
} {
  const kpIds = Array.isArray(question.kp_ids)
    ? question.kp_ids.filter((kpId): kpId is number => Number.isInteger(kpId) && validKpIds.has(kpId))
    : []

  if (kpIds.length === 0) {
    throw new Error(`Question ${index + 1} has no valid kp_ids`)
  }

  if (!VALID_TYPES.has(question.type as QuestionType)) {
    throw new Error(`Question ${index + 1} has invalid type: ${question.type}`)
  }

  const text = typeof question.text === 'string' ? question.text.trim() : ''
  const correctAnswer =
    typeof question.correct_answer === 'string' ? question.correct_answer.trim() : ''
  const explanation =
    typeof question.explanation === 'string' ? question.explanation.trim() : ''

  if (!text || !correctAnswer || !explanation) {
    throw new Error(`Question ${index + 1} is missing required text fields`)
  }

  const type = question.type as QuestionType
  if (type === 'single_choice') {
    if (!Array.isArray(question.options) || question.options.length !== 4) {
      throw new Error(`Question ${index + 1} must have 4 options`)
    }

    const options = question.options.map((option) => {
      if (typeof option !== 'string') {
        throw new Error(`Question ${index + 1} contains non-string options`)
      }

      return option.trim()
    })
    if (options.some((option) => option.length === 0)) {
      throw new Error(`Question ${index + 1} contains empty options`)
    }

    if (!['A', 'B', 'C', 'D'].includes(correctAnswer)) {
      throw new Error(`Question ${index + 1} has invalid single-choice answer`)
    }

    return { kpIds, type, text, options, correctAnswer, explanation }
  }

  if (question.options !== null) {
    throw new Error(`Question ${index + 1} must have null options`)
  }

  return {
    kpIds,
    type,
    text,
    options: null,
    correctAnswer,
    explanation,
  }
}

export const POST = handleRoute(async (req, context) => {
  const { moduleId } = await context!.params
  const id = Number(moduleId)

  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid module ID', 'INVALID_ID', 400)
  }

  const body = parseRequestBody(await req.json().catch(() => undefined))
  const db = getDb()

  const module_ = db
    .prepare('SELECT id, title, learning_status FROM modules WHERE id = ?')
    .get(id) as ModuleRow | undefined

  if (!module_) {
    throw new UserError('Module not found', 'NOT_FOUND', 404)
  }

  if (module_.learning_status !== 'notes_generated' && module_.learning_status !== 'testing') {
    throw new UserError(
      'Module must have completed notes generation before testing',
      'INVALID_STATUS',
      409
    )
  }

  if (body.retake) {
    db.prepare('DELETE FROM test_papers WHERE module_id = ? AND total_score IS NULL').run(id)
  } else {
    const existingPaper = db
      .prepare(`
        SELECT id, attempt_number
        FROM test_papers
        WHERE module_id = ? AND total_score IS NULL
        ORDER BY id DESC
        LIMIT 1
      `)
      .get(id) as TestPaperRow | undefined

    if (existingPaper) {
      const existingQuestions = db
        .prepare(`
          SELECT id, kp_id, kp_ids, question_type, question_text, options, order_index
          FROM test_questions
          WHERE paper_id = ?
          ORDER BY order_index ASC
        `)
        .all(existingPaper.id) as StoredQuestionRow[]

      return {
        data: {
          paper_id: existingPaper.id,
          attempt_number: existingPaper.attempt_number,
          questions: existingQuestions.map(formatQuestion),
          cached: true,
        },
      }
    }
  }

  const kps = db
    .prepare(`
      SELECT id, kp_code, description, type, importance, detailed_content
      FROM knowledge_points
      WHERE module_id = ?
      ORDER BY id ASC
    `)
    .all(id) as KnowledgePointRow[]

  if (kps.length === 0) {
    throw new UserError('No knowledge points found for this module', 'NO_KPS', 409)
  }

  const mistakes = db
    .prepare(`
      SELECT kp_id, knowledge_point, error_type, remediation
      FROM mistakes
      WHERE module_id = ? AND is_resolved = 0
      ORDER BY created_at DESC
    `)
    .all(id) as MistakeRow[]

  const prompt = getPrompt('examiner', 'test_generation', {
    kp_table: formatKnowledgePointTable(kps),
    past_mistakes: formatPastMistakes(mistakes),
  })

  const lastPaper = db
    .prepare(`
      SELECT attempt_number
      FROM test_papers
      WHERE module_id = ?
      ORDER BY attempt_number DESC
      LIMIT 1
    `)
    .get(id) as { attempt_number: number } | undefined

  const attemptNumber = (lastPaper?.attempt_number ?? 0) + 1

  logAction('Test generation started', `moduleId=${id}, attempt=${attemptNumber}, kpCount=${kps.length}`)

  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens: 16384,
    prompt,
    abortSignal: AbortSignal.timeout(timeout),
  })

  let generatedQuestions: GeneratedQuestion[]
  try {
    generatedQuestions = parseGeneratedQuestions(text)
  } catch (error) {
    logAction('Test generation parse error', text.slice(0, 500), 'error')
    throw new SystemError('Failed to parse AI response for test generation', error)
  }

  const validKpIds = new Set(kps.map((kp) => kp.id))
  const insertPaper = db.prepare('INSERT INTO test_papers (module_id, attempt_number) VALUES (?, ?)')
  const insertQuestion = db.prepare(`
    INSERT INTO test_questions (
      paper_id,
      kp_id,
      kp_ids,
      question_type,
      question_text,
      options,
      correct_answer,
      explanation,
      order_index
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  let paperId = 0
  const questionResponses: QuestionResponse[] = []

  try {
    const transaction = db.transaction(() => {
      const paperResult = insertPaper.run(id, attemptNumber)
      paperId = Number(paperResult.lastInsertRowid)

      for (const [index, question] of generatedQuestions.entries()) {
        const validated = validateQuestion(question, index, validKpIds)
        const kpIdsJson = JSON.stringify(validated.kpIds)
        const optionsJson = validated.options === null ? null : JSON.stringify(validated.options)
        const result = insertQuestion.run(
          paperId,
          validated.kpIds[0],
          kpIdsJson,
          validated.type,
          validated.text,
          optionsJson,
          validated.correctAnswer,
          validated.explanation,
          index + 1
        )

        questionResponses.push({
          id: Number(result.lastInsertRowid),
          kp_id: validated.kpIds[0],
          kp_ids: validated.kpIds,
          question_type: validated.type,
          question_text: validated.text,
          options: validated.options,
          order_index: index + 1,
        })
      }

      if (module_.learning_status === 'notes_generated') {
        db.prepare('UPDATE modules SET learning_status = ? WHERE id = ?').run('testing', id)
      }
    })

    transaction()
  } catch (error) {
    throw new SystemError('Failed to create generated test paper', error)
  }

  logAction(
    'Test generation complete',
    `moduleId=${id}, paperId=${paperId}, questionCount=${questionResponses.length}`
  )

  return {
    data: {
      paper_id: paperId,
      attempt_number: attemptNumber,
      questions: questionResponses,
    },
  }
})

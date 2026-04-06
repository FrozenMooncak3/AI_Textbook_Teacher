import { requireModuleOwner } from '@/lib/auth'
import { generateText } from 'ai'
import { getModel, timeout } from '@/lib/ai'
import { pool, query, queryOne, run } from '@/lib/db'
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

const QUESTION_TYPE_PRIORITY: Record<string, number> = {
  single_choice: 0,
  multiple_choice: 1,
  c2_evaluation: 1,
  short_answer: 2,
  calculation: 2,
  open_ended: 3,
  essay: 3,
}

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
  let cleaned = text
  const codeBlock = text.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/)
  if (codeBlock) {
    cleaned = codeBlock[1]
  }

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON object found in model response')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    const raw = jsonMatch[0]
    let fixed = ''
    let inString = false
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i]
      if (ch === '"' && (i === 0 || raw[i - 1] !== '\\')) {
        inString = !inString
        fixed += ch
      } else if (inString && ch.charCodeAt(0) < 0x20) {
        if (ch === '\n') fixed += '\\n'
        else if (ch === '\r') fixed += '\\r'
        else if (ch === '\t') fixed += '\\t'
      } else {
        fixed += ch
      }
    }
    parsed = JSON.parse(fixed)
  }

  if (parsed === null || typeof parsed !== 'object' || !('questions' in parsed)) {
    throw new Error('Missing questions field in model response')
  }

  const { questions } = parsed as { questions?: unknown }
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('Questions array is empty')
  }

  return questions as GeneratedQuestion[]
}

function sortGeneratedQuestions(questions: GeneratedQuestion[]): GeneratedQuestion[] {
  return questions
    .map((question, index) => ({ question, index }))
    .sort((left, right) => {
      const leftPriority = QUESTION_TYPE_PRIORITY[left.question.type] ?? Number.MAX_SAFE_INTEGER
      const rightPriority = QUESTION_TYPE_PRIORITY[right.question.type] ?? Number.MAX_SAFE_INTEGER

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority
      }

      return left.index - right.index
    })
    .map(({ question }) => question)
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

  await requireModuleOwner(req, id)

  const body = parseRequestBody(await req.json().catch(() => undefined))

  const module_ = await queryOne<ModuleRow>(
    'SELECT id, title, learning_status FROM modules WHERE id = $1',
    [id]
  )

  if (!module_) {
    throw new UserError('Module not found', 'NOT_FOUND', 404)
  }

  if (
    module_.learning_status !== 'notes_generated' &&
    module_.learning_status !== 'testing' &&
    module_.learning_status !== 'completed'
  ) {
    throw new UserError(
      'Module must have completed notes generation before testing',
      'INVALID_STATUS',
      409
    )
  }

  if (body.retake) {
    await run('DELETE FROM test_papers WHERE module_id = $1 AND total_score IS NULL', [id])
  } else {
    const existingPaper = await queryOne<TestPaperRow>(
      `
        SELECT id, attempt_number
        FROM test_papers
        WHERE module_id = $1 AND total_score IS NULL
        ORDER BY id DESC
        LIMIT 1
      `,
      [id]
    )

    if (existingPaper) {
      const existingQuestions = await query<StoredQuestionRow>(
        `
          SELECT id, kp_id, kp_ids, question_type, question_text, options, order_index
          FROM test_questions
          WHERE paper_id = $1
          ORDER BY order_index ASC
        `,
        [existingPaper.id]
      )

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

  const kps = await query<KnowledgePointRow>(
    `
      SELECT id, kp_code, description, type, importance, detailed_content
      FROM knowledge_points
      WHERE module_id = $1
      ORDER BY id ASC
    `,
    [id]
  )

  if (kps.length === 0) {
    throw new UserError('No knowledge points found for this module', 'NO_KPS', 409)
  }

  const mistakes = await query<MistakeRow>(
    `
      SELECT kp_id, knowledge_point, error_type, remediation
      FROM mistakes
      WHERE module_id = $1 AND is_resolved = 0
      ORDER BY created_at DESC
    `,
    [id]
  )

  const prompt = await getPrompt('examiner', 'test_generation', {
    kp_table: formatKnowledgePointTable(kps),
    past_mistakes: formatPastMistakes(mistakes),
  })

  const lastPaper = await queryOne<{ attempt_number: number }>(
    `
      SELECT attempt_number
      FROM test_papers
      WHERE module_id = $1
      ORDER BY attempt_number DESC
      LIMIT 1
    `,
    [id]
  )

  const attemptNumber = (lastPaper?.attempt_number ?? 0) + 1

  await logAction('Test generation started', `moduleId=${id}, attempt=${attemptNumber}, kpCount=${kps.length}`)

  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens: 65536,
    prompt,
    abortSignal: AbortSignal.timeout(timeout),
  })

  let generatedQuestions: GeneratedQuestion[]
  try {
    generatedQuestions = sortGeneratedQuestions(parseGeneratedQuestions(text))
  } catch (error) {
    await logAction('Test generation parse error', text.slice(0, 500), 'error')
    throw new SystemError('Failed to parse AI response for test generation', error)
  }

  const validKpIds = new Set(kps.map((kp) => kp.id))
  let paperId = 0
  const questionResponses: QuestionResponse[] = []
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const paperResult = await client.query<{ id: number }>(
      'INSERT INTO test_papers (module_id, attempt_number) VALUES ($1, $2) RETURNING id',
      [id, attemptNumber]
    )
    paperId = paperResult.rows[0].id

    let orderIndex = 0
    for (const [index, question] of generatedQuestions.entries()) {
      let validated
      try {
        validated = validateQuestion(question, index, validKpIds)
      } catch {
        await logAction('Skipping invalid question', `index=${index}, type=${question.type}`, 'warn')
        continue
      }

      const result = await client.query<{ id: number }>(
        `
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
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id
        `,
        [
          paperId,
          validated.kpIds[0],
          JSON.stringify(validated.kpIds),
          validated.type,
          validated.text,
          validated.options === null ? null : JSON.stringify(validated.options),
          validated.correctAnswer,
          validated.explanation,
          orderIndex + 1,
        ]
      )

      questionResponses.push({
        id: result.rows[0].id,
        kp_id: validated.kpIds[0],
        kp_ids: validated.kpIds,
        question_type: validated.type,
        question_text: validated.text,
        options: validated.options,
        order_index: orderIndex + 1,
      })
      orderIndex += 1
    }

    if (questionResponses.length === 0) {
      throw new Error('No valid questions generated')
    }

    if (module_.learning_status === 'notes_generated') {
      await client.query('UPDATE modules SET learning_status = $1 WHERE id = $2', ['testing', id])
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw new SystemError('Failed to create generated test paper', error)
  } finally {
    client.release()
  }

  await logAction(
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

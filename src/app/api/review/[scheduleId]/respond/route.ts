import { generateText } from 'ai'
import { getModel, timeout } from '@/lib/ai'
import { getDb } from '@/lib/db'
import { UserError, SystemError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'
import { getPrompt } from '@/lib/prompt-templates'

type QuestionType = 'single_choice' | 'c2_evaluation' | 'calculation' | 'essay'

interface ReviewQuestionRow {
  id: number
  schedule_id: number
  kp_id: number | null
  question_type: QuestionType
  question_text: string
  options: string | null
  correct_answer: string
  explanation: string | null
}

interface KnowledgePointRow {
  description: string
  detailed_content: string
}

interface ScheduleRow {
  module_id: number
}

interface NextQuestionRow {
  id: number
  question_type: QuestionType
  question_text: string
  options: string | null
  order_index: number
}

interface ReviewFeedbackResult {
  is_correct: boolean
  score: number
  error_type: string | null
  feedback: string
  remediation: string | null
}

function parseScheduleId(value: string): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid schedule ID', 'INVALID_ID', 400)
  }

  return id
}

function parseRequestBody(body: unknown): { questionId: number; userAnswer: string } {
  if (body === null || body === undefined || typeof body !== 'object') {
    throw new UserError('Invalid request body', 'INVALID_INPUT', 400)
  }

  const parsed = body as { question_id?: unknown; user_answer?: unknown }
  const questionId = Number(parsed.question_id)
  const userAnswer = typeof parsed.user_answer === 'string' ? parsed.user_answer.trim() : ''

  if (!Number.isInteger(questionId) || questionId <= 0 || userAnswer.length === 0) {
    throw new UserError('question_id and user_answer are required', 'MISSING_FIELDS', 400)
  }

  return { questionId, userAnswer }
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

function parseFeedbackResponse(text: string): ReviewFeedbackResult {
  let cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '')
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in reviewer response')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    const raw = jsonMatch[0]
    let fixed = ''
    let inString = false

    for (let index = 0; index < raw.length; index++) {
      const char = raw[index]
      if (char === '"' && (index === 0 || raw[index - 1] !== '\\')) {
        inString = !inString
        fixed += char
        continue
      }

      if (inString && char.charCodeAt(0) < 0x20) {
        if (char === '\n') fixed += '\\n'
        else if (char === '\r') fixed += '\\r'
        else if (char === '\t') fixed += '\\t'
        continue
      }

      fixed += char
    }

    cleaned = fixed
    parsed = JSON.parse(cleaned)
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new Error('Reviewer response is not an object')
  }

  const candidate = parsed as Partial<ReviewFeedbackResult>
  if (
    typeof candidate.is_correct !== 'boolean' ||
    typeof candidate.score !== 'number' ||
    typeof candidate.feedback !== 'string' ||
    (candidate.error_type !== null && candidate.error_type !== undefined && typeof candidate.error_type !== 'string') ||
    (candidate.remediation !== null &&
      candidate.remediation !== undefined &&
      typeof candidate.remediation !== 'string')
  ) {
    throw new Error('Reviewer response is missing required fields')
  }

  return {
    is_correct: candidate.is_correct,
    score: candidate.score,
    error_type: candidate.error_type ?? null,
    feedback: candidate.feedback.trim(),
    remediation: candidate.remediation ?? null,
  }
}

function formatNextQuestion(question: NextQuestionRow | undefined): {
  id: number
  type: QuestionType
  text: string
  options: string[] | null
} | null {
  if (!question) {
    return null
  }

  try {
    return {
      id: question.id,
      type: question.question_type,
      text: question.question_text,
      options: question.options ? parseJsonArray<string>(question.options, []) : null,
    }
  } catch (error) {
    throw new SystemError('Failed to parse next review question', error)
  }
}

export const POST = handleRoute(async (req, context) => {
  const { scheduleId } = await context!.params
  const normalizedScheduleId = parseScheduleId(scheduleId)
  const { questionId, userAnswer } = parseRequestBody(await req.json())
  const db = getDb()

  const question = db.prepare(`
    SELECT *
    FROM review_questions
    WHERE id = ? AND schedule_id = ?
  `).get(questionId, normalizedScheduleId) as ReviewQuestionRow | undefined

  if (!question) {
    throw new UserError('Question not found or wrong schedule', 'NOT_FOUND', 404)
  }

  const existingResponse = db.prepare(
    'SELECT id FROM review_responses WHERE question_id = ?'
  ).get(questionId) as { id: number } | undefined

  if (existingResponse) {
    throw new UserError('Already answered', 'ALREADY_ANSWERED', 409)
  }

  const kp = question.kp_id === null
    ? null
    : db.prepare(`
        SELECT description, detailed_content
        FROM knowledge_points
        WHERE id = ?
      `).get(question.kp_id) as KnowledgePointRow | undefined

  const prompt = getPrompt('reviewer', 'review_scoring', {
    question_text: question.question_text,
    correct_answer: question.correct_answer,
    explanation: question.explanation ?? '',
    kp_content: kp ? `${kp.description}\n${kp.detailed_content}` : '(No KP linked)',
    user_answer: userAnswer,
  })

  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens: 1024,
    prompt,
    abortSignal: AbortSignal.timeout(timeout),
  })

  let feedback: ReviewFeedbackResult
  try {
    feedback = parseFeedbackResponse(text)
  } catch (error) {
    logAction('Review scoring parse error', text.slice(0, 300), 'error')
    throw new SystemError('Failed to parse review scoring response', error)
  }

  db.prepare(`
    INSERT INTO review_responses (question_id, user_answer, is_correct, score, ai_feedback, error_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    questionId,
    userAnswer,
    feedback.is_correct ? 1 : 0,
    feedback.score,
    feedback.feedback,
    feedback.error_type
  )

  if (!feedback.is_correct) {
    const schedule = db.prepare(`
      SELECT module_id
      FROM review_schedule
      WHERE id = ?
    `).get(normalizedScheduleId) as ScheduleRow | undefined

    if (!schedule) {
      throw new SystemError('Review schedule missing while recording mistake')
    }

    const knowledgePointLabel = kp ? kp.description : question.question_text.slice(0, 50)
    db.prepare(`
      INSERT INTO mistakes (module_id, kp_id, knowledge_point, error_type, source, remediation, is_resolved)
      VALUES (?, ?, ?, ?, 'review', ?, 0)
    `).run(
      schedule.module_id,
      question.kp_id,
      knowledgePointLabel,
      feedback.error_type ?? 'blind_spot',
      feedback.remediation
    )
  }

  const nextQuestion = db.prepare(`
    SELECT rq.id, rq.question_type, rq.question_text, rq.options, rq.order_index
    FROM review_questions rq
    LEFT JOIN review_responses rr ON rr.question_id = rq.id
    WHERE rq.schedule_id = ? AND rr.id IS NULL
    ORDER BY rq.order_index ASC
    LIMIT 1
  `).get(normalizedScheduleId) as NextQuestionRow | undefined

  logAction(
    'Review response recorded',
    `scheduleId=${normalizedScheduleId}, questionId=${questionId}, correct=${feedback.is_correct}`
  )

  return {
    data: {
      is_correct: feedback.is_correct,
      score: feedback.score,
      ai_feedback: feedback.feedback,
      has_next: Boolean(nextQuestion),
      next_question: formatNextQuestion(nextQuestion),
    },
  }
})

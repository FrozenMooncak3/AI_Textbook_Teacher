import { generateText } from 'ai'
import { getModel, timeout } from '@/lib/ai'
import { insert, query, queryOne } from '@/lib/db'
import { UserError, SystemError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'
import { getPrompt } from '@/lib/prompt-templates'

interface QAQuestion {
  id: number
  module_id: number
  kp_id: number | null
  question_type: string
  question_text: string
  correct_answer: string | null
  scaffolding: string | null
}

interface FeedbackResult {
  is_correct: boolean
  score: number
  feedback: string
}

interface StoredFeedbackRow {
  question_id: number
  user_answer: string
  is_correct: number | null
  ai_feedback: string | null
  score: number | null
}

interface StoredFeedback {
  is_correct: boolean
  score: number
  feedback: string
  user_answer: string
}

export const GET = handleRoute(async (_req, context) => {
  const { moduleId } = await context!.params
  const moduleNumericId = Number(moduleId)

  if (!Number.isInteger(moduleNumericId) || moduleNumericId <= 0) {
    throw new UserError('Invalid module ID', 'INVALID_ID', 400)
  }

  const responseRows = await query<StoredFeedbackRow>(
    `
      SELECT qr.question_id, qr.user_answer, qr.is_correct, qr.ai_feedback, qr.score
      FROM qa_responses qr
      JOIN qa_questions qq ON qr.question_id = qq.id
      WHERE qq.module_id = $1
    `,
    [moduleNumericId]
  )

  const responses = responseRows.reduce<Record<number, StoredFeedback>>((accumulator, row) => {
    accumulator[row.question_id] = {
      is_correct: Boolean(row.is_correct),
      score: row.score ?? 0,
      feedback: row.ai_feedback ?? '',
      user_answer: row.user_answer,
    }

    return accumulator
  }, {})

  return { data: { responses } }
})

export const POST = handleRoute(async (req, context) => {
  const { moduleId } = await context!.params
  const moduleNumericId = Number(moduleId)

  if (!Number.isInteger(moduleNumericId) || moduleNumericId <= 0) {
    throw new UserError('Invalid module ID', 'INVALID_ID', 400)
  }

  const { questionId, userAnswer } = await req.json() as {
    questionId?: number
    userAnswer?: string
  }

  const normalizedQuestionId = Number(questionId)

  if (!Number.isInteger(normalizedQuestionId) || normalizedQuestionId <= 0 || !userAnswer?.trim()) {
    throw new UserError('questionId and userAnswer are required', 'MISSING_FIELDS', 400)
  }

  const question = await queryOne<QAQuestion>(
    'SELECT * FROM qa_questions WHERE id = $1 AND module_id = $2',
    [normalizedQuestionId, moduleNumericId]
  )

  if (!question) {
    throw new UserError('Question not found', 'NOT_FOUND', 404)
  }

  const existingResponse = await queryOne<{ id: number }>(
    'SELECT id FROM qa_responses WHERE question_id = $1',
    [normalizedQuestionId]
  )

  if (existingResponse) {
    throw new UserError('Question already answered', 'ALREADY_ANSWERED', 409)
  }

  let kpDetail = '(No specific KP linked)'
  if (question.kp_id) {
    const kp = await queryOne<{ description: string; detailed_content: string }>(
      'SELECT description, detailed_content FROM knowledge_points WHERE id = $1',
      [question.kp_id]
    )

    if (kp) {
      kpDetail = `${kp.description}\n${kp.detailed_content}`
    }
  }

  const prompt = await getPrompt('coach', 'qa_feedback', {
    question: question.question_text,
    correct_answer: question.correct_answer || '(Open-ended question, no fixed answer)',
    user_answer: userAnswer.trim(),
    kp_detail: kpDetail,
  })

  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens: 1024,
    prompt,
    abortSignal: AbortSignal.timeout(timeout),
  })

  let feedback: FeedbackResult
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found')
    }

    feedback = JSON.parse(jsonMatch[0]) as FeedbackResult
  } catch (err) {
    await logAction('QA feedback parse error', text.slice(0, 300), 'error')
    throw new SystemError('Failed to parse feedback response', err)
  }

  const responseId = await insert(
    `
      INSERT INTO qa_responses (question_id, user_answer, is_correct, ai_feedback, score)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [
      normalizedQuestionId,
      userAnswer.trim(),
      feedback.is_correct ? 1 : 0,
      feedback.feedback,
      feedback.score,
    ]
  )

  await logAction('QA feedback given', `questionId=${normalizedQuestionId}, correct=${feedback.is_correct}`)

  return {
    data: {
      responseId,
      is_correct: feedback.is_correct,
      score: feedback.score,
      feedback: feedback.feedback,
    },
  }
})

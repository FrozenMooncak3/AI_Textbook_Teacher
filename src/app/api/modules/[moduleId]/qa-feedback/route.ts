import { handleRoute } from '@/lib/handle-route'
import { getDb } from '@/lib/db'
import { UserError, SystemError } from '@/lib/errors'
import { getPrompt } from '@/lib/prompt-templates'
import { getClaudeClient, CLAUDE_MODEL } from '@/lib/claude'
import { logAction } from '@/lib/log'

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

  const db = getDb()
  const question = db
    .prepare('SELECT * FROM qa_questions WHERE id = ? AND module_id = ?')
    .get(normalizedQuestionId, moduleNumericId) as QAQuestion | undefined

  if (!question) {
    throw new UserError('Question not found', 'NOT_FOUND', 404)
  }

  const existingResponse = db
    .prepare('SELECT id FROM qa_responses WHERE question_id = ?')
    .get(normalizedQuestionId) as { id: number } | undefined

  if (existingResponse) {
    throw new UserError('Question already answered', 'ALREADY_ANSWERED', 409)
  }

  let kpDetail = '(No specific KP linked)'
  if (question.kp_id) {
    const kp = db
      .prepare('SELECT description, detailed_content FROM knowledge_points WHERE id = ?')
      .get(question.kp_id) as { description: string; detailed_content: string } | undefined

    if (kp) {
      kpDetail = `${kp.description}\n${kp.detailed_content}`
    }
  }

  const prompt = getPrompt('coach', 'qa_feedback', {
    question: question.question_text,
    correct_answer: question.correct_answer || '(Open-ended question, no fixed answer)',
    user_answer: userAnswer.trim(),
    kp_detail: kpDetail,
  })

  const claude = getClaudeClient()
  const message = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const rawContent = message.content[0]
  if (rawContent.type !== 'text') {
    throw new SystemError('Claude returned non-text response')
  }

  let feedback: FeedbackResult
  try {
    const jsonMatch = rawContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found')
    }

    feedback = JSON.parse(jsonMatch[0]) as FeedbackResult
  } catch (err) {
    logAction('QA feedback parse error', rawContent.text.slice(0, 300), 'error')
    throw new SystemError('Failed to parse feedback response', err)
  }

  const result = db
    .prepare(`
      INSERT INTO qa_responses (question_id, user_answer, is_correct, ai_feedback, score)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(
      normalizedQuestionId,
      userAnswer.trim(),
      feedback.is_correct ? 1 : 0,
      feedback.feedback,
      feedback.score
    )

  logAction('QA feedback given', `questionId=${normalizedQuestionId}, correct=${feedback.is_correct}`)

  return {
    data: {
      responseId: Number(result.lastInsertRowid),
      is_correct: feedback.is_correct,
      score: feedback.score,
      feedback: feedback.feedback,
    },
  }
})

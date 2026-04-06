import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { getModel, timeout } from '@/lib/ai'
import { requireModuleOwner } from '@/lib/auth'
import { query, queryOne, run } from '@/lib/db'
import { recordMistakes } from '@/lib/mistakes'
import { UserError } from '@/lib/errors'

interface Question {
  id: number
  prompt: string
  answer_key: string
  explanation: string
}

interface UserResponse {
  question_id: number
  response_text: string
  score: number | null
  is_correct: number | null
  ai_feedback: string | null
}

// POST /api/modules/[moduleId]/evaluate - AI 逐题评分
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const { moduleId } = await params
  const moduleNumericId = Number(moduleId)

  try {
    await requireModuleOwner(_req, moduleNumericId)
  } catch (error) {
    if (error instanceof UserError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }

    throw error
  }

  const questions = await query<Question>(
    `
      SELECT
        id,
        question_text AS prompt,
        COALESCE(correct_answer, '') AS answer_key,
        COALESCE(scaffolding, '') AS explanation
      FROM qa_questions
      WHERE module_id = $1
      ORDER BY order_index ASC
    `,
    [moduleNumericId]
  )

  if (questions.length === 0) {
    return NextResponse.json({ error: '没有题目' }, { status: 404 })
  }

  const responses = await query<UserResponse>(
    `
      SELECT
        qr.question_id,
        qr.user_answer AS response_text,
        qr.score,
        qr.is_correct,
        qr.ai_feedback
      FROM qa_responses qr
      JOIN qa_questions qq ON qr.question_id = qq.id
      WHERE qq.module_id = $1
      ORDER BY qq.order_index ASC
    `,
    [moduleNumericId]
  )

  if (responses.length < questions.length) {
    return NextResponse.json({ error: '还有题目未作答' }, { status: 400 })
  }

  const firstResponse = responses[0]
  if (firstResponse?.score !== null && firstResponse?.score !== undefined) {
    const scored = questions.map((question) => {
      const response = responses.find((item) => item.question_id === question.id)
      return {
        id: question.id,
        prompt: question.prompt,
        answer_key: question.answer_key,
        explanation: question.explanation,
        response_text: response?.response_text ?? '',
        score: response?.score ?? 0,
        error_type: null,
        feedback: response?.ai_feedback ?? '',
      }
    })

    return NextResponse.json({ evaluations: scored })
  }

  const qaList = questions.map((question) => {
    const response = responses.find((item) => item.question_id === question.id)
    return {
      questionId: question.id,
      prompt: question.prompt,
      answer_key: question.answer_key,
      explanation: question.explanation,
      user_answer: response?.response_text ?? '',
    }
  })

  const prompt = `你是一位专业的教学评估老师，请逐题评分并给出诊断。
以下是学生的 Q&A 作答记录，请对每道题进行评估。
${qaList.map((question, index) => `
【第${index + 1}题】题目：${question.prompt}
参考答案：${question.answer_key}
解析：${question.explanation}
学生回答：${question.user_answer}
`).join('\n---\n')}

评分标准：
- 满分 10 分
- 8-10 分：理解正确，表述清晰
- 5-7 分：大体正确，有遗漏或表述不够准确
- 0-4 分：理解有误或未能回答要点

错误类型（仅在扣分时填写，四选一）：
- blind_spot
- procedural
- careless
- confusion

请以严格 JSON 格式返回：
{
  "evaluations": [
    {
      "question_id": ${qaList[0]?.questionId ?? 0},
      "score": 8,
      "error_type": null,
      "feedback": "评价"
    }
  ]
}`

  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens: 8192,
    prompt,
    abortSignal: AbortSignal.timeout(timeout),
  })

  let parsed: {
    evaluations: Array<{
      question_id: number
      score: number
      error_type: string | null
      feedback: string
    }>
  }
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('未找到 JSON')
    }

    parsed = JSON.parse(jsonMatch[0]) as {
      evaluations: Array<{
        question_id: number
        score: number
        error_type: string | null
        feedback: string
      }>
    }
  } catch {
    return NextResponse.json({ error: 'Claude 返回内容无法解析' }, { status: 500 })
  }

  for (const evaluation of parsed.evaluations) {
    await run(
      `
        UPDATE qa_responses
        SET score = $1, is_correct = $2, ai_feedback = $3
        WHERE question_id = $4
      `,
      [
        evaluation.score,
        evaluation.score >= 6 ? 1 : 0,
        evaluation.feedback,
        evaluation.question_id,
      ]
    )
  }

  const result = questions.map((question) => {
    const response = responses.find((item) => item.question_id === question.id)
    const evaluation = parsed.evaluations.find((item) => item.question_id === question.id)
    return {
      id: question.id,
      prompt: question.prompt,
      answer_key: question.answer_key,
      explanation: question.explanation,
      response_text: response?.response_text ?? '',
      score: evaluation?.score ?? response?.score ?? 0,
      error_type: evaluation?.error_type ?? null,
      feedback: evaluation?.feedback ?? '',
    }
  })

  const qaMistakes = parsed.evaluations
    .filter((evaluation) => evaluation.score < 6 && evaluation.error_type)
    .map((evaluation) => {
      const question = questions.find((item) => item.id === evaluation.question_id)
      return {
        moduleId: moduleNumericId,
        questionId: evaluation.question_id,
        kpId: undefined,
        knowledgePoint: question?.prompt.slice(0, 200) ?? '',
        errorType: evaluation.error_type,
        source: 'qa' as const,
        remediation: question?.explanation,
      }
    })

  await recordMistakes(qaMistakes)

  return NextResponse.json({ evaluations: result })
}

import { requireModuleOwner } from '@/lib/auth'
import { generateText } from 'ai'
import { getModel, timeout } from '@/lib/ai'
import { pool, query, queryOne } from '@/lib/db'
import { UserError, SystemError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'
import { getPrompt } from '@/lib/prompt-templates'
import { normalizeReviewErrorType } from '@/lib/review-question-utils'

interface TestQuestion {
  id: number
  kp_id: number | null
  kp_ids: string | null
  question_type: string
  question_text: string
  options: string | null
  correct_answer: string
  explanation: string | null
  order_index: number
}

interface UserAnswer {
  question_id: number
  user_answer: string
}

interface AIResult {
  question_id: number
  is_correct: boolean
  score: number
  feedback: string
  error_type: string | null
  remediation: string | null
}

const POINTS: Record<string, number> = {
  single_choice: 5,
  c2_evaluation: 5,
  calculation: 5,
  essay: 10,
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

export const POST = handleRoute(async (req, context) => {
  const { moduleId } = await context!.params
  const id = Number(moduleId)
  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid module ID', 'INVALID_ID', 400)
  }

  await requireModuleOwner(req, id)

  const body = await req.json() as { paper_id: number; answers: UserAnswer[] }
  if (!body.paper_id || !Array.isArray(body.answers) || body.answers.length === 0) {
    throw new UserError('Missing paper_id or answers', 'INVALID_INPUT', 400)
  }

  const paper = await queryOne<{
    id: number
    module_id: number
    attempt_number: number
    total_score: number | null
  }>(
    `
      SELECT id, module_id, attempt_number, total_score
      FROM test_papers
      WHERE id = $1 AND module_id = $2
    `,
    [body.paper_id, id]
  )

  if (!paper) {
    throw new UserError('Test paper not found', 'NOT_FOUND', 404)
  }
  if (paper.total_score !== null) {
    throw new UserError('This test has already been submitted', 'ALREADY_SUBMITTED', 409)
  }

  const questions = await query<TestQuestion>(
    `
      SELECT id, kp_id, kp_ids, question_type, question_text, options, correct_answer, explanation, order_index
      FROM test_questions
      WHERE paper_id = $1
      ORDER BY order_index ASC
    `,
    [body.paper_id]
  )

  if (questions.length === 0) {
    throw new UserError('No questions found for this paper', 'NO_QUESTIONS', 409)
  }

  const mcQuestions = questions.filter((question) => question.question_type === 'single_choice')
  const subjectiveQuestions = questions.filter((question) => question.question_type !== 'single_choice')

  const mcResults: Array<{
    question_id: number
    is_correct: boolean
    score: number
    feedback: string | null
    error_type: string | null
    remediation: string | null
  }> = []

  for (const question of mcQuestions) {
    const answer = body.answers.find((item) => item.question_id === question.id)
    const userAnswer = (answer?.user_answer ?? '').trim().toUpperCase()
    const correctAnswer = question.correct_answer.trim().toUpperCase()
    const isCorrect = userAnswer === correctAnswer
    mcResults.push({
      question_id: question.id,
      is_correct: isCorrect,
      score: isCorrect ? POINTS.single_choice : 0,
      feedback: isCorrect ? null : `正确答案是 ${correctAnswer}。${question.explanation ?? ''}`,
      error_type: null,
      remediation: null,
    })
  }

  const wrongMcIds = mcResults.filter((result) => !result.is_correct).map((result) => result.question_id)
  let aiResults: AIResult[] = []

  if (subjectiveQuestions.length > 0 || wrongMcIds.length > 0) {
    const subjectivePaper = subjectiveQuestions
      .map((question) => {
        const answer = body.answers.find((item) => item.question_id === question.id)
        return `【题目 ID=${question.id}】(${question.question_type}, 满分 ${POINTS[question.question_type] ?? 5} 分)
题目：${question.question_text}
参考答案：${question.correct_answer}
解析：${question.explanation ?? '无'}
学生回答：${answer?.user_answer ?? '(未作答)'}`
      })
      .join('\n\n---\n\n')

    const mcErrorContext = wrongMcIds.length > 0
      ? mcQuestions
          .filter((question) => wrongMcIds.includes(question.id))
          .map((question) => {
            const answer = body.answers.find((item) => item.question_id === question.id)
            return `【单选错题 ID=${question.id}】
题目：${question.question_text}
正确答案：${question.correct_answer}
学生选择：${answer?.user_answer ?? '(未作答)'}
解析：${question.explanation ?? '无'}`
          })
          .join('\n\n')
      : '(无单选错题)'

    const prompt = await getPrompt('examiner', 'test_scoring', {
      test_paper: subjectivePaper || '(无主观题)',
      mc_results: mcErrorContext,
    })

    await logAction('Test scoring started', `paperId=${body.paper_id}`)

    const { text } = await generateText({
      model: getModel(),
      maxOutputTokens: 8192,
      prompt,
      abortSignal: AbortSignal.timeout(timeout),
    })

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found')
      }

      const parsed = JSON.parse(jsonMatch[0]) as { results: AIResult[] }
      aiResults = parsed.results ?? []
    } catch (err) {
      await logAction('Test scoring parse error', text.slice(0, 500), 'error')
      throw new SystemError('Failed to parse AI scoring response', err)
    }
  }

  for (const result of mcResults) {
    if (!result.is_correct) {
      const aiDiagnostic = aiResults.find((item) => item.question_id === result.question_id)
      if (aiDiagnostic) {
        result.error_type = normalizeReviewErrorType(aiDiagnostic.error_type)
        result.feedback = aiDiagnostic.feedback ?? result.feedback
        result.remediation = aiDiagnostic.remediation ?? null
      } else {
        result.error_type = normalizeReviewErrorType(null)
      }
    }
  }

  const subjectiveResults = subjectiveQuestions.map((question) => {
    const aiResult = aiResults.find((item) => item.question_id === question.id)
    const maxPoints = POINTS[question.question_type] ?? 5
    return {
      question_id: question.id,
      is_correct: aiResult?.is_correct ?? false,
      score: Math.min(aiResult?.score ?? 0, maxPoints),
      feedback: aiResult?.feedback ?? null,
      error_type: aiResult?.is_correct ? null : normalizeReviewErrorType(aiResult?.error_type),
      remediation: aiResult?.remediation ?? null,
    }
  })

  const allResults = [...mcResults, ...subjectiveResults]
  const totalScore = allResults.reduce((sum, result) => sum + result.score, 0)
  const maxScore = questions.reduce((sum, question) => sum + (POINTS[question.question_type] ?? 5), 0)
  const passRate = maxScore > 0 ? totalScore / maxScore : 0
  const isPassed = passRate >= 0.8

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    for (const question of questions) {
      const answer = body.answers.find((item) => item.question_id === question.id)
      const result = allResults.find((item) => item.question_id === question.id)

      await client.query(
        `
          INSERT INTO test_responses (question_id, user_answer, is_correct, score, ai_feedback, error_type)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          question.id,
          answer?.user_answer ?? '',
          result?.is_correct ? 1 : 0,
          result?.score ?? 0,
          result?.feedback ?? null,
          result?.error_type ?? null,
        ]
      )
    }

    for (const result of allResults) {
      if (result.is_correct) {
        continue
      }

      const question = questions.find((item) => item.id === result.question_id)
      if (!question) {
        continue
      }

      const kpIds = parseJsonArray<number>(question.kp_ids, [])
      const userAnswer = body.answers.find((item) => item.question_id === question.id)

      await client.query(
        `
          INSERT INTO mistakes (
            module_id,
            kp_id,
            knowledge_point,
            error_type,
            source,
            remediation,
            question_text,
            user_answer,
            correct_answer
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          id,
          question.kp_id ?? kpIds[0] ?? null,
          question.question_text.slice(0, 200),
          normalizeReviewErrorType(result.error_type),
          'test',
          result.remediation ?? null,
          question.question_text,
          userAnswer?.user_answer ?? '',
          question.correct_answer,
        ]
      )
    }

    await client.query(
      'UPDATE test_papers SET total_score = $1, pass_rate = $2, is_passed = $3 WHERE id = $4',
      [totalScore, passRate, isPassed ? 1 : 0, body.paper_id]
    )

    if (isPassed) {
      await client.query('UPDATE modules SET learning_status = $1 WHERE id = $2', ['completed', id])

      const existingSchedule = await client.query<{ id: number }>(
        'SELECT id FROM review_schedule WHERE module_id = $1 AND review_round = 1',
        [id]
      )

      if (existingSchedule.rows.length === 0) {
        await client.query(
          `
            INSERT INTO review_schedule (module_id, review_round, due_date, status)
            VALUES ($1, 1, ((CURRENT_DATE + INTERVAL '3 days')::date)::text, 'pending')
          `,
          [id]
        )
      }

      const clusterResults = await client.query<{
        cluster_id: number | null
        total: number
        correct: number | null
      }>(
        `
          SELECT
            kp.cluster_id,
            COUNT(*)::int AS total,
            SUM(CASE WHEN tr.is_correct = 1 THEN 1 ELSE 0 END)::int AS correct
          FROM test_questions tq
          JOIN knowledge_points kp ON tq.kp_id = kp.id
          JOIN test_responses tr ON tr.question_id = tq.id
          WHERE tq.paper_id = $1
          GROUP BY kp.cluster_id
        `,
        [body.paper_id]
      )

      for (const clusterResult of clusterResults.rows) {
        if (clusterResult.cluster_id === null) {
          continue
        }

        const correctCount = clusterResult.correct ?? 0
        const allCorrect = correctCount === clusterResult.total
        const newPValue = allCorrect ? 2 : 3

        await client.query('UPDATE clusters SET current_p_value = $1 WHERE id = $2', [
          newPValue,
          clusterResult.cluster_id,
        ])
      }
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw new SystemError('Failed to submit test results', error)
  } finally {
    client.release()
  }

  await logAction(
    'Test scoring complete',
    `paperId=${body.paper_id}, score=${totalScore}/${maxScore}, passed=${isPassed}`
  )

  const responseData = questions.map((question) => {
    const result = allResults.find((item) => item.question_id === question.id)
    const answer = body.answers.find((item) => item.question_id === question.id)
    return {
      question_id: question.id,
      question_type: question.question_type,
      question_text: question.question_text,
      options: question.options ? parseJsonArray<string>(question.options, []) : null,
      correct_answer: question.correct_answer,
      explanation: question.explanation,
      user_answer: answer?.user_answer ?? '',
      is_correct: result?.is_correct ?? false,
      score: result?.score ?? 0,
      max_score: POINTS[question.question_type] ?? 5,
      feedback: result?.feedback ?? null,
      error_type: result?.error_type ?? null,
      remediation: result?.remediation ?? null,
    }
  })

  return {
    data: {
      paper_id: body.paper_id,
      attempt_number: paper.attempt_number,
      total_score: totalScore,
      max_score: maxScore,
      pass_rate: Math.round(passRate * 100),
      is_passed: isPassed,
      results: responseData,
    },
  }
})

import { handleRoute } from '@/lib/handle-route'
import { getDb } from '@/lib/db'
import { UserError, SystemError } from '@/lib/errors'
import { getPrompt } from '@/lib/prompt-templates'
import { generateText } from 'ai'
import { getModel, timeout } from '@/lib/ai'
import { logAction } from '@/lib/log'

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

export const POST = handleRoute(async (req, context) => {
  const { moduleId } = await context!.params
  const id = Number(moduleId)
  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid module ID', 'INVALID_ID', 400)
  }

  const body = await req.json() as { paper_id: number; answers: UserAnswer[] }
  if (!body.paper_id || !Array.isArray(body.answers) || body.answers.length === 0) {
    throw new UserError('Missing paper_id or answers', 'INVALID_INPUT', 400)
  }

  const db = getDb()

  const paper = db.prepare(`
    SELECT id, module_id, attempt_number, total_score
    FROM test_papers WHERE id = ? AND module_id = ?
  `).get(body.paper_id, id) as {
    id: number
    module_id: number
    attempt_number: number
    total_score: number | null
  } | undefined

  if (!paper) {
    throw new UserError('Test paper not found', 'NOT_FOUND', 404)
  }
  if (paper.total_score !== null) {
    throw new UserError('This test has already been submitted', 'ALREADY_SUBMITTED', 409)
  }

  const questions = db.prepare(`
    SELECT id, kp_id, kp_ids, question_type, question_text, options, correct_answer, explanation, order_index
    FROM test_questions WHERE paper_id = ? ORDER BY order_index ASC
  `).all(body.paper_id) as TestQuestion[]

  if (questions.length === 0) {
    throw new UserError('No questions found for this paper', 'NO_QUESTIONS', 409)
  }

  const mcQuestions = questions.filter((q) => q.question_type === 'single_choice')
  const subjectiveQuestions = questions.filter((q) => q.question_type !== 'single_choice')

  const mcResults: Array<{
    question_id: number
    is_correct: boolean
    score: number
    feedback: string | null
    error_type: string | null
    remediation: string | null
  }> = []

  for (const q of mcQuestions) {
    const answer = body.answers.find((a) => a.question_id === q.id)
    const userAnswer = (answer?.user_answer ?? '').trim().toUpperCase()
    const correctAnswer = q.correct_answer.trim().toUpperCase()
    const isCorrect = userAnswer === correctAnswer
    mcResults.push({
      question_id: q.id,
      is_correct: isCorrect,
      score: isCorrect ? POINTS.single_choice : 0,
      feedback: isCorrect ? null : `正确答案是 ${correctAnswer}。${q.explanation ?? ''}`,
      error_type: null,
      remediation: null,
    })
  }

  const wrongMcIds = mcResults.filter((r) => !r.is_correct).map((r) => r.question_id)
  let aiResults: AIResult[] = []

  if (subjectiveQuestions.length > 0 || wrongMcIds.length > 0) {
    const subjectivePaper = subjectiveQuestions.map((q) => {
      const answer = body.answers.find((a) => a.question_id === q.id)
      return `【题目 ID=${q.id}】(${q.question_type}, 满分 ${POINTS[q.question_type] ?? 5} 分)
题目：${q.question_text}
参考答案：${q.correct_answer}
解析：${q.explanation ?? '无'}
学生回答：${answer?.user_answer ?? '(未作答)'}`
    }).join('\n\n---\n\n')

    const mcErrorContext = wrongMcIds.length > 0
      ? mcQuestions
          .filter((q) => wrongMcIds.includes(q.id))
          .map((q) => {
            const answer = body.answers.find((a) => a.question_id === q.id)
            return `【单选错题 ID=${q.id}】
题目：${q.question_text}
正确答案：${q.correct_answer}
学生选择：${answer?.user_answer ?? '(未作答)'}
解析：${q.explanation ?? '无'}`
          })
          .join('\n\n')
      : '(无单选错题)'

    const prompt = getPrompt('examiner', 'test_scoring', {
      test_paper: subjectivePaper || '(无主观题)',
      mc_results: mcErrorContext,
    })

    logAction('Test scoring started', `paperId=${body.paper_id}`)

    const { text } = await generateText({
      model: getModel(),
      maxOutputTokens: 8192,
      prompt,
      abortSignal: AbortSignal.timeout(timeout),
    })

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found')
      const parsed = JSON.parse(jsonMatch[0]) as { results: AIResult[] }
      aiResults = parsed.results ?? []
    } catch (err) {
      logAction('Test scoring parse error', text.slice(0, 500), 'error')
      throw new SystemError('Failed to parse AI scoring response', err)
    }
  }

  for (const mcr of mcResults) {
    if (!mcr.is_correct) {
      const aiDiag = aiResults.find((ar) => ar.question_id === mcr.question_id)
      if (aiDiag) {
        mcr.error_type = aiDiag.error_type ?? 'blind_spot'
        mcr.feedback = aiDiag.feedback ?? mcr.feedback
        mcr.remediation = aiDiag.remediation ?? null
      } else {
        mcr.error_type = 'blind_spot'
      }
    }
  }

  const subjectiveResults = subjectiveQuestions.map((q) => {
    const aiResult = aiResults.find((ar) => ar.question_id === q.id)
    const maxPts = POINTS[q.question_type] ?? 5
    return {
      question_id: q.id,
      is_correct: aiResult?.is_correct ?? false,
      score: Math.min(aiResult?.score ?? 0, maxPts),
      feedback: aiResult?.feedback ?? null,
      error_type: aiResult?.error_type ?? (aiResult?.is_correct ? null : 'blind_spot'),
      remediation: aiResult?.remediation ?? null,
    }
  })

  const allResults = [...mcResults, ...subjectiveResults]

  const totalScore = allResults.reduce((sum, r) => sum + r.score, 0)
  const maxScore = questions.reduce((sum, q) => sum + (POINTS[q.question_type] ?? 5), 0)
  const passRate = maxScore > 0 ? totalScore / maxScore : 0
  const isPassed = passRate >= 0.8

  const insertResponse = db.prepare(`
    INSERT INTO test_responses (question_id, user_answer, is_correct, score, ai_feedback, error_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const tx = db.transaction(() => {
    for (const q of questions) {
      const answer = body.answers.find((a) => a.question_id === q.id)
      const result = allResults.find((r) => r.question_id === q.id)
      insertResponse.run(
        q.id,
        answer?.user_answer ?? '',
        result?.is_correct ? 1 : 0,
        result?.score ?? 0,
        result?.feedback ?? null,
        result?.error_type ?? null
      )
    }

    const insertMistake = db.prepare(`
      INSERT INTO mistakes (module_id, kp_id, knowledge_point, error_type, source, remediation)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    for (const r of allResults) {
      if (r.is_correct) continue
      const q = questions.find((qu) => qu.id === r.question_id)!
      const kpIdsArr: number[] = q.kp_ids ? JSON.parse(q.kp_ids) : []
      insertMistake.run(
        id,
        q.kp_id ?? kpIdsArr[0] ?? null,
        q.question_text.slice(0, 200),
        r.error_type ?? 'blind_spot',
        'test',
        r.remediation ?? null
      )
    }

    db.prepare(`
      UPDATE test_papers SET total_score = ?, pass_rate = ?, is_passed = ? WHERE id = ?
    `).run(totalScore, passRate, isPassed ? 1 : 0, body.paper_id)

    if (isPassed) {
      db.prepare('UPDATE modules SET learning_status = ? WHERE id = ?').run('completed', id)

      const existingSchedule = db.prepare(
        'SELECT id FROM review_schedule WHERE module_id = ? AND review_round = 1'
      ).get(id) as { id: number } | undefined

      if (!existingSchedule) {
        db.prepare(
          "INSERT INTO review_schedule (module_id, review_round, due_date, status) VALUES (?, 1, date('now', '+3 days'), 'pending')"
        ).run(id)
      }

      const clusterResults = db.prepare(`
        SELECT
          kp.cluster_id,
          COUNT(*) as total,
          SUM(CASE WHEN tr.is_correct = 1 THEN 1 ELSE 0 END) as correct
        FROM test_questions tq
        JOIN knowledge_points kp ON tq.kp_id = kp.id
        JOIN test_responses tr ON tr.question_id = tq.id
        WHERE tq.paper_id = ?
        GROUP BY kp.cluster_id
      `).all(body.paper_id) as Array<{
        cluster_id: number | null
        total: number
        correct: number | null
      }>

      for (const clusterResult of clusterResults) {
        if (clusterResult.cluster_id === null) continue

        const cluster = db.prepare(
          'SELECT current_p_value, consecutive_correct FROM clusters WHERE id = ?'
        ).get(clusterResult.cluster_id) as
          | { current_p_value: number; consecutive_correct: number }
          | undefined

        if (!cluster) continue

        const correctCount = clusterResult.correct ?? 0

        if (correctCount === clusterResult.total) {
          const newConsecutive = cluster.consecutive_correct + 1
          const newPValue = newConsecutive >= 2
            ? Math.min(cluster.current_p_value + 1, 5)
            : cluster.current_p_value

          db.prepare(
            'UPDATE clusters SET consecutive_correct = ?, current_p_value = ? WHERE id = ?'
          ).run(newConsecutive, newPValue, clusterResult.cluster_id)
          continue
        }

        const newPValue = Math.max(cluster.current_p_value - 1, 1)
        db.prepare(
          'UPDATE clusters SET consecutive_correct = 0, current_p_value = ? WHERE id = ?'
        ).run(newPValue, clusterResult.cluster_id)
      }
    }
  })

  tx()

  logAction(
    'Test scoring complete',
    `paperId=${body.paper_id}, score=${totalScore}/${maxScore}, passed=${isPassed}`
  )

  const responseData = questions.map((q) => {
    const result = allResults.find((r) => r.question_id === q.id)
    const answer = body.answers.find((a) => a.question_id === q.id)
    return {
      question_id: q.id,
      question_type: q.question_type,
      question_text: q.question_text,
      options: q.options ? JSON.parse(q.options) : null,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      user_answer: answer?.user_answer ?? '',
      is_correct: result?.is_correct ?? false,
      score: result?.score ?? 0,
      max_score: POINTS[q.question_type] ?? 5,
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

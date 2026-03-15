import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getClaudeClient, CLAUDE_MODEL } from '@/lib/claude'
import { recordMistakes } from '@/lib/mistakes'

interface Question {
  id: number
  prompt: string
  answer_key: string
  explanation: string
}

interface UserAnswer {
  question_id: number
  response_text: string
}

// POST /api/modules/[moduleId]/test-evaluate — 评分 + 更新过关状态
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const { moduleId } = await params
  const { answers } = await req.json() as { answers: UserAnswer[] }

  if (!answers || answers.length === 0) {
    return NextResponse.json({ error: '缺少答题数据' }, { status: 400 })
  }

  const db = getDb()

  const questions = db
    .prepare('SELECT id, prompt, answer_key, explanation FROM questions WHERE module_id = ? AND type = ? ORDER BY id')
    .all(Number(moduleId), 'test') as Question[]

  if (questions.length === 0) {
    return NextResponse.json({ error: '没有测试题' }, { status: 404 })
  }

  // 单选题自动评分（answer_key 是单个字母 A/B/C/D）
  const isMC = (q: Question) => /^[ABCD]$/.test(q.answer_key.trim())

  const mcQuestions = questions.filter(isMC)
  const openQuestions = questions.filter((q) => !isMC(q))

  // 自动评分单选题
  const mcResults = mcQuestions.map((q) => {
    const userAnswer = answers.find((a) => a.question_id === q.id)
    const correct = userAnswer?.response_text.trim().toUpperCase() === q.answer_key.trim().toUpperCase()
    return {
      question_id: q.id,
      score: correct ? 5 : 0,
      error_type: correct ? null : '知识盲点',
      feedback: correct
        ? '正确'
        : `错误。正确答案是 ${q.answer_key}。${q.explanation}`,
    }
  })

  // AI 评分开放题（计算题 + 思考题）
  let openResults: Array<{
    question_id: number
    score: number
    error_type: string | null
    feedback: string
  }> = []

  if (openQuestions.length > 0) {
    const claude = getClaudeClient()

    const prompt = `你是一位专业的考试评卷老师，请对以下开放题进行评分。

${openQuestions.map((q, i) => {
  const userAnswer = answers.find((a) => a.question_id === q.id)
  return `【第${i + 1}题】（${q.prompt.length < 20 ? '思考题' : '计算题'}，满分${q.prompt.includes('计算') ? 5 : 10}分）
题目：${q.prompt}
参考答案：${q.answer_key}
评分要点：${q.explanation}
学生回答：${userAnswer?.response_text ?? '（未作答）'}`
}).join('\n\n---\n\n')}

评分标准：
- 计算题满分 5 分：步骤正确 3 分，结果正确 2 分
- 思考题满分 10 分：覆盖关键要点酌情给分

错误类型（仅在扣分时填写）：知识盲点 / 程序性失误 / 粗心错误 / 概念混淆

请以严格 JSON 格式返回：
{
  "results": [
    {
      "question_id": 123,
      "score": 4,
      "error_type": "程序性失误",
      "feedback": "步骤思路正确，但最后一步计算出错。正确结果应为..."
    }
  ]
}`

    const message = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawContent = message.content[0]
    if (rawContent.type !== 'text') {
      return NextResponse.json({ error: 'Claude 返回格式异常' }, { status: 500 })
    }

    try {
      const jsonMatch = rawContent.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('未找到 JSON')
      const parsed = JSON.parse(jsonMatch[0])
      openResults = parsed.results
    } catch {
      return NextResponse.json({ error: 'Claude 返回内容无法解析' }, { status: 500 })
    }
  }

  const allResults = [...mcResults, ...openResults]

  // 写入 user_responses
  const insertResp = db.prepare(
    'INSERT INTO user_responses (question_id, response_text, score, error_type) VALUES (?, ?, ?, ?)'
  )
  const insertAll = db.transaction(() => {
    answers.forEach((a) => {
      const result = allResults.find((r) => r.question_id === a.question_id)
      insertResp.run(a.question_id, a.response_text, result?.score ?? null, result?.error_type ?? null)
    })
  })
  insertAll()

  // 判断是否过关：单选题正确率 ≥ 80%（硬规则）
  const mcCorrect = mcResults.filter((r) => r.score > 0).length
  const mcTotal = mcResults.length
  const mcRate = mcTotal > 0 ? mcCorrect / mcTotal : 1
  const passed = mcRate >= 0.8

  // 更新模块过关状态
  db.prepare('UPDATE modules SET pass_status = ?, learning_status = ? WHERE id = ?').run(
    passed ? 'passed' : 'not_passed',
    'completed',
    Number(moduleId)
  )

  // 记录错题（任何失分题目均记录）
  const mistakeRecords = allResults
    .filter((r) => r.score === 0 || (r.score !== null && r.score < 5 && !isMC(questions.find((q) => q.id === r.question_id)!)))
    .map((r) => {
      const q = questions.find((qu) => qu.id === r.question_id)!
      return {
        moduleId: Number(moduleId),
        questionId: r.question_id,
        errorType: r.error_type,
        explanation: q.explanation,
      }
    })
  recordMistakes(db, mistakeRecords)

  // 组装最终结果（含 feedback）
  const finalResults = questions.map((q) => {
    const r = allResults.find((res) => res.question_id === q.id)
    const userAnswer = answers.find((a) => a.question_id === q.id)
    return {
      id: q.id,
      prompt: q.prompt,
      answer_key: q.answer_key,
      response_text: userAnswer?.response_text ?? '',
      score: r?.score ?? 0,
      error_type: r?.error_type ?? null,
      feedback: r?.feedback ?? '',
    }
  })

  return NextResponse.json({
    passed,
    mc_rate: Math.round(mcRate * 100),
    results: finalResults,
  })
}

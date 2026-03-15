import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getClaudeClient, CLAUDE_MODEL } from '@/lib/claude'

interface Question {
  id: number
  prompt: string
  answer_key: string
  explanation: string
}

interface UserResponse {
  id: number
  question_id: number
  response_text: string
}

// POST /api/modules/[moduleId]/evaluate — AI 逐题评分
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const { moduleId } = await params
  const db = getDb()

  const questions = db
    .prepare('SELECT id, prompt, answer_key, explanation FROM questions WHERE module_id = ? AND type = ? ORDER BY id')
    .all(Number(moduleId), 'qa') as Question[]

  if (questions.length === 0) {
    return NextResponse.json({ error: '没有题目' }, { status: 404 })
  }

  const responses = db
    .prepare(`
      SELECT ur.id, ur.question_id, ur.response_text
      FROM user_responses ur
      JOIN questions q ON ur.question_id = q.id
      WHERE q.module_id = ? AND q.type = 'qa'
    `)
    .all(Number(moduleId)) as UserResponse[]

  if (responses.length < questions.length) {
    return NextResponse.json({ error: '还有题目未作答' }, { status: 400 })
  }

  // 已有评分则直接返回
  const firstResponse = responses[0]
  const alreadyScored = db
    .prepare('SELECT score FROM user_responses WHERE id = ?')
    .get(firstResponse.id) as { score: number | null } | undefined

  if (alreadyScored?.score !== null && alreadyScored?.score !== undefined) {
    const scored = db
      .prepare(`
        SELECT q.id, q.prompt, q.answer_key, q.explanation,
               ur.response_text, ur.score, ur.error_type
        FROM questions q
        JOIN user_responses ur ON ur.question_id = q.id
        WHERE q.module_id = ? AND q.type = 'qa'
        ORDER BY q.id
      `)
      .all(Number(moduleId))
    return NextResponse.json({ evaluations: scored })
  }

  const claude = getClaudeClient()

  const qaList = questions.map((q) => {
    const resp = responses.find((r) => r.question_id === q.id)
    return {
      questionId: q.id,
      prompt: q.prompt,
      answer_key: q.answer_key,
      explanation: q.explanation,
      user_answer: resp?.response_text ?? '',
    }
  })

  const prompt = `你是一位专业的教学评估老师，请逐题评分并给出诊断。

以下是学生的 Q&A 作答记录，请对每道题进行评估。

${qaList.map((q, i) => `
【第${i + 1}题】
题目：${q.prompt}
参考答案：${q.answer_key}
解析：${q.explanation}
学生回答：${q.user_answer}
`).join('\n---\n')}

评分标准：
- 满分 10 分
- 8-10 分：理解正确，表述清晰
- 5-7 分：大体正确，有遗漏或表述不准确
- 0-4 分：理解有误或未能回答要点

错误类型（仅在扣分时填写，四选一）：
- 知识盲点：完全不知道这个概念
- 程序性失误：懂原理但步骤执行错
- 粗心错误：偶发，非系统性错误
- 概念混淆：把 A 误认为 B

请以严格 JSON 格式返回，不要有任何额外文字：
{
  "evaluations": [
    {
      "question_id": ${qaList[0]?.questionId},
      "score": 8,
      "error_type": null,
      "feedback": "评价：指出答对了什么，错在哪里，应该如何补充"
    }
  ]
}`

  const message = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const rawContent = message.content[0]
  if (rawContent.type !== 'text') {
    return NextResponse.json({ error: 'Claude 返回格式异常' }, { status: 500 })
  }

  let parsed: {
    evaluations: Array<{
      question_id: number
      score: number
      error_type: string | null
      feedback: string
    }>
  }
  try {
    const jsonMatch = rawContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('未找到 JSON')
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return NextResponse.json({ error: 'Claude 返回内容无法解析' }, { status: 500 })
  }

  // 写回评分
  const updateResponse = db.prepare(
    'UPDATE user_responses SET score = ?, error_type = ? WHERE question_id = ?'
  )
  const updateAll = db.transaction(() => {
    parsed.evaluations.forEach((ev) => {
      updateResponse.run(ev.score, ev.error_type ?? null, ev.question_id)
    })
  })
  updateAll()

  // 返回完整评估结果（含题目 + 用户回答 + 评分 + feedback）
  const result = db
    .prepare(`
      SELECT q.id, q.prompt, q.answer_key, q.explanation,
             ur.response_text, ur.score, ur.error_type
      FROM questions q
      JOIN user_responses ur ON ur.question_id = q.id
      WHERE q.module_id = ? AND q.type = 'qa'
      ORDER BY q.id
    `)
    .all(Number(moduleId))

  // feedback 来自 Claude 返回，合并进结果
  const withFeedback = (result as Array<Record<string, unknown>>).map((row) => {
    const ev = parsed.evaluations.find((e) => e.question_id === row['id'])
    return { ...row, feedback: ev?.feedback ?? '' }
  })

  return NextResponse.json({ evaluations: withFeedback })
}

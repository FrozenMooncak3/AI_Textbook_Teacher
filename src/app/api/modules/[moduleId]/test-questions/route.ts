import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getClaudeClient, CLAUDE_MODEL } from '@/lib/claude'

interface Module {
  id: number
  book_id: number
  title: string
  summary: string
  kp_count: number
}

interface Book {
  raw_text: string
  title: string
}

// GET /api/modules/[moduleId]/test-questions — 获取测试题，若无则生成
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const { moduleId } = await params
  const db = getDb()

  const module_ = db
    .prepare('SELECT id, book_id, title, summary, kp_count FROM modules WHERE id = ?')
    .get(Number(moduleId)) as Module | undefined

  if (!module_) {
    return NextResponse.json({ error: '模块不存在' }, { status: 404 })
  }

  // 已有测试题则直接返回
  const existing = db
    .prepare('SELECT * FROM questions WHERE module_id = ? AND type = ? ORDER BY id')
    .all(Number(moduleId), 'test') as Array<{
      id: number; module_id: number; type: string; prompt: string; answer_key: string; explanation: string
    }>

  if (existing.length > 0) {
    return NextResponse.json({ questions: existing })
  }

  const book = db
    .prepare('SELECT raw_text, title FROM books WHERE id = ?')
    .get(module_.book_id) as Book | undefined

  if (!book) {
    return NextResponse.json({ error: '教材不存在' }, { status: 404 })
  }

  const claude = getClaudeClient()
  const text = book.raw_text.slice(0, 100000)

  // 单选题数量基于 KP，最少 5 题
  const mcCount = Math.max(5, Math.round(module_.kp_count * 0.6))

  const prompt = `你是一位专业的出题老师，请为以下教材模块出模块测试题。

教材：${book.title}
模块：${module_.title}
模块概述：${module_.summary}
知识点数量：${module_.kp_count} 个

教材原文：
${text}

请出以下题目：
- 单选题：${mcCount} 道（每道 5 分，4 个选项 A/B/C/D）
- 计算题：2 道（每道 5 分）
- 思考题：2 道（每道 10 分）

单选题设计要求（严格遵守，违反则重出）：
- 禁止：正确答案明显最长
- 禁止：只有一个选项提到关键词
- 禁止：使用"一定""绝对""所有"等绝对词
- 禁止：正确选项直接复述题干关键词
- 必须：至少 1 道 C2 评估题（包含正面 + 负面信号，4 个选项对应 4 种不同权衡结论）
- 必须：错误选项合理，不能一眼排除

计算题要求：
- 至少 1 道逆向计算题（已知结果，反推条件）
- 数字必须自洽，出题后自行验算

请以严格 JSON 格式返回，不要有任何额外文字。
重要：所有字段值内部不得出现英文双引号 "，如需强调词语请用【】或『』代替：
{
  "questions": [
    {
      "type": "mc",
      "prompt": "题目内容",
      "options": {"A": "选项A", "B": "选项B", "C": "选项C", "D": "选项D"},
      "answer_key": "B",
      "explanation": "解析：为什么B正确，其他选项错在哪里"
    },
    {
      "type": "calc",
      "prompt": "计算题题目，包含完整数据",
      "answer_key": "完整计算步骤和结果",
      "explanation": "考察知识点和解题要点"
    },
    {
      "type": "essay",
      "prompt": "思考题题目",
      "answer_key": "参考答案要点",
      "explanation": "评分要点"
    }
  ]
}`

  const message = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 6000,
    messages: [{ role: 'user', content: prompt }],
  })

  const rawContent = message.content[0]
  if (rawContent.type !== 'text') {
    return NextResponse.json({ error: 'Claude 返回格式异常' }, { status: 500 })
  }

  let parsed: {
    questions: Array<{
      type: string
      prompt: string
      options?: Record<string, string>
      answer_key: string
      explanation: string
    }>
  }
  try {
    const jsonMatch = rawContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('未找到 JSON')
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return NextResponse.json({ error: 'Claude 返回内容无法解析' }, { status: 500 })
  }

  const insert = db.prepare(
    'INSERT INTO questions (module_id, type, prompt, answer_key, explanation) VALUES (?, ?, ?, ?, ?)'
  )
  const insertAll = db.transaction(() => {
    parsed.questions.forEach((q) => {
      // 单选题把选项存入 prompt（方便展示），answer_key 只存正确字母
      const fullPrompt = q.options
        ? `${q.prompt}\n\nA. ${q.options['A']}\nB. ${q.options['B']}\nC. ${q.options['C']}\nD. ${q.options['D']}`
        : q.prompt
      insert.run(Number(moduleId), 'test', fullPrompt, q.answer_key, q.explanation)
    })
  })
  insertAll()

  const questions = db
    .prepare('SELECT * FROM questions WHERE module_id = ? AND type = ? ORDER BY id')
    .all(Number(moduleId), 'test')

  return NextResponse.json({ questions })
}

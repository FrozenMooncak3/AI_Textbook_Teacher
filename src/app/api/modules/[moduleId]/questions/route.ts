import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { generateText } from 'ai'
import { getModel, timeout } from '@/lib/ai'
import { logAction } from '@/lib/log'

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

// GET /api/modules/[moduleId]/questions — 获取题目，若无则先生成
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

  // 已有题目则直接返回
  const existing = db
    .prepare('SELECT * FROM questions WHERE module_id = ? AND type = ? ORDER BY id')
    .all(Number(moduleId), 'qa') as Array<{
      id: number; module_id: number; type: string; prompt: string; answer_key: string; explanation: string
    }>

  if (existing.length > 0) {
    return NextResponse.json({ questions: existing })
  }

  // 生成题目
  const book = db
    .prepare('SELECT raw_text, title FROM books WHERE id = ?')
    .get(module_.book_id) as Book | undefined

  if (!book) {
    return NextResponse.json({ error: '教材不存在' }, { status: 404 })
  }

  const bookText = book.raw_text.slice(0, 100000)

  // 题量根据 KP 数量决定（约 KP 数量的 0.8 倍，最少 3 题）
  const questionCount = Math.max(3, Math.round(module_.kp_count * 0.8))

  const prompt = `你是一位专业的学习设计师，请为以下教材模块出 Q&A 练习题。

教材：${book.title}
模块：${module_.title}
模块概述：${module_.summary}
知识点数量：${module_.kp_count} 个

教材原文：
${bookText}

请出 ${questionCount} 道 Q&A 练习题，要求：
1. 覆盖位置类、计算类、C1判断类、C2评估类、定义类等不同知识点类型
2. 计算类题目须先给范例（展示完整计算过程），再给渐进题（提供新数据让学生套用步骤）
3. C2评估类题目须包含至少1个正面信号和1个负面信号
4. 题目难度递进，从基础概念到综合应用

请以严格 JSON 格式返回，不要有任何额外文字。
重要：所有字段值内部不得出现英文双引号 "，如需强调词语请用【】或『』代替。
{
  "questions": [
    {
      "prompt": "题目内容（清晰完整，必要时给出数据或情景）",
      "answer_key": "参考答案（完整详细，用于 AI 评分参考）",
      "explanation": "解析：说明这道题考察什么知识点，以及答题要点"
    }
  ]
}`

  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens: 8192,
    prompt,
    abortSignal: AbortSignal.timeout(timeout),
  })

  let parsed: { questions: Array<{ prompt: string; answer_key: string; explanation: string }> }
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('未找到 JSON')
    parsed = JSON.parse(jsonMatch[0])
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e)
    logAction('QA出题解析失败', `err=${err} ||| tail=${text.slice(-300)}`, 'error')
    return NextResponse.json({ error: 'Claude 返回内容无法解析' }, { status: 500 })
  }

  const insert = db.prepare(
    'INSERT INTO questions (module_id, type, prompt, answer_key, explanation) VALUES (?, ?, ?, ?, ?)'
  )
  const insertAll = db.transaction(() => {
    parsed.questions.forEach((q) => {
      insert.run(Number(moduleId), 'qa', q.prompt, q.answer_key, q.explanation)
    })
  })
  insertAll()

  const questions = db
    .prepare('SELECT * FROM questions WHERE module_id = ? AND type = ? ORDER BY id')
    .all(Number(moduleId), 'qa')

  return NextResponse.json({ questions })
}

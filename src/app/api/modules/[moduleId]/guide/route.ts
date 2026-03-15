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

// POST /api/modules/[moduleId]/guide — 生成读前指引
export async function POST(
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

  const book = db
    .prepare('SELECT raw_text, title FROM books WHERE id = ?')
    .get(module_.book_id) as Book | undefined

  if (!book) {
    return NextResponse.json({ error: '教材不存在' }, { status: 404 })
  }

  const claude = getClaudeClient()
  const text = book.raw_text.slice(0, 100000)

  const prompt = `你是一位专业的学习设计师。请为以下教材模块生成读前指引（任务锚）。

教材：${book.title}
模块：${module_.title}
模块概述：${module_.summary}
知识点数量：${module_.kp_count} 个

教材原文（供参考）：
${text}

请生成读前指引，必须包含以下三部分，以严格 JSON 格式返回，不要有任何额外文字：
{
  "goal": "学完这个模块能做什么——用一个具体的判断场景描述，不是抽象的'了解XX'（1-2句话）",
  "focus_points": [
    "重点1：最重要的知识点，帮助用户读书时有意识地注意",
    "重点2",
    "重点3"
  ],
  "common_mistakes": [
    "容易混淆的地方1：本模块最常见的认知误区，提前预警",
    "容易混淆的地方2"
  ]
}`

  const message = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const rawContent = message.content[0]
  if (rawContent.type !== 'text') {
    return NextResponse.json({ error: 'Claude 返回格式异常' }, { status: 500 })
  }

  let guide: { goal: string; focus_points: string[]; common_mistakes: string[] }
  try {
    const jsonMatch = rawContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('未找到 JSON')
    guide = JSON.parse(jsonMatch[0])
  } catch {
    return NextResponse.json({ error: 'Claude 返回内容无法解析' }, { status: 500 })
  }

  return NextResponse.json({ guide })
}

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getClaudeClient, CLAUDE_MODEL } from '@/lib/claude'

// POST /api/modules — 为指定书籍生成模块地图
export async function POST(req: NextRequest) {
  const { bookId } = await req.json() as { bookId?: number }
  if (!bookId) {
    return NextResponse.json({ error: '缺少 bookId' }, { status: 400 })
  }

  const db = getDb()
  const book = db
    .prepare('SELECT id, title, raw_text FROM books WHERE id = ?')
    .get(bookId) as { id: number; title: string; raw_text: string } | undefined

  if (!book) {
    return NextResponse.json({ error: '教材不存在' }, { status: 404 })
  }

  // 已有模块则不重复生成
  const existing = db.prepare('SELECT id FROM modules WHERE book_id = ?').all(bookId)
  if (existing.length > 0) {
    return NextResponse.json({ error: '模块已存在，不可重复生成' }, { status: 409 })
  }

  const claude = getClaudeClient()

  // 文本过长时截断（100k 字符安全边界）
  const text = book.raw_text.slice(0, 100000)

  const prompt = `你是一位专业的学习设计师，请将以下教材文本拆分为学习模块。

教材名称：${book.title}

教材内容：
${text}

请按照以下规则拆分：
1. 以书中的小节（二级/三级标题）为自然分割点，不按页数机械切割
2. 每个模块必须覆盖至少 4 种知识点类型（位置类/计算类/C1判断类/C2评估类/定义类）
3. 模块间知识点数量差距不超过 2:1
4. 明确标注跨模块依赖关系

请以严格的 JSON 格式返回，不要有任何额外文字，格式如下：
{
  "modules": [
    {
      "title": "模块名称（对应小节名）",
      "summary": "核心技能描述：学完后能做什么具体判断（1-2句话）",
      "kp_count": 8,
      "kp_breakdown": {
        "位置类": 2,
        "计算类": 2,
        "C1判断类": 1,
        "C2评估类": 2,
        "定义类": 1
      },
      "dependency": "无 / 依赖模块X的某知识点"
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

  let parsed: { modules: Array<{ title: string; summary: string; kp_count: number; dependency: string }> }
  try {
    // 提取 JSON（Claude 有时会在前后加 ```json 标记）
    const jsonMatch = rawContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('未找到 JSON')
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return NextResponse.json({ error: 'Claude 返回内容无法解析为 JSON' }, { status: 500 })
  }

  // 写入数据库
  const insertModule = db.prepare(
    'INSERT INTO modules (book_id, title, summary, order_index, kp_count) VALUES (?, ?, ?, ?, ?)'
  )
  const insertMany = db.transaction(() => {
    parsed.modules.forEach((mod, idx) => {
      insertModule.run(bookId, mod.title, mod.summary, idx + 1, mod.kp_count)
    })
  })
  insertMany()

  const modules = db
    .prepare('SELECT * FROM modules WHERE book_id = ? ORDER BY order_index')
    .all(bookId)

  return NextResponse.json({ modules }, { status: 201 })
}

// GET /api/modules?bookId=X — 获取书籍的模块列表
export async function GET(req: NextRequest) {
  const bookId = req.nextUrl.searchParams.get('bookId')
  if (!bookId) {
    return NextResponse.json({ error: '缺少 bookId' }, { status: 400 })
  }

  const db = getDb()
  const modules = db
    .prepare('SELECT * FROM modules WHERE book_id = ? ORDER BY order_index')
    .all(Number(bookId))

  return NextResponse.json({ modules })
}

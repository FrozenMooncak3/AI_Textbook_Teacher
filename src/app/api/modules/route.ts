import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { getModel, timeout } from '@/lib/ai'
import { insert, query, queryOne } from '@/lib/db'
import { logAction } from '@/lib/log'

interface BookRow {
  id: number
  title: string
  raw_text: string | null
}

interface ModuleRow {
  id: number
  book_id: number
  title: string
  summary: string
  order_index: number
  kp_count: number
  cluster_count: number
  page_start: number | null
  page_end: number | null
  learning_status: string
  guide_json: string | null
  created_at: string
}

interface GeneratedModule {
  title: string
  summary: string
  kp_count: number
  dependency: string
}

async function listModules(bookId: number): Promise<ModuleRow[]> {
  return query<ModuleRow>(
    'SELECT * FROM modules WHERE book_id = $1 ORDER BY order_index ASC',
    [bookId]
  )
}

// POST /api/modules - 为指定书籍生成模块地图
export async function POST(req: NextRequest) {
  const { bookId } = await req.json() as { bookId?: number }
  const normalizedBookId = Number(bookId)
  if (!Number.isInteger(normalizedBookId) || normalizedBookId <= 0) {
    return NextResponse.json({ error: '缺少 bookId' }, { status: 400 })
  }

  const book = await queryOne<BookRow>(
    'SELECT id, title, raw_text FROM books WHERE id = $1',
    [normalizedBookId]
  )

  if (!book) {
    return NextResponse.json({ error: '教材不存在' }, { status: 404 })
  }

  if (!book.raw_text?.trim()) {
    return NextResponse.json({ error: '教材原文为空，无法生成模块' }, { status: 409 })
  }

  const existing = await query<{ id: number }>('SELECT id FROM modules WHERE book_id = $1', [normalizedBookId])
  if (existing.length > 0) {
    return NextResponse.json({ error: '模块已存在，不可重复生成' }, { status: 409 })
  }

  await logAction('生成模块地图', `bookId=${normalizedBookId}，教材：${book.title}`)

  const bookText = book.raw_text.slice(0, 50_000)
  const prompt = `你是一位专业的学习设计师，请将以下教材文本拆分为学习模块。

教材名称：${book.title}

教材内容：
${bookText}

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
      "dependency": "无 / 依赖模块X的某知识点"
    }
  ]
}`

  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens: 8192,
    prompt,
    abortSignal: AbortSignal.timeout(timeout),
  })

  let parsed: { modules: GeneratedModule[] }
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('未找到 JSON')
    }

    parsed = JSON.parse(jsonMatch[0]) as { modules: GeneratedModule[] }
  } catch {
    await logAction('模块生成解析失败', `len=${text.length} tail=${text.slice(-100)}`, 'error')
    return NextResponse.json({ error: 'Claude 返回内容无法解析为 JSON' }, { status: 500 })
  }

  for (const [index, module_] of parsed.modules.entries()) {
    await insert(
      'INSERT INTO modules (book_id, title, summary, order_index, kp_count) VALUES ($1, $2, $3, $4, $5)',
      [normalizedBookId, module_.title, module_.summary, index + 1, module_.kp_count]
    )
  }

  const modules = await listModules(normalizedBookId)

  await logAction('模块地图生成成功', `bookId=${normalizedBookId}，共 ${parsed.modules.length} 个模块`)
  return NextResponse.json({ modules }, { status: 201 })
}

// GET /api/modules?bookId=X - 获取书籍的模块列表
export async function GET(req: NextRequest) {
  const bookId = Number(req.nextUrl.searchParams.get('bookId'))
  if (!Number.isInteger(bookId) || bookId <= 0) {
    return NextResponse.json({ error: '缺少 bookId' }, { status: 400 })
  }

  const modules = await listModules(bookId)
  return NextResponse.json({ modules })
}

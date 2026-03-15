import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// POST /api/qa/[questionId]/respond — 保存用户回答
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const { questionId } = await params
  const { response_text } = await req.json() as { response_text?: string }

  if (!response_text || !response_text.trim()) {
    return NextResponse.json({ error: '回答不能为空' }, { status: 400 })
  }

  const db = getDb()

  const question = db
    .prepare('SELECT id FROM questions WHERE id = ?')
    .get(Number(questionId))

  if (!question) {
    return NextResponse.json({ error: '题目不存在' }, { status: 404 })
  }

  // 已答题目不可修改（产品不变量）
  const existing = db
    .prepare('SELECT id FROM user_responses WHERE question_id = ?')
    .get(Number(questionId))

  if (existing) {
    return NextResponse.json({ error: '该题已作答，不可修改' }, { status: 409 })
  }

  const result = db
    .prepare('INSERT INTO user_responses (question_id, response_text) VALUES (?, ?)')
    .run(Number(questionId), response_text.trim())

  return NextResponse.json({ responseId: result.lastInsertRowid }, { status: 201 })
}

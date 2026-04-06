import { NextRequest, NextResponse } from 'next/server'
import { insert, queryOne } from '@/lib/db'

// POST /api/qa/[questionId]/respond - 保存用户回答
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const { questionId } = await params
  const { response_text } = await req.json() as { response_text?: string }

  if (!response_text || !response_text.trim()) {
    return NextResponse.json({ error: '回答不能为空' }, { status: 400 })
  }

  const normalizedQuestionId = Number(questionId)
  const question = await queryOne<{ id: number }>(
    'SELECT id FROM qa_questions WHERE id = $1',
    [normalizedQuestionId]
  )

  if (!question) {
    return NextResponse.json({ error: '题目不存在' }, { status: 404 })
  }

  const existing = await queryOne<{ id: number }>(
    'SELECT id FROM qa_responses WHERE question_id = $1',
    [normalizedQuestionId]
  )

  if (existing) {
    return NextResponse.json({ error: '该题已作答，不可修改' }, { status: 409 })
  }

  const responseId = await insert(
    'INSERT INTO qa_responses (question_id, user_answer) VALUES ($1, $2)',
    [normalizedQuestionId, response_text.trim()]
  )

  return NextResponse.json({ responseId }, { status: 201 })
}

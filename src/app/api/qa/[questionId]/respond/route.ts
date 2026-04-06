import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { insert, queryOne } from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const { questionId } = await params
  const user = await requireUser(req)
  const { response_text } = await req.json() as { response_text?: string }

  if (!response_text || !response_text.trim()) {
    return NextResponse.json({ error: 'Response cannot be empty' }, { status: 400 })
  }

  const normalizedQuestionId = Number(questionId)
  const question = await queryOne<{ id: number }>(
    `
      SELECT q.id
      FROM qa_questions q
      JOIN modules m ON m.id = q.module_id
      JOIN books b ON b.id = m.book_id
      WHERE q.id = $1 AND b.user_id = $2
    `,
    [normalizedQuestionId, user.id]
  )

  if (!question) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

  const existing = await queryOne<{ id: number }>(
    'SELECT id FROM qa_responses WHERE question_id = $1',
    [normalizedQuestionId]
  )

  if (existing) {
    return NextResponse.json({ error: 'Question already answered and cannot be changed' }, { status: 409 })
  }

  const responseId = await insert(
    'INSERT INTO qa_responses (question_id, user_answer) VALUES ($1, $2)',
    [normalizedQuestionId, response_text.trim()]
  )

  return NextResponse.json({ responseId }, { status: 201 })
}

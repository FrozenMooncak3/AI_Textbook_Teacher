import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// GET /api/modules/[moduleId]/mistakes — 查询该模块的错题
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const { moduleId } = await params
  const db = getDb()

  const mistakes = db
    .prepare(`
      SELECT
        m.id,
        m.knowledge_point,
        m.next_review_date,
        q.prompt,
        q.answer_key,
        q.explanation,
        ur.response_text,
        ur.score,
        ur.error_type
      FROM mistakes m
      JOIN questions q ON m.question_id = q.id
      LEFT JOIN user_responses ur ON ur.question_id = q.id
      WHERE m.module_id = ?
      ORDER BY m.id DESC
    `)
    .all(Number(moduleId))

  return NextResponse.json({ mistakes })
}

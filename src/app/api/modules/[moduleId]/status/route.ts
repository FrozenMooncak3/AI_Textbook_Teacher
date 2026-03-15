import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

const VALID_STATUSES = ['unstarted', 'reading', 'qa', 'testing', 'completed']

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const { moduleId } = await params
  const { learning_status } = await req.json() as { learning_status?: string }

  if (!learning_status || !VALID_STATUSES.includes(learning_status)) {
    return NextResponse.json({ error: '无效的状态值' }, { status: 400 })
  }

  const db = getDb()
  const result = db
    .prepare('UPDATE modules SET learning_status = ? WHERE id = ?')
    .run(learning_status, Number(moduleId))

  if (result.changes === 0) {
    return NextResponse.json({ error: '模块不存在' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}

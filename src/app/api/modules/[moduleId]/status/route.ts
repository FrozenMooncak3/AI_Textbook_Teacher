import { NextRequest, NextResponse } from 'next/server'
import { queryOne, run } from '@/lib/db'

const VALID_STATUSES = ['unstarted', 'reading', 'qa', 'notes_generated', 'testing', 'completed']
const VALID_TRANSITIONS: Record<string, string[]> = {
  unstarted: ['reading'],
  reading: ['qa'],
  qa: ['notes_generated'],
  notes_generated: ['testing', 'completed'],
  testing: ['completed'],
  completed: [],
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const { moduleId } = await params
  const { learning_status } = await req.json() as { learning_status?: string }

  if (!learning_status || !VALID_STATUSES.includes(learning_status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const module_ = await queryOne<{ learning_status: string }>(
    'SELECT learning_status FROM modules WHERE id = $1',
    [Number(moduleId)]
  )

  if (!module_) {
    return NextResponse.json({ error: 'Module not found' }, { status: 404 })
  }

  const allowedTransitions = VALID_TRANSITIONS[module_.learning_status] ?? []
  if (!allowedTransitions.includes(learning_status)) {
    return NextResponse.json(
      { error: `Invalid status transition from ${module_.learning_status} to ${learning_status}` },
      { status: 409 }
    )
  }

  await run('UPDATE modules SET learning_status = $1 WHERE id = $2', [
    learning_status,
    Number(moduleId),
  ])

  return NextResponse.json({ ok: true })
}

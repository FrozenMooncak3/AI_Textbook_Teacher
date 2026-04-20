import { NextRequest, NextResponse } from 'next/server'
import { requireModuleOwner } from '@/lib/auth'
import { queryOne, run } from '@/lib/db'
import { UserError } from '@/lib/errors'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const { moduleId } = await params
  const id = Number(moduleId)

  try {
    await requireModuleOwner(req, id)
  } catch (error) {
    if (error instanceof UserError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }

    throw error
  }

  await req.json().catch(() => ({}))

  const moduleRow = await queryOne<{ learning_status: string }>(
    'SELECT learning_status FROM modules WHERE id = $1',
    [id]
  )

  if (!moduleRow) {
    return NextResponse.json({ error: 'Module not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  if (moduleRow.learning_status !== 'taught') {
    return NextResponse.json(
      { error: 'Teaching phase not complete', code: 'TEACHING_NOT_DONE' },
      { status: 400 }
    )
  }

  await run("UPDATE modules SET learning_status = 'qa_in_progress' WHERE id = $1", [id])

  return NextResponse.json({
    qaSessionId: id,
    redirectUrl: `/modules/${id}/qa`,
  })
}

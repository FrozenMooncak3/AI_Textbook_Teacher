import { NextRequest, NextResponse } from 'next/server'
import { requireBookOwner } from '@/lib/auth'
import { queryOne, run } from '@/lib/db'
import { UserError } from '@/lib/errors'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string; moduleId: string }> }
) {
  const { bookId, moduleId } = await params
  const normalizedBookId = Number(bookId)
  const normalizedModuleId = Number(moduleId)

  try {
    await requireBookOwner(req, normalizedBookId)
  } catch (error) {
    if (error instanceof UserError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }

    throw error
  }

  await req.json().catch(() => ({}))

  const moduleRow = await queryOne<{ id: number }>(
    'SELECT id FROM modules WHERE id = $1 AND book_id = $2',
    [normalizedModuleId, normalizedBookId]
  )

  if (!moduleRow) {
    return NextResponse.json({ error: 'Module not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  await run("UPDATE modules SET learning_status = 'unstarted' WHERE id = $1", [normalizedModuleId])

  return NextResponse.json({
    ok: true,
    redirectUrl: `/modules/${normalizedModuleId}/activate`,
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { requireBookOwner } from '@/lib/auth'
import { run } from '@/lib/db'
import { UserError } from '@/lib/errors'

type LearningMode = 'teaching' | 'full'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const { bookId } = await params
  const id = Number(bookId)

  try {
    await requireBookOwner(req, id)
  } catch (error) {
    if (error instanceof UserError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }

    throw error
  }

  const body = await req.json().catch(() => ({}))
  const newMode = body.newMode

  if (newMode !== 'teaching' && newMode !== 'full') {
    return NextResponse.json({ error: 'Invalid mode', code: 'INVALID_MODE' }, { status: 400 })
  }

  await run('UPDATE books SET learning_mode = $1 WHERE id = $2', [newMode satisfies LearningMode, id])

  return NextResponse.json({ ok: true, learningMode: newMode })
}

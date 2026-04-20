import { NextRequest, NextResponse } from 'next/server'
import { requireModuleOwner } from '@/lib/auth'
import { queryOne, query } from '@/lib/db'
import { UserError } from '@/lib/errors'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const { moduleId } = await params
  const id = Number(moduleId)
  try {
    await requireModuleOwner(req, id)
  } catch (e) {
    if (e instanceof UserError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.statusCode })
    }
    throw e
  }
  const mod = await queryOne<{
    id: number
    book_id: number
    title: string
    summary: string
    order_index: number
    kp_count: number
    cluster_count: number
    learning_status: string
  }>(
    `SELECT id, book_id, title, summary, order_index, kp_count, cluster_count, learning_status
     FROM modules WHERE id=$1`,
    [id]
  )
  if (!mod) return NextResponse.json({ error: 'Module not found' }, { status: 404 })

  const kps = await query<{
    id: number
    kp_code: string
    section_name: string
    description: string
    importance: number
    cluster_id: number | null
  }>(
    `SELECT id, kp_code, section_name, description, importance, cluster_id
     FROM knowledge_points WHERE module_id=$1 ORDER BY id ASC`,
    [id]
  )

  return NextResponse.json({ ...mod, knowledge_points: kps })
}

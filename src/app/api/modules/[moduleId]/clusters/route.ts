import { NextRequest, NextResponse } from 'next/server'
import { requireModuleOwner } from '@/lib/auth'
import { query } from '@/lib/db'
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

  const rows = await query<{
    id: number
    name: string
    kp_ids: number[]
  }>(
    `SELECT c.id, c.name,
       COALESCE(
         ARRAY_AGG(kp.id ORDER BY kp.id ASC) FILTER (WHERE kp.id IS NOT NULL),
         ARRAY[]::int[]
       ) AS kp_ids
     FROM clusters c
     LEFT JOIN knowledge_points kp ON kp.cluster_id = c.id
     WHERE c.module_id = $1
     GROUP BY c.id, c.name
     ORDER BY c.id ASC`,
    [id]
  )
  return NextResponse.json({ clusters: rows })
}

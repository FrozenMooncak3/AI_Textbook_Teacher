import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { pool, queryOne } from '@/lib/db'
import { canUseTeaching } from '@/lib/entitlement'
import { emptyTranscript, type TeachingDepth, type TranscriptV1 } from '@/lib/teaching-types'

type CreateSessionBody = {
  moduleId?: unknown
  clusterId?: unknown
  depth?: unknown
}

type ModuleOwnerRow = {
  id: number
}

type KnowledgePointRow = {
  id: number
}

type InsertedSessionRow = {
  id: string
  transcript: TranscriptV1
}

export async function POST(req: NextRequest) {
  let user
  try {
    user = await requireUser(req)
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  if (!(await canUseTeaching(user.id))) {
    return NextResponse.json({ error: 'TEACHING_LOCKED' }, { status: 402 })
  }

  const body = (await req.json().catch(() => ({}))) as CreateSessionBody
  const moduleId = Number(body.moduleId)
  const clusterId = body.clusterId != null ? Number(body.clusterId) : null
  const depth: TeachingDepth = body.depth === 'light' ? 'light' : 'full'

  if (!Number.isInteger(moduleId) || moduleId <= 0) {
    return NextResponse.json({ error: 'MODULE_ID_REQUIRED' }, { status: 400 })
  }

  const moduleOwner = await queryOne<ModuleOwnerRow>(
    `
      SELECT m.id
      FROM modules m
      JOIN books b ON b.id = m.book_id
      WHERE m.id = $1 AND b.user_id = $2
    `,
    [moduleId, user.id]
  )

  if (!moduleOwner) {
    return NextResponse.json({ error: 'MODULE_NOT_FOUND' }, { status: 404 })
  }

  const transcript = emptyTranscript()
  transcript.state.depth = depth

  if (clusterId && Number.isInteger(clusterId)) {
    const firstKp = await queryOne<KnowledgePointRow>(
      `
        SELECT id
        FROM knowledge_points
        WHERE cluster_id = $1
        ORDER BY id ASC
        LIMIT 1
      `,
      [clusterId]
    )

    if (firstKp) {
      transcript.state.currentKpId = firstKp.id
    }
  }

  const result = await pool.query<InsertedSessionRow>(
    `
      INSERT INTO teaching_sessions (module_id, cluster_id, user_id, transcript, depth)
      VALUES ($1, $2, $3, $4::jsonb, $5)
      RETURNING id, transcript
    `,
    [moduleId, clusterId ?? null, user.id, JSON.stringify(transcript), depth]
  )

  return NextResponse.json({
    sessionId: result.rows[0].id,
    transcript: result.rows[0].transcript,
  })
}

import { handleRoute } from '@/lib/handle-route'
import { getDb } from '@/lib/db'
import { UserError } from '@/lib/errors'

interface MistakeRow {
  id: number
  module_id: number
  kp_id: number | null
  knowledge_point: string
  error_type: string
  source: string
  remediation: string | null
  is_resolved: number
  created_at: string
  kp_code: string | null
  kp_description: string | null
}

export const GET = handleRoute(async (_req, context) => {
  const { moduleId } = await context!.params
  const id = Number(moduleId)
  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid module ID', 'INVALID_ID', 400)
  }

  const db = getDb()

  const mistakes = db.prepare(`
    SELECT
      m.id, m.module_id, m.kp_id, m.knowledge_point, m.error_type,
      m.source, m.remediation, m.is_resolved, m.created_at,
      kp.kp_code, kp.description AS kp_description
    FROM mistakes m
    LEFT JOIN knowledge_points kp ON kp.id = m.kp_id
    WHERE m.module_id = ?
    ORDER BY m.created_at DESC
  `).all(id) as MistakeRow[]

  return {
    data: {
      mistakes: mistakes.map((m) => ({
        id: m.id,
        kp_id: m.kp_id,
        kp_code: m.kp_code,
        kp_description: m.kp_description,
        knowledge_point: m.knowledge_point,
        error_type: m.error_type,
        source: m.source,
        remediation: m.remediation,
        is_resolved: m.is_resolved === 1,
        created_at: m.created_at,
      })),
    },
  }
})

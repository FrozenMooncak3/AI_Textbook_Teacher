import { query } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'

interface MistakeRow {
  id: number
  module_id: number
  kp_id: number | null
  knowledge_point: string | null
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

  const mistakes = await query<MistakeRow>(
    `
      SELECT
        m.id,
        m.module_id,
        m.kp_id,
        m.knowledge_point,
        m.error_type,
        m.source,
        m.remediation,
        m.is_resolved,
        m.created_at,
        kp.kp_code,
        kp.description AS kp_description
      FROM mistakes m
      LEFT JOIN knowledge_points kp ON kp.id = m.kp_id
      WHERE m.module_id = $1
      ORDER BY m.created_at DESC
    `,
    [id]
  )

  return {
    data: {
      mistakes: mistakes.map((mistake) => ({
        id: mistake.id,
        kp_id: mistake.kp_id,
        kp_code: mistake.kp_code,
        kp_description: mistake.kp_description,
        knowledge_point: mistake.knowledge_point,
        error_type: mistake.error_type,
        source: mistake.source,
        remediation: mistake.remediation,
        is_resolved: mistake.is_resolved === 1,
        created_at: mistake.created_at,
      })),
    },
  }
})

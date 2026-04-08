import { requireReviewScheduleOwner } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import {
  buildAllocations,
  type ReviewClusterRow,
} from '@/lib/review-question-utils'

interface ScheduleRow {
  id: number
  module_id: number
  review_round: number
}

interface ModuleRow {
  title: string
}

interface ClusterWithKpCountRow extends ReviewClusterRow {
  kp_count: number
}

interface PreviousScheduleRow {
  completed_at: string
}

const REVIEW_INTERVALS_DAYS = [3, 7, 15, 30, 60] as const

function parseScheduleId(value: string): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid schedule ID', 'INVALID_ID', 400)
  }

  return id
}

export const GET = handleRoute(async (req, context) => {
  const { scheduleId } = await context!.params
  const id = parseScheduleId(scheduleId)

  await requireReviewScheduleOwner(req, id)

  const schedule = await queryOne<ScheduleRow>(
    `
      SELECT id, module_id, review_round
      FROM review_schedule
      WHERE id = $1
    `,
    [id]
  )

  if (!schedule) {
    throw new UserError('Review schedule not found', 'NOT_FOUND', 404)
  }

  const mod = await queryOne<ModuleRow>(
    `
      SELECT title
      FROM modules
      WHERE id = $1
    `,
    [schedule.module_id]
  )

  const clusters = await query<ClusterWithKpCountRow>(
    `
      SELECT
        c.id,
        c.name,
        c.current_p_value,
        COUNT(kp.id)::int AS kp_count
      FROM clusters c
      LEFT JOIN knowledge_points kp ON kp.cluster_id = c.id
      WHERE c.module_id = $1
      GROUP BY c.id, c.name, c.current_p_value
      ORDER BY c.id ASC
    `,
    [schedule.module_id]
  )

  const masteryDistribution = {
    mastered: 0,
    improving: 0,
    weak: 0,
  }

  for (const cluster of clusters) {
    if (cluster.current_p_value <= 1) {
      masteryDistribution.mastered += 1
    } else if (cluster.current_p_value === 2) {
      masteryDistribution.improving += 1
    } else {
      masteryDistribution.weak += 1
    }
  }

  const estimatedQuestions = buildAllocations(clusters).reduce(
    (sum, allocation) => sum + allocation.count,
    0
  )

  const intervalDays =
    REVIEW_INTERVALS_DAYS[schedule.review_round - 1] ??
    REVIEW_INTERVALS_DAYS[REVIEW_INTERVALS_DAYS.length - 1]

  const previous = await queryOne<PreviousScheduleRow>(
    `
      SELECT completed_at
      FROM review_schedule
      WHERE module_id = $1
        AND status = 'completed'
        AND id != $2
      ORDER BY completed_at DESC
      LIMIT 1
    `,
    [schedule.module_id, schedule.id]
  )

  const previousCompletedAt = previous?.completed_at ? new Date(previous.completed_at) : null
  const lastReviewDaysAgo = previousCompletedAt && !Number.isNaN(previousCompletedAt.getTime())
    ? Math.floor((Date.now() - previousCompletedAt.getTime()) / (1000 * 60 * 60 * 24))
    : null

  return {
    data: {
      scheduleId: schedule.id,
      moduleId: schedule.module_id,
      moduleName: mod?.title ?? 'Unknown',
      reviewRound: schedule.review_round,
      intervalDays,
      estimatedQuestions,
      lastReviewDaysAgo,
      masteryDistribution,
      clusters: clusters.map((cluster) => ({
        id: cluster.id,
        name: cluster.name,
        currentP: cluster.current_p_value,
        kpCount: cluster.kp_count,
      })),
    },
  }
})

import { getDb } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'

type ReviewResult = 'all_correct' | 'has_errors' | null

interface ScheduleRow {
  id: number
  module_id: number
  review_round: number
  status: string
}

interface UnansweredRow {
  id: number
}

interface ClusterResultRow {
  cluster_id: number
  cluster_name: string
  current_p_value: number
  last_review_result: ReviewResult
  consecutive_correct: number
  total: number
  correct: number
}

interface ExistingScheduleRow {
  id: number
}

interface NextScheduleRow {
  review_round: number
  due_date: string
}

interface UpdatedClusterRow {
  current_p_value: number
  consecutive_correct: number
}

const ROUND_INTERVALS = [0, 3, 7, 15, 30, 60] as const
const MAX_REVIEW_ROUND = 5

function parseScheduleId(value: string): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid schedule ID', 'INVALID_ID', 400)
  }

  return id
}

export const POST = handleRoute(async (_req, context) => {
  const { scheduleId } = await context!.params
  const id = parseScheduleId(scheduleId)
  const db = getDb()

  const schedule = db.prepare(`
    SELECT id, module_id, review_round, status
    FROM review_schedule
    WHERE id = ?
  `).get(id) as ScheduleRow | undefined

  if (!schedule) {
    throw new UserError('Schedule not found', 'NOT_FOUND', 404)
  }

  if (schedule.status === 'completed') {
    throw new UserError('Already completed', 'ALREADY_COMPLETED', 409)
  }

  const unanswered = db.prepare(`
    SELECT rq.id
    FROM review_questions rq
    LEFT JOIN review_responses rr ON rr.question_id = rq.id
    WHERE rq.schedule_id = ? AND rr.id IS NULL
  `).all(id) as UnansweredRow[]

  if (unanswered.length > 0) {
    throw new UserError(`${unanswered.length} questions unanswered`, 'INCOMPLETE', 400)
  }

  const clusterResults = db.prepare(`
    SELECT
      rq.cluster_id,
      c.name AS cluster_name,
      c.current_p_value,
      c.last_review_result,
      c.consecutive_correct,
      COUNT(*) AS total,
      SUM(CASE WHEN rr.is_correct = 1 THEN 1 ELSE 0 END) AS correct
    FROM review_questions rq
    JOIN review_responses rr ON rr.question_id = rq.id
    JOIN clusters c ON rq.cluster_id = c.id
    WHERE rq.schedule_id = ?
    GROUP BY rq.cluster_id
    ORDER BY rq.cluster_id ASC
  `).all(id) as ClusterResultRow[]

  if (clusterResults.length === 0) {
    throw new UserError('No review results found', 'NO_RESULTS', 409)
  }

  const completeReview = db.transaction(() => {
    for (const clusterResult of clusterResults) {
      const allCorrect = clusterResult.correct === clusterResult.total
      const previousResult = clusterResult.last_review_result
      const pBefore = clusterResult.current_p_value
      let pAfter = pBefore
      let newConsecutive = clusterResult.consecutive_correct

      if (allCorrect) {
        pAfter = Math.max(1, pBefore - 1)
        newConsecutive += 1
      } else if (previousResult === 'has_errors') {
        pAfter = Math.min(4, pBefore + 1)
        newConsecutive = 0
      } else {
        newConsecutive = 0
      }

      const nextResult: Exclude<ReviewResult, null> = allCorrect ? 'all_correct' : 'has_errors'

      db.prepare(`
        UPDATE clusters
        SET current_p_value = ?, consecutive_correct = ?, last_review_result = ?
        WHERE id = ?
      `).run(pAfter, newConsecutive, nextResult, clusterResult.cluster_id)

      db.prepare(`
        INSERT INTO review_records (
          schedule_id,
          cluster_id,
          questions_count,
          correct_count,
          p_value_before,
          p_value_after
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        id,
        clusterResult.cluster_id,
        clusterResult.total,
        clusterResult.correct,
        pBefore,
        pAfter
      )
    }

    const allClustersSkip = clusterResults.every((clusterResult) => {
      const updated = db.prepare(`
        SELECT current_p_value, consecutive_correct
        FROM clusters
        WHERE id = ?
      `).get(clusterResult.cluster_id) as UpdatedClusterRow | undefined

      return (
        updated !== undefined &&
        updated.current_p_value === 1 &&
        updated.consecutive_correct >= 3
      )
    })

    const nextRound = schedule.review_round + 1
    let effectiveRound = nextRound

    if (allClustersSkip && nextRound <= MAX_REVIEW_ROUND) {
      effectiveRound = Math.min(nextRound + 1, MAX_REVIEW_ROUND)

      db.prepare(`
        UPDATE clusters
        SET consecutive_correct = 0
        WHERE module_id = ?
      `).run(schedule.module_id)
    }

    if (effectiveRound <= MAX_REVIEW_ROUND) {
      const existing = db.prepare(`
        SELECT id
        FROM review_schedule
        WHERE module_id = ? AND review_round = ?
      `).get(schedule.module_id, effectiveRound) as ExistingScheduleRow | undefined

      if (!existing) {
        const interval = ROUND_INTERVALS[effectiveRound] ?? ROUND_INTERVALS[MAX_REVIEW_ROUND]

        db.prepare(`
          INSERT INTO review_schedule (module_id, review_round, due_date, status)
          VALUES (?, ?, date('now', '+' || ? || ' days'), 'pending')
        `).run(schedule.module_id, effectiveRound, interval)
      }
    }

    db.prepare(`
      UPDATE review_schedule
      SET status = 'completed', completed_at = datetime('now')
      WHERE id = ?
    `).run(id)

    const nextSchedule = effectiveRound <= MAX_REVIEW_ROUND
      ? db.prepare(`
          SELECT review_round, due_date
          FROM review_schedule
          WHERE module_id = ? AND review_round = ?
        `).get(schedule.module_id, effectiveRound) as NextScheduleRow | undefined
      : undefined

    return {
      nextReview: nextSchedule
        ? {
            round: nextSchedule.review_round,
            due_date: nextSchedule.due_date,
          }
        : null,
    }
  })

  const { nextReview } = completeReview()
  const totalQuestions = clusterResults.reduce((sum, clusterResult) => sum + clusterResult.total, 0)
  const correctCount = clusterResults.reduce((sum, clusterResult) => sum + clusterResult.correct, 0)

  logAction(
    'Review completed',
    `scheduleId=${id}, moduleId=${schedule.module_id}, total=${totalQuestions}, correct=${correctCount}`
  )

  return {
    data: {
      summary: {
        total_questions: totalQuestions,
        correct_count: correctCount,
        accuracy: totalQuestions > 0 ? correctCount / totalQuestions : 0,
        clusters: clusterResults.map((clusterResult) => ({
          name: clusterResult.cluster_name,
          correct: clusterResult.correct,
          total: clusterResult.total,
        })),
      },
      next_review: nextReview,
    },
  }
})

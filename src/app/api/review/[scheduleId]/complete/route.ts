import { requireReviewScheduleOwner } from '@/lib/auth'
import { pool, query, queryOne } from '@/lib/db'
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

interface ClusterResultRow {
  cluster_id: number
  cluster_name: string
  current_p_value: number
  last_review_result: ReviewResult
  consecutive_correct: number
  total: number
  correct: number
}

interface NextScheduleRow {
  review_round: number
  due_date: string
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

export const POST = handleRoute(async (req, context) => {
  const { scheduleId } = await context!.params
  const id = parseScheduleId(scheduleId)

  await requireReviewScheduleOwner(req, id)

  const schedule = await queryOne<ScheduleRow>(
    `
      SELECT id, module_id, review_round, status
      FROM review_schedule
      WHERE id = $1
    `,
    [id]
  )

  if (!schedule) {
    throw new UserError('Schedule not found', 'NOT_FOUND', 404)
  }

  if (schedule.status === 'completed') {
    throw new UserError('Already completed', 'ALREADY_COMPLETED', 409)
  }

  const unanswered = await query<{ id: number }>(
    `
      SELECT rq.id
      FROM review_questions rq
      LEFT JOIN review_responses rr ON rr.question_id = rq.id
      WHERE rq.schedule_id = $1 AND rr.id IS NULL
    `,
    [id]
  )

  if (unanswered.length > 0) {
    throw new UserError(`${unanswered.length} questions unanswered`, 'INCOMPLETE', 400)
  }

  const clusterResults = await query<ClusterResultRow>(
    `
      SELECT
        rq.cluster_id,
        c.name AS cluster_name,
        c.current_p_value,
        c.last_review_result,
        c.consecutive_correct,
        COUNT(*)::int AS total,
        SUM(CASE WHEN rr.is_correct = 1 THEN 1 ELSE 0 END)::int AS correct
      FROM review_questions rq
      JOIN review_responses rr ON rr.question_id = rq.id
      JOIN clusters c ON rq.cluster_id = c.id
      WHERE rq.schedule_id = $1
      GROUP BY rq.cluster_id, c.name, c.current_p_value, c.last_review_result, c.consecutive_correct
      ORDER BY rq.cluster_id ASC
    `,
    [id]
  )

  if (clusterResults.length === 0) {
    throw new UserError('No review results found', 'NO_RESULTS', 409)
  }

  const updates = clusterResults.map((clusterResult) => {
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

    return {
      ...clusterResult,
      pBefore,
      pAfter,
      newConsecutive,
      nextResult: (allCorrect ? 'all_correct' : 'has_errors') as Exclude<ReviewResult, null>,
    }
  })

  const nextRound = schedule.review_round + 1
  let effectiveRound = nextRound

  const allClustersSkip = updates.every((update) => update.pAfter === 1 && update.newConsecutive >= 3)
  if (allClustersSkip && nextRound <= MAX_REVIEW_ROUND) {
    effectiveRound = Math.min(nextRound + 1, MAX_REVIEW_ROUND)
  }

  const client = await pool.connect()
  let nextReview: { round: number; due_date: string } | null = null

  try {
    await client.query('BEGIN')

    for (const update of updates) {
      await client.query(
        `
          UPDATE clusters
          SET current_p_value = $1, consecutive_correct = $2, last_review_result = $3
          WHERE id = $4
        `,
        [update.pAfter, update.newConsecutive, update.nextResult, update.cluster_id]
      )

      await client.query(
        `
          INSERT INTO review_records (
            schedule_id,
            cluster_id,
            questions_count,
            correct_count,
            p_value_before,
            p_value_after
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [id, update.cluster_id, update.total, update.correct, update.pBefore, update.pAfter]
      )
    }

    if (allClustersSkip && nextRound <= MAX_REVIEW_ROUND) {
      await client.query('UPDATE clusters SET consecutive_correct = 0 WHERE module_id = $1', [
        schedule.module_id,
      ])
    }

    if (effectiveRound <= MAX_REVIEW_ROUND) {
      const existing = await client.query<{ id: number }>(
        `
          SELECT id
          FROM review_schedule
          WHERE module_id = $1 AND review_round = $2
        `,
        [schedule.module_id, effectiveRound]
      )

      if (existing.rows.length === 0) {
        const interval = ROUND_INTERVALS[effectiveRound] ?? ROUND_INTERVALS[MAX_REVIEW_ROUND]
        await client.query(
          `
            INSERT INTO review_schedule (module_id, review_round, due_date, status)
            VALUES ($1, $2, ((CURRENT_DATE + ($3 || ' days')::interval)::date)::text, 'pending')
          `,
          [schedule.module_id, effectiveRound, String(interval)]
        )
      }

      const nextSchedule = await client.query<NextScheduleRow>(
        `
          SELECT review_round, due_date
          FROM review_schedule
          WHERE module_id = $1 AND review_round = $2
        `,
        [schedule.module_id, effectiveRound]
      )

      const row = nextSchedule.rows[0]
      if (row) {
        nextReview = {
          round: row.review_round,
          due_date: row.due_date,
        }
      }
    }

    await client.query(
      `
        UPDATE review_schedule
        SET status = 'completed', completed_at = NOW()::text
        WHERE id = $1
      `,
      [id]
    )

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  const totalQuestions = clusterResults.reduce((sum, clusterResult) => sum + clusterResult.total, 0)
  const correctCount = clusterResults.reduce((sum, clusterResult) => sum + clusterResult.correct, 0)

  await logAction(
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

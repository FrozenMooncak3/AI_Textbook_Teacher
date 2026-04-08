import { requireReviewScheduleOwner } from '@/lib/auth'
import { generateText } from 'ai'
import { getModel, timeout } from '@/lib/ai'
import { pool, query, queryOne } from '@/lib/db'
import { UserError, SystemError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'
import { getPrompt } from '@/lib/prompt-templates'
import {
  buildAllocations,
  type GeneratedReviewQuestion,
  MAX_REVIEW_QUESTIONS as MAX_QUESTIONS,
  type ReviewAllocationRow as AllocationRow,
  type ReviewClusterRow as ClusterRow,
  type ReviewKnowledgePointRow as KnowledgePointRow,
  type ReviewQuestionType as QuestionType,
  validateGeneratedReviewQuestion,
} from '@/lib/review-question-utils'

interface ScheduleRow {
  id: number
  module_id: number
  review_round: number
  status: string
}

interface ResumeQuestionRow {
  id: number
  question_type: QuestionType
  question_text: string
  options: string | null
  order_index: number
}

interface CountRow {
  c: number
}

interface MistakeRow {
  kp_id: number | null
  knowledge_point: string | null
  error_type: string
  remediation: string | null
}

interface PreviousQuestionRow {
  question_text: string
}

interface StoredQuestionResponse {
  id: number
  type: QuestionType
  text: string
  options: string[] | null
}

function parseScheduleId(value: string): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid schedule ID', 'INVALID_ID', 400)
  }

  return id
}

function parseJsonArray<T>(value: string | null, fallback: T[]): T[] {
  if (!value) {
    return fallback
  }

  const parsed = JSON.parse(value) as unknown
  if (!Array.isArray(parsed)) {
    throw new Error('Expected JSON array')
  }

  return parsed as T[]
}

function formatQuestion(row: ResumeQuestionRow): StoredQuestionResponse {
  try {
    return {
      id: row.id,
      type: row.question_type,
      text: row.question_text,
      options: row.options ? parseJsonArray<string>(row.options, []) : null,
    }
  } catch (error) {
    throw new SystemError('Failed to parse stored review question', error)
  }
}

function formatClustersWithP(clusters: ClusterRow[], allocations: AllocationRow[]): string {
  return clusters
    .map((cluster) => {
      const allocation = allocations.find((item) => item.clusterId === cluster.id)
      return `- Cluster "${cluster.name}" (id=${cluster.id}): P=${cluster.current_p_value}, allocated ${allocation?.count ?? 0} questions`
    })
    .join('\n')
}

function formatKnowledgePointTable(kps: KnowledgePointRow[]): string {
  return kps
    .map((kp) => {
      const clusterPart = kp.cluster_id === null ? 'cluster=?' : `cluster=${kp.cluster_id}`
      return `- [ID=${kp.id}] [${kp.kp_code}] (${kp.type}, ${clusterPart}) ${kp.description}\n  Detail: ${kp.detailed_content}`
    })
    .join('\n')
}

function formatMistakes(mistakes: MistakeRow[]): string {
  if (mistakes.length === 0) {
    return '(No unresolved mistakes)'
  }

  return mistakes
    .map((mistake) => {
      const kpLabel = mistake.kp_id === null ? 'KP ?' : `KP ${mistake.kp_id}`
      const knowledgePoint = mistake.knowledge_point ?? 'Unknown knowledge point'
      const remediation = mistake.remediation ? `; remediation=${mistake.remediation}` : ''
      return `- ${kpLabel}: ${knowledgePoint} (${mistake.error_type}${remediation})`
    })
    .join('\n')
}

function formatRecentQuestions(questions: PreviousQuestionRow[]): string {
  if (questions.length === 0) {
    return '(No previous review questions)'
  }

  return questions.map((question) => `- ${question.question_text}`).join('\n')
}

function parseGeneratedQuestions(text: string): GeneratedReviewQuestion[] {
  let cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '')
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new SystemError('No JSON in reviewer response', text.slice(0, 300))
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    const raw = jsonMatch[0]
    let fixed = ''
    let inString = false

    for (let index = 0; index < raw.length; index++) {
      const char = raw[index]
      if (char === '"' && (index === 0 || raw[index - 1] !== '\\')) {
        inString = !inString
        fixed += char
        continue
      }

      if (inString && char.charCodeAt(0) < 0x20) {
        if (char === '\n') fixed += '\\n'
        else if (char === '\r') fixed += '\\r'
        else if (char === '\t') fixed += '\\t'
        continue
      }

      fixed += char
    }

    cleaned = fixed
    parsed = JSON.parse(cleaned)
  }

  if (parsed === null || typeof parsed !== 'object' || !('questions' in parsed)) {
    throw new SystemError('Missing questions array from reviewer', text.slice(0, 300))
  }

  const { questions } = parsed as { questions?: unknown }
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new SystemError('Empty questions array from reviewer', text.slice(0, 300))
  }

  return questions as GeneratedReviewQuestion[]
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
    throw new UserError('Review schedule not found', 'NOT_FOUND', 404)
  }

  if (schedule.status !== 'pending') {
    throw new UserError('Review schedule is not pending', 'INVALID_STATUS', 409)
  }

  const existingQuestions = await query<{ id: number }>(
    'SELECT id FROM review_questions WHERE schedule_id = $1',
    [id]
  )

  if (existingQuestions.length > 0) {
    const nextQuestion = await queryOne<ResumeQuestionRow>(
      `
        SELECT rq.id, rq.question_type, rq.question_text, rq.options, rq.order_index
        FROM review_questions rq
        LEFT JOIN review_responses rr ON rr.question_id = rq.id
        WHERE rq.schedule_id = $1 AND rr.id IS NULL
        ORDER BY rq.order_index ASC
        LIMIT 1
      `,
      [id]
    )

    const totalQuestions = await queryOne<CountRow>(
      'SELECT COUNT(*)::int AS c FROM review_questions WHERE schedule_id = $1',
      [id]
    )
    const answeredQuestions = await queryOne<CountRow>(
      `
        SELECT COUNT(*)::int AS c
        FROM review_responses rr
        JOIN review_questions rq ON rr.question_id = rq.id
        WHERE rq.schedule_id = $1
      `,
      [id]
    )

    if (!nextQuestion) {
      return {
        data: {
          total_questions: totalQuestions?.c ?? 0,
          current_index: totalQuestions?.c ?? 0,
          all_answered: true,
        },
      }
    }

    return {
      data: {
        total_questions: totalQuestions?.c ?? 0,
        current_index: (answeredQuestions?.c ?? 0) + 1,
        question: formatQuestion(nextQuestion),
      },
    }
  }

  const clusters = await query<ClusterRow>(
    `
      SELECT id, name, current_p_value
      FROM clusters
      WHERE module_id = $1
      ORDER BY id ASC
    `,
    [schedule.module_id]
  )

  if (clusters.length === 0) {
    throw new UserError('No clusters found for this module', 'NO_CLUSTERS', 409)
  }

  const allocations = buildAllocations(clusters)
  const clusterIds = new Set(clusters.map((cluster) => cluster.id))

  const kps = await query<KnowledgePointRow>(
    `
      SELECT id, kp_code, description, type, detailed_content, cluster_id
      FROM knowledge_points
      WHERE module_id = $1
      ORDER BY cluster_id ASC, id ASC
    `,
    [schedule.module_id]
  )

  if (kps.length === 0) {
    throw new UserError('No knowledge points found for this module', 'NO_KPS', 409)
  }

  const knowledgePoints = new Map(kps.map((kp) => [kp.id, kp]))

  const mistakes = await query<MistakeRow>(
    `
      SELECT kp_id, knowledge_point, error_type, remediation
      FROM mistakes
      WHERE module_id = $1 AND is_resolved = 0
      ORDER BY created_at DESC
    `,
    [schedule.module_id]
  )

  const previousQuestions = schedule.review_round > 1
    ? await query<PreviousQuestionRow>(
        `
          SELECT rq.question_text
          FROM review_questions rq
          JOIN review_schedule rs ON rq.schedule_id = rs.id
          WHERE rs.module_id = $1 AND rs.review_round = $2
          ORDER BY rq.order_index ASC
        `,
        [schedule.module_id, schedule.review_round - 1]
      )
    : []

  const prompt = await getPrompt('reviewer', 'review_generation', {
    max_questions: String(MAX_QUESTIONS),
    clusters_with_p: formatClustersWithP(clusters, allocations),
    kp_table: formatKnowledgePointTable(kps),
    past_mistakes: formatMistakes(mistakes),
    recent_questions: formatRecentQuestions(previousQuestions),
  })

  await logAction(
    'Review generation started',
    `scheduleId=${id}, moduleId=${schedule.module_id}, clusterCount=${clusters.length}`
  )

  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens: 65536,
    prompt,
    abortSignal: AbortSignal.timeout(timeout),
  })

  let generatedQuestions: GeneratedReviewQuestion[]
  try {
    generatedQuestions = parseGeneratedQuestions(text)
  } catch (error) {
    await logAction('Review generation parse error', text.slice(0, 500), 'error')
    throw error
  }

  const storedQuestions: ResumeQuestionRow[] = []
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    let orderIndex = 0
    for (const [index, question] of generatedQuestions.entries()) {
      let validated
      try {
        validated = validateGeneratedReviewQuestion(question, index, clusterIds, knowledgePoints)
      } catch (error) {
        await logAction('Skipping invalid review question', String(error), 'warn')
        continue
      }

      const result = await client.query<{ id: number }>(
        `
          INSERT INTO review_questions (
            schedule_id,
            module_id,
            cluster_id,
            kp_id,
            question_type,
            question_text,
            options,
            correct_answer,
            explanation,
            order_index
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id
        `,
        [
          id,
          schedule.module_id,
          validated.clusterId,
          validated.kpId,
          validated.type,
          validated.text,
          validated.options === null ? null : JSON.stringify(validated.options),
          validated.correctAnswer,
          validated.explanation,
          orderIndex + 1,
        ]
      )

      storedQuestions.push({
        id: result.rows[0].id,
        question_type: validated.type,
        question_text: validated.text,
        options: validated.options === null ? null : JSON.stringify(validated.options),
        order_index: orderIndex + 1,
      })
      orderIndex += 1
    }

    if (storedQuestions.length === 0) {
      throw new Error('No valid review questions generated')
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw new SystemError('Failed to create review questions', error)
  } finally {
    client.release()
  }

  await logAction(
    'Review generation complete',
    `scheduleId=${id}, moduleId=${schedule.module_id}, questionCount=${storedQuestions.length}`
  )

  return {
    data: {
      total_questions: storedQuestions.length,
      current_index: 1,
      question: formatQuestion(storedQuestions[0]),
    },
  }
})

import { generateText } from 'ai'
import { getModel, timeout } from '@/lib/ai'
import { getDb } from '@/lib/db'
import { UserError, SystemError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'
import { getPrompt } from '@/lib/prompt-templates'

type QuestionType = 'single_choice' | 'c2_evaluation' | 'calculation' | 'essay'

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

interface ClusterRow {
  id: number
  name: string
  current_p_value: number
}

interface AllocationRow {
  clusterId: number
  pValue: number
  count: number
}

interface KnowledgePointRow {
  id: number
  kp_code: string
  description: string
  type: string
  detailed_content: string
  cluster_id: number | null
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

interface GeneratedQuestion {
  cluster_id: number
  kp_id: number
  type: string
  text: string
  options: string[] | null
  correct_answer: string
  explanation: string
}

interface StoredQuestionResponse {
  id: number
  type: QuestionType
  text: string
  options: string[] | null
}

const MAX_QUESTIONS = 10

const VALID_TYPES = new Set<QuestionType>([
  'single_choice',
  'c2_evaluation',
  'calculation',
  'essay',
])

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

function buildAllocations(clusters: ClusterRow[]): AllocationRow[] {
  let allocations = clusters.map((cluster) => ({
    clusterId: cluster.id,
    pValue: Math.max(1, cluster.current_p_value),
    count: Math.max(1, cluster.current_p_value),
  }))

  const total = allocations.reduce((sum, allocation) => sum + allocation.count, 0)
  if (total <= MAX_QUESTIONS) {
    return allocations
  }

  const scale = MAX_QUESTIONS / total
  allocations = allocations.map((allocation) => ({
    ...allocation,
    count: Math.max(1, Math.round(allocation.count * scale)),
  }))

  let adjusted = allocations.reduce((sum, allocation) => sum + allocation.count, 0)
  while (adjusted > MAX_QUESTIONS) {
    const highest = allocations
      .filter((allocation) => allocation.count > 1)
      .sort((left, right) => {
        if (right.pValue !== left.pValue) {
          return right.pValue - left.pValue
        }

        return right.count - left.count
      })[0]

    if (!highest) {
      break
    }

    highest.count -= 1
    adjusted -= 1
  }

  return allocations
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

function parseGeneratedQuestions(text: string): GeneratedQuestion[] {
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

  return questions as GeneratedQuestion[]
}

function validateGeneratedQuestion(
  question: GeneratedQuestion,
  index: number,
  clusterIds: Set<number>,
  knowledgePoints: Map<number, KnowledgePointRow>
): {
  clusterId: number
  kpId: number
  type: QuestionType
  text: string
  options: string[] | null
  correctAnswer: string
  explanation: string
} {
  if (!Number.isInteger(question.cluster_id) || !clusterIds.has(question.cluster_id)) {
    throw new Error(`Question ${index + 1} has invalid cluster_id`)
  }

  if (!Number.isInteger(question.kp_id)) {
    throw new Error(`Question ${index + 1} has invalid kp_id`)
  }

  const kp = knowledgePoints.get(question.kp_id)
  if (!kp) {
    throw new Error(`Question ${index + 1} references unknown kp_id`)
  }

  if (kp.cluster_id !== question.cluster_id) {
    throw new Error(`Question ${index + 1} kp_id/cluster_id mismatch`)
  }

  if (!VALID_TYPES.has(question.type as QuestionType)) {
    throw new Error(`Question ${index + 1} has invalid type`)
  }

  const text = typeof question.text === 'string' ? question.text.trim() : ''
  const correctAnswer = typeof question.correct_answer === 'string'
    ? question.correct_answer.trim()
    : ''
  const explanation = typeof question.explanation === 'string'
    ? question.explanation.trim()
    : ''

  if (!text || !correctAnswer || !explanation) {
    throw new Error(`Question ${index + 1} is missing required fields`)
  }

  const type = question.type as QuestionType
  if (type === 'single_choice') {
    if (!Array.isArray(question.options) || question.options.length !== 4) {
      throw new Error(`Question ${index + 1} must include 4 options`)
    }

    const options = question.options.map((option) => {
      if (typeof option !== 'string') {
        throw new Error(`Question ${index + 1} has non-string options`)
      }

      return option.trim()
    })

    if (options.some((option) => option.length === 0)) {
      throw new Error(`Question ${index + 1} has empty options`)
    }

    if (!['A', 'B', 'C', 'D'].includes(correctAnswer)) {
      throw new Error(`Question ${index + 1} has invalid single-choice answer`)
    }

    return {
      clusterId: question.cluster_id,
      kpId: question.kp_id,
      type,
      text,
      options,
      correctAnswer,
      explanation,
    }
  }

  if (question.options !== null) {
    throw new Error(`Question ${index + 1} must have null options`)
  }

  return {
    clusterId: question.cluster_id,
    kpId: question.kp_id,
    type,
    text,
    options: null,
    correctAnswer,
    explanation,
  }
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
    throw new UserError('Review schedule not found', 'NOT_FOUND', 404)
  }

  if (schedule.status !== 'pending') {
    throw new UserError('Review schedule is not pending', 'INVALID_STATUS', 409)
  }

  const existingQuestions = db.prepare(
    'SELECT id FROM review_questions WHERE schedule_id = ?'
  ).all(id) as { id: number }[]

  if (existingQuestions.length > 0) {
    const nextQuestion = db.prepare(`
      SELECT rq.id, rq.question_type, rq.question_text, rq.options, rq.order_index
      FROM review_questions rq
      LEFT JOIN review_responses rr ON rr.question_id = rq.id
      WHERE rq.schedule_id = ? AND rr.id IS NULL
      ORDER BY rq.order_index ASC
      LIMIT 1
    `).get(id) as ResumeQuestionRow | undefined

    const totalQuestions = db.prepare(
      'SELECT COUNT(*) as c FROM review_questions WHERE schedule_id = ?'
    ).get(id) as CountRow

    const answeredQuestions = db.prepare(`
      SELECT COUNT(*) as c
      FROM review_responses rr
      JOIN review_questions rq ON rr.question_id = rq.id
      WHERE rq.schedule_id = ?
    `).get(id) as CountRow

    if (!nextQuestion) {
      return {
        data: {
          total_questions: totalQuestions.c,
          current_index: totalQuestions.c,
          all_answered: true,
        },
      }
    }

    return {
      data: {
        total_questions: totalQuestions.c,
        current_index: answeredQuestions.c + 1,
        question: formatQuestion(nextQuestion),
      },
    }
  }

  const clusters = db.prepare(`
    SELECT id, name, current_p_value
    FROM clusters
    WHERE module_id = ?
    ORDER BY id ASC
  `).all(schedule.module_id) as ClusterRow[]

  if (clusters.length === 0) {
    throw new UserError('No clusters found for this module', 'NO_CLUSTERS', 409)
  }

  const allocations = buildAllocations(clusters)
  const clusterIds = new Set(clusters.map((cluster) => cluster.id))

  const kps = db.prepare(`
    SELECT id, kp_code, description, type, detailed_content, cluster_id
    FROM knowledge_points
    WHERE module_id = ?
    ORDER BY cluster_id ASC, id ASC
  `).all(schedule.module_id) as KnowledgePointRow[]

  if (kps.length === 0) {
    throw new UserError('No knowledge points found for this module', 'NO_KPS', 409)
  }

  const knowledgePoints = new Map(kps.map((kp) => [kp.id, kp]))

  const mistakes = db.prepare(`
    SELECT kp_id, knowledge_point, error_type, remediation
    FROM mistakes
    WHERE module_id = ? AND is_resolved = 0
    ORDER BY created_at DESC
  `).all(schedule.module_id) as MistakeRow[]

  const previousQuestions = schedule.review_round > 1
    ? db.prepare(`
        SELECT rq.question_text
        FROM review_questions rq
        JOIN review_schedule rs ON rq.schedule_id = rs.id
        WHERE rs.module_id = ? AND rs.review_round = ?
        ORDER BY rq.order_index ASC
      `).all(schedule.module_id, schedule.review_round - 1) as PreviousQuestionRow[]
    : []

  const prompt = getPrompt('reviewer', 'review_generation', {
    max_questions: String(MAX_QUESTIONS),
    clusters_with_p: formatClustersWithP(clusters, allocations),
    kp_table: formatKnowledgePointTable(kps),
    past_mistakes: formatMistakes(mistakes),
    recent_questions: formatRecentQuestions(previousQuestions),
  })

  logAction(
    'Review generation started',
    `scheduleId=${id}, moduleId=${schedule.module_id}, clusterCount=${clusters.length}`
  )

  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens: 65536,
    prompt,
    abortSignal: AbortSignal.timeout(timeout),
  })

  let generatedQuestions: GeneratedQuestion[]
  try {
    generatedQuestions = parseGeneratedQuestions(text)
  } catch (error) {
    logAction('Review generation parse error', text.slice(0, 500), 'error')
    throw error
  }

  const insertQuestion = db.prepare(`
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const storedQuestions: ResumeQuestionRow[] = []

  try {
    const transaction = db.transaction(() => {
      let orderIndex = 0

      for (const [index, question] of generatedQuestions.entries()) {
        let validated
        try {
          validated = validateGeneratedQuestion(question, index, clusterIds, knowledgePoints)
        } catch (error) {
          logAction('Skipping invalid review question', String(error), 'warn')
          continue
        }

        const result = insertQuestion.run(
          id,
          schedule.module_id,
          validated.clusterId,
          validated.kpId,
          validated.type,
          validated.text,
          validated.options === null ? null : JSON.stringify(validated.options),
          validated.correctAnswer,
          validated.explanation,
          orderIndex + 1
        )

        storedQuestions.push({
          id: Number(result.lastInsertRowid),
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
    })

    transaction()
  } catch (error) {
    throw new SystemError('Failed to create review questions', error)
  }

  const firstQuestion = storedQuestions[0]

  logAction(
    'Review generation complete',
    `scheduleId=${id}, moduleId=${schedule.module_id}, questionCount=${storedQuestions.length}`
  )

  return {
    data: {
      total_questions: storedQuestions.length,
      current_index: 1,
      question: formatQuestion(firstQuestion),
    },
  }
})

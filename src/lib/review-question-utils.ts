export type ReviewQuestionType = 'single_choice' | 'c2_evaluation' | 'calculation' | 'essay'

export interface ReviewKnowledgePointRow {
  id: number
  kp_code: string
  description: string
  type: string
  detailed_content: string
  cluster_id: number | null
}

export interface GeneratedReviewQuestion {
  cluster_id: number
  kp_id: number
  type: string
  text: string
  options?: string[] | null
  correct_answer: string
  explanation: string
}

export interface ValidatedReviewQuestion {
  clusterId: number
  kpId: number
  type: ReviewQuestionType
  text: string
  options: string[] | null
  correctAnswer: string
  explanation: string
}

export type ReviewMistakeErrorType = 'blind_spot' | 'procedural' | 'confusion' | 'careless'

export const MAX_REVIEW_QUESTIONS = 10
export const REVIEW_SCORING_MAX_OUTPUT_TOKENS = 8192

export interface ReviewClusterRow {
  id: number
  name: string
  current_p_value: number
}

export interface ReviewAllocationRow {
  clusterId: number
  pValue: number
  count: number
}

const VALID_REVIEW_QUESTION_TYPES = new Set<ReviewQuestionType>([
  'single_choice',
  'c2_evaluation',
  'calculation',
  'essay',
])

const VALID_REVIEW_ERROR_TYPES = new Set<ReviewMistakeErrorType>([
  'blind_spot',
  'procedural',
  'confusion',
  'careless',
])

export function normalizeReviewErrorType(errorType: string | null | undefined): ReviewMistakeErrorType {
  if (!errorType) {
    return 'confusion'
  }

  const normalized = errorType.trim().toLowerCase()
  if (VALID_REVIEW_ERROR_TYPES.has(normalized as ReviewMistakeErrorType)) {
    return normalized as ReviewMistakeErrorType
  }

  if (
    normalized.includes('confus') ||
    normalized.includes('mix') ||
    normalized.includes('concept')
  ) {
    return 'confusion'
  }

  if (
    normalized.includes('blind') ||
    normalized.includes('gap') ||
    normalized.includes('knowledge') ||
    normalized.includes('missing')
  ) {
    return 'blind_spot'
  }

  if (
    normalized.includes('proced') ||
    normalized.includes('step') ||
    normalized.includes('calculation') ||
    normalized.includes('process')
  ) {
    return 'procedural'
  }

  if (
    normalized.includes('careless') ||
    normalized.includes('slip') ||
    normalized.includes('typo')
  ) {
    return 'careless'
  }

  return 'confusion'
}

export function buildAllocations(clusters: ReviewClusterRow[]): ReviewAllocationRow[] {
  let allocations = clusters.map((cluster) => ({
    clusterId: cluster.id,
    pValue: Math.max(1, cluster.current_p_value),
    count: Math.max(1, cluster.current_p_value),
  }))

  const total = allocations.reduce((sum, allocation) => sum + allocation.count, 0)
  if (total <= MAX_REVIEW_QUESTIONS) {
    return allocations
  }

  const scale = MAX_REVIEW_QUESTIONS / total
  allocations = allocations.map((allocation) => ({
    ...allocation,
    count: Math.max(1, Math.round(allocation.count * scale)),
  }))

  let adjusted = allocations.reduce((sum, allocation) => sum + allocation.count, 0)
  while (adjusted > MAX_REVIEW_QUESTIONS) {
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

export function validateGeneratedReviewQuestion(
  question: GeneratedReviewQuestion,
  index: number,
  clusterIds: ReadonlySet<number>,
  knowledgePoints: ReadonlyMap<number, ReviewKnowledgePointRow>
): ValidatedReviewQuestion {
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

  if (!VALID_REVIEW_QUESTION_TYPES.has(question.type as ReviewQuestionType)) {
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

  const type = question.type as ReviewQuestionType
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

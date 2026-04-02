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

export const REVIEW_SCORING_MAX_OUTPUT_TOKENS = 8192

const VALID_REVIEW_QUESTION_TYPES = new Set<ReviewQuestionType>([
  'single_choice',
  'c2_evaluation',
  'calculation',
  'essay',
])

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

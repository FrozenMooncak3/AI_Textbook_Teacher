export type TeachingDepth = 'full' | 'light'
export type TeachingStatus = 'teaching' | 'ready_to_advance' | 'struggling'
export type KPType = 'factual' | 'conceptual' | 'procedural' | 'analytical' | 'evaluative'

export type TranscriptStateError = {
  reason: 'teacher_unavailable' | 'invalid_output'
  at: string
  attemptCount: number
}

export type TranscriptState = {
  depth: TeachingDepth
  currentKpId: number | null
  coveredKpIds: number[]
  strugglingStreak: number
  startedAt: string | null
  lastActiveAt: string | null
  tokensInTotal: number
  tokensOutTotal: number
  lastError?: TranscriptStateError
}

export type TranscriptMessageBase = {
  ts: string
}

export type SocraticQuestion = TranscriptMessageBase & {
  kind: 'socratic_question'
  role: 'teacher'
  content: string
  kpId?: number
  tokensIn?: number
  tokensOut?: number
  model?: string
}

export type StudentResponse = TranscriptMessageBase & {
  kind: 'student_response'
  role: 'user'
  content: string
}

export type KpTakeaway = TranscriptMessageBase & {
  kind: 'kp_takeaway'
  role: 'teacher'
  kpId: number
  summary: string
  tokensIn?: number
  tokensOut?: number
  model?: string
}

export type StrugglingHint = TranscriptMessageBase & {
  kind: 'struggling_hint'
  role: 'teacher'
  content: string
  kpId?: number
  tokensIn?: number
  tokensOut?: number
  model?: string
}

export type TranscriptMessage =
  | SocraticQuestion
  | StudentResponse
  | KpTakeaway
  | StrugglingHint

export type TranscriptV1 = {
  version: 1
  state: TranscriptState
  messages: TranscriptMessage[]
}

export function emptyTranscript(): TranscriptV1 {
  return {
    version: 1,
    state: {
      depth: 'full',
      currentKpId: null,
      coveredKpIds: [],
      strugglingStreak: 0,
      startedAt: null,
      lastActiveAt: null,
      tokensInTotal: 0,
      tokensOutTotal: 0,
    },
    messages: [],
  }
}

import { query, run } from './db'

interface RecordMistakeParams {
  moduleId: number
  knowledgePoint: string
  kpId?: number
  errorType: 'blind_spot' | 'procedural' | 'confusion' | 'careless'
  source?: 'test' | 'qa' | 'review'
  remediation?: string
}

interface BulkMistake {
  moduleId: number
  questionId?: number
  kpId?: number
  knowledgePoint?: string
  errorType: 'blind_spot' | 'procedural' | 'confusion' | 'careless' | string | null
  source?: 'test' | 'qa' | 'review'
  remediation?: string
  explanation?: string
}

const INSERT_MISTAKE_SQL = `
  INSERT INTO mistakes (module_id, kp_id, knowledge_point, error_type, source, remediation)
  VALUES ($1, $2, $3, $4, $5, $6)
`

export async function recordMistake(params: RecordMistakeParams): Promise<void> {
  await run(INSERT_MISTAKE_SQL, [
    params.moduleId,
    params.kpId ?? null,
    params.knowledgePoint,
    params.errorType,
    params.source ?? 'test',
    params.remediation ?? null,
  ])
}

export async function recordMistakes(mistakes: BulkMistake[]): Promise<void> {
  for (const mistake of mistakes) {
    if (!mistake.errorType) {
      continue
    }

    await run(INSERT_MISTAKE_SQL, [
      mistake.moduleId,
      mistake.kpId ?? null,
      mistake.knowledgePoint ?? mistake.explanation ?? '',
      mistake.errorType,
      mistake.source ?? 'test',
      mistake.remediation ?? null,
    ])
  }
}

export async function getUnresolvedMistakes(moduleId: number): Promise<unknown[]> {
  return query(
    'SELECT * FROM mistakes WHERE module_id = $1 AND is_resolved = 0 ORDER BY created_at DESC',
    [moduleId]
  )
}

export async function resolveMistake(mistakeId: number): Promise<void> {
  await run('UPDATE mistakes SET is_resolved = 1 WHERE id = $1', [mistakeId])
}

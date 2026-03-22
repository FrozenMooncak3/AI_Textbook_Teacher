import { getDb } from './db.ts'

interface RecordMistakeParams {
  moduleId: number
  knowledgePoint: string
  kpId?: number
  errorType: 'blind_spot' | 'procedural' | 'confusion' | 'careless'
  source?: 'test' | 'qa' | 'review'
  remediation?: string
}

export function recordMistake(params: RecordMistakeParams): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO mistakes (module_id, kp_id, knowledge_point, error_type, source, remediation)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    params.moduleId,
    params.kpId ?? null,
    params.knowledgePoint,
    params.errorType,
    params.source ?? 'test',
    params.remediation ?? null
  )
}

export function getUnresolvedMistakes(moduleId: number): unknown[] {
  const db = getDb()
  return db.prepare(
    'SELECT * FROM mistakes WHERE module_id = ? AND is_resolved = 0 ORDER BY created_at DESC'
  ).all(moduleId)
}

export function resolveMistake(mistakeId: number): void {
  const db = getDb()
  db.prepare('UPDATE mistakes SET is_resolved = 1 WHERE id = ?').run(mistakeId)
}

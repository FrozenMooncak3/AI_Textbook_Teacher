import Database from 'better-sqlite3'

interface MistakeRecord {
  moduleId: number
  questionId: number
  errorType: string | null
  explanation: string
}

function nextReviewDate(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString().split('T')[0]
}

export function recordMistakes(db: Database.Database, records: MistakeRecord[]): void {
  if (records.length === 0) return

  const insert = db.prepare(
    'INSERT INTO mistakes (module_id, question_id, knowledge_point, next_review_date) VALUES (?, ?, ?, ?)'
  )
  // 已存在则跳过（同一题不重复记录）
  const exists = db.prepare(
    'SELECT id FROM mistakes WHERE module_id = ? AND question_id = ?'
  )

  const insertAll = db.transaction(() => {
    for (const r of records) {
      const already = exists.get(r.moduleId, r.questionId)
      if (!already) {
        const knowledgePoint = r.errorType
          ? `[${r.errorType}] ${r.explanation.slice(0, 100)}`
          : r.explanation.slice(0, 100)
        insert.run(r.moduleId, r.questionId, knowledgePoint, nextReviewDate(3))
      }
    }
  })
  insertAll()
}

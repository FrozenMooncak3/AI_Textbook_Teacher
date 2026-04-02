import { handleRoute } from '@/lib/handle-route'
import { getDb } from '@/lib/db'

interface DueReview {
  schedule_id: number
  module_id: number
  module_title: string
  book_id: number
  book_title: string
  review_round: number
  due_date: string
}

export const GET = handleRoute(async () => {
  const db = getDb()
  const reviews = db.prepare(`
    SELECT
      rs.id AS schedule_id,
      rs.module_id,
      m.title AS module_title,
      b.id AS book_id,
      b.title AS book_title,
      rs.review_round,
      rs.due_date
    FROM review_schedule rs
    JOIN modules m ON rs.module_id = m.id
    JOIN books b ON m.book_id = b.id
    WHERE rs.status = 'pending' AND rs.due_date <= date('now')
    ORDER BY rs.due_date ASC
  `).all() as DueReview[]

  return { data: { reviews } }
})

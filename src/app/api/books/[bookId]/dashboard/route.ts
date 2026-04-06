import { query, queryOne } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'

type MistakeErrorType = 'blind_spot' | 'procedural' | 'confusion' | 'careless'

interface BookRow {
  id: number
  title: string
}

interface ModuleDashboardRow {
  id: number
  title: string
  order_index: number
  learning_status: string
  qa_total: number
  qa_answered: number
  test_score: number | null
  test_passed: number | null
}

interface ReviewDueRow {
  scheduleId: number
  moduleId: number
  moduleTitle: string
  dueDate: string
  round: number
}

interface RecentTestRow {
  moduleId: number
  moduleTitle: string
  score: number
  passed: number
  completedAt: string
}

interface MistakeSummaryRow {
  error_type: MistakeErrorType
  count: number
}

function parseBookId(value: string): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid book ID', 'INVALID_ID', 400)
  }

  return id
}

function createEmptyMistakeSummary(): Record<MistakeErrorType, number> {
  return {
    blind_spot: 0,
    procedural: 0,
    confusion: 0,
    careless: 0,
  }
}

function getTodayDate(): string {
  const now = new Date()
  const year = String(now.getFullYear())
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const GET = handleRoute(async (_req, context) => {
  const { bookId } = await context!.params
  const id = parseBookId(bookId)

  const book = await queryOne<BookRow>('SELECT id, title FROM books WHERE id = $1', [id])
  if (!book) {
    throw new UserError('Book not found', 'NOT_FOUND', 404)
  }

  const modules = await query<ModuleDashboardRow>(
    `
      SELECT
        m.id,
        m.title,
        m.order_index,
        m.learning_status,
        (SELECT COUNT(*)::int FROM qa_questions qq WHERE qq.module_id = m.id) AS qa_total,
        (SELECT COUNT(*)::int FROM qa_responses qr
         JOIN qa_questions qq2 ON qq2.id = qr.question_id
         WHERE qq2.module_id = m.id) AS qa_answered,
        (SELECT tp.total_score
         FROM test_papers tp
         WHERE tp.module_id = m.id AND tp.total_score IS NOT NULL
         ORDER BY tp.created_at DESC
         LIMIT 1) AS test_score,
        (SELECT tp.is_passed
         FROM test_papers tp
         WHERE tp.module_id = m.id AND tp.total_score IS NOT NULL
         ORDER BY tp.created_at DESC
         LIMIT 1) AS test_passed
      FROM modules m
      WHERE m.book_id = $1
      ORDER BY m.order_index
    `,
    [id]
  )

  const reviewsDue = await query<ReviewDueRow>(
    `
      SELECT
        rs.id AS "scheduleId",
        rs.module_id AS "moduleId",
        m.title AS "moduleTitle",
        rs.due_date AS "dueDate",
        rs.review_round AS round
      FROM review_schedule rs
      JOIN modules m ON m.id = rs.module_id
      WHERE m.book_id = $1 AND rs.status = 'pending'
      ORDER BY rs.due_date ASC, m.order_index ASC
    `,
    [id]
  )

  const recentTests = await query<RecentTestRow>(
    `
      SELECT
        tp.module_id AS "moduleId",
        m.title AS "moduleTitle",
        tp.total_score AS score,
        tp.is_passed AS passed,
        tp.created_at AS "completedAt"
      FROM test_papers tp
      JOIN modules m ON m.id = tp.module_id
      WHERE m.book_id = $1 AND tp.total_score IS NOT NULL
      ORDER BY tp.created_at DESC
      LIMIT 10
    `,
    [id]
  )

  const mistakesSummary = await query<MistakeSummaryRow>(
    `
      SELECT mk.error_type, COUNT(*)::int AS count
      FROM mistakes mk
      JOIN modules m ON m.id = mk.module_id
      WHERE m.book_id = $1
      GROUP BY mk.error_type
    `,
    [id]
  )

  const todayDate = getTodayDate()
  const byType = createEmptyMistakeSummary()
  let totalMistakes = 0

  for (const row of mistakesSummary) {
    byType[row.error_type] = row.count
    totalMistakes += row.count
  }

  const completedModules = modules.filter((module) => module.learning_status === 'completed').length

  return {
    data: {
      book: {
        id: book.id,
        title: book.title,
        totalModules: modules.length,
        completedModules,
      },
      modules: modules.map((module) => ({
        id: module.id,
        title: module.title,
        orderIndex: module.order_index,
        learningStatus: module.learning_status,
        qaProgress: {
          total: module.qa_total,
          answered: module.qa_answered,
        },
        testScore: module.test_score,
        testPassed: module.test_passed === null ? null : module.test_passed === 1,
      })),
      reviewsDue: reviewsDue.map((review) => ({
        scheduleId: review.scheduleId,
        moduleId: review.moduleId,
        moduleTitle: review.moduleTitle,
        dueDate: review.dueDate,
        round: review.round,
        isOverdue: review.dueDate < todayDate,
      })),
      recentTests: recentTests.map((test) => ({
        moduleId: test.moduleId,
        moduleTitle: test.moduleTitle,
        score: test.score,
        passed: test.passed === 1,
        completedAt: test.completedAt,
      })),
      mistakesSummary: {
        total: totalMistakes,
        byType,
      },
    },
  }
})

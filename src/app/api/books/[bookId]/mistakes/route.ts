import { getDb } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'

type MistakeErrorType = 'blind_spot' | 'procedural' | 'confusion' | 'careless'
type MistakeSource = 'test' | 'qa' | 'review'

interface BookRow {
  id: number
}

interface MistakeRow {
  id: number
  moduleId: number
  moduleTitle: string
  questionText: string | null
  userAnswer: string | null
  correctAnswer: string | null
  errorType: MistakeErrorType
  remediation: string | null
  source: MistakeSource
  kpTitle: string | null
  createdAt: string
  knowledgePoint: string | null
}

interface SummaryByTypeRow {
  error_type: MistakeErrorType
  count: number
}

interface SummaryByModuleRow {
  moduleId: number
  moduleTitle: string
  count: number
}

function parseBookId(value: string): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid book ID', 'INVALID_ID', 400)
  }

  return id
}

function parseModuleFilter(value: string | null): number | null {
  if (value === null) {
    return null
  }

  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid module filter', 'INVALID_QUERY', 400)
  }

  return id
}

function parseErrorTypeFilter(value: string | null): MistakeErrorType | null {
  if (value === null) {
    return null
  }

  const allowed: MistakeErrorType[] = ['blind_spot', 'procedural', 'confusion', 'careless']
  if (!allowed.includes(value as MistakeErrorType)) {
    throw new UserError('Invalid errorType filter', 'INVALID_QUERY', 400)
  }

  return value as MistakeErrorType
}

function parseSourceFilter(value: string | null): MistakeSource | null {
  if (value === null) {
    return null
  }

  const allowed: MistakeSource[] = ['test', 'qa', 'review']
  if (!allowed.includes(value as MistakeSource)) {
    throw new UserError('Invalid source filter', 'INVALID_QUERY', 400)
  }

  return value as MistakeSource
}

function createEmptyMistakeSummary(): Record<MistakeErrorType, number> {
  return {
    blind_spot: 0,
    procedural: 0,
    confusion: 0,
    careless: 0,
  }
}

export const GET = handleRoute(async (req, context) => {
  const { bookId } = await context!.params
  const id = parseBookId(bookId)
  const db = getDb()

  const book = db.prepare('SELECT id FROM books WHERE id = ?').get(id) as BookRow | undefined
  if (!book) {
    throw new UserError('Book not found', 'NOT_FOUND', 404)
  }

  const url = new URL(req.url)
  const moduleFilter = parseModuleFilter(url.searchParams.get('module'))
  const errorTypeFilter = parseErrorTypeFilter(url.searchParams.get('errorType'))
  const sourceFilter = parseSourceFilter(url.searchParams.get('source'))

  const conditions = ['m.book_id = ?']
  const params: Array<number | string> = [id]

  if (moduleFilter !== null) {
    conditions.push('mk.module_id = ?')
    params.push(moduleFilter)
  }

  if (errorTypeFilter !== null) {
    conditions.push('mk.error_type = ?')
    params.push(errorTypeFilter)
  }

  if (sourceFilter !== null) {
    conditions.push('mk.source = ?')
    params.push(sourceFilter)
  }

  const whereClause = conditions.join(' AND ')

  const mistakes = db.prepare(`
    SELECT
      mk.id,
      mk.module_id AS moduleId,
      m.title AS moduleTitle,
      mk.question_text AS questionText,
      mk.user_answer AS userAnswer,
      mk.correct_answer AS correctAnswer,
      mk.error_type AS errorType,
      mk.remediation,
      mk.source,
      mk.created_at AS createdAt,
      kp.description AS kpTitle,
      mk.knowledge_point AS knowledgePoint
    FROM mistakes mk
    JOIN modules m ON m.id = mk.module_id
    LEFT JOIN knowledge_points kp ON kp.id = mk.kp_id
    WHERE ${whereClause}
    ORDER BY mk.created_at DESC
  `).all(...params) as MistakeRow[]

  const summaryByType = db.prepare(`
    SELECT mk.error_type, COUNT(*) AS count
    FROM mistakes mk
    JOIN modules m ON m.id = mk.module_id
    WHERE m.book_id = ?
    GROUP BY mk.error_type
  `).all(id) as SummaryByTypeRow[]

  const summaryByModule = db.prepare(`
    SELECT
      mk.module_id AS moduleId,
      m.title AS moduleTitle,
      COUNT(*) AS count
    FROM mistakes mk
    JOIN modules m ON m.id = mk.module_id
    WHERE m.book_id = ?
    GROUP BY mk.module_id, m.title, m.order_index
    ORDER BY count DESC, m.order_index ASC
  `).all(id) as SummaryByModuleRow[]

  const byType = createEmptyMistakeSummary()
  let total = 0

  for (const row of summaryByType) {
    byType[row.error_type] = row.count
    total += row.count
  }

  return {
    data: {
      mistakes: mistakes.map((mistake) => ({
        id: mistake.id,
        moduleId: mistake.moduleId,
        moduleTitle: mistake.moduleTitle,
        questionText: mistake.questionText ?? mistake.knowledgePoint ?? '',
        userAnswer: mistake.userAnswer ?? '',
        correctAnswer: mistake.correctAnswer ?? '',
        errorType: mistake.errorType,
        remediation: mistake.remediation,
        source: mistake.source,
        kpTitle: mistake.kpTitle ?? mistake.knowledgePoint,
        createdAt: mistake.createdAt,
      })),
      summary: {
        total,
        byType,
        byModule: summaryByModule,
      },
    },
  }
})

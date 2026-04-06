import { query, queryOne } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'

interface ModuleRow {
  learning_status: string
}

interface TestPaperRow {
  id: number
  attempt_number: number
  total_score: number | null
  pass_rate: number | null
  is_passed: number
  created_at: string
}

export const GET = handleRoute(async (_req, context) => {
  const { moduleId } = await context!.params
  const id = Number(moduleId)

  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid module ID', 'INVALID_ID', 400)
  }

  const module_ = await queryOne<ModuleRow>(
    'SELECT learning_status FROM modules WHERE id = $1',
    [id]
  )

  if (!module_) {
    throw new UserError('Module not found', 'NOT_FOUND', 404)
  }

  const papers = await query<TestPaperRow>(
    `
      SELECT id, attempt_number, total_score, pass_rate, is_passed, created_at
      FROM test_papers
      WHERE module_id = $1
      ORDER BY attempt_number ASC
    `,
    [id]
  )

  const inProgressPaper = papers.find((paper) => paper.total_score === null)
  const history = papers
    .filter((paper) => paper.total_score !== null)
    .map((paper) => ({
      paper_id: paper.id,
      attempt_number: paper.attempt_number,
      total_score: paper.total_score,
      pass_rate: paper.pass_rate === null ? null : Math.round(paper.pass_rate * 100),
      is_passed: paper.is_passed === 1,
      created_at: paper.created_at,
    }))

  return {
    data: {
      learning_status: module_.learning_status,
      in_progress_paper_id: inProgressPaper?.id ?? null,
      history,
    },
  }
})

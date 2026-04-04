import { notFound, redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import TestSession from './TestSession'

interface Book {
  id: number
  title: string
}

interface Module {
  id: number
  title: string
  order_index: number
  learning_status: string
}

export default async function TestPage({
  params,
}: {
  params: Promise<{ bookId: string; moduleId: string }>
}) {
  const { bookId, moduleId } = await params
  const db = getDb()

  const book = db
    .prepare('SELECT id, title FROM books WHERE id = ?')
    .get(Number(bookId)) as Book | undefined

  if (!book) notFound()

  const module_ = db
    .prepare(`
      SELECT id, title, order_index, learning_status 
      FROM modules 
      WHERE id = ? AND book_id = ?
    `)
    .get(Number(moduleId), Number(bookId)) as Module | undefined

  if (!module_) notFound()

  // 检查 learning_status: 只有 notes_generated, testing, completed 允许进入
  const allowedStatuses = ['notes_generated', 'testing', 'completed']
  if (!allowedStatuses.includes(module_.learning_status)) {
    redirect(`/books/${bookId}`)
  }

  // 查询历史记录
  interface TestPaperRow {
    paper_id: number
    attempt_number: number
    total_score: number | null
    pass_rate: number | null
    is_passed: number
    created_at: string
  }

  const history = db
    .prepare(`
      SELECT id as paper_id, attempt_number, total_score, pass_rate, is_passed, created_at
      FROM test_papers
      WHERE module_id = ?
      ORDER BY attempt_number DESC
    `)
    .all(module_.id) as TestPaperRow[]

  // 转换 is_passed 为 boolean
  const formattedHistory = history.map(h => ({
    ...h,
    is_passed: Boolean(h.is_passed)
  }))

  const inProgressPaper = formattedHistory.find(h => h.total_score === null)

  return (
    <main className="min-h-full bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-xs text-slate-400 mb-8" aria-label="Breadcrumb">
          <a href={`/books/${bookId}`} className="hover:text-slate-600 transition-colors">
            {book.title}
          </a>
          <span className="text-slate-300">/</span>
          <span className="text-slate-600 font-medium">模块 {module_.order_index} 测试</span>
        </nav>

        <TestSession
          moduleId={module_.id}
          moduleTitle={module_.title}
          bookId={book.id}
          learningStatus={module_.learning_status}
          initialHistory={formattedHistory}
          inProgressPaperId={inProgressPaper?.paper_id || null}
        />
      </div>
    </main>
  )
}

import { notFound, redirect } from 'next/navigation'
import { query, queryOne } from '@/lib/db'
import { cookies } from 'next/headers'
import { getUserFromSession } from '@/lib/auth'
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
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value
  if (!token) redirect('/login')
  const user = await getUserFromSession(token)
  if (!user) redirect('/login')

  const { bookId, moduleId } = await params

  const book = await queryOne<Book>(
    'SELECT id, title FROM books WHERE id = $1 AND user_id = $2',
    [Number(bookId), user.id]
  )

  if (!book) notFound()

  const module_ = await queryOne<Module>(
    `
      SELECT id, title, order_index, learning_status 
      FROM modules 
      WHERE id = $1 AND book_id = $2
    `,
    [Number(moduleId), Number(bookId)]
  )

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

  const history = await query<TestPaperRow>(
    `
      SELECT id as paper_id, attempt_number, total_score, pass_rate, is_passed, created_at
      FROM test_papers
      WHERE module_id = $1
      ORDER BY attempt_number DESC
    `,
    [module_.id]
  )

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

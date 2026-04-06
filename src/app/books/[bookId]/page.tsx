import { notFound, redirect } from 'next/navigation'
import { query, queryOne } from '@/lib/db'
import { cookies } from 'next/headers'
import { getUserFromSession } from '@/lib/auth'
import ModuleMap from './ModuleMap'
import ProcessingPoller from './ProcessingPoller'

interface Book {
  id: number
  title: string
  created_at: string
  parse_status: string
}

interface Module {
  id: number
  title: string
  summary: string
  order_index: number
  kp_count: number
  learning_status: string
  pass_status: string
}

export default async function BookPage({ params }: { params: Promise<{ bookId: string }> }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value
  if (!token) redirect('/login')
  const user = await getUserFromSession(token)
  if (!user) redirect('/login')

  const { bookId } = await params

  const book = await queryOne<Book>(
    'SELECT id, title, created_at, parse_status FROM books WHERE id = $1 AND user_id = $2',
    [Number(bookId), user.id]
  )

  if (!book) notFound()

  const modules = await query<Module>(
    'SELECT * FROM modules WHERE book_id = $1 ORDER BY order_index',
    [Number(bookId)]
  )

  return (
    <main className="min-h-full bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* 顶部书名 */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">教材</p>
            <h1 className="text-2xl font-semibold text-gray-900">{book.title}</h1>
          </div>
        </div>

        {book.parse_status === 'processing' ? (
          <ProcessingPoller bookId={book.id} />
        ) : book.parse_status === 'error' ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-sm font-medium text-red-700">PDF 处理失败</p>
            <p className="text-xs text-red-500 mt-1">请查看系统日志了解详情，或重新上传文件</p>
            <a href="/logs" className="text-xs text-red-600 underline mt-2 block">查看日志</a>
          </div>
        ) : (
          <ModuleMap bookId={book.id} modules={modules} />
        )}
      </div>
    </main>
  )
}

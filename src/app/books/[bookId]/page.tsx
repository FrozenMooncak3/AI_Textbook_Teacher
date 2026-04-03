import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
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
  const { bookId } = await params
  const db = getDb()

  const book = db
    .prepare('SELECT id, title, created_at, parse_status FROM books WHERE id = ?')
    .get(Number(bookId)) as Book | undefined

  if (!book) notFound()

  const modules = db
    .prepare('SELECT * FROM modules WHERE book_id = ? ORDER BY order_index')
    .all(Number(bookId)) as Module[]

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* 顶部书名 */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">教材</p>
            <h1 className="text-2xl font-semibold text-gray-900">{book.title}</h1>
          </div>
          <div className="flex gap-2 mt-1">
            <a
              href={`/books/${book.id}/dashboard`}
              className="shrink-0 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 hover:border-gray-400 rounded-lg px-3 py-1.5 transition-colors"
            >
              仪表盘
            </a>
            <a
              href={`/books/${book.id}/reader`}
              className="shrink-0 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded-lg px-3 py-1.5 transition-colors"
            >
              阅读原文
            </a>
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

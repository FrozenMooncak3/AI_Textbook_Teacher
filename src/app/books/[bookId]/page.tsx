import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import ModuleMap from './ModuleMap'

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
        <div className="mb-8">
          <p className="text-xs text-gray-400 mb-1">教材</p>
          <h1 className="text-2xl font-semibold text-gray-900">{book.title}</h1>
        </div>

        <ModuleMap bookId={book.id} modules={modules} />
      </div>
    </main>
  )
}

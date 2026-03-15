import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import QASession from './QASession'

interface Module {
  id: number
  book_id: number
  title: string
  order_index: number
  learning_status: string
}

interface Book {
  id: number
  title: string
}

export default async function QAPage({
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
    .prepare('SELECT id, book_id, title, order_index, learning_status FROM modules WHERE id = ? AND book_id = ?')
    .get(Number(moduleId), Number(bookId)) as Module | undefined

  if (!module_) notFound()

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-6">
          <a href={`/books/${bookId}`} className="hover:text-gray-600 transition-colors">
            {book.title}
          </a>
          <span>/</span>
          <span className="text-gray-600">模块 {module_.order_index} Q&A</span>
        </div>

        <QASession moduleId={module_.id} moduleTitle={module_.title} bookId={book.id} />
      </div>
    </main>
  )
}

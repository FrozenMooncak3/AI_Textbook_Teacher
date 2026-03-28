import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import ModuleLearning from './ModuleLearning'

interface Module {
  id: number
  book_id: number
  title: string
  summary: string
  order_index: number
  kp_count: number
  learning_status: string
  pass_status: string
}

interface Book {
  id: number
  title: string
  raw_text: string
}

export default async function ModulePage({
  params,
}: {
  params: Promise<{ bookId: string; moduleId: string }>
}) {
  const { bookId, moduleId } = await params
  const db = getDb()

  const book = db
    .prepare('SELECT id, title, raw_text FROM books WHERE id = ?')
    .get(Number(bookId)) as Book | undefined

  if (!book) notFound()

  const module_ = db
    .prepare('SELECT * FROM modules WHERE id = ? AND book_id = ?')
    .get(Number(moduleId), Number(bookId)) as Module | undefined

  if (!module_) notFound()

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-xs text-slate-400 mb-8 overflow-hidden whitespace-nowrap">
          <a href={`/books/${bookId}`} className="hover:text-blue-600 transition-colors shrink-0">
            {book.title}
          </a>
          <span className="shrink-0">/</span>
          <span className="text-slate-600 truncate">模块 {module_.order_index}：{module_.title}</span>
        </nav>

        <ModuleLearning 
          module={module_} 
          bookRawText={book.raw_text} 
          bookId={book.id} 
        />
      </div>
    </main>
  )
}

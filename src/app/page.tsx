import { getDb } from '@/lib/db'

interface Book {
  id: number
  title: string
  created_at: string
}

export default function Home() {
  const db = getDb()
  const books = db
    .prepare('SELECT id, title, created_at FROM books ORDER BY created_at DESC')
    .all() as Book[]

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">AI 教材精学老师</h1>
          <a href="/logs" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            系统日志
          </a>
        </div>

        <a
          href="/upload"
          className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl text-sm text-center transition-colors mb-8"
        >
          + 上传新教材
        </a>

        {books.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <p className="text-sm text-gray-400">还没有教材，先上传一本吧</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">我的教材</p>
            {books.map((book) => (
              <a
                key={book.id}
                href={`/books/${book.id}`}
                className="block bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-blue-300 transition-colors"
              >
                <p className="text-sm font-medium text-gray-900">{book.title}</p>
                <p className="text-xs text-gray-400 mt-1">{book.created_at.slice(0, 10)}</p>
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

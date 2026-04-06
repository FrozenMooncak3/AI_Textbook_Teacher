import { query } from '@/lib/db'
import ReviewButton from './ReviewButton'
import { cookies } from 'next/headers'
import { getUserFromSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

interface Book {
  id: number
  title: string
  created_at: string
}

export default async function Home() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value
  if (!token) redirect('/login')
  const user = await getUserFromSession(token)
  if (!user) redirect('/login')

  const books = await query<Book>(
    'SELECT id, title, created_at FROM books WHERE user_id = $1 ORDER BY created_at DESC',
    [user.id]
  )

  return (
    <main className="min-h-full bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">AI 教材精学老师</h1>
        </div>

        <a
          href="/upload"
          className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl text-sm text-center transition-colors mb-8"
        >
          + 上传新教材
        </a>

        <ReviewButton />

        {books.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <p className="text-sm text-gray-400">还没有教材，先上传一本吧</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">我的教材</p>
            {books.map((book) => (
              <div key={book.id} className="block bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-colors overflow-hidden">
                <a href={`/books/${book.id}`} className="block px-5 py-4">
                  <p className="text-sm font-medium text-gray-900">{book.title}</p>
                  <p className="text-xs text-gray-400 mt-1">{book.created_at.slice(0, 10)}</p>
                </a>
                <div className="px-5 py-2 bg-gray-50 border-t border-gray-100 flex justify-end">
                  <a href={`/books/${book.id}/dashboard`} className="text-xs font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest">
                    学习仪表盘 &rarr;
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

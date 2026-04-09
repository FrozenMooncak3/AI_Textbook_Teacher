import { notFound, redirect } from 'next/navigation'
import { queryOne } from '@/lib/db'
import { cookies } from 'next/headers'
import { getUserFromSession } from '@/lib/auth'
import ActionHub from './ActionHub'
import ProcessingPoller from './ProcessingPoller'

interface Book {
  id: number
  title: string
  created_at: string
  parse_status: string
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

  return (
    <main className="min-h-full bg-surface-container-low">      
      {book.parse_status === 'processing' ? (
        <div className="max-w-2xl mx-auto px-4 py-10">
          <ProcessingPoller bookId={book.id} />
        </div>
      ) : book.parse_status === 'error' ? (
        <div className="max-w-2xl mx-auto px-4 py-10">
          <div className="bg-error-container/10 border border-error/20 rounded-[32px] p-8 text-center shadow-sm">
            <span className="material-symbols-outlined text-error text-5xl mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
            <p className="text-lg font-bold text-error font-headline">PDF 处理失败</p>
            <p className="text-sm text-on-surface-variant mt-2">请查看系统日志了解详情，或重新上传文件</p>
            <div className="mt-6 flex justify-center gap-4">
              <a href="/logs" className="px-6 py-2 rounded-full border border-outline-variant text-sm font-bold hover:bg-surface-container transition-colors">查看日志</a>
              <a href="/upload" className="px-6 py-2 rounded-full bg-primary text-on-primary text-sm font-bold shadow-lg shadow-orange-900/10 active:scale-95 transition-all">重新上传</a>
            </div>
          </div>
        </div>
      ) : (
        <ActionHub 
          bookId={book.id} 
          userName={user.display_name || user.email} 
        />
      )}
    </main>
  )
}

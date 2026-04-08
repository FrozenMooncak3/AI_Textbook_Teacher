import { notFound, redirect } from 'next/navigation'
import { queryOne } from '@/lib/db'
import { cookies } from 'next/headers'
import { getUserFromSession } from '@/lib/auth'
import ReviewPageClient from './ReviewPageClient'

interface Book {
  title: string
}

interface Module {
  title: string
}

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookId: string; moduleId: string }>
  searchParams: Promise<{ scheduleId?: string }>
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value
  if (!token) redirect('/login')
  const user = await getUserFromSession(token)
  if (!user) redirect('/login')

  const { bookId, moduleId } = await params
  const { scheduleId } = await searchParams

  if (!scheduleId) {
    return (
      <div className="min-h-screen bg-surface-container-low flex items-center justify-center p-6">
        <div className="bg-surface-container-lowest rounded-[32px] border border-error/20 p-8 text-center shadow-xl max-w-md w-full">
          <span className="material-symbols-outlined text-4xl text-error mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
          <p className="text-on-surface font-bold font-headline">缺少 scheduleId 参数</p>
          <a href={`/books/${bookId}`} className="mt-6 inline-block text-primary font-bold hover:underline">返回教材中心</a>
        </div>
      </div>
    )
  }

  const book = await queryOne<Book>(
    'SELECT title FROM books WHERE id = $1 AND user_id = $2',
    [Number(bookId), user.id]
  )
  if (!book) notFound()

  const module_ = await queryOne<Module>(
    'SELECT title FROM modules WHERE id = $1 AND book_id = $2',
    [Number(moduleId), Number(bookId)]
  )
  if (!module_) notFound()

  return (
    <ReviewPageClient
      bookId={Number(bookId)}
      moduleId={Number(moduleId)}
      scheduleId={Number(scheduleId)}
      bookTitle={book.title}
      moduleTitle={module_.title}
    />
  )
}

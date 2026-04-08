import { notFound, redirect } from 'next/navigation'
import { queryOne } from '@/lib/db'
import { cookies } from 'next/headers'
import { getUserFromSession } from '@/lib/auth'
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
    'SELECT id, book_id, title, order_index, learning_status FROM modules WHERE id = $1 AND book_id = $2',
    [Number(moduleId), Number(bookId)]
  )

  if (!module_) notFound()

  return (
    <main className="min-h-full bg-surface-container-low">
      <QASession 
        moduleId={module_.id} 
        moduleTitle={module_.title} 
        bookId={book.id}
        bookTitle={book.title}
      />
    </main>
  )
}

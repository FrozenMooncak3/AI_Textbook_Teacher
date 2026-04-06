import { notFound, redirect } from 'next/navigation'
import { queryOne } from '@/lib/db'
import { cookies } from 'next/headers'
import { getUserFromSession } from '@/lib/auth'
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
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value
  if (!token) redirect('/login')
  const user = await getUserFromSession(token)
  if (!user) redirect('/login')

  const { bookId, moduleId } = await params

  const book = await queryOne<Book>(
    'SELECT id, title, raw_text FROM books WHERE id = $1 AND user_id = $2',
    [Number(bookId), user.id]
  )

  if (!book) notFound()

  const module_ = await queryOne<Module>(
    'SELECT * FROM modules WHERE id = $1 AND book_id = $2',
    [Number(moduleId), Number(bookId)]
  )

  if (!module_) notFound()

  return (
    <main className="min-h-full bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <ModuleLearning 
          module={module_} 
          bookRawText={book.raw_text} 
          bookId={book.id} 
        />
      </div>
    </main>
  )
}

import { notFound, redirect } from 'next/navigation'
import { queryOne } from '@/lib/db'
import { cookies } from 'next/headers'
import { getUserFromSession } from '@/lib/auth'
import PdfViewerLoader from './PdfViewerLoader'

interface Book {
  id: number
  title: string
}

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ bookId: string }>
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value
  if (!token) redirect('/login')
  const user = await getUserFromSession(token)
  if (!user) redirect('/login')

  const { bookId } = await params

  const book = await queryOne<Book>(
    'SELECT id, title FROM books WHERE id = $1 AND user_id = $2',
    [Number(bookId), user.id]
  )

  if (!book) notFound()

  return <PdfViewerLoader bookId={book.id} bookTitle={book.title} />
}

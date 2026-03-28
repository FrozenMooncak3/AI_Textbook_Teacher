import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
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
  const { bookId } = await params
  const db = getDb()

  const book = db
    .prepare('SELECT id, title FROM books WHERE id = ?')
    .get(Number(bookId)) as Book | undefined

  if (!book) notFound()

  return <PdfViewerLoader bookId={book.id} bookTitle={book.title} />
}

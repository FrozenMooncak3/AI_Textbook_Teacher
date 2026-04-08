import { redirect } from 'next/navigation'

export default async function ModuleMapRedirect({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params
  redirect(`/books/${bookId}`)
}

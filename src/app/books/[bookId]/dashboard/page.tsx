import { redirect } from 'next/navigation'

export default async function DashboardRedirect({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params
  redirect(`/books/${bookId}`)
}

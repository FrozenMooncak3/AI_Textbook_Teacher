import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getUserFromSession } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import TeachClient from './TeachClient'

interface ModuleRow {
  id: number
  book_id: number
  title: string
  learning_status: string
}

export default async function TeachPage({
  params
}: {
  params: Promise<{ moduleId: string }>
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value
  if (!token) redirect('/login')

  const user = await getUserFromSession(token)
  if (!user) redirect('/login')

  const { moduleId } = await params

  const module_ = await queryOne<ModuleRow>(
    `SELECT m.id, m.book_id, m.title, m.learning_status
     FROM modules m
     JOIN books b ON b.id = m.book_id
     WHERE m.id = $1 AND b.user_id = $2`,
    [Number(moduleId), user.id]
  )

  if (!module_) {
    notFound()
  }

  return (
    <TeachClient
      moduleId={module_.id}
      bookId={module_.book_id}
      moduleTitle={module_.title}
      learningStatus={module_.learning_status}
      userName={user.display_name || user.email}
    />
  )
}

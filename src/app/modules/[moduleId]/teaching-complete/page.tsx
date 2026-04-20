import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getUserFromSession } from '@/lib/auth'
import { queryOne, query } from '@/lib/db'
import TeachingCompleteClient from './TeachingCompleteClient'

interface ModuleRow {
  id: number
  book_id: number
  title: string
  learning_status: string
}

interface KPRow {
  id: number
  section_name: string
}

export default async function TeachingCompletePage({
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

  // Guard: only 'taught' users may see this page
  if (module_.learning_status !== 'taught') {
    redirect(`/books/${module_.book_id}`)
  }

  const kps = await query<KPRow>(
    `SELECT id, section_name
     FROM knowledge_points
     WHERE module_id = $1
     ORDER BY id ASC`,
    [module_.id]
  )

  return (
    <TeachingCompleteClient
      moduleId={module_.id}
      bookId={module_.book_id}
      moduleTitle={module_.title}
      userName={user.display_name || user.email}
      kps={kps}
    />
  )
}

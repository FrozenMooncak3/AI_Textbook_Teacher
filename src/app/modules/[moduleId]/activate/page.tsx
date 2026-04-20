import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getUserFromSession } from '@/lib/auth'
import { queryOne, query } from '@/lib/db'
import ActivateClient from './ActivateClient'

interface ModuleRow {
  id: number
  book_id: number
  title: string
  summary: string
}

interface KPRow {
  id: number
  section_name: string
  description: string
}

export default async function ActivatePage({
  params
}: {
  params: Promise<{ moduleId: string }>
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value

  if (!token) {
    redirect('/login')
  }

  const user = await getUserFromSession(token)
  if (!user) {
    redirect('/login')
  }

  const { moduleId } = await params

  // Fetch module and check ownership
  const module = await queryOne<ModuleRow>(
    `SELECT m.id, m.book_id, m.title, m.summary
     FROM modules m
     JOIN books b ON b.id = m.book_id
     WHERE m.id = $1 AND b.user_id = $2`,
    [Number(moduleId), user.id]
  )

  if (!module) {
    notFound()
  }

  // Fetch KPs - strictly selecting only needed fields
  const kps = await query<KPRow>(
    `SELECT id, section_name, description
     FROM knowledge_points
     WHERE module_id = $1
     ORDER BY id ASC`,
    [module.id]
  )

  return (
    <ActivateClient
      moduleId={module.id}
      bookId={module.book_id}
      moduleTitle={module.title}
      userName={user.display_name || user.email}
      kps={kps.map(kp => ({
        id: kp.id,
        section_name: kp.section_name,
        description: kp.description
      }))}
    />
  )
}

import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getUserFromSession } from '@/lib/auth'
import { queryOne, query } from '@/lib/db'
import TeachClient from './TeachClient'
import type { TranscriptV1 } from '@/lib/teaching-types'

interface ModuleRow {
  id: number
  book_id: number
  title: string
}

interface SessionRow {
  id: string
  transcript: TranscriptV1
  cluster_id: number | null
}

interface KPRow {
  id: number
  section_name: string
  description: string
}

export default async function TeachPage({
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
    `SELECT m.id, m.book_id, m.title
     FROM modules m
     JOIN books b ON b.id = m.book_id
     WHERE m.id = $1 AND b.user_id = $2`,
    [Number(moduleId), user.id]
  )

  if (!module) {
    notFound()
  }

  // Find the most recent active teaching session for this module
  const session = await queryOne<SessionRow>(
    `SELECT id, transcript, cluster_id
     FROM teaching_sessions
     WHERE module_id = $1 AND user_id = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [module.id, user.id]
  )

  // If no session exists, redirect to activate page
  if (!session) {
    redirect(`/modules/${moduleId}/activate`)
  }

  // Fetch all KPs for this module (or cluster) to show progress
  // If session has cluster_id, we only show KPs in that cluster
  const kps = await query<KPRow>(
    `SELECT id, section_name, description
     FROM knowledge_points
     WHERE ${session.cluster_id ? 'cluster_id = $1' : 'module_id = $1'}
     ORDER BY id ASC`,
    [session.cluster_id || module.id]
  )

  return (
    <TeachClient
      sessionId={session.id}
      moduleId={module.id}
      bookId={module.book_id}
      moduleTitle={module.title}
      userName={user.display_name || user.email}
      initialTranscript={session.transcript}
      kps={kps.map(kp => ({
        id: kp.id,
        section_name: kp.section_name,
        description: kp.description
      }))}
    />
  )
}

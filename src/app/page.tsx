import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { query } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import HomeContent from './HomeContent'

interface Book {
  id: number
  title: string
  created_at: string
  total_modules: number
  completed_modules: number
}

export default async function HomePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value

  if (!token) {
    redirect('/login')
  }

  const user = await getUserFromSession(token)
  if (!user) {
    redirect('/login')
  }

  // Fetch books with module progress
  const books = await query<Book>(
    `SELECT b.id, b.title, b.created_at,
      COUNT(DISTINCT m.id)::int as total_modules,
      COUNT(DISTINCT CASE WHEN m.learning_status = 'completed' THEN m.id END)::int as completed_modules
     FROM books b
     LEFT JOIN modules m ON m.book_id = b.id
     WHERE b.user_id = $1
     GROUP BY b.id, b.title, b.created_at
     ORDER BY b.created_at DESC`,
    [user.id]
  )

  return (
    <HomeContent 
      user={{
        id: user.id,
        email: user.email,
        display_name: user.display_name
      }} 
      books={books} 
    />
  )
}

import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

export async function GET(request: Request) {
  const user = await requireUser(request)

  const column = await queryOne<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'logs' AND column_name = 'user_id'
      ) AS exists
    `
  )

  if (!column?.exists) {
    return NextResponse.json({ logs: [] })
  }

  const logs = await query(
    'SELECT * FROM logs WHERE user_id = $1 ORDER BY id DESC LIMIT 200',
    [user.id]
  )
  return NextResponse.json({ logs })
}

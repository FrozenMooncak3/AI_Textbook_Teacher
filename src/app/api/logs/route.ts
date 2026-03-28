import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const logs = db
    .prepare('SELECT * FROM logs ORDER BY id DESC LIMIT 200')
    .all()
  return NextResponse.json({ logs })
}

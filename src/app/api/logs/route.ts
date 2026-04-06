import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET() {
  const logs = await query('SELECT * FROM logs ORDER BY id DESC LIMIT 200')
  return NextResponse.json({ logs })
}

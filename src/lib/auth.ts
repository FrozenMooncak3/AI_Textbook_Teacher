import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { queryOne, run } from './db'
import { UserError } from './errors'

export type UserRole = 'user' | 'admin'

const SESSION_COOKIE = 'session_token'

const SALT_ROUNDS = 12
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

export interface User {
  id: number
  email: string
  display_name: string | null
  role: UserRole
  book_quota_remaining: number
  book_quota_total: number
}

interface ModuleOwnerRow {
  book_id: number
}

interface ScheduleOwnerRow {
  module_id: number
  book_id: number
}

function getSessionTokenFromRequest(request: Request): string | undefined {
  const cookieHeader = request.headers.get('cookie') ?? ''
  const cookies = cookieHeader.split(';')

  for (const cookie of cookies) {
    const [rawName, ...rawValueParts] = cookie.trim().split('=')
    if (rawName === SESSION_COOKIE) {
      return decodeURIComponent(rawValueParts.join('='))
    }
  }

  return undefined
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createSession(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000)

  await run(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)',
    [token, userId, expiresAt.toISOString()]
  )

  return token
}

export async function getUserFromSession(token: string): Promise<User | undefined> {
  return queryOne<User>(
    `
      SELECT
        u.id,
        u.email,
        u.display_name,
        u.role,
        u.book_quota_remaining,
        u.book_quota_remaining + COALESCE(
          (SELECT COUNT(*)::int FROM book_uploads_log WHERE user_id = u.id),
          0
        ) AS book_quota_total
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = $1 AND s.expires_at > NOW()
    `,
    [token]
  )
}

export async function destroySession(token: string): Promise<void> {
  await run('DELETE FROM sessions WHERE token = $1', [token])
}

export function getSessionCookieOptions(): {
  httpOnly: true
  sameSite: 'lax'
  secure: boolean
  path: '/'
  maxAge: number
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  }
}

export async function requireUser(request: Request): Promise<User> {
  const token = getSessionTokenFromRequest(request)
  if (!token) {
    throw new UserError('Unauthorized', 'UNAUTHORIZED', 401)
  }

  const user = await getUserFromSession(token)
  if (!user) {
    throw new UserError('Session expired', 'SESSION_EXPIRED', 401)
  }

  return user
}

export async function requireBookOwner(
  request: Request,
  bookId: number
): Promise<{ user: User }> {
  if (!Number.isInteger(bookId) || bookId <= 0) {
    throw new UserError('Invalid book ID', 'INVALID_ID', 400)
  }

  const user = await requireUser(request)
  const book = await queryOne<{ id: number }>(
    'SELECT id FROM books WHERE id = $1 AND user_id = $2',
    [bookId, user.id]
  )

  if (!book) {
    throw new UserError('Book not found', 'NOT_FOUND', 404)
  }

  return { user }
}

export async function requireModuleOwner(
  request: Request,
  moduleId: number
): Promise<{ user: User; bookId: number }> {
  if (!Number.isInteger(moduleId) || moduleId <= 0) {
    throw new UserError('Invalid module ID', 'INVALID_ID', 400)
  }

  const user = await requireUser(request)
  const moduleOwner = await queryOne<ModuleOwnerRow>(
    `
      SELECT m.book_id
      FROM modules m
      JOIN books b ON b.id = m.book_id
      WHERE m.id = $1 AND b.user_id = $2
    `,
    [moduleId, user.id]
  )

  if (!moduleOwner) {
    throw new UserError('Module not found', 'NOT_FOUND', 404)
  }

  return { user, bookId: moduleOwner.book_id }
}

export async function requireReviewScheduleOwner(
  request: Request,
  scheduleId: number
): Promise<{ user: User; moduleId: number; bookId: number }> {
  if (!Number.isInteger(scheduleId) || scheduleId <= 0) {
    throw new UserError('Invalid schedule ID', 'INVALID_ID', 400)
  }

  const user = await requireUser(request)
  const scheduleOwner = await queryOne<ScheduleOwnerRow>(
    `
      SELECT rs.module_id, b.id AS book_id
      FROM review_schedule rs
      JOIN modules m ON m.id = rs.module_id
      JOIN books b ON b.id = m.book_id
      WHERE rs.id = $1 AND b.user_id = $2
    `,
    [scheduleId, user.id]
  )

  if (!scheduleOwner) {
    throw new UserError('Review schedule not found', 'NOT_FOUND', 404)
  }

  return {
    user,
    moduleId: scheduleOwner.module_id,
    bookId: scheduleOwner.book_id,
  }
}

export { SESSION_COOKIE }

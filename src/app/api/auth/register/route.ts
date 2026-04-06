import { pool } from '@/lib/db'
import { UserError, SystemError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import {
  SESSION_COOKIE,
  createSession,
  getSessionCookieOptions,
  hashPassword,
} from '@/lib/auth'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface RegisterBody {
  email?: unknown
  password?: unknown
  inviteCode?: unknown
  displayName?: unknown
}

interface UserRow {
  id: number
  email: string
  display_name: string | null
}

function parseBody(body: unknown): {
  email: string
  password: string
  inviteCode: string
  displayName: string | null
} {
  if (body === null || typeof body !== 'object') {
    throw new UserError('Invalid request body', 'INVALID_BODY', 400)
  }

  const parsed = body as RegisterBody
  const email = typeof parsed.email === 'string' ? parsed.email.trim().toLowerCase() : ''
  const password = typeof parsed.password === 'string' ? parsed.password : ''
  const inviteCode = typeof parsed.inviteCode === 'string' ? parsed.inviteCode.trim() : ''
  const displayName = typeof parsed.displayName === 'string' && parsed.displayName.trim().length > 0
    ? parsed.displayName.trim()
    : null

  if (!EMAIL_REGEX.test(email)) {
    throw new UserError('Invalid email address', 'INVALID_EMAIL', 400)
  }

  if (password.length < 8) {
    throw new UserError('Password must be at least 8 characters', 'INVALID_PASSWORD', 400)
  }

  return { email, password, inviteCode, displayName }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  )
}

export const POST = handleRoute(async (req) => {
  const { email, password, inviteCode, displayName } = parseBody(await req.json())
  const passwordHash = await hashPassword(password)
  const client = await pool.connect()

  let user: UserRow | undefined

  try {
    await client.query('BEGIN')

    if (inviteCode) {
      const invite = await client.query<{ code: string; used_count: number; max_uses: number }>(
        `
          SELECT code, used_count, max_uses
          FROM invite_codes
          WHERE code = $1
          FOR UPDATE
        `,
        [inviteCode]
      )

      const inviteRow = invite.rows[0]
      if (!inviteRow) {
        throw new UserError('Invite code not found', 'INVALID_INVITE_CODE', 400)
      }

      if (inviteRow.used_count >= inviteRow.max_uses) {
        throw new UserError('Invite code has reached its usage limit', 'INVITE_CODE_EXHAUSTED', 400)
      }
    }

    try {
      const createdUser = await client.query<UserRow>(
        `
          INSERT INTO users (email, password_hash, display_name)
          VALUES ($1, $2, $3)
          RETURNING id, email, display_name
        `,
        [email, passwordHash, displayName]
      )
      user = createdUser.rows[0]
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new UserError('Email already registered', 'EMAIL_EXISTS', 409)
      }

      throw error
    }

    if (inviteCode) {
      await client.query(
        'UPDATE invite_codes SET used_count = used_count + 1 WHERE code = $1',
        [inviteCode]
      )
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    if (error instanceof UserError) {
      throw error
    }

    throw new SystemError('Failed to register user', error)
  } finally {
    client.release()
  }

  if (!user) {
    throw new SystemError('User creation did not return a record')
  }

  const token = await createSession(user.id)
  const setCookie = getSessionCookieOptions()

  return {
    data: user,
    status: 201,
    cookies: [
      {
        name: SESSION_COOKIE,
        value: token,
        ...setCookie,
      },
    ],
  }
})

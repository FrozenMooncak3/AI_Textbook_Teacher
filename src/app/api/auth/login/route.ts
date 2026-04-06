import { queryOne } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import {
  SESSION_COOKIE,
  createSession,
  getSessionCookieOptions,
  verifyPassword,
} from '@/lib/auth'

interface LoginBody {
  email?: unknown
  password?: unknown
}

interface UserRow {
  id: number
  email: string
  display_name: string | null
  password_hash: string
}

function parseBody(body: unknown): { email: string; password: string } {
  if (body === null || typeof body !== 'object') {
    throw new UserError('Invalid request body', 'INVALID_BODY', 400)
  }

  const parsed = body as LoginBody
  const email = typeof parsed.email === 'string' ? parsed.email.trim().toLowerCase() : ''
  const password = typeof parsed.password === 'string' ? parsed.password : ''

  if (!email || !password) {
    throw new UserError('Email and password are required', 'MISSING_FIELDS', 400)
  }

  return { email, password }
}

export const POST = handleRoute(async (req) => {
  const { email, password } = parseBody(await req.json())

  const user = await queryOne<UserRow>(
    'SELECT id, email, display_name, password_hash FROM users WHERE email = $1',
    [email]
  )

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw new UserError('Invalid email or password', 'INVALID_CREDENTIALS', 401)
  }

  const token = await createSession(user.id)
  const setCookie = getSessionCookieOptions()

  return {
    data: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
    },
    cookies: [
      {
        name: SESSION_COOKIE,
        value: token,
        ...setCookie,
      },
    ],
  }
})

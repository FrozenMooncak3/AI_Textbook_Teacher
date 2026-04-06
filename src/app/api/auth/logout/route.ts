import { handleRoute } from '@/lib/handle-route'
import { SESSION_COOKIE, destroySession, getSessionCookieOptions } from '@/lib/auth'

function getSessionToken(request: Request): string | undefined {
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

export const POST = handleRoute(async (req) => {
  const token = getSessionToken(req)
  if (token) {
    await destroySession(token)
  }

  return {
    data: { success: true },
    cookies: [
      {
        name: SESSION_COOKIE,
        value: '',
        ...getSessionCookieOptions(),
        maxAge: 0,
        expires: new Date(0),
      },
    ],
  }
})

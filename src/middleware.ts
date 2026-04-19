import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'session_token'
const publicPaths = ['/login', '/register']

function isPublicPath(pathname: string): boolean {
  return (
    publicPaths.includes(pathname) ||
    pathname.startsWith('/api/auth/') ||
    pathname === '/api/ocr/callback'
  )
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    /\.[^/]+$/.test(pathname)
  )
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl

  if (isStaticAsset(pathname) || isPublicPath(pathname)) {
    return NextResponse.next()
  }

  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value)
  if (hasSessionCookie) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 }
    )
  }

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.searchParams.set('next', `${pathname}${search}`)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

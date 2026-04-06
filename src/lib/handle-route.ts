import { NextRequest, NextResponse } from 'next/server'
import { UserError, SystemError } from './errors'
import { logAction } from './log'

interface RouteResult {
  data: unknown
  status?: number
  cookies?: RouteCookie[]
  headers?: Record<string, string>
}

type RouteContext = { params: Promise<Record<string, string>> }

interface RouteCookie {
  name: string
  value: string
  httpOnly?: boolean
  sameSite?: 'lax' | 'strict' | 'none'
  secure?: boolean
  path?: string
  expires?: Date
  maxAge?: number
}

type RouteHandler = (
  req: NextRequest,
  context?: RouteContext
) => Promise<RouteResult>

export function handleRoute(fn: RouteHandler) {
  return async (req: NextRequest, context?: RouteContext): Promise<NextResponse> => {
    try {
      const result = await fn(req, context)
      const response = NextResponse.json(
        { success: true, data: result.data },
        {
          status: result.status ?? 200,
          headers: result.headers,
        }
      )

      for (const cookie of result.cookies ?? []) {
        response.cookies.set(cookie)
      }

      return response
    } catch (err) {
      if (err instanceof SyntaxError) {
        return NextResponse.json(
          { success: false, error: '请求格式错误', code: 'INVALID_JSON' },
          { status: 400 }
        )
      }

      if (err instanceof UserError) {
        return NextResponse.json(
          { success: false, error: err.message, code: err.code },
          { status: err.statusCode }
        )
      }

      const message = err instanceof SystemError
        ? err.message
        : String(err)
      const original = err instanceof SystemError
        ? err.originalError
        : err

      // logAction 内部已有 try/catch 静默处理，不会因日志失败而影响错误响应
      logAction('系统错误', `${message} | ${String(original)}`, 'error')

      return NextResponse.json(
        { success: false, error: '服务暂时不可用，请稍后重试', code: 'SYSTEM_ERROR' },
        { status: 500 }
      )
    }
  }
}

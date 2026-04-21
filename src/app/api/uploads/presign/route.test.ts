import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import * as nodeModule from 'node:module'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { NextRequest } from 'next/server.js'

const SRC_DIR = path.join(process.cwd(), 'src')
const HANDLE_ROUTE_URL = pathToFileURL(path.join(SRC_DIR, 'lib', 'handle-route.ts')).href

const AUTH_STUB_URL = `data:text/javascript,${encodeURIComponent(`
import { UserError } from '@/lib/errors'

export async function requireUser() {
  if (globalThis.__presignAuthMode === 'unauthorized') {
    throw new UserError('Unauthorized', 'UNAUTHORIZED', 401)
  }

  return {
    id: globalThis.__presignUserId ?? 7,
    email: 'test@example.com',
    display_name: null,
  }
}
`)}`

const DB_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export async function insert(sql, params) {
  globalThis.__presignInsertCalls.push({ sql, params })
  return globalThis.__presignInsertId ?? 42
}
`)}`

const LOG_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export async function logAction(...args) {
  globalThis.__presignLogCalls.push(args)
}
`)}`

const R2_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export async function buildPresignedPutUrl(bookId, expirySeconds = 900) {
  globalThis.__presignR2Calls.push({ bookId, expirySeconds })
  return {
    uploadUrl: globalThis.__presignUploadUrl ?? 'https://test-account.r2.cloudflarestorage.com/test-bucket/books/' + bookId + '/original.pdf?X-Amz-Signature=test-signature&X-Amz-Expires=' + expirySeconds,
    objectKey: globalThis.__presignObjectKey ?? 'books/' + bookId + '/original.pdf',
  }
}
`)}`

interface ResolveContext {
  parentURL?: string
}

interface ResolveResult {
  url: string
  shortCircuit?: boolean
}

type NextResolve = (specifier: string, context: ResolveContext) => ResolveResult
type RegisterHooks = (hooks: {
  resolve: (
    specifier: string,
    context: ResolveContext,
    nextResolve: NextResolve
  ) => ResolveResult
}) => unknown

type InsertCall = {
  sql: string
  params: unknown[]
}

type LogCall = unknown[]

type R2Call = {
  bookId: number
  expirySeconds: number
}

type StubState = typeof globalThis & {
  __presignAuthMode?: 'authorized' | 'unauthorized'
  __presignUserId?: number
  __presignInsertId?: number
  __presignUploadUrl?: string
  __presignObjectKey?: string
  __presignInsertCalls: InsertCall[]
  __presignLogCalls: LogCall[]
  __presignR2Calls: R2Call[]
}

const registerHooks = (nodeModule as typeof nodeModule & {
  registerHooks: RegisterHooks
}).registerHooks

function resolveLocalModule(basePath: string): string | undefined {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.js`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.js'),
  ]

  return candidates.find((candidate) => existsSync(candidate))
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'next/server') {
      return nextResolve('next/server.js', context)
    }

    if (specifier === '@/lib/auth') {
      return { url: AUTH_STUB_URL, shortCircuit: true }
    }

    if (specifier === '@/lib/db') {
      return { url: DB_STUB_URL, shortCircuit: true }
    }

    if (specifier === '@/lib/log') {
      return { url: LOG_STUB_URL, shortCircuit: true }
    }

    if (specifier === './log' && context.parentURL === HANDLE_ROUTE_URL) {
      return { url: LOG_STUB_URL, shortCircuit: true }
    }

    if (specifier === '@/lib/r2-client') {
      return { url: R2_STUB_URL, shortCircuit: true }
    }

    if (specifier.startsWith('@/')) {
      const resolved = resolveLocalModule(path.join(SRC_DIR, specifier.slice(2)))
      if (resolved) {
        return { url: pathToFileURL(resolved).href, shortCircuit: true }
      }
    }

    if (
      context.parentURL?.startsWith('file:') &&
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      path.extname(specifier) === ''
    ) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL))
      const resolved = resolveLocalModule(path.resolve(parentDir, specifier))
      if (resolved) {
        return { url: pathToFileURL(resolved).href, shortCircuit: true }
      }
    }

    return nextResolve(specifier, context)
  },
})

const stubState = globalThis as StubState

function resetStubState(): void {
  stubState.__presignAuthMode = 'authorized'
  stubState.__presignUserId = 7
  stubState.__presignInsertId = 42
  stubState.__presignUploadUrl = undefined
  stubState.__presignObjectKey = undefined
  stubState.__presignInsertCalls = []
  stubState.__presignLogCalls = []
  stubState.__presignR2Calls = []
}

function mkRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/uploads/presign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

test.beforeEach(() => {
  resetStubState()
})

test('returns 401 when user is not authenticated', async () => {
  stubState.__presignAuthMode = 'unauthorized'

  const { POST } = await import('./route')
  const res = await POST(mkRequest({
    filename: 'test.pdf',
    size: 1_000_000,
    contentType: 'application/pdf',
  }))
  const json = await res.json()

  assert.equal(res.status, 401)
  assert.equal(json.success, false)
  assert.equal(json.code, 'UNAUTHORIZED')
  assert.equal(stubState.__presignInsertCalls.length, 0)
  assert.equal(stubState.__presignR2Calls.length, 0)
})

test('returns 400 when request exceeds 50MB', async () => {
  const { POST } = await import('./route')
  const res = await POST(mkRequest({
    filename: 'huge.pdf',
    size: 52_428_801,
    contentType: 'application/pdf',
  }))
  const json = await res.json()

  assert.equal(res.status, 400)
  assert.equal(json.success, false)
  assert.equal(json.code, 'INVALID_REQUEST')
  assert.equal(stubState.__presignInsertCalls.length, 0)
  assert.equal(stubState.__presignR2Calls.length, 0)
})

test('creates pending book row and returns presigned upload data', async () => {
  const { POST } = await import('./route')
  const res = await POST(mkRequest({
    filename: 'test.pdf',
    size: 1_000_000,
    contentType: 'application/pdf',
  }))
  const json = await res.json()

  assert.equal(res.status, 200)
  assert.equal(json.success, true)
  assert.deepEqual(json.data, {
    bookId: 42,
    uploadUrl: 'https://test-account.r2.cloudflarestorage.com/test-bucket/books/42/original.pdf?X-Amz-Signature=test-signature&X-Amz-Expires=900',
    objectKey: 'books/42/original.pdf',
  })

  assert.equal(stubState.__presignInsertCalls.length, 1)
  assert.match(stubState.__presignInsertCalls[0].sql, /INSERT INTO books/)
  assert.match(stubState.__presignInsertCalls[0].sql, /upload_status/)
  assert.match(stubState.__presignInsertCalls[0].sql, /kp_extraction_status/)
  assert.deepEqual(stubState.__presignInsertCalls[0].params, [7, 'test.pdf', 1_000_000])

  assert.deepEqual(stubState.__presignR2Calls, [{ bookId: 42, expirySeconds: 900 }])
  assert.equal(stubState.__presignLogCalls.length, 1)
  assert.equal(stubState.__presignLogCalls[0][0], 'book_presign_issued')
  assert.equal(stubState.__presignLogCalls[0][1], 'bookId=42, filename=test.pdf, size=1000000')
})

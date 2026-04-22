import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import * as nodeModule from 'node:module'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { NextRequest } from 'next/server.js'

const SRC_DIR = path.join(process.cwd(), 'src')
const HANDLE_ROUTE_URL = pathToFileURL(path.join(SRC_DIR, 'lib', 'handle-route.ts')).href
const DB_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export async function query() {
  return []
}

export async function run() {
  return { rows: [], rowCount: 0, command: 'UPDATE', oid: 0, fields: [] }
}
`)}`
const LOG_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export async function logAction() {}
`)}`
const KP_EXTRACTION_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export async function triggerReadyModulesExtraction(bookId) {
  globalThis.__ocrCallbackTriggerCalls.push(bookId)
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

const registerHooks = (nodeModule as typeof nodeModule & {
  registerHooks: RegisterHooks
}).registerHooks

type StubState = typeof globalThis & {
  __ocrCallbackTriggerCalls: number[]
}

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

    if (specifier === '@/lib/db') {
      return { url: DB_STUB_URL, shortCircuit: true }
    }

    if (specifier === '@/lib/log') {
      return { url: LOG_STUB_URL, shortCircuit: true }
    }

    if (specifier === '@/lib/services/kp-extraction-service') {
      return { url: KP_EXTRACTION_STUB_URL, shortCircuit: true }
    }

    if (specifier === './log' && context.parentURL === HANDLE_ROUTE_URL) {
      return { url: LOG_STUB_URL, shortCircuit: true }
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

const TOKEN = 'test-token-32chars-xxxxxxxxxxxxxx'

function mkRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/ocr/callback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

test.beforeEach(() => {
  stubState.__ocrCallbackTriggerCalls = []
})

test('rejects request without Authorization header (401)', async () => {
  process.env.OCR_SERVER_TOKEN = TOKEN
  const { POST } = await import('./route')
  const req = new NextRequest('http://localhost/api/ocr/callback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'progress', book_id: 1, pages_done: 1, pages_total: 10 }),
  })
  const res = await POST(req)
  assert.equal(res.status, 401)
})

test('rejects request with wrong Bearer token (401)', async () => {
  process.env.OCR_SERVER_TOKEN = TOKEN
  const { POST } = await import('./route')
  const req = mkRequest(
    { event: 'progress', book_id: 1, pages_done: 1, pages_total: 10 },
    { Authorization: 'Bearer wrong-token' }
  )
  const res = await POST(req)
  assert.equal(res.status, 401)
})

test('rejects request with missing OCR_SERVER_TOKEN env (500)', async () => {
  delete process.env.OCR_SERVER_TOKEN
  const { POST } = await import('./route')
  const req = mkRequest({ event: 'progress', book_id: 1, pages_done: 1, pages_total: 10 })
  const res = await POST(req)
  assert.equal(res.status, 500)
})

test('rejects unknown event type (400)', async () => {
  process.env.OCR_SERVER_TOKEN = TOKEN
  const { POST } = await import('./route')
  const req = mkRequest({ event: 'bogus', book_id: 1 })
  const res = await POST(req)
  assert.equal(res.status, 400)
})

test('accepts progress event (200 or 500 depending on DB)', async () => {
  process.env.OCR_SERVER_TOKEN = TOKEN
  const { POST } = await import('./route')
  const req = mkRequest({
    event: 'progress',
    book_id: 999999,
    pages_done: 3,
    pages_total: 10,
  })
  const res = await POST(req)
  assert.ok([200, 500].includes(res.status), `expected 200 or 500, got ${res.status}`)
})

test('triggers KP extraction after book-level OCR success', async () => {
  process.env.OCR_SERVER_TOKEN = TOKEN
  const { POST } = await import('./route')
  const req = mkRequest({
    event: 'module_complete',
    book_id: 42,
    module_id: 0,
    status: 'success',
  })

  const res = await POST(req)

  assert.equal(res.status, 200)
  assert.deepEqual(stubState.__ocrCallbackTriggerCalls, [42])
})

test('triggers KP extraction after per-module OCR success', async () => {
  process.env.OCR_SERVER_TOKEN = TOKEN
  const { POST } = await import('./route')
  const req = mkRequest({
    event: 'module_complete',
    book_id: 42,
    module_id: 7,
    status: 'success',
  })

  const res = await POST(req)

  assert.equal(res.status, 200)
  assert.deepEqual(stubState.__ocrCallbackTriggerCalls, [42])
})

test('does not trigger KP extraction on OCR error', async () => {
  process.env.OCR_SERVER_TOKEN = TOKEN
  const { POST } = await import('./route')
  const req = mkRequest({
    event: 'module_complete',
    book_id: 42,
    module_id: 0,
    status: 'error',
    error: 'vision timeout',
  })

  const res = await POST(req)

  assert.equal(res.status, 200)
  assert.deepEqual(stubState.__ocrCallbackTriggerCalls, [])
})

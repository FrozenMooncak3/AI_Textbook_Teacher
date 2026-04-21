import assert from 'node:assert/strict'
import { existsSync, statSync } from 'node:fs'
import * as nodeModule from 'node:module'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { NextRequest } from 'next/server.js'

const SRC_DIR = path.join(process.cwd(), 'src')
const AUTH_STUB_URL = pathToFileURL(path.join(SRC_DIR, 'lib', 'test-stubs', 'books-route', 'auth.ts')).href
const DB_STUB_URL = pathToFileURL(path.join(SRC_DIR, 'lib', 'test-stubs', 'books-route', 'db.ts')).href
const LOG_STUB_URL = pathToFileURL(path.join(SRC_DIR, 'lib', 'test-stubs', 'books-route', 'log.ts')).href

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

type StubState = typeof globalThis & {
  __booksRouteUserId?: number
  __booksRouteInsertCalls: InsertCall[]
  __booksRouteInsertId?: number
  __booksRouteLogCalls: unknown[][]
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

  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile())
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
  stubState.__booksRouteUserId = 7
  stubState.__booksRouteInsertCalls = []
  stubState.__booksRouteInsertId = 42
  stubState.__booksRouteLogCalls = []
}

function buildRequest(fileName: string, contents: string, title: string): NextRequest {
  const formData = new FormData()
  formData.set('title', title)
  formData.set('file', new File([contents], fileName))

  return new NextRequest('http://localhost/api/books', {
    method: 'POST',
    body: formData,
  })
}

async function loadBooksRoute() {
  const moduleUrl = new URL(
    `./route.ts?ts=${Date.now()}-${Math.random().toString(16).slice(2)}`,
    import.meta.url
  ).href

  return import(moduleUrl)
}

test.beforeEach(() => {
  resetStubState()
})

test('keeps the txt branch working', async () => {
  const { POST } = await loadBooksRoute()
  const txtContent = 'A'.repeat(120)
  const res = await POST(buildRequest('lesson.txt', txtContent, '  Lesson 1  '))
  const json = await res.json()

  assert.equal(res.status, 201)
  assert.deepEqual(json, { bookId: 42 })
  assert.equal(stubState.__booksRouteInsertCalls.length, 1)
  assert.deepEqual(stubState.__booksRouteInsertCalls[0].params, [7, 'Lesson 1', txtContent, 'done'])
  assert.equal(stubState.__booksRouteLogCalls[0]?.[0], 'book_upload_started')
  assert.equal(stubState.__booksRouteLogCalls[1]?.[0], 'book_upload_completed_txt')
})

test('returns USE_PRESIGN_ENDPOINT for pdf uploads', async () => {
  const { POST } = await loadBooksRoute()
  const res = await POST(buildRequest('lesson.pdf', 'fake-pdf', 'Lesson PDF'))
  const json = await res.json()

  assert.equal(res.status, 400)
  assert.deepEqual(json, {
    error: 'PDF uploads must use /api/uploads/presign',
    code: 'USE_PRESIGN_ENDPOINT',
  })
  assert.equal(stubState.__booksRouteInsertCalls.length, 0)
  assert.equal(stubState.__booksRouteLogCalls[0]?.[0], 'book_upload_started')
  assert.equal(stubState.__booksRouteLogCalls[1]?.[0], 'book_upload_pdf_via_old_endpoint')
})

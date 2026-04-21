import assert from 'node:assert/strict'
import { existsSync, statSync } from 'node:fs'
import * as nodeModule from 'node:module'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { NextRequest } from 'next/server.js'

const SRC_DIR = path.join(process.cwd(), 'src')
const AUTH_STUB_URL = pathToFileURL(path.join(SRC_DIR, 'lib', 'test-stubs', 'book-status', 'auth.ts')).href
const DB_STUB_URL = pathToFileURL(path.join(SRC_DIR, 'lib', 'test-stubs', 'book-status', 'db.ts')).href
const LOG_STUB_URL = pathToFileURL(path.join(SRC_DIR, 'lib', 'test-stubs', 'book-status', 'log.ts')).href

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

interface BookStatusStubRow {
  id: number
  upload_status: string
  parse_status: string
  kp_extraction_status: string
  ocr_current_page: number | null
  ocr_total_pages: number | null
}

interface ModuleStatusStubRow {
  id: number
  order_index: number
  title: string
  kp_extraction_status: string
}

type QueryCall = {
  sql: string
  params: unknown[]
}

type StubState = typeof globalThis & {
  __statusRouteBook?: BookStatusStubRow
  __statusRouteModules: ModuleStatusStubRow[]
  __statusRouteRequireBookOwnerCalls: number[]
  __statusRouteQueryOneCalls: QueryCall[]
  __statusRouteQueryCalls: QueryCall[]
  __statusRouteLogCalls: unknown[][]
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
  stubState.__statusRouteBook = undefined
  stubState.__statusRouteModules = []
  stubState.__statusRouteRequireBookOwnerCalls = []
  stubState.__statusRouteQueryOneCalls = []
  stubState.__statusRouteQueryCalls = []
  stubState.__statusRouteLogCalls = []
}

function buildRequest(): NextRequest {
  return new NextRequest('http://localhost/api/books/42/status', {
    method: 'GET',
  })
}

async function loadStatusRoute() {
  const moduleUrl = new URL(
    `./route.ts?ts=${Date.now()}-${Math.random().toString(16).slice(2)}`,
    import.meta.url
  ).href

  return import(moduleUrl)
}

test.beforeEach(() => {
  resetStubState()
})

test('returns pending upload metadata with null-safe OCR counters', async () => {
  stubState.__statusRouteBook = {
    id: 42,
    upload_status: 'pending',
    parse_status: 'pending',
    kp_extraction_status: 'pending',
    ocr_current_page: null,
    ocr_total_pages: null,
  }

  const { GET } = await loadStatusRoute()
  const res = await GET(buildRequest(), {
    params: Promise.resolve({ bookId: '42' }),
  })
  const json = await res.json()

  assert.equal(res.status, 200)
  assert.deepEqual(json, {
    success: true,
    data: {
      parseStatus: 'pending',
      ocrCurrentPage: 0,
      ocrTotalPages: 0,
      parse_status: 'pending',
      kp_extraction_status: 'pending',
      ocr_current_page: 0,
      ocr_total_pages: 0,
      bookId: 42,
      uploadStatus: 'pending',
      kpExtractionStatus: 'pending',
      modules: [],
      progressPct: 0,
      firstModuleReady: false,
      estimatedSecondsRemaining: null,
    },
  })
  assert.deepEqual(stubState.__statusRouteRequireBookOwnerCalls, [42])
  assert.equal(stubState.__statusRouteQueryOneCalls.length, 1)
  assert.equal(stubState.__statusRouteQueryCalls.length, 1)
})

test('returns completed module progress while preserving legacy raw fields', async () => {
  stubState.__statusRouteBook = {
    id: 42,
    upload_status: 'confirmed',
    parse_status: 'done',
    kp_extraction_status: 'done',
    ocr_current_page: 12,
    ocr_total_pages: 12,
  }
  stubState.__statusRouteModules = [
    {
      id: 101,
      order_index: 1,
      title: 'Vectors',
      kp_extraction_status: 'done',
    },
  ]

  const { GET } = await loadStatusRoute()
  const res = await GET(buildRequest(), {
    params: Promise.resolve({ bookId: '42' }),
  })
  const json = await res.json()

  assert.equal(res.status, 200)
  assert.deepEqual(json, {
    success: true,
    data: {
      parseStatus: 'completed',
      ocrCurrentPage: 12,
      ocrTotalPages: 12,
      parse_status: 'done',
      kp_extraction_status: 'done',
      ocr_current_page: 12,
      ocr_total_pages: 12,
      bookId: 42,
      uploadStatus: 'confirmed',
      kpExtractionStatus: 'completed',
      modules: [
        {
          id: 101,
          orderIndex: 1,
          title: 'Vectors',
          kpExtractionStatus: 'completed',
          ready: true,
        },
      ],
      progressPct: 100,
      firstModuleReady: true,
      estimatedSecondsRemaining: null,
    },
  })
  assert.deepEqual(stubState.__statusRouteRequireBookOwnerCalls, [42])
  assert.equal(stubState.__statusRouteQueryOneCalls.length, 1)
  assert.equal(stubState.__statusRouteQueryCalls.length, 1)
})

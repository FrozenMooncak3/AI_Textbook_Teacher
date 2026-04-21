import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import * as nodeModule from 'node:module'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SRC_DIR = path.join(process.cwd(), 'src')
const DB_STUB_URL = pathToFileURL(path.join(SRC_DIR, 'lib', 'test-stubs', 'upload-flow', 'db.ts')).href
const LOG_STUB_URL = pathToFileURL(path.join(SRC_DIR, 'lib', 'test-stubs', 'upload-flow', 'log.ts')).href
const OCR_AUTH_STUB_URL = pathToFileURL(path.join(SRC_DIR, 'lib', 'test-stubs', 'upload-flow', 'ocr-auth.ts')).href
const KP_STUB_URL = pathToFileURL(path.join(SRC_DIR, 'lib', 'test-stubs', 'upload-flow', 'kp-extraction.ts')).href
const TEXT_CHUNKER_STUB_URL = pathToFileURL(path.join(SRC_DIR, 'lib', 'test-stubs', 'upload-flow', 'text-chunker.ts')).href

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

type RunCall = {
  sql: string
  params: unknown[]
}

type InsertCall = {
  sql: string
  params: unknown[]
}

type FetchCall = {
  url: string
  init?: RequestInit
}

type TextChunk = {
  index: number
  title: string
  text: string
  startLine: number
  endLine: number
  pageStart: number | null
  pageEnd: number | null
}

type StubState = typeof globalThis & {
  __uploadFlowRunCalls: RunCall[]
  __uploadFlowInsertCalls: InsertCall[]
  __uploadFlowLogCalls: unknown[][]
  __uploadFlowHeaderUrls: string[]
  __uploadFlowKpCalls: number[]
  __uploadFlowChunkInputs: string[]
  __uploadFlowChunks: TextChunk[]
  __uploadFlowFetchCalls: FetchCall[]
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
    if (specifier === '@/lib/db') {
      return { url: DB_STUB_URL, shortCircuit: true }
    }

    if (specifier === '@/lib/log') {
      return { url: LOG_STUB_URL, shortCircuit: true }
    }

    if (specifier === '@/lib/ocr-auth') {
      return { url: OCR_AUTH_STUB_URL, shortCircuit: true }
    }

    if (specifier === '@/lib/services/kp-extraction-service') {
      return { url: KP_STUB_URL, shortCircuit: true }
    }

    if (specifier === '@/lib/text-chunker') {
      return { url: TEXT_CHUNKER_STUB_URL, shortCircuit: true }
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
const originalFetch = globalThis.fetch

function resetStubState(): void {
  stubState.__uploadFlowRunCalls = []
  stubState.__uploadFlowInsertCalls = []
  stubState.__uploadFlowLogCalls = []
  stubState.__uploadFlowHeaderUrls = []
  stubState.__uploadFlowKpCalls = []
  stubState.__uploadFlowChunkInputs = []
  stubState.__uploadFlowFetchCalls = []
  stubState.__uploadFlowChunks = [
    {
      index: 0,
      title: 'Chapter 1',
      text: 'Alpha content',
      startLine: 0,
      endLine: 2,
      pageStart: 1,
      pageEnd: 1,
    },
  ]
  process.env.OCR_SERVER_URL = 'http://ocr.example.test'
}

async function loadUploadFlow() {
  const moduleUrl = new URL(
    `./upload-flow.ts?ts=${Date.now()}-${Math.random().toString(16).slice(2)}`,
    import.meta.url
  ).href

  return import(moduleUrl)
}

test.beforeEach(() => {
  resetStubState()
})

test.after(() => {
  globalThis.fetch = originalFetch
})

test('marks the book as failed when classify-pdf returns a non-ok response', async () => {
  globalThis.fetch = async (input, init) => {
    stubState.__uploadFlowFetchCalls.push({ url: String(input), init })
    return new Response('', { status: 502 })
  }

  const { runClassifyAndExtract } = await loadUploadFlow()
  await runClassifyAndExtract(42, 'books/42/original.pdf')

  assert.equal(stubState.__uploadFlowFetchCalls.length, 1)
  assert.equal(stubState.__uploadFlowFetchCalls[0].url, 'http://ocr.example.test/classify-pdf')
  assert.equal(stubState.__uploadFlowRunCalls.length, 1)
  assert.equal(
    stubState.__uploadFlowRunCalls[0].sql,
    "UPDATE books SET parse_status = 'error' WHERE id = $1"
  )
  assert.deepEqual(stubState.__uploadFlowRunCalls[0].params, [42])
  assert.equal(stubState.__uploadFlowLogCalls[0]?.[0], 'book_ocr_failed')
  assert.equal(stubState.__uploadFlowInsertCalls.length, 0)
  assert.equal(stubState.__uploadFlowKpCalls.length, 0)
})

test('writes raw text, creates modules, and marks text-only books as done', async () => {
  const classifyPayload = {
    pages: [{ page: 1, type: 'text' }],
    text_count: 1,
    scanned_count: 0,
    mixed_count: 0,
    total_pages: 1,
  }
  const extractPayload = {
    text: '--- PAGE 1 ---\nChapter 1\nAlpha content',
    page_count: 1,
  }

  globalThis.fetch = async (input, init) => {
    const url = String(input)
    stubState.__uploadFlowFetchCalls.push({ url, init })

    if (url.endsWith('/classify-pdf')) {
      return Response.json(classifyPayload)
    }

    if (url.endsWith('/extract-text')) {
      return Response.json(extractPayload)
    }

    throw new Error(`Unexpected fetch URL: ${url}`)
  }

  const { runClassifyAndExtract } = await loadUploadFlow()
  await runClassifyAndExtract(42, 'books/42/original.pdf')

  assert.deepEqual(stubState.__uploadFlowHeaderUrls, [
    'http://ocr.example.test/classify-pdf',
    'http://ocr.example.test/extract-text',
  ])
  assert.equal(stubState.__uploadFlowFetchCalls.length, 2)
  assert.deepEqual(stubState.__uploadFlowRunCalls[0].params, [
    JSON.stringify(classifyPayload.pages),
    1,
    0,
    1,
    42,
  ])
  assert.deepEqual(stubState.__uploadFlowRunCalls[1], {
    sql: 'UPDATE books SET raw_text = $1 WHERE id = $2',
    params: [extractPayload.text, 42],
  })
  assert.deepEqual(stubState.__uploadFlowRunCalls[2], {
    sql: "UPDATE books SET parse_status = 'done' WHERE id = $1",
    params: [42],
  })

  assert.equal(stubState.__uploadFlowChunkInputs[0], extractPayload.text)
  assert.equal(stubState.__uploadFlowInsertCalls.length, 1)
  assert.deepEqual(stubState.__uploadFlowInsertCalls[0].params, [
    42,
    'Chapter 1',
    0,
    1,
    1,
    'ready',
    'skipped',
    'pending',
  ])
  assert.deepEqual(stubState.__uploadFlowKpCalls, [42])
  assert.equal(stubState.__uploadFlowLogCalls.at(-1)?.[0], 'book_upload_classified')
})

import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import * as nodeModule from 'node:module'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { NextRequest } from 'next/server.js'

const SRC_DIR = path.join(process.cwd(), 'src')
const HANDLE_ROUTE_URL = pathToFileURL(path.join(SRC_DIR, 'lib', 'handle-route.ts')).href
const AUTH_STUB_URL = pathToFileURL(path.join(SRC_DIR, 'lib', 'test-stubs', 'confirm', 'auth.ts')).href
const DB_STUB_URL = pathToFileURL(path.join(SRC_DIR, 'lib', 'test-stubs', 'confirm', 'db.ts')).href
const LOG_STUB_URL = pathToFileURL(path.join(SRC_DIR, 'lib', 'test-stubs', 'confirm', 'log.ts')).href
const R2_STUB_URL = pathToFileURL(path.join(SRC_DIR, 'lib', 'test-stubs', 'confirm', 'r2-client.ts')).href
const UPLOAD_FLOW_STUB_URL = pathToFileURL(path.join(SRC_DIR, 'lib', 'test-stubs', 'confirm', 'upload-flow.ts')).href
const S3_STUB_URL = pathToFileURL(path.join(SRC_DIR, 'lib', 'test-stubs', 'confirm', 'aws-sdk-client-s3.ts')).href

const PDF_PARSE_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export default async function pdf() {
  return globalThis.__confirmPdfResult ?? {
    numpages: 10,
    text: 'readable text '.repeat(100),
  }
}
`)}`

const PDF_MD5_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export async function computePdfMd5FromR2(objectKey) {
  globalThis.__confirmMd5Calls.push(objectKey)
  return globalThis.__confirmFileMd5 ?? 'test-md5'
}
`)}`

const PPTX_PARSE_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export async function parsePptx(objectKey, bookId) {
  globalThis.__confirmPptxParseCalls.push({ objectKey, bookId })
  return globalThis.__confirmPptxParseResult ?? {
    slideCount: 2,
    rawText: '--- SLIDE 1 ---\\nSlide one\\n--- SLIDE 2 ---\\nSlide two',
  }
}
`)}`

const KP_CACHE_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export async function lookupCache(pdfMd5, pageCount, language) {
  globalThis.__confirmLookupCacheCalls.push({ pdfMd5, pageCount, language })
  return globalThis.__confirmCacheResult ?? { hit: false }
}

export async function applyCacheToBook(bookId, payload, pdfMd5) {
  globalThis.__confirmApplyCacheCalls.push({ bookId, payload, pdfMd5 })
}
`)}`

const QUOTA_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export async function consumeQuotaAndLogUpload(userId, bookId) {
  globalThis.__confirmQuotaConsumeCalls.push({ userId, bookId })
  return globalThis.__confirmConsumeQuotaResult ?? true
}
`)}`

const COST_ESTIMATOR_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export function estimateBookCostYuan(pageCount, modelId) {
  globalThis.__confirmEstimateCostCalls.push({ pageCount, modelId })
  return globalThis.__confirmEstimateCostYuan ?? 0.5
}

export function assertWithinBookBudget(estimateYuan) {
  globalThis.__confirmBudgetAssertCalls.push(estimateYuan)
  if (globalThis.__confirmBudgetReject) {
    throw globalThis.__confirmBudgetReject
  }
}
`)}`

const AI_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export const AI_MODEL_ID = 'test-model'
`)}`

const KP_EXTRACTION_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export async function triggerReadyModulesExtraction(bookId) {
  globalThis.__confirmKpTriggerCalls.push(bookId)
}
`)}`

const TEXT_CHUNKER_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export function chunkText(rawText) {
  return globalThis.__confirmChunks ?? [{
    title: 'Module 1',
    pageStart: 1,
    pageEnd: 2,
    text: rawText,
  }]
}
`)}`

const NEXT_AFTER_STUB_URL = `data:text/javascript,${encodeURIComponent(`
export function after(callback) {
  void callback()
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

type QueryCall = {
  sql: string
  params: unknown[]
}

type RunCall = {
  sql: string
  params: unknown[]
}

type UploadFlowCall = {
  bookId: number
  objectKey: string
}

type ObjectKeyCall = {
  bookId: number
  contentType?: string
}

type QuotaConsumeCall = {
  userId: number
  bookId: number
}

type LookupCacheCall = {
  pdfMd5: string
  pageCount: number
  language: 'zh' | 'en'
}

type EstimateCostCall = {
  pageCount: number
  modelId: string
}

type ConfirmBook = {
  id: number
  user_id: number
  upload_status: string
  parse_status: string
  file_size: string
} | undefined

type StubState = typeof globalThis & {
  __confirmAuthMode?: 'authorized' | 'unauthorized'
  __confirmUserId?: number
  __confirmUserRole?: 'user' | 'admin'
  __confirmBook: ConfirmBook
  __confirmObjectKey?: string
  __confirmHeadContentLength?: number
  __confirmHeadError?: unknown
  __confirmUpdateRowCount?: number
  __confirmInsertId?: number
  __confirmFileMd5?: string
  __confirmPdfResult?: { numpages: number; text: string }
  __confirmPptxParseResult?: { slideCount: number; rawText: string }
  __confirmCacheResult?: { hit: false } | { hit: true; payload: unknown; modelUsed: string }
  __confirmConsumeQuotaResult?: boolean
  __confirmEstimateCostYuan?: number
  __confirmBudgetReject?: Error
  __confirmQueryCalls: QueryCall[]
  __confirmRunCalls: RunCall[]
  __confirmInsertCalls: QueryCall[]
  __confirmLogCalls: unknown[][]
  __confirmBuildObjectKeyCalls: ObjectKeyCall[]
  __confirmUploadFlowCalls: UploadFlowCall[]
  __confirmHeadCalls: Record<string, unknown>[]
  __confirmS3Configs: Record<string, unknown>[]
  __confirmMd5Calls: string[]
  __confirmPptxParseCalls: Array<{ objectKey: string; bookId: number }>
  __confirmLookupCacheCalls: LookupCacheCall[]
  __confirmApplyCacheCalls: Array<{ bookId: number; payload: unknown; pdfMd5: string }>
  __confirmQuotaConsumeCalls: QuotaConsumeCall[]
  __confirmEstimateCostCalls: EstimateCostCall[]
  __confirmBudgetAssertCalls: number[]
  __confirmKpTriggerCalls: number[]
  __confirmChunks?: Array<{
    title: string
    pageStart: number
    pageEnd: number
    text: string
  }>
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
    if (
      specifier === 'next/server' &&
      context.parentURL?.includes('/src/app/api/books/confirm/route.ts')
    ) {
      return { url: NEXT_AFTER_STUB_URL, shortCircuit: true }
    }

    if (specifier === 'next/server') {
      return nextResolve('next/server.js', context)
    }

    if (specifier === '@aws-sdk/client-s3') {
      return { url: S3_STUB_URL, shortCircuit: true }
    }

    if (specifier === 'pdf-parse') {
      return { url: PDF_PARSE_STUB_URL, shortCircuit: true }
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

    if (specifier === '@/lib/upload-flow') {
      return { url: UPLOAD_FLOW_STUB_URL, shortCircuit: true }
    }

    if (specifier === '@/lib/pdf-md5') {
      return { url: PDF_MD5_STUB_URL, shortCircuit: true }
    }

    if (specifier === '@/lib/pptx-parse') {
      return { url: PPTX_PARSE_STUB_URL, shortCircuit: true }
    }

    if (specifier === '@/lib/services/kp-cache-service') {
      return { url: KP_CACHE_STUB_URL, shortCircuit: true }
    }

    if (specifier === '@/lib/services/quota-service') {
      return { url: QUOTA_STUB_URL, shortCircuit: true }
    }

    if (specifier === '@/lib/services/cost-estimator') {
      return { url: COST_ESTIMATOR_STUB_URL, shortCircuit: true }
    }

    if (specifier === '@/lib/ai') {
      return { url: AI_STUB_URL, shortCircuit: true }
    }

    if (specifier === '@/lib/services/kp-extraction-service') {
      return { url: KP_EXTRACTION_STUB_URL, shortCircuit: true }
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

function resetStubState(): void {
  stubState.__confirmAuthMode = 'authorized'
  stubState.__confirmUserId = 7
  stubState.__confirmUserRole = 'user'
  stubState.__confirmBook = undefined
  stubState.__confirmObjectKey = undefined
  stubState.__confirmHeadContentLength = 1_000_000
  stubState.__confirmHeadError = undefined
  stubState.__confirmUpdateRowCount = 1
  stubState.__confirmInsertId = 101
  stubState.__confirmFileMd5 = 'test-md5'
  stubState.__confirmPdfResult = {
    numpages: 10,
    text: 'readable text '.repeat(100),
  }
  stubState.__confirmPptxParseResult = {
    slideCount: 2,
    rawText: '--- SLIDE 1 ---\nSlide one\n--- SLIDE 2 ---\nSlide two',
  }
  stubState.__confirmCacheResult = { hit: false }
  stubState.__confirmConsumeQuotaResult = true
  stubState.__confirmEstimateCostYuan = 0.5
  stubState.__confirmBudgetReject = undefined
  stubState.__confirmQueryCalls = []
  stubState.__confirmRunCalls = []
  stubState.__confirmInsertCalls = []
  stubState.__confirmLogCalls = []
  stubState.__confirmBuildObjectKeyCalls = []
  stubState.__confirmUploadFlowCalls = []
  stubState.__confirmHeadCalls = []
  stubState.__confirmS3Configs = []
  stubState.__confirmMd5Calls = []
  stubState.__confirmPptxParseCalls = []
  stubState.__confirmLookupCacheCalls = []
  stubState.__confirmApplyCacheCalls = []
  stubState.__confirmQuotaConsumeCalls = []
  stubState.__confirmEstimateCostCalls = []
  stubState.__confirmBudgetAssertCalls = []
  stubState.__confirmKpTriggerCalls = []
  stubState.__confirmChunks = undefined

  process.env.R2_ACCOUNT_ID = 'test-account'
  process.env.R2_ACCESS_KEY_ID = 'test-key'
  process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
  process.env.R2_BUCKET = 'test-bucket'
}

function mkRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/books/confirm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

async function loadConfirmRoute() {
  const moduleUrl = new URL(
    `./route.ts?ts=${Date.now()}-${Math.random().toString(16).slice(2)}`,
    import.meta.url
  ).href

  return import(moduleUrl)
}

test.beforeEach(() => {
  resetStubState()
})

test('returns 401 when user is not authenticated', async () => {
  stubState.__confirmAuthMode = 'unauthorized'

  const { POST } = await loadConfirmRoute()
  const res = await POST(mkRequest({
    bookId: 42,
    title: 'Physics',
    contentType: 'application/pdf',
  }))
  const json = await res.json()

  assert.equal(res.status, 401)
  assert.equal(json.success, false)
  assert.equal(json.code, 'UNAUTHORIZED')
  assert.equal(stubState.__confirmQueryCalls.length, 0)
  assert.equal(stubState.__confirmUploadFlowCalls.length, 0)
})

test('returns 404 when the book does not belong to the user', async () => {
  const { POST } = await loadConfirmRoute()
  const res = await POST(mkRequest({
    bookId: 42,
    title: 'Physics',
    contentType: 'application/pdf',
  }))
  const json = await res.json()

  assert.equal(res.status, 404)
  assert.equal(json.success, false)
  assert.equal(json.code, 'NOT_FOUND')
  assert.equal(stubState.__confirmQueryCalls.length, 1)
  assert.deepEqual(stubState.__confirmQueryCalls[0].params, [42, 7])
  assert.equal(stubState.__confirmHeadCalls.length, 0)
})

test('returns 409 when a previously confirmed upload already failed', async () => {
  stubState.__confirmBook = {
    id: 42,
    user_id: 7,
    upload_status: 'confirmed',
    parse_status: 'error',
    file_size: '1000000',
  }

  const { POST } = await loadConfirmRoute()
  const res = await POST(mkRequest({
    bookId: 42,
    title: 'Physics',
    contentType: 'application/pdf',
  }))
  const json = await res.json()

  assert.equal(res.status, 409)
  assert.equal(json.success, false)
  assert.equal(json.code, 'PROCESSING_FAILED')
  assert.equal(stubState.__confirmHeadCalls.length, 0)
  assert.equal(stubState.__confirmRunCalls.length, 0)
  assert.equal(stubState.__confirmUploadFlowCalls.length, 0)
  assert.equal(stubState.__confirmLogCalls[0]?.[0], 'book_confirm_already_failed')
})

test('short-circuits when the upload is already confirmed and healthy', async () => {
  stubState.__confirmBook = {
    id: 42,
    user_id: 7,
    upload_status: 'confirmed',
    parse_status: 'processing',
    file_size: '1000000',
  }

  const { POST } = await loadConfirmRoute()
  const res = await POST(mkRequest({
    bookId: 42,
    title: 'Physics',
    contentType: 'application/pdf',
  }))
  const json = await res.json()

  assert.equal(res.status, 200)
  assert.equal(json.success, true)
  assert.deepEqual(json.data, { bookId: 42, processing: true })
  assert.equal(stubState.__confirmHeadCalls.length, 0)
  assert.equal(stubState.__confirmRunCalls.length, 0)
  assert.equal(stubState.__confirmUploadFlowCalls.length, 0)
})

test('returns 400 when the uploaded object size mismatches the recorded file size', async () => {
  stubState.__confirmBook = {
    id: 42,
    user_id: 7,
    upload_status: 'pending',
    parse_status: 'pending',
    file_size: '1000000',
  }
  stubState.__confirmHeadContentLength = 1_000_001

  const { POST } = await loadConfirmRoute()
  const res = await POST(mkRequest({
    bookId: 42,
    title: 'Physics',
    contentType: 'application/pdf',
  }))
  const json = await res.json()

  assert.equal(res.status, 400)
  assert.equal(json.success, false)
  assert.equal(json.code, 'UPLOAD_INCOMPLETE')
  assert.equal(stubState.__confirmRunCalls.length, 0)
  assert.equal(stubState.__confirmUploadFlowCalls.length, 0)
  assert.equal(stubState.__confirmLogCalls[0]?.[0], 'book_upload_size_mismatch')
})

test('confirms a pending upload after a successful HEAD check', async () => {
  stubState.__confirmBook = {
    id: 42,
    user_id: 7,
    upload_status: 'pending',
    parse_status: 'pending',
    file_size: '1000000',
  }

  const { POST } = await loadConfirmRoute()
  const res = await POST(mkRequest({
    bookId: 42,
    title: '  Physics  ',
    contentType: 'application/pdf',
  }))
  const json = await res.json()

  assert.equal(res.status, 200)
  assert.equal(json.success, true)
  assert.deepEqual(json.data, { bookId: 42, processing: true })

  assert.deepEqual(stubState.__confirmBuildObjectKeyCalls, [{
    bookId: 42,
    contentType: 'application/pdf',
  }])
  assert.deepEqual(stubState.__confirmHeadCalls, [
    { Bucket: 'test-bucket', Key: 'books/42/original.pdf' },
  ])

  assert.equal(stubState.__confirmRunCalls.length, 1)
  assert.match(stubState.__confirmRunCalls[0].sql, /UPDATE books/)
  assert.match(stubState.__confirmRunCalls[0].sql, /upload_status = 'confirmed'/)
  assert.deepEqual(stubState.__confirmRunCalls[0].params, ['test-md5', 'Physics', 42])
  assert.deepEqual(stubState.__confirmMd5Calls, ['books/42/original.pdf'])
  assert.deepEqual(stubState.__confirmLookupCacheCalls, [{
    pdfMd5: 'test-md5',
    pageCount: 10,
    language: 'zh',
  }])
  assert.deepEqual(stubState.__confirmQuotaConsumeCalls, [{ userId: 7, bookId: 42 }])

  assert.deepEqual(stubState.__confirmUploadFlowCalls, [
    { bookId: 42, objectKey: 'books/42/original.pdf' },
  ])
  assert.equal(stubState.__confirmLogCalls.at(-1)?.[0], 'book_confirmed_pdf')
  assert.equal(
    stubState.__confirmLogCalls.at(-1)?.[1],
    'bookId=42, md5=test-md5, pages=10, est=0.5'
  )
})

test('accepts string file_size from pg BIGINT when sizes match', async () => {
  stubState.__confirmBook = {
    id: 42,
    user_id: 7,
    upload_status: 'pending',
    parse_status: 'pending',
    file_size: '14929623',
  }
  stubState.__confirmHeadContentLength = 14_929_623

  const { POST } = await loadConfirmRoute()
  const res = await POST(mkRequest({
    bookId: 42,
    title: 'Physics Volume 2',
    contentType: 'application/pdf',
  }))
  const json = await res.json()

  assert.equal(res.status, 200)
  assert.equal(json.success, true)
  assert.deepEqual(json.data, { bookId: 42, processing: true })
  assert.equal(stubState.__confirmRunCalls.length, 1)
  assert.deepEqual(stubState.__confirmRunCalls[0].params, ['test-md5', 'Physics Volume 2', 42])
  assert.deepEqual(stubState.__confirmQuotaConsumeCalls, [{ userId: 7, bookId: 42 }])
  assert.deepEqual(stubState.__confirmUploadFlowCalls, [
    { bookId: 42, objectKey: 'books/42/original.pdf' },
  ])
})

test('admin pending PDF confirmation bypasses quota consumption', async () => {
  stubState.__confirmUserId = 1
  stubState.__confirmUserRole = 'admin'
  stubState.__confirmConsumeQuotaResult = false
  stubState.__confirmBook = {
    id: 42,
    user_id: 1,
    upload_status: 'pending',
    parse_status: 'pending',
    file_size: '1000000',
  }

  const { POST } = await loadConfirmRoute()
  const res = await POST(mkRequest({
    bookId: 42,
    title: 'Admin Upload',
    contentType: 'application/pdf',
  }))
  const json = await res.json()

  assert.equal(res.status, 200)
  assert.equal(json.success, true)
  assert.deepEqual(json.data, { bookId: 42, processing: true })
  assert.deepEqual(stubState.__confirmQuotaConsumeCalls, [])
})

test('regular user pending PDF confirmation still fails on quota race', async () => {
  stubState.__confirmConsumeQuotaResult = false
  stubState.__confirmBook = {
    id: 42,
    user_id: 7,
    upload_status: 'pending',
    parse_status: 'pending',
    file_size: '1000000',
  }

  const { POST } = await loadConfirmRoute()
  const res = await POST(mkRequest({
    bookId: 42,
    title: 'User Upload',
    contentType: 'application/pdf',
  }))
  const json = await res.json()

  assert.equal(res.status, 409)
  assert.equal(json.success, false)
  assert.equal(json.code, 'QUOTA_RACE')
  assert.deepEqual(stubState.__confirmQuotaConsumeCalls, [{ userId: 7, bookId: 42 }])
  assert.deepEqual(stubState.__confirmUploadFlowCalls, [])
})

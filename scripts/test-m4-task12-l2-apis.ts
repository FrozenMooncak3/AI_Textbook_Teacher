import assert from 'node:assert/strict'
import test from 'node:test'
import { Pool } from 'pg'

const BASE = process.env.APP_BASE_URL || 'http://localhost:3000'
const AUTH_COOKIE = process.env.TEST_AUTH_COOKIE
const TEST_BOOK_ID = Number(process.env.TEST_BOOK_ID)
const TEST_MODULE_ID = Number(process.env.TEST_MODULE_ID)
const databaseUrl = process.env.DATABASE_URL

type ModuleDetailResponse = {
  id: number
  book_id: number
  title: string
  summary: string
  order_index: number
  kp_count: number
  cluster_count: number
  learning_status: string
  knowledge_points: Array<{
    id: number
    kp_code: string
    section_name: string
    description: string
    importance: number
    cluster_id: number | null
    type?: unknown
    detailed_content?: unknown
    ocr_quality?: unknown
  }>
}

type ModuleClustersResponse = {
  clusters: Array<{
    id: number
    name: string
    kp_ids: number[]
  }>
}

type StatusResponse = {
  ok: boolean
}

type StartQaResponse = {
  qaSessionId: number
  redirectUrl: string
}

type SwitchModeResponse = {
  ok: boolean
  learningMode: 'teaching' | 'full'
}

type ResetAndStartResponse = {
  ok: boolean
  redirectUrl: string
}

function createApiHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    cookie: AUTH_COOKIE!,
  }
}

function assertApiEnv(t: test.TestContext): { bookId: number; moduleId: number } {
  if (!AUTH_COOKIE) {
    t.skip(
      '需要 TEST_AUTH_COOKIE 环境变量（格式：session_token=xxx；`session_token` 是 src/lib/auth.ts:6 SESSION_COOKIE 名）'
    )
  }

  assert.ok(Number.isInteger(TEST_BOOK_ID) && TEST_BOOK_ID > 0, 'TEST_BOOK_ID must be a positive integer')
  assert.ok(
    Number.isInteger(TEST_MODULE_ID) && TEST_MODULE_ID > 0,
    'TEST_MODULE_ID must be a positive integer'
  )

  return { bookId: TEST_BOOK_ID, moduleId: TEST_MODULE_ID }
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.text()
  assert.ok(response.ok, `HTTP ${response.status}: ${body}`)
  return JSON.parse(body) as T
}

async function createPool(): Promise<Pool> {
  assert.ok(databaseUrl, 'DATABASE_URL env var is required for DB-backed verification')
  return new Pool({ connectionString: databaseUrl })
}

test('GET /api/modules/[moduleId] returns module detail without protected KP fields', async (t) => {
  const { moduleId } = assertApiEnv(t)

  const response = await fetch(`${BASE}/api/modules/${moduleId}`, {
    headers: createApiHeaders(),
  })
  const payload = await readJsonResponse<ModuleDetailResponse>(response)

  assert.equal(payload.id, moduleId)
  assert.equal(typeof payload.title, 'string')
  assert.ok(Array.isArray(payload.knowledge_points))

  for (const kp of payload.knowledge_points) {
    assert.equal(typeof kp.id, 'number')
    assert.equal(typeof kp.kp_code, 'string')
    assert.equal(typeof kp.section_name, 'string')
    assert.equal(typeof kp.description, 'string')
    assert.equal(typeof kp.importance, 'number')
    assert.ok(!('type' in kp), 'kp.type must not be returned')
    assert.ok(!('detailed_content' in kp), 'kp.detailed_content must not be returned')
    assert.ok(!('ocr_quality' in kp), 'kp.ocr_quality must not be returned')
  }
})

test('GET /api/modules/[moduleId]/clusters returns cluster ids with ordered kp_ids arrays', async (t) => {
  const { moduleId } = assertApiEnv(t)

  const response = await fetch(`${BASE}/api/modules/${moduleId}/clusters`, {
    headers: createApiHeaders(),
  })
  const payload = await readJsonResponse<ModuleClustersResponse>(response)

  assert.ok(Array.isArray(payload.clusters))
  for (const cluster of payload.clusters) {
    assert.equal(typeof cluster.id, 'number')
    assert.equal(typeof cluster.name, 'string')
    assert.ok(Array.isArray(cluster.kp_ids))
    for (const kpId of cluster.kp_ids) {
      assert.equal(typeof kpId, 'number')
    }
  }
})

test("PATCH /api/modules/[moduleId]/status allows 'unstarted' -> 'taught'", async (t) => {
  const { moduleId } = assertApiEnv(t)
  const pool = await createPool()

  try {
    await pool.query("UPDATE modules SET learning_status = 'unstarted' WHERE id = $1", [moduleId])

    const response = await fetch(`${BASE}/api/modules/${moduleId}/status`, {
      method: 'PATCH',
      headers: createApiHeaders(),
      body: JSON.stringify({ learning_status: 'taught' }),
    })
    const payload = await readJsonResponse<StatusResponse>(response)

    assert.equal(payload.ok, true)
  } finally {
    await pool.end()
  }
})

test("POST /api/modules/[moduleId]/start-qa advances 'taught' modules into QA", async (t) => {
  const { moduleId } = assertApiEnv(t)

  const response = await fetch(`${BASE}/api/modules/${moduleId}/start-qa`, {
    method: 'POST',
    headers: createApiHeaders(),
    body: JSON.stringify({}),
  })
  const payload = await readJsonResponse<StartQaResponse>(response)

  assert.equal(payload.qaSessionId, moduleId)
  assert.equal(payload.redirectUrl, `/modules/${moduleId}/qa`)
})

test("POST /api/books/[bookId]/switch-mode accepts 'teaching'", async (t) => {
  const { bookId } = assertApiEnv(t)

  const response = await fetch(`${BASE}/api/books/${bookId}/switch-mode`, {
    method: 'POST',
    headers: createApiHeaders(),
    body: JSON.stringify({ newMode: 'teaching' }),
  })
  const payload = await readJsonResponse<SwitchModeResponse>(response)

  assert.equal(payload.ok, true)
  assert.equal(payload.learningMode, 'teaching')
})

test('POST /api/books/[bookId]/modules/[moduleId]/reset-and-start resets module to unstarted', async (t) => {
  const { bookId, moduleId } = assertApiEnv(t)
  const pool = await createPool()

  try {
    const response = await fetch(`${BASE}/api/books/${bookId}/modules/${moduleId}/reset-and-start`, {
      method: 'POST',
      headers: createApiHeaders(),
      body: JSON.stringify({}),
    })
    const payload = await readJsonResponse<ResetAndStartResponse>(response)

    assert.equal(payload.ok, true)
    assert.equal(payload.redirectUrl, `/modules/${moduleId}/activate`)

    const moduleRow = await pool.query<{ learning_status: string }>(
      'SELECT learning_status FROM modules WHERE id = $1',
      [moduleId]
    )

    assert.equal(moduleRow.rows[0]?.learning_status, 'unstarted')
  } finally {
    await pool.end()
  }
})

test('book-meta-analyzer returns teaching, full, and neutral recommendations with Chinese reasons', async () => {
  let getRecommendation: ((bookMeta: {
    kpCount: number
    subject?: string
    scanQuality?: 'good' | 'fair' | 'poor'
  }) => { recommended: 'teaching' | 'full' | null; reason: string }) | undefined

  try {
    ;({ getRecommendation } = await import('../src/lib/book-meta-analyzer'))
  } catch (error) {
    assert.fail(`failed to import book-meta-analyzer: ${String(error)}`)
  }

  assert.ok(getRecommendation, 'getRecommendation must be exported')

  const teaching = getRecommendation({ kpCount: 50, subject: '数学' })
  const full = getRecommendation({ kpCount: 10, subject: '文学' })
  const neutral = getRecommendation({ kpCount: 30 })

  assert.equal(teaching.recommended, 'teaching')
  assert.match(teaching.reason, /[\u4e00-\u9fff]/)

  assert.equal(full.recommended, 'full')
  assert.match(full.reason, /[\u4e00-\u9fff]/)

  assert.equal(neutral.recommended, null)
  assert.match(neutral.reason, /[\u4e00-\u9fff]/)
})

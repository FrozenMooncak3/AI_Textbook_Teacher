import assert from 'node:assert/strict'
import test from 'node:test'

const BASE = process.env.APP_BASE_URL || 'http://localhost:3000'
const AUTH_COOKIE = process.env.TEST_AUTH_COOKIE

type CreatedSession = {
  sessionId: string
  transcript: {
    version: number
    state: {
      currentKpId: number | null
    }
  }
}

type MessageSuccess = {
  status: 'teaching' | 'ready_to_advance' | 'struggling'
  message: string
  strugglingStreak: number
}

type MessageUnavailable = {
  error: 'teacher_unavailable' | 'invalid_output'
  retryable: boolean
}

test('teaching session happy path', async (t) => {
  if (!AUTH_COOKIE) {
    t.skip(
      '需要 TEST_AUTH_COOKIE 环境变量（格式：session_token=xxx；`session_token` 是 src/lib/auth.ts:6 SESSION_COOKIE 名）'
    )
    return
  }

  const moduleId = Number(process.env.TEST_MODULE_ID ?? 1)
  const clusterId = Number(process.env.TEST_CLUSTER_ID ?? 1)

  const createRes = await fetch(`${BASE}/api/teaching-sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: AUTH_COOKIE },
    body: JSON.stringify({ moduleId, clusterId, depth: 'full' }),
  })
  const createBody = await createRes.text()
  assert.equal(createRes.status, 200, createBody)

  const created = JSON.parse(createBody) as CreatedSession
  assert.ok(created.sessionId, 'sessionId 必须返回')
  assert.equal(created.transcript.version, 1)
  assert.ok(
    created.transcript.state.currentKpId,
    'cluster 有 KP 时应自动 set currentKpId'
  )

  const msgRes = await fetch(`${BASE}/api/teaching-sessions/${created.sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: AUTH_COOKIE },
    body: JSON.stringify({
      message: '我不太明白这个概念，能举个具体例子吗？',
    }),
  })

  const rawBody = await msgRes.text()
  assert.ok([200, 503].includes(msgRes.status), rawBody)

  if (msgRes.status === 503) {
    const unavailable = JSON.parse(rawBody) as MessageUnavailable
    assert.ok(
      unavailable.error === 'teacher_unavailable' || unavailable.error === 'invalid_output',
      `unexpected error payload: ${rawBody}`
    )
    assert.equal(unavailable.retryable, true)
    return
  }

  const parsed = JSON.parse(rawBody) as MessageSuccess
  assert.ok(
    ['teaching', 'ready_to_advance', 'struggling'].includes(parsed.status),
    `status=${parsed.status} 不在枚举里`
  )
  assert.ok(parsed.message.length > 0, 'message 必须非空')
  assert.equal(typeof parsed.strugglingStreak, 'number')
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { classifyError, retryWithBackoff } from '../src/lib/retry'

test('classifyError: AI_TypeValidationError -> retryable_validation', () => {
  const error = Object.assign(new Error('bad'), { name: 'AI_TypeValidationError' })

  assert.equal(classifyError(error), 'retryable_validation')
})

test('classifyError: AI_JSONParseError -> retryable_validation', () => {
  const error = Object.assign(new Error('bad'), { name: 'AI_JSONParseError' })

  assert.equal(classifyError(error), 'retryable_validation')
})

test('classifyError: status 429 -> retryable_network', () => {
  const error = Object.assign(new Error('rate limit'), { status: 429 })

  assert.equal(classifyError(error), 'retryable_network')
})

test('classifyError: status 500 -> retryable_network', () => {
  const error = Object.assign(new Error('server'), { status: 500 })

  assert.equal(classifyError(error), 'retryable_network')
})

test('classifyError: status 400 -> permanent', () => {
  const error = Object.assign(new Error('bad req'), { status: 400 })

  assert.equal(classifyError(error), 'permanent')
})

test('retryWithBackoff: succeeds on the second attempt', async () => {
  let calls = 0

  const result = await retryWithBackoff(
    async () => {
      calls += 1
      if (calls < 2) {
        throw Object.assign(new Error('transient'), { status: 500 })
      }

      return 'ok'
    },
    { baseMs: 10 }
  )

  assert.equal(result, 'ok')
  assert.equal(calls, 2)
})

test('retryWithBackoff: throws the last error after three failed attempts', async () => {
  let calls = 0

  await assert.rejects(
    () =>
      retryWithBackoff(
        async () => {
          calls += 1
          throw Object.assign(new Error(`attempt ${calls}`), { status: 500 })
        },
        { baseMs: 10 }
      ),
    /attempt 3/
  )

  assert.equal(calls, 3)
})

test('retryWithBackoff: throws permanent errors immediately without retrying', async () => {
  let calls = 0

  await assert.rejects(() =>
    retryWithBackoff(
      async () => {
        calls += 1
        throw Object.assign(new Error('bad req'), { status: 400 })
      },
      { baseMs: 10 }
    )
  )

  assert.equal(calls, 1)
})

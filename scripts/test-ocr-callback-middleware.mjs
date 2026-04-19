import assert from 'node:assert/strict'
import * as nodeModule from 'node:module'
import test from 'node:test'
import { NextRequest } from 'next/server.js'

const registerHooks = nodeModule.registerHooks

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'next/server') {
      return nextResolve('next/server.js', context)
    }

    return nextResolve(specifier, context)
  },
})

const { middleware } = await import('../src/middleware.ts')

function callMiddleware(pathname) {
  const request = new NextRequest(`http://localhost${pathname}`, {
    method: 'POST',
  })

  return middleware(request)
}

test('allows the exact OCR callback endpoint without a session cookie', () => {
  const response = callMiddleware('/api/ocr/callback')

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('x-middleware-next'), '1')
})

test('keeps nearby OCR API paths protected without a session cookie', async () => {
  for (const pathname of ['/api/ocr/callback/extra', '/api/ocr/status']) {
    const response = callMiddleware(pathname)

    assert.equal(response.status, 401, `${pathname} should stay protected`)
    assert.equal(response.headers.get('content-type'), 'application/json')
    assert.deepEqual(await response.json(), {
      success: false,
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    })
  }
})

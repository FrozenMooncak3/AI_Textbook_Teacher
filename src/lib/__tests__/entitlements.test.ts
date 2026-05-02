import assert from 'node:assert/strict'
import test from 'node:test'

type EntitlementsModule = typeof import('../entitlements')

async function loadEntitlements(): Promise<EntitlementsModule> {
  return import(new URL('../entitlements.ts', import.meta.url).href) as Promise<EntitlementsModule>
}

test('canBypassUploadLimits returns true for admin', async () => {
  const { canBypassUploadLimits } = await loadEntitlements()

  assert.strictEqual(canBypassUploadLimits({ role: 'admin' }), true)
})

test('canBypassUploadLimits returns false for user', async () => {
  const { canBypassUploadLimits } = await loadEntitlements()

  assert.strictEqual(canBypassUploadLimits({ role: 'user' }), false)
})

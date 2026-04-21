import assert from 'node:assert/strict'
import test from 'node:test'

async function loadR2ClientWithEnv(env: Record<string, string>) {
  const backup: Record<string, string | undefined> = {}

  for (const key of Object.keys(env)) {
    backup[key] = process.env[key]
    process.env[key] = env[key]
  }

  const moduleUrl = new URL(
    `./r2-client.ts?ts=${Date.now()}-${Math.random().toString(16).slice(2)}`,
    import.meta.url
  ).href
  const mod = await import(moduleUrl)

  return {
    mod,
    restore: () => {
      for (const key of Object.keys(env)) {
        if (backup[key] === undefined) {
          delete process.env[key]
        } else {
          process.env[key] = backup[key]
        }
      }
    },
  }
}

test('buildObjectKey returns books/<bookId>/original.pdf', async () => {
  const { mod, restore } = await loadR2ClientWithEnv({
    R2_ACCOUNT_ID: 'acct',
    R2_ACCESS_KEY_ID: 'k',
    R2_SECRET_ACCESS_KEY: 's',
    R2_BUCKET: 'b',
  })

  try {
    const key = (mod as { buildObjectKey: (id: number) => string }).buildObjectKey(42)
    assert.equal(key, 'books/42/original.pdf')
  } finally {
    restore()
  }
})

test('getSignedPdfUrl returns an https URL containing X-Amz-Signature', async () => {
  const { mod, restore } = await loadR2ClientWithEnv({
    R2_ACCOUNT_ID: 'acct',
    R2_ACCESS_KEY_ID: 'AKIA_TEST',
    R2_SECRET_ACCESS_KEY: 'secret',
    R2_BUCKET: 'test-bucket',
  })

  try {
    const url = await (mod as { getSignedPdfUrl: (k: string, s?: number) => Promise<string> })
      .getSignedPdfUrl('books/1/original.pdf', 300)

    assert.ok(url.startsWith('https://acct.r2.cloudflarestorage.com/test-bucket/books/1/original.pdf?'))
    assert.match(url, /X-Amz-Signature=/)
    assert.match(url, /X-Amz-Expires=300/)
  } finally {
    restore()
  }
})

test('buildPresignedPutUrl returns URL and object key for valid bookId', async () => {
  const { mod, restore } = await loadR2ClientWithEnv({
    R2_ACCOUNT_ID: 'test-account',
    R2_ACCESS_KEY_ID: 'test-key',
    R2_SECRET_ACCESS_KEY: 'test-secret',
    R2_BUCKET: 'test-bucket',
  })

  try {
    const { uploadUrl, objectKey } = await (mod as {
      buildPresignedPutUrl: (
        id: number,
        expirySeconds?: number
      ) => Promise<{ uploadUrl: string; objectKey: string }>
    }).buildPresignedPutUrl(42)

    assert.equal(objectKey, 'books/42/original.pdf')
    assert.match(uploadUrl, /^https?:\/\/.*\.r2\.cloudflarestorage\.com/)
    assert.match(uploadUrl, /X-Amz-Signature=/)
    assert.match(uploadUrl, /X-Amz-Expires=900/)
  } finally {
    restore()
  }
})

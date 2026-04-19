import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test, { after } from 'node:test'
import { Pool } from 'pg'

const databaseUrl = process.env.DATABASE_URL

assert.ok(databaseUrl, 'DATABASE_URL env var is required')

function normalizeDatabaseUrl(connectionString: string): string {
  const normalizedUrl = new URL(connectionString)

  if (normalizedUrl.searchParams.get('sslmode') === 'require') {
    normalizedUrl.searchParams.set('sslmode', 'verify-full')
  }

  return normalizedUrl.toString()
}

const pool = new Pool({ connectionString: normalizeDatabaseUrl(databaseUrl) })

let cleanupUserId: number | null = null

async function ensureUserId(): Promise<number> {
  const existingUserResult = await pool.query<{ id: number }>(
    'SELECT id FROM users ORDER BY id ASC LIMIT 1'
  )

  if (existingUserResult.rows[0]?.id) {
    return existingUserResult.rows[0].id
  }

  const email = `m4-task3-${randomUUID()}@example.com`
  const createdUserResult = await pool.query<{ id: number }>(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, 'test-password-hash', 'M4 Task 3 Test User')
     RETURNING id`,
    [email]
  )

  const userId = createdUserResult.rows[0]?.id
  assert.ok(userId, 'expected a user id when creating the fallback user')
  cleanupUserId = userId

  await pool.query(
    `INSERT INTO user_subscriptions (user_id, tier, effective_at)
     VALUES ($1, 'premium', NOW())
     ON CONFLICT DO NOTHING`,
    [userId]
  )

  return userId
}

after(async () => {
  if (cleanupUserId !== null) {
    await pool.query('DELETE FROM users WHERE id = $1', [cleanupUserId])
  }

  await pool.end()
})

test('pgcrypto extension is enabled', async () => {
  const extensionResult = await pool.query<{ extname: string }>(
    `SELECT extname FROM pg_extension WHERE extname='pgcrypto'`
  )

  assert.equal(extensionResult.rows.length, 1, 'pgcrypto must exist for gen_random_uuid')
})

test('prompt_templates.model column exists and is nullable text', async () => {
  const columnResult = await pool.query<{
    column_name: string
    data_type: string
    is_nullable: string
  }>(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_name='prompt_templates' AND column_name='model'`
  )

  assert.equal(columnResult.rows.length, 1)
  assert.equal(columnResult.rows[0]?.data_type, 'text')
  assert.equal(columnResult.rows[0]?.is_nullable, 'YES')
})

test('teaching_sessions transcript default is the teaching envelope object', async () => {
  const columnResult = await pool.query<{ column_default: string | null }>(
    `SELECT column_default
     FROM information_schema.columns
     WHERE table_name='teaching_sessions' AND column_name='transcript'`
  )

  assert.equal(columnResult.rows.length, 1)
  const columnDefault = columnResult.rows[0]?.column_default
  assert.ok(columnDefault, 'transcript column must have a default')
  const normalizedDefault = columnDefault.replace(/\s+/g, '')
  assert.ok(normalizedDefault.includes('"version":1'), 'transcript default must include version=1')
  assert.ok(normalizedDefault.includes('"messages":[]'), 'transcript default must include messages=[]')
  assert.ok(
    normalizedDefault.includes('"strugglingStreak":0'),
    'transcript default must include strugglingStreak=0'
  )
})

test('user_subscriptions exists and all users are backfilled', async () => {
  await pool.query('SELECT tier FROM user_subscriptions LIMIT 1')

  const missingSubscriptionResult = await pool.query<{ id: number }>(
    `SELECT u.id
     FROM users u
     WHERE NOT EXISTS (
       SELECT 1
       FROM user_subscriptions s
       WHERE s.user_id = u.id
     )`
  )

  assert.equal(
    missingSubscriptionResult.rows.length,
    0,
    `expected every user to have a subscription, missing ${missingSubscriptionResult.rows.length}`
  )
})

test('books.learning_mode is non-null with default full', async () => {
  const columnResult = await pool.query<{
    is_nullable: string
    column_default: string | null
  }>(
    `SELECT is_nullable, column_default
     FROM information_schema.columns
     WHERE table_name='books' AND column_name='learning_mode'`
  )

  assert.equal(columnResult.rows.length, 1)
  assert.equal(columnResult.rows[0]?.is_nullable, 'NO')
  assert.ok(
    columnResult.rows[0]?.column_default?.includes("'full'"),
    `learning_mode default should include 'full', got ${columnResult.rows[0]?.column_default}`
  )
})

test('books.preferred_learning_mode exists and is nullable', async () => {
  const columnResult = await pool.query<{ is_nullable: string }>(
    `SELECT is_nullable
     FROM information_schema.columns
     WHERE table_name='books' AND column_name='preferred_learning_mode'`
  )

  assert.equal(columnResult.rows.length, 1)
  assert.equal(columnResult.rows[0]?.is_nullable, 'YES')
})

test('books.learning_mode check rejects invalid values', async () => {
  const userId = await ensureUserId()

  await assert.rejects(
    () =>
      pool.query(
        `INSERT INTO books (user_id, title, learning_mode)
         VALUES ($1, $2, 'invalid_mode')`,
        [userId, `m4-task3-book-${randomUUID()}`]
      ),
    /violates check constraint/
  )
})

test('gen_random_uuid returns a UUID string', async () => {
  const uuidResult = await pool.query<{ gen_random_uuid: string }>('SELECT gen_random_uuid()')

  assert.match(uuidResult.rows[0]?.gen_random_uuid ?? '', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
})

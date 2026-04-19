import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test, { after } from 'node:test'
import { Pool } from 'pg'

const databaseUrl = process.env.DATABASE_URL

assert.ok(databaseUrl, 'DATABASE_URL env var is required')

const pool = new Pool({ connectionString: databaseUrl })
const insertedKnowledgePointIds: number[] = []
let cleanupBookId: number | null = null
let cleanupUserId: number | null = null
let moduleIdPromise: Promise<number> | null = null

async function ensureModuleId(): Promise<number> {
  if (moduleIdPromise) {
    return moduleIdPromise
  }

  moduleIdPromise = (async () => {
    const existingModule = await pool.query<{ id: number }>(
      'SELECT id FROM modules ORDER BY id ASC LIMIT 1'
    )
    if (existingModule.rows[0]) {
      return existingModule.rows[0].id
    }

    const email = `m4-task1-${randomUUID()}@example.com`
    const userResult = await pool.query<{ id: number }>(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, 'test-password-hash', 'M4 Task 1 Test User')
       RETURNING id`,
      [email]
    )
    cleanupUserId = userResult.rows[0].id

    const bookResult = await pool.query<{ id: number }>(
      `INSERT INTO books (user_id, title, parse_status, kp_extraction_status)
       VALUES ($1, 'M4 Task 1 Test Book', 'pending', 'pending')
       RETURNING id`,
      [cleanupUserId]
    )
    cleanupBookId = bookResult.rows[0].id

    const moduleResult = await pool.query<{ id: number }>(
      `INSERT INTO modules (book_id, title, order_index)
       VALUES ($1, 'M4 Task 1 Test Module', 1)
       RETURNING id`,
      [cleanupBookId]
    )

    return moduleResult.rows[0].id
  })()

  return moduleIdPromise
}

after(async () => {
  if (insertedKnowledgePointIds.length > 0) {
    await pool.query('DELETE FROM knowledge_points WHERE id = ANY($1::int[])', [insertedKnowledgePointIds])
  }

  if (cleanupBookId !== null) {
    await pool.query('DELETE FROM books WHERE id=$1', [cleanupBookId])
  }

  if (cleanupUserId !== null) {
    await pool.query('DELETE FROM users WHERE id=$1', [cleanupUserId])
  }

  await pool.end()
})

test('knowledge_points.type accepts only the new 5 values', async () => {
  const moduleId = await ensureModuleId()
  const validValues = ['factual', 'conceptual', 'procedural', 'analytical', 'evaluative'] as const

  for (const validValue of validValues) {
    const insertResult = await pool.query<{ id: number }>(
      `INSERT INTO knowledge_points
         (module_id, kp_code, section_name, description, type, importance, detailed_content)
       VALUES ($1, $2, 'test-section', 'test-description', $3, 3, 'test-content')
       RETURNING id`,
      [moduleId, `m4-task1-${validValue}-${randomUUID()}`, validValue]
    )

    const insertedId = insertResult.rows[0]?.id
    assert.ok(insertedId, `expected ${validValue} to be accepted`)
    insertedKnowledgePointIds.push(insertedId)
  }

  await assert.rejects(
    () =>
      pool.query(
        `INSERT INTO knowledge_points
           (module_id, kp_code, section_name, description, type, importance, detailed_content)
         VALUES ($1, 'm4-task1-old-type', 'test-section', 'test-description', 'position', 3, 'test-content')`,
        [moduleId]
      ),
    /knowledge_points_type_check/
  )
})

test('source_anchor column exists as nullable jsonb', async () => {
  const columnResult = await pool.query<{
    column_name: string
    data_type: string
    is_nullable: string
  }>(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_name='knowledge_points' AND column_name='source_anchor'`
  )

  assert.equal(columnResult.rows.length, 1)
  assert.equal(columnResult.rows[0]?.data_type, 'jsonb')
  assert.equal(columnResult.rows[0]?.is_nullable, 'YES')
})

test('extractor templates no longer contain the old KP type labels', async () => {
  const templateResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM prompt_templates
     WHERE role='extractor' AND template_text LIKE '%position%'`
  )

  assert.equal(templateResult.rows[0]?.count, '0', 'extractor templates still contain "position"')
})

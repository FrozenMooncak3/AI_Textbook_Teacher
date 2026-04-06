import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const repoRoot = process.cwd()

async function read(relativePath) {
  try {
    return await fs.readFile(path.join(repoRoot, relativePath), 'utf8')
  } catch {
    return ''
  }
}

const schemaSource = await read('src/lib/schema.sql')
const dbSource = await read('src/lib/db.ts')
const packageSource = await read('package.json')
const envSource = await read('.env.example')

test('package.json uses pg instead of better-sqlite3', () => {
  assert.match(packageSource, /"pg"\s*:/)
  assert.match(packageSource, /"@types\/pg"\s*:/)
  assert.doesNotMatch(packageSource, /"better-sqlite3"\s*:/)
  assert.doesNotMatch(packageSource, /"@types\/better-sqlite3"\s*:/)
})

test('schema.sql defines 24 tables including auth tables and books.user_id', () => {
  assert.notEqual(schemaSource, '')
  const createTableMatches = schemaSource.match(/CREATE TABLE IF NOT EXISTS /g) ?? []
  assert.equal(createTableMatches.length, 24)
  assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS users \(/)
  assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS invite_codes \(/)
  assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS sessions \(/)
  assert.match(schemaSource, /user_id\s+INTEGER REFERENCES users\(id\)/)
})

test('db.ts exports async pg helpers and no sqlite getDb remains', () => {
  assert.match(dbSource, /import \{ Pool, QueryResult \} from 'pg'/)
  assert.match(dbSource, /export async function query</)
  assert.match(dbSource, /export async function queryOne</)
  assert.match(dbSource, /export async function run\(/)
  assert.match(dbSource, /export async function insert\(/)
  assert.match(dbSource, /export async function initDb\(\): Promise<void>/)
  assert.match(dbSource, /export \{ pool \}/)
  assert.doesNotMatch(dbSource, /better-sqlite3/)
  assert.doesNotMatch(dbSource, /export function getDb/)
})

test('.env.example includes DATABASE_URL', () => {
  assert.match(envSource, /^DATABASE_URL=postgresql:\/\/user:password@localhost:5432\/textbook_teacher$/m)
})

import { readFile } from 'fs/promises'
import path from 'path'
import { Pool, QueryResult } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const { rows } = await pool.query(sql, params ?? [])
  return rows as T[]
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | undefined> {
  const rows = await query<T>(sql, params)
  return rows[0]
}

export async function run(
  sql: string,
  params?: unknown[]
): Promise<QueryResult<Record<string, unknown>>> {
  return pool.query<Record<string, unknown>>(sql, params ?? [])
}

export async function insert(
  sql: string,
  params?: unknown[]
): Promise<number> {
  const trimmedSql = sql.trim().replace(/;$/, '')
  const finalSql = /\bRETURNING\b/i.test(trimmedSql)
    ? trimmedSql
    : `${trimmedSql} RETURNING id`

  const { rows } = await pool.query<{ id: number }>(finalSql, params ?? [])
  const insertedId = rows[0]?.id

  if (!Number.isInteger(insertedId)) {
    throw new Error('Insert query did not return a numeric id')
  }

  return insertedId
}

export async function initDb(): Promise<void> {
  const schemaPath = path.join(process.cwd(), 'src', 'lib', 'schema.sql')
  const schema = await readFile(schemaPath, 'utf8')
  await pool.query(schema)
}

export { pool }

import { readFile } from 'fs/promises'
import { execFileSync } from 'child_process'
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
  const { seedTemplates } = await import('./seed-templates')
  await seedTemplates()
}

interface LegacyRunResult {
  changes: number
  lastInsertRowid: number
}

interface LegacyPreparedStatement {
  get<T = Record<string, unknown>>(...params: unknown[]): T | undefined
  all<T = Record<string, unknown>>(...params: unknown[]): T[]
  run(...params: unknown[]): LegacyRunResult
}

interface LegacyDb {
  prepare(sql: string): LegacyPreparedStatement
}

function convertLegacyPlaceholders(sql: string): string {
  let index = 0
  return sql.replace(/\?/g, () => `$${++index}`)
}

function runLegacyQuery<T>(
  sql: string,
  params: unknown[],
  mode: 'get' | 'all' | 'run'
): T {
  if (!process.env.DATABASE_URL) {
    if (mode === 'all') {
      return [] as T
    }

    if (mode === 'get') {
      return undefined as T
    }

    return { changes: 0, lastInsertRowid: 0 } as T
  }

  const script = `
    const { Client } = require('pg');

    (async () => {
      const client = new Client({ connectionString: process.env.CODEX_DATABASE_URL });
      await client.connect();

      try {
        const result = await client.query(
          process.env.CODEX_DATABASE_SQL,
          JSON.parse(process.env.CODEX_DATABASE_PARAMS || '[]')
        );

        let output;
        switch (process.env.CODEX_DATABASE_MODE) {
          case 'get':
            output = result.rows[0] ?? null;
            break;
          case 'all':
            output = result.rows;
            break;
          default:
            output = {
              changes: result.rowCount ?? 0,
              lastInsertRowid: Number(result.rows[0]?.id ?? 0),
            };
            break;
        }

        process.stdout.write(JSON.stringify(output));
      } finally {
        await client.end();
      }
    })().catch((error) => {
      console.error(String(error));
      process.exit(1);
    });
  `

  let output = ''
  try {
    output = execFileSync(process.execPath, ['-e', script], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        CODEX_DATABASE_URL: process.env.DATABASE_URL ?? '',
        CODEX_DATABASE_SQL: convertLegacyPlaceholders(sql),
        CODEX_DATABASE_PARAMS: JSON.stringify(params),
        CODEX_DATABASE_MODE: mode,
      },
    }).trim()
  } catch {
    if (mode === 'all') {
      return [] as T
    }

    if (mode === 'get') {
      return undefined as T
    }

    return { changes: 0, lastInsertRowid: 0 } as T
  }

  const parsed = output.length === 0 ? null : JSON.parse(output) as T | null
  return (parsed ?? undefined) as T
}

// Temporary compatibility shim for untouched server pages that still use getDb().
export function getDb(): LegacyDb {
  return {
    prepare(sql: string): LegacyPreparedStatement {
      return {
        get<T = Record<string, unknown>>(...params: unknown[]): T | undefined {
          return runLegacyQuery<T | undefined>(sql, params, 'get')
        },
        all<T = Record<string, unknown>>(...params: unknown[]): T[] {
          return runLegacyQuery<T[]>(sql, params, 'all')
        },
        run(...params: unknown[]): LegacyRunResult {
          return runLegacyQuery<LegacyRunResult>(sql, params, 'run')
        },
      }
    },
  }
}

export { pool }

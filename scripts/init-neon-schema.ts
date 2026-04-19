#!/usr/bin/env -S node --experimental-strip-types
import { readFile } from 'fs/promises'
import { Pool } from 'pg'

function normalizeDatabaseUrl(connectionString: string): string {
  const normalizedUrl = new URL(connectionString)

  if (normalizedUrl.searchParams.get('sslmode') === 'require') {
    normalizedUrl.searchParams.set('sslmode', 'verify-full')
  }

  return normalizedUrl.toString()
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL env var is required')
    process.exit(1)
  }
  const schemaPath = new URL('../src/lib/schema.sql', import.meta.url)
  const schema = await readFile(schemaPath, 'utf8')
  const pool = new Pool({ connectionString: normalizeDatabaseUrl(databaseUrl) })
  try {
    await pool.query(schema)
    console.log('schema applied successfully')
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

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

test('lib conversion files use async pg helpers instead of getDb', async () => {
  const files = [
    'src/lib/log.ts',
    'src/lib/prompt-templates.ts',
    'src/lib/mistakes.ts',
    'src/lib/services/book-service.ts',
    'src/lib/seed-templates.ts',
  ]

  for (const file of files) {
    const source = await read(file)
    assert.notEqual(source, '')
    assert.doesNotMatch(source, /getDb/)
  }
})

test('db-touching exported functions are async and renderTemplate stays sync', async () => {
  const logSource = await read('src/lib/log.ts')
  const promptSource = await read('src/lib/prompt-templates.ts')
  const mistakesSource = await read('src/lib/mistakes.ts')
  const bookServiceSource = await read('src/lib/services/book-service.ts')
  const seedSource = await read('src/lib/seed-templates.ts')

  assert.match(logSource, /export async function logAction\(/)

  assert.match(promptSource, /export async function getActiveTemplate\(/)
  assert.match(promptSource, /export function renderTemplate\(/)
  assert.doesNotMatch(promptSource, /export async function renderTemplate\(/)
  assert.match(promptSource, /export async function getPrompt\(/)
  assert.match(promptSource, /export async function upsertTemplate\(/)

  assert.match(mistakesSource, /export async function recordMistake\(/)
  assert.match(mistakesSource, /export async function recordMistakes\(/)
  assert.match(mistakesSource, /export async function getUnresolvedMistakes\(/)
  assert.match(mistakesSource, /export async function resolveMistake\(/)

  assert.match(bookServiceSource, /list\(\): Promise<Book\[]>/)
  assert.match(bookServiceSource, /async list\(\): Promise<Book\[]>/)
  assert.match(bookServiceSource, /getById\(id: number\): Promise<Book>/)
  assert.match(bookServiceSource, /async getById\(id: number\): Promise<Book>/)

  assert.match(seedSource, /export async function seedTemplates\(\): Promise<void>/)
})

test('converted SQL uses postgres placeholders and helper imports', async () => {
  const logSource = await read('src/lib/log.ts')
  const promptSource = await read('src/lib/prompt-templates.ts')
  const mistakesSource = await read('src/lib/mistakes.ts')
  const bookServiceSource = await read('src/lib/services/book-service.ts')
  const seedSource = await read('src/lib/seed-templates.ts')

  assert.match(logSource, /from '\.\/db'/)
  assert.match(logSource, /run\('INSERT INTO logs \(level, action, details\) VALUES \(\$1, \$2, \$3\)'/)

  assert.match(promptSource, /from '\.\/db'/)
  assert.match(promptSource, /SELECT \* FROM prompt_templates WHERE role = \$1 AND stage = \$2 AND is_active = 1/)
  assert.match(promptSource, /UPDATE prompt_templates SET template_text = \$1 WHERE id = \$2/)
  assert.match(promptSource, /VALUES \(\$1, \$2, 1, \$3, 1\)/)

  assert.match(mistakesSource, /from '\.\/db'/)
  assert.match(mistakesSource, /VALUES \(\$1, \$2, \$3, \$4, \$5, \$6\)/)
  assert.match(mistakesSource, /WHERE module_id = \$1 AND is_resolved = 0/)
  assert.match(mistakesSource, /WHERE id = \$1/)

  assert.match(bookServiceSource, /from '\.\.\/db'/)
  assert.match(bookServiceSource, /WHERE id = \$1/)

  assert.match(seedSource, /from '\.\/db'/)
  assert.match(seedSource, /VALUES \(\$1, \$2, 1, \$3, 1\)/)
})

test('initDb seeds templates after applying schema', async () => {
  const dbSource = await read('src/lib/db.ts')

  assert.match(dbSource, /const \{ seedTemplates \} = await import\('\.\/seed-templates'\)/)
  assert.match(dbSource, /await seedTemplates\(\)/)
})

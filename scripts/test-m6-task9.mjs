import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const repoRoot = process.cwd()

async function read(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), 'utf8')
}

test('task 9 secures qa respond route with authenticated ownership check', async () => {
  const source = await read('src/app/api/qa/[questionId]/respond/route.ts')

  assert.match(source, /import\s+\{\s*requireUser\s*\}\s+from\s+'@\/lib\/auth'/)
  assert.match(source, /const user = await requireUser\(req\)/)
  assert.match(source, /JOIN modules m ON m\.id = q\.module_id/)
  assert.match(source, /JOIN books b ON b\.id = m\.book_id/)
  assert.match(source, /WHERE q\.id = \$1 AND b\.user_id = \$2/)
})

test('task 9 secures conversation messages and logs routes', async () => {
  const conversationSource = await read('src/app/api/conversations/[conversationId]/messages/route.ts')
  const logsSource = await read('src/app/api/logs/route.ts')
  const logLibSource = await read('src/lib/log.ts')

  assert.match(conversationSource, /const user = await requireUser\(req\)/)
  assert.match(conversationSource, /JOIN books b ON b\.id = c\.book_id/)
  assert.match(conversationSource, /WHERE c\.id = \$1 AND b\.user_id = \$2/)
  assert.match(logsSource, /const user = await requireUser\(request\)/)
  assert.match(logsSource, /information_schema\.columns/)
  assert.match(logsSource, /WHERE user_id = \$1 ORDER BY id DESC LIMIT 200/)
  assert.match(logLibSource, /INSERT INTO logs \(user_id, level, action, details\) VALUES \(\$1, \$2, \$3, \$4\)/)
})

test('task 9 hardens schema and login redirect', async () => {
  const schemaSource = await read('src/lib/schema.sql')
  const loginSource = await read('src/app/(auth)/login/page.tsx')

  assert.match(schemaSource, /user_id INTEGER NOT NULL REFERENCES users\(id\),/)
  assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS logs \([\s\S]*user_id INTEGER REFERENCES users\(id\),/)
  assert.match(loginSource, /const rawNext = searchParams\.get\('next'\) \|\| '\//)
  assert.match(loginSource, /const next = rawNext\.startsWith\('\/'\) && !rawNext\.startsWith\('\/\/'\) \? rawNext : '\//)
})

test('task 9 replaces screenshot ask mojibake strings with English text', async () => {
  const source = await read('src/app/api/books/[bookId]/screenshot-ask/route.ts')

  assert.match(source, /You are a professional textbook learning tutor/)
  assert.match(source, /\(no text recognized\)/)
  assert.doesNotMatch(source, /閺冪姵鏋冪€涙鐦戦崚/)
  assert.doesNotMatch(source, /娴ｇ姵妲告稉/)
})

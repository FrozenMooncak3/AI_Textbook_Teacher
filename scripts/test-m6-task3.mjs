import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const repoRoot = process.cwd()

const routeFiles = [
  'src/app/api/books/route.ts',
  'src/app/api/books/[bookId]/status/route.ts',
  'src/app/api/books/[bookId]/extract/route.ts',
  'src/app/api/books/[bookId]/pdf/route.ts',
  'src/app/api/books/[bookId]/toc/route.ts',
  'src/app/api/books/[bookId]/highlights/route.ts',
  'src/app/api/books/[bookId]/notes/route.ts',
  'src/app/api/books/[bookId]/module-map/route.ts',
  'src/app/api/books/[bookId]/module-map/confirm/route.ts',
  'src/app/api/books/[bookId]/module-map/regenerate/route.ts',
  'src/app/api/books/[bookId]/screenshot-ocr/route.ts',
  'src/app/api/books/[bookId]/screenshot-ask/route.ts',
  'src/app/api/books/[bookId]/dashboard/route.ts',
  'src/app/api/books/[bookId]/mistakes/route.ts',
  'src/app/api/conversations/[conversationId]/messages/route.ts',
  'src/app/api/logs/route.ts',
]

async function read(relativePath) {
  try {
    return await fs.readFile(path.join(repoRoot, relativePath), 'utf8')
  } catch {
    return ''
  }
}

test('task 3 route files use pg helpers instead of getDb/db.prepare', async () => {
  for (const file of routeFiles) {
    const source = await read(file)
    assert.notEqual(source, '', `${file} should exist`)
    assert.doesNotMatch(source, /getDb/)
    assert.doesNotMatch(source, /db\.prepare\(/)
  }
})

test('routes await lib helpers that became async in task 2', async () => {
  const booksRoute = await read('src/app/api/books/route.ts')
  const screenshotAskRoute = await read('src/app/api/books/[bookId]/screenshot-ask/route.ts')
  const screenshotOcrRoute = await read('src/app/api/books/[bookId]/screenshot-ocr/route.ts')
  const moduleMapConfirmRoute = await read('src/app/api/books/[bookId]/module-map/confirm/route.ts')
  const conversationsRoute = await read('src/app/api/conversations/[conversationId]/messages/route.ts')

  assert.match(booksRoute, /await bookService\.list\(\)/)
  assert.match(booksRoute, /await logAction\('book_upload_started'/)
  assert.match(booksRoute, /await logAction\('book_upload_short_text'/)
  assert.match(booksRoute, /await logAction\('book_upload_completed_txt'/)
  assert.match(booksRoute, /await logAction\('book_ocr_started'/)

  assert.match(screenshotAskRoute, /await logAction\('screenshot_ask_started'/)
  assert.match(screenshotAskRoute, /const userPrompt = await getPrompt\(/)
  assert.match(screenshotAskRoute, /await logAction\('screenshot_ask_failed'/)
  assert.match(screenshotAskRoute, /await logAction\('screenshot_ask_completed'/)

  assert.match(screenshotOcrRoute, /await logAction\(\s*'screenshot_ocr_completed'/)
  assert.match(moduleMapConfirmRoute, /await logAction\(/)
  assert.match(conversationsRoute, /await logAction\(/)
})

test('route files import pg helpers where needed', async () => {
  const booksRoute = await read('src/app/api/books/route.ts')
  const statusRoute = await read('src/app/api/books/[bookId]/status/route.ts')
  const highlightsRoute = await read('src/app/api/books/[bookId]/highlights/route.ts')
  const screenshotAskRoute = await read('src/app/api/books/[bookId]/screenshot-ask/route.ts')
  const logsRoute = await read('src/app/api/logs/route.ts')

  assert.match(booksRoute, /from '@\/lib\/db'/)
  assert.match(booksRoute, /await insert\(/)
  assert.match(statusRoute, /await queryOne</)
  assert.match(highlightsRoute, /await query</)
  assert.match(highlightsRoute, /await insert\(/)
  assert.match(highlightsRoute, /await run\(/)
  assert.match(screenshotAskRoute, /await insert\(/)
  assert.match(screenshotAskRoute, /await run\(/)
  assert.match(logsRoute, /await query\(/)
})

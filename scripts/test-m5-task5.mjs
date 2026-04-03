import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const repoRoot = process.cwd()

async function readSource(relativePath) {
  try {
    return await fs.readFile(path.join(repoRoot, relativePath), 'utf8')
  } catch {
    return ''
  }
}

const dashboardRoutePath = 'src/app/api/books/[bookId]/dashboard/route.ts'
const mistakesRoutePath = 'src/app/api/books/[bookId]/mistakes/route.ts'
const apiContractPath = '.agents/API_CONTRACT.md'

test('dashboard route validates book id and missing book', async () => {
  const source = await readSource(dashboardRoutePath)
  assert.notEqual(source, '')
  assert.match(source, /export const GET = handleRoute\(async \(_req, context\) =>/)
  assert.match(source, /throw new UserError\('Invalid book ID', 'INVALID_ID', 400\)/)
  assert.match(source, /SELECT id,\s*title FROM books WHERE id = \?/)
  assert.match(source, /throw new UserError\('Book not found', 'NOT_FOUND', 404\)/)
})

test('dashboard route aggregates modules reviews tests mistakes and overdue flag', async () => {
  const source = await readSource(dashboardRoutePath)
  assert.match(source, /FROM modules m WHERE m\.book_id = \? ORDER BY m\.order_index/)
  assert.match(source, /FROM review_schedule rs[\s\S]*WHERE m\.book_id = \? AND rs\.status = 'pending'/)
  assert.match(source, /FROM test_papers tp[\s\S]*WHERE m\.book_id = \?[\s\S]*ORDER BY tp\.created_at DESC LIMIT 10/)
  assert.match(source, /FROM mistakes mk[\s\S]*WHERE m\.book_id = \?[\s\S]*GROUP BY error_type/)
  assert.match(source, /isOverdue:/)
})

test('book mistakes route supports filters and summary queries', async () => {
  const source = await readSource(mistakesRoutePath)
  assert.notEqual(source, '')
  assert.match(source, /parseModuleFilter\(url\.searchParams\.get\('module'\)\)/)
  assert.match(source, /parseErrorTypeFilter\(url\.searchParams\.get\('errorType'\)\)/)
  assert.match(source, /parseSourceFilter\(url\.searchParams\.get\('source'\)\)/)
  assert.match(source, /conditions\.push\('mk\.module_id = \?'\)/)
  assert.match(source, /conditions\.push\('mk\.error_type = \?'\)/)
  assert.match(source, /conditions\.push\('mk\.source = \?'\)/)
  assert.match(source, /JOIN modules m ON m\.id = mk\.module_id/)
  assert.match(source, /LEFT JOIN knowledge_points kp ON kp\.id = mk\.kp_id/)
  assert.match(source, /summary:\s*\{\s*total,\s*byType,\s*byModule:/)
})

test('api contract documents dashboard and book mistakes endpoints', async () => {
  const source = await readSource(apiContractPath)
  assert.match(source, /GET \/api\/books\/\[bookId\]\/dashboard/)
  assert.match(source, /GET \/api\/books\/\[bookId\]\/mistakes/)
})

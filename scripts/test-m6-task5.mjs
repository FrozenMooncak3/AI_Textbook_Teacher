import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const repoRoot = process.cwd()

const guardedBookRoutes = [
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
]

async function read(relativePath) {
  try {
    return await fs.readFile(path.join(repoRoot, relativePath), 'utf8')
  } catch {
    return ''
  }
}

test('task 5 adds auth library, middleware, auth routes, and seed script', async () => {
  const authSource = await read('src/lib/auth.ts')
  const middlewareSource = await read('src/middleware.ts')
  const registerRoute = await read('src/app/api/auth/register/route.ts')
  const loginRoute = await read('src/app/api/auth/login/route.ts')
  const logoutRoute = await read('src/app/api/auth/logout/route.ts')
  const meRoute = await read('src/app/api/auth/me/route.ts')
  const seedScript = await read('scripts/seed-invite-codes.ts')

  assert.notEqual(authSource, '')
  assert.notEqual(middlewareSource, '')
  assert.notEqual(registerRoute, '')
  assert.notEqual(loginRoute, '')
  assert.notEqual(logoutRoute, '')
  assert.notEqual(meRoute, '')
  assert.notEqual(seedScript, '')

  assert.match(authSource, /export async function hashPassword/)
  assert.match(authSource, /export async function verifyPassword/)
  assert.match(authSource, /export async function createSession/)
  assert.match(authSource, /export async function getUserFromSession/)
  assert.match(authSource, /export async function destroySession/)
  assert.match(authSource, /export async function requireUser/)
  assert.match(authSource, /export async function requireBookOwner/)
  assert.match(authSource, /export \{ SESSION_COOKIE \}/)

  assert.match(middlewareSource, /publicPaths/)
  assert.match(middlewareSource, /session_token/)
  assert.match(middlewareSource, /401/)
  assert.match(middlewareSource, /\/login/)

  assert.match(registerRoute, /inviteCode/)
  assert.match(registerRoute, /setCookie|cookies\.set|Set-Cookie/)
  assert.match(loginRoute, /setCookie|cookies\.set|Set-Cookie/)
  assert.match(logoutRoute, /destroySession/)
  assert.match(meRoute, /getUserFromSession|requireUser/)
  assert.match(seedScript, /BETA-001/)
  assert.match(seedScript, /invite_codes/)
})

test('task 5 adds bcryptjs dependency and keeps sessions table in schema', async () => {
  const packageJson = await read('package.json')
  const schema = await read('src/lib/schema.sql')

  assert.match(packageJson, /"bcryptjs"/)
  assert.match(packageJson, /"@types\/bcryptjs"/)

  assert.match(schema, /CREATE TABLE IF NOT EXISTS sessions/)
  assert.match(schema, /token TEXT PRIMARY KEY/)
  assert.match(schema, /expires_at TIMESTAMPTZ NOT NULL/)
})

test('task 5 books and review routes enforce authenticated ownership checks', async () => {
  const booksRoute = await read('src/app/api/books/route.ts')
  const modulesRoute = await read('src/app/api/modules/route.ts')
  const reviewDueRoute = await read('src/app/api/review/due/route.ts')

  assert.match(booksRoute, /requireUser/)
  assert.match(booksRoute, /user_id/)
  assert.match(booksRoute, /INSERT INTO books/)
  assert.match(booksRoute, /WHERE user_id = \$1/)

  assert.match(modulesRoute, /requireUser/)
  assert.match(modulesRoute, /JOIN books/)
  assert.match(modulesRoute, /user_id = \$\d+/)

  assert.match(reviewDueRoute, /requireUser/)
  assert.match(reviewDueRoute, /JOIN books/)
  assert.match(reviewDueRoute, /b\.user_id = \$1/)

  for (const file of guardedBookRoutes) {
    const source = await read(file)
    assert.notEqual(source, '', `${file} should exist`)
    assert.match(source, /requireBookOwner/, `${file} should require book ownership`)
  }
})

test('task 5 security-sensitive details use hashed passwords, random sessions, and fixed screenshot fallback', async () => {
  const authSource = await read('src/lib/auth.ts')
  const registerRoute = await read('src/app/api/auth/register/route.ts')
  const screenshotAskRoute = await read('src/app/api/books/[bookId]/screenshot-ask/route.ts')

  assert.match(authSource, /bcryptjs/)
  assert.match(authSource, /crypto\.randomBytes\(32\)/)
  assert.match(authSource, /HttpOnly|httpOnly/)
  assert.match(authSource, /SameSite|sameSite/)

  assert.match(registerRoute, /used_count/)
  assert.match(registerRoute, /max_uses/)
  assert.match(registerRoute, /hashPassword/)

  assert.match(screenshotAskRoute, /\(鏃犳枃瀛楄瘑鍒粨鏋\?/)
  assert.doesNotMatch(screenshotAskRoute, /\(閺冪姵鏋冪€涙鐦戦崚/)
})

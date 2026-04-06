# M6: MVP Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the product publicly so international students can register and use the full learning flow with real textbooks.

**Architecture:** Migrate from SQLite (better-sqlite3, sync) to PostgreSQL (pg, async). Add user auth with invite codes. Replace PDF reader with react-pdf-viewer. Add text chunking for large PDFs. Dockerize and deploy to Railway/Fly.io.

**Tech Stack:** Next.js 15, PostgreSQL (pg driver), bcrypt, react-pdf-viewer, Docker

**Spec:** `docs/superpowers/specs/2026-04-06-m6-mvp-launch-design.md`

**Spec override:** The spec originally specified Drizzle ORM. This plan uses raw `pg` driver + async query helpers instead. Reason: adding an ORM on top of a 48-file sync→async migration doubles the conversion scope. Raw pg keeps SQL strings nearly identical (just swap `?` → `$N` and add `await`). Drizzle can be added post-MVP as a separate improvement.

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/db.ts` | Rewrite: async PostgreSQL pool + query helpers |
| `src/lib/schema.sql` | PostgreSQL schema (all 23 tables) |
| `src/lib/auth.ts` | Password hashing, session create/verify/destroy |
| `src/middleware.ts` | Next.js middleware: auth check on all routes |
| `src/app/(auth)/login/page.tsx` | Login page |
| `src/app/(auth)/register/page.tsx` | Register page |
| `src/app/api/auth/register/route.ts` | Register API |
| `src/app/api/auth/login/route.ts` | Login API |
| `src/app/api/auth/logout/route.ts` | Logout API |
| `src/app/api/auth/me/route.ts` | Current user API |
| `src/lib/text-chunker.ts` | Split large texts into chunks |
| `src/lib/kp-merger.ts` | Merge KP results from chunks |
| `scripts/seed-invite-codes.ts` | Generate initial invite codes |
| `Dockerfile` | Next.js app container |
| `Dockerfile.ocr` | PaddleOCR service container |
| `docker-compose.yml` | Local dev with all services |

### Modified Files (48 files for db migration)

**Lib files (6):** `seed-templates.ts`, `prompt-templates.ts`, `log.ts`, `mistakes.ts`, `services/book-service.ts`, `services/kp-extraction-service.ts`

**API routes (34):** All files under `src/app/api/`

**Server component pages (7):** `page.tsx` (home), `logs/page.tsx`, `books/[bookId]/page.tsx`, `books/[bookId]/reader/page.tsx`, `modules/[moduleId]/page.tsx`, `modules/[moduleId]/qa/page.tsx`, `modules/[moduleId]/test/page.tsx`

**handle-route.ts:** Already async, no change needed.

---

## Conversion Pattern Reference

Every file that uses `getDb()` needs the same mechanical conversion. Here is the pattern:

### Before (better-sqlite3, sync)

```typescript
import { getDb } from '@/lib/db'

// Single row
const db = getDb()
const book = db.prepare('SELECT * FROM books WHERE id = ?').get(id) as Book | undefined

// Multiple rows
const books = db.prepare('SELECT * FROM books ORDER BY created_at DESC').all() as Book[]

// Insert
const result = db.prepare('INSERT INTO books (title) VALUES (?)').run(title)
const newId = result.lastInsertRowid

// Update
db.prepare('UPDATE books SET title = ? WHERE id = ?').run(title, id)

// Delete
db.prepare('DELETE FROM books WHERE id = ?').run(id)
```

### After (pg, async)

```typescript
import { query, queryOne, run, insert } from '@/lib/db'

// Single row
const book = await queryOne<Book>('SELECT * FROM books WHERE id = $1', [id])

// Multiple rows
const books = await query<Book>('SELECT * FROM books ORDER BY created_at DESC')

// Insert (returning id)
const newId = await insert('INSERT INTO books (title) VALUES ($1)', [title])

// Update
await run('UPDATE books SET title = $1 WHERE id = $2', [title, id])

// Delete
await run('DELETE FROM books WHERE id = $1', [id])
```

### Key changes:
1. `import { getDb } from '@/lib/db'` → `import { query, queryOne, run, insert } from '@/lib/db'`
2. Remove `const db = getDb()` line
3. `db.prepare(sql).get(...)` → `await queryOne<Type>(sql, [...])`
4. `db.prepare(sql).all(...)` → `await query<Type>(sql, [...])`
5. `db.prepare(sql).run(...)` → `await run(sql, [...])`
6. `result.lastInsertRowid` → `await insert(sql, [...])` (returns id)
7. Replace `?` placeholders with `$1, $2, $3...` (positional)
8. Functions calling db become `async`, callers add `await`
9. Server components: `export default function X()` → `export default async function X()`
10. SQLite `datetime('now')` → PostgreSQL `NOW()` (but most are DEFAULT values in schema, not in queries)

### user_id filtering (after auth is added):
```typescript
// Before:
const books = await query<Book>('SELECT * FROM books ORDER BY created_at DESC')

// After:
const books = await query<Book>('SELECT * FROM books WHERE user_id = $1 ORDER BY created_at DESC', [userId])
```

---

## Task Execution Order

```
T1: PostgreSQL foundation (db.ts + schema)
 ↓
T2: Convert lib/ files to async
 ↓
T3: Convert API routes (books + conversations + logs)
 ↓
T4: Convert API routes (modules + review + qa)
 ↓
T5: Auth system backend
 ↓
T6: Auth frontend + server page conversion + user_id guards
 ↓ (T7 and T8 can run in parallel)
T7: Large PDF chunking
T8: PDF reader replacement
 ↓
T9: Bug fixes
 ↓
T10: Deployment (Docker + Railway)
 ↓
T11: Smoke test + docs update
```

---

### Task 1: PostgreSQL Foundation

**Assignee:** Codex
**Files:**
- Rewrite: `src/lib/db.ts`
- Create: `src/lib/schema.sql`
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: Install dependencies**

```bash
npm install pg
npm install --save-dev @types/pg
npm uninstall better-sqlite3 @types/better-sqlite3
```

- [ ] **Step 2: Create PostgreSQL schema file**

Create `src/lib/schema.sql` with all 23 tables. Convert from SQLite syntax:
- `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
- `TEXT NOT NULL DEFAULT (datetime('now'))` → `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `INTEGER NOT NULL DEFAULT 0` stays the same
- Add new tables: `users` and `invite_codes`
- Add `user_id INTEGER REFERENCES users(id)` to `books` table

Reference: current schema is in `src/lib/db.ts` lines 27-257. Copy all 21 tables, convert syntax, add 2 new tables.

New tables to add:

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invite_codes (
  code TEXT PRIMARY KEY,
  created_by INTEGER REFERENCES users(id),
  max_uses INTEGER NOT NULL DEFAULT 5,
  used_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Add to books table: `user_id INTEGER REFERENCES users(id)`

**Important:** Keep INTEGER primary keys for all existing tables (not UUID). This minimizes code changes. Only `users.id` is new and uses SERIAL.

- [ ] **Step 3: Rewrite `src/lib/db.ts`**

```typescript
import { Pool, QueryResult } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const { rows } = await pool.query(sql, params)
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
): Promise<QueryResult> {
  return pool.query(sql, params)
}

export async function insert(
  sql: string,
  params?: unknown[]
): Promise<number> {
  // Append RETURNING id if not already present
  // NOTE: Only use for tables with `id` column. For tables with other PKs
  // (invite_codes.code, sessions.token), use run() instead.
  const finalSql = sql.includes('RETURNING') ? sql : `${sql} RETURNING id`
  const { rows } = await pool.query(finalSql, params)
  return rows[0]?.id
}

export async function initDb(): Promise<void> {
  const fs = await import('fs')
  const path = await import('path')
  const schemaPath = path.join(process.cwd(), 'src', 'lib', 'schema.sql')
  const schema = fs.readFileSync(schemaPath, 'utf-8')
  await pool.query(schema)
}

export { pool }
```

- [ ] **Step 4: Update `.env.example`**

Add: `DATABASE_URL=postgresql://user:password@localhost:5432/textbook_teacher`

- [ ] **Step 5: Test connection**

```bash
# Start local PostgreSQL (Docker)
docker run -d --name textbook-pg -e POSTGRES_DB=textbook_teacher -e POSTGRES_USER=dev -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16

# Set env
export DATABASE_URL=postgresql://dev:dev@localhost:5432/textbook_teacher

# Test: run schema
npx tsx -e "import { initDb } from './src/lib/db'; initDb().then(() => console.log('OK'))"
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts src/lib/schema.sql package.json .env.example
git commit -m "feat(m6): PostgreSQL foundation — db.ts rewrite + schema"
```

---

### Task 2: Convert Lib Files to Async

**Assignee:** Codex
**Files:**
- Modify: `src/lib/log.ts`
- Modify: `src/lib/prompt-templates.ts`
- Modify: `src/lib/mistakes.ts`
- Modify: `src/lib/services/book-service.ts`
- Modify: `src/lib/seed-templates.ts`

These files export functions used by API routes. All sync functions that use `getDb()` must become async.

- [ ] **Step 1: Convert `src/lib/log.ts`**

```typescript
import { run } from './db'

type Level = 'info' | 'warn' | 'error'

export async function logAction(action: string, details: string = '', level: Level = 'info'): Promise<void> {
  try {
    await run('INSERT INTO logs (level, action, details) VALUES ($1, $2, $3)', [level, action, details])
  } catch {
    // Log write failure must not affect main flow
  }
}
```

**Warning:** `logAction` is called from many places including inside catch blocks. Callers that currently call `logAction(...)` without await should add await where practical, but in catch blocks it's OK to call without await (fire-and-forget).

- [ ] **Step 2: Convert `src/lib/prompt-templates.ts`**

All 4 exported functions (`getActiveTemplate`, `renderTemplate`, `getPrompt`, `upsertTemplate`) — make db-using ones async. `renderTemplate` has no db calls, stays sync.

Reference: read current file at `src/lib/prompt-templates.ts` and apply conversion pattern.

- [ ] **Step 3: Convert `src/lib/mistakes.ts`**

Read current file, apply conversion pattern.

- [ ] **Step 4: Convert `src/lib/services/book-service.ts`**

Both `list()` and `getById()` become async. All callers will need await.

- [ ] **Step 5: Convert `src/lib/seed-templates.ts`**

This file uses `getDb()` with `ON CONFLICT...DO UPDATE SET` which works in PostgreSQL. Convert to use `run()` helper. Make `seedTemplates()` async.

**Important:** `seedTemplates()` is called from `initDb()`. Ensure `initDb()` calls `await seedTemplates()` after running schema.

- [ ] **Step 6: Verify build**

```bash
npm run build
```

Build will fail because routes still use old `getDb()`. That's expected — just verify no TypeScript errors in the converted lib files.

- [ ] **Step 7: Commit**

```bash
git add src/lib/log.ts src/lib/prompt-templates.ts src/lib/mistakes.ts src/lib/services/book-service.ts src/lib/seed-templates.ts
git commit -m "feat(m6): convert lib files to async PostgreSQL"
```

---

### Task 3: Convert API Routes — Books Group

**Assignee:** Codex
**Files (15 routes):**
- `src/app/api/books/route.ts` (GET list, POST upload)
- `src/app/api/books/[bookId]/status/route.ts`
- `src/app/api/books/[bookId]/extract/route.ts`
- `src/app/api/books/[bookId]/pdf/route.ts`
- `src/app/api/books/[bookId]/toc/route.ts`
- `src/app/api/books/[bookId]/highlights/route.ts`
- `src/app/api/books/[bookId]/notes/route.ts`
- `src/app/api/books/[bookId]/module-map/route.ts`
- `src/app/api/books/[bookId]/module-map/confirm/route.ts`
- `src/app/api/books/[bookId]/module-map/regenerate/route.ts`
- `src/app/api/books/[bookId]/screenshot-ocr/route.ts`
- `src/app/api/books/[bookId]/screenshot-ask/route.ts`
- `src/app/api/books/[bookId]/dashboard/route.ts`
- `src/app/api/books/[bookId]/mistakes/route.ts`
- `src/app/api/conversations/[conversationId]/messages/route.ts`

- [ ] **Step 1: Read every file, apply conversion pattern**

For each file:
1. Change `import { getDb } from '@/lib/db'` → `import { query, queryOne, run, insert } from '@/lib/db'`
2. Remove `const db = getDb()` lines
3. Convert all `.prepare().get/all/run()` calls to `await queryOne/query/run/insert()`
4. Replace `?` with `$1, $2, ...` in SQL strings
5. If the route calls lib functions that are now async (e.g., `logAction`, `bookService.list`), add `await`

**Special cases:**
- `books/route.ts` POST: uses `db.prepare().run()` then `result.lastInsertRowid` → use `await insert()` which returns id
- `extract/route.ts`: calls `kp-extraction-service.ts` which is already async — just ensure it uses the new db functions
- `screenshot-ocr/route.ts` and `screenshot-ask/route.ts`: contain AI calls, already async, just convert db parts
- `dashboard/route.ts`: complex aggregation query with multiple JOINs — convert SQL placeholders carefully

- [ ] **Step 2: Also convert `src/app/api/logs/route.ts`**

Simple route, just read and convert.

- [ ] **Step 3: Test a few endpoints**

```bash
npm run dev
# Test books list
curl http://localhost:3000/api/books
# Test book status
curl http://localhost:3000/api/books/1/status
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/books/ src/app/api/conversations/ src/app/api/logs/
git commit -m "feat(m6): convert books/conversations/logs API routes to async PostgreSQL"
```

---

### Task 4: Convert API Routes — Modules + Review + QA Group

**Assignee:** Codex
**Files (19 routes):**
- `src/app/api/modules/route.ts`
- `src/app/api/modules/[moduleId]/status/route.ts`
- `src/app/api/modules/[moduleId]/guide/route.ts`
- `src/app/api/modules/[moduleId]/generate-questions/route.ts`
- `src/app/api/modules/[moduleId]/questions/route.ts`
- `src/app/api/modules/[moduleId]/qa-feedback/route.ts`
- `src/app/api/modules/[moduleId]/evaluate/route.ts`
- `src/app/api/modules/[moduleId]/generate-notes/route.ts`
- `src/app/api/modules/[moduleId]/reading-notes/route.ts`
- `src/app/api/modules/[moduleId]/test/route.ts`
- `src/app/api/modules/[moduleId]/test/generate/route.ts`
- `src/app/api/modules/[moduleId]/test/submit/route.ts`
- `src/app/api/modules/[moduleId]/mistakes/route.ts`
- `src/app/api/review/due/route.ts`
- `src/app/api/review/[scheduleId]/generate/route.ts`
- `src/app/api/review/[scheduleId]/respond/route.ts`
- `src/app/api/review/[scheduleId]/complete/route.ts`
- `src/app/api/qa/[questionId]/respond/route.ts`

- [ ] **Step 1: Read every file, apply conversion pattern**

Same mechanical conversion as Task 3. Key special cases:
- `test/submit/route.ts`: complex — creates mistakes, updates learning_status, creates review_schedule. Multiple db operations in sequence. Convert each one.
- `review/[scheduleId]/complete/route.ts`: P-value update logic with multiple queries. Convert carefully, maintain transaction-like ordering.
- `review/[scheduleId]/generate/route.ts`: complex query building with dynamic WHERE clauses. Convert placeholders carefully.
- `generate-questions/route.ts` and `test/generate/route.ts`: AI calls + db writes. Already async, just convert db parts.

- [ ] **Step 2: Also convert `src/lib/services/kp-extraction-service.ts`**

This service already has async functions (`callModel`). Convert only the db-calling parts:
- `writeResultsToDB()` function uses `getDb()` extensively — convert all db calls to async helpers
- Keep AI-related code unchanged

- [ ] **Step 3: Test learning flow**

```bash
npm run dev
# Test module list
curl http://localhost:3000/api/modules?bookId=1
# Test review due
curl http://localhost:3000/api/review/due
```

- [ ] **Step 4: Run build**

```bash
npm run build
```

All API routes should now compile. Fix any remaining TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/modules/ src/app/api/review/ src/app/api/qa/ src/lib/services/kp-extraction-service.ts
git commit -m "feat(m6): convert modules/review/qa API routes to async PostgreSQL"
```

---

### Task 5: Auth System Backend

**Assignee:** Codex
**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/register/route.ts`
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/api/auth/me/route.ts`
- Create: `src/middleware.ts`
- Create: `scripts/seed-invite-codes.ts`
- Modify: `package.json` (add bcrypt)

- [ ] **Step 1: Install bcrypt**

```bash
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

Use `bcryptjs` (pure JS, no native build issues in Docker).

- [ ] **Step 2: Create `src/lib/auth.ts`**

```typescript
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { query, queryOne, run } from './db'

const SESSION_COOKIE = 'session_token'
const SALT_ROUNDS = 12

interface User {
  id: number
  email: string
  display_name: string | null
}

interface Session {
  token: string
  user_id: number
  expires_at: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createSession(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  await run(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)',
    [token, userId, expiresAt.toISOString()]
  )
  return token
}

export async function getUserFromSession(token: string): Promise<User | undefined> {
  const session = await queryOne<Session>(
    'SELECT * FROM sessions WHERE token = $1 AND expires_at > NOW()',
    [token]
  )
  if (!session) return undefined
  return queryOne<User>('SELECT id, email, display_name FROM users WHERE id = $1', [session.user_id])
}

export async function destroySession(token: string): Promise<void> {
  await run('DELETE FROM sessions WHERE token = $1', [token])
}

export { SESSION_COOKIE }
```

**Note:** This requires adding a `sessions` table to the schema:

```sql
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Update `src/lib/schema.sql` to add this table.

- [ ] **Step 3: Create auth API routes**

**`src/app/api/auth/register/route.ts`:**
- Accept `{ email, password, inviteCode }`
- Validate invite code: check exists, used_count < max_uses
- Hash password, create user, increment invite code used_count
- Create session, set cookie
- Return user info

**`src/app/api/auth/login/route.ts`:**
- Accept `{ email, password }`
- Find user by email, verify password
- Create session, set cookie
- Return user info

**`src/app/api/auth/logout/route.ts`:**
- Read session cookie, destroy session, clear cookie

**`src/app/api/auth/me/route.ts`:**
- Read session cookie, return current user or 401

- [ ] **Step 4: Create Next.js middleware**

Create `src/middleware.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public paths — no auth required
  const publicPaths = ['/login', '/register', '/api/auth/']
  if (publicPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Check session cookie
  const sessionToken = request.cookies.get('session_token')?.value
  if (!sessionToken) {
    // API routes return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Pages redirect to login
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

**Note:** This middleware only checks cookie existence, not validity. Full validation happens in the API route via `getUserFromSession()`. This is standard Next.js middleware pattern (middleware runs on edge, can't do async DB calls).

- [ ] **Step 5: Add user_id to API routes that create/query books**

The key change: `src/app/api/books/route.ts`
- GET: add `WHERE user_id = $1` with userId from session
- POST: add `user_id` to INSERT

Create a helper to extract userId from request:

```typescript
// In src/lib/auth.ts, add:
export async function requireUser(request: NextRequest): Promise<User> {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) throw new UserError('未登录', 'UNAUTHORIZED', 401)
  const user = await getUserFromSession(token)
  if (!user) throw new UserError('会话已过期', 'SESSION_EXPIRED', 401)
  return user
}
```

Then in each route:
```typescript
const user = await requireUser(req)
// Use user.id for queries
```

**User ownership pattern:** Create a shared helper that all `/books/[bookId]/` sub-routes use:

```typescript
// In src/lib/auth.ts, add:
export async function requireBookOwner(req: NextRequest, bookId: number): Promise<{ user: User; book: Book }> {
  const user = await requireUser(req)
  const book = await queryOne<Book>('SELECT * FROM books WHERE id = $1 AND user_id = $2', [bookId, user.id])
  if (!book) throw new UserError('教材不存在', 'NOT_FOUND', 404)
  return { user, book }
}
```

Apply user_id filtering to these routes:
- `books/route.ts` GET: `WHERE user_id = $1`; POST: set `user_id` on insert
- `books/[bookId]/` all sub-routes: call `requireBookOwner(req, bookId)` at the top. This is the ONLY ownership check needed — downstream data (modules, KPs, etc.) chains through the verified book.
- `review/due/route.ts`: join through books to filter by user
- Home page (`src/app/page.tsx`): filter books by user

- [ ] **Step 6: Create seed script**

Create `scripts/seed-invite-codes.ts`:

```typescript
import { run } from '../src/lib/db'

const codes = ['BETA-001', 'BETA-002', 'BETA-003', 'BETA-004', 'BETA-005']

async function seed() {
  for (const code of codes) {
    await run(
      'INSERT INTO invite_codes (code, max_uses) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [code, 10]
    )
  }
  console.log(`Seeded ${codes.length} invite codes`)
}

seed().catch(console.error)
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth.ts src/lib/schema.sql src/middleware.ts src/app/api/auth/ scripts/seed-invite-codes.ts package.json
git commit -m "feat(m6): auth system — register/login/logout + middleware + invite codes"
```

---

### Task 6: Auth Frontend + Server Page Conversion

**Assignee:** Gemini
**Files:**
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/register/page.tsx`
- Create: `src/app/(auth)/layout.tsx`
- Modify: `src/app/page.tsx` — async + user_id filter
- Modify: `src/app/logs/page.tsx` — async
- Modify: `src/app/books/[bookId]/page.tsx` — async + user_id guard
- Modify: `src/app/books/[bookId]/reader/page.tsx` — async + user_id guard
- Modify: `src/app/books/[bookId]/modules/[moduleId]/page.tsx` — async
- Modify: `src/app/books/[bookId]/modules/[moduleId]/qa/page.tsx` — async
- Modify: `src/app/books/[bookId]/modules/[moduleId]/test/page.tsx` — async

- [ ] **Step 1: Create auth layout**

`src/app/(auth)/layout.tsx` — minimal layout WITHOUT sidebar (auth pages don't show sidebar):

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Create login page**

Simple form: email + password + submit button. Link to register.
POST to `/api/auth/login`. On success → redirect to `/`.

- [ ] **Step 3: Create register page**

Simple form: email + password + invite code + submit button. Link to login.
POST to `/api/auth/register`. On success → redirect to `/`.

- [ ] **Step 4: Convert server component pages to async**

For each page listed above:
1. Change `export default function` → `export default async function`
2. Replace `const db = getDb()` → use `query/queryOne` from `@/lib/db`
3. Replace `?` with `$1, $2...` in SQL strings
4. Add `await` to all db calls

For pages under `/books/[bookId]/`: add user_id guard:
```typescript
import { cookies } from 'next/headers'
import { getUserFromSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

// At start of component:
const cookieStore = await cookies()
const token = cookieStore.get('session_token')?.value
if (!token) redirect('/login')
const user = await getUserFromSession(token)
if (!user) redirect('/login')

// When querying books, verify ownership:
const book = await queryOne<Book>('SELECT * FROM books WHERE id = $1 AND user_id = $2', [bookId, user.id])
if (!book) notFound()
```

- [ ] **Step 5: Update sidebar to show user info**

In `src/components/sidebar/Sidebar.tsx`:
- Add logout button at bottom
- Optionally show user email

- [ ] **Step 6: Test auth flow**

```bash
npm run dev
# 1. Visit http://localhost:3000 → should redirect to /login
# 2. Go to /register → register with invite code
# 3. Login → should see home page with empty book list
# 4. Upload a book → should appear in list
# 5. Logout → should redirect to /login
```

- [ ] **Step 7: Commit**

```bash
git add src/app/\(auth\)/ src/app/page.tsx src/app/logs/ src/app/books/ src/components/sidebar/
git commit -m "feat(m6): auth frontend + server page async conversion + user isolation"
```

---

### Task 7: Large PDF Chunking

**Assignee:** Codex
**Files:**
- Create: `src/lib/text-chunker.ts`
- Create: `src/lib/kp-merger.ts`
- Modify: `src/lib/services/kp-extraction-service.ts`
- Reference: `src/lib/seed-templates.ts` (extraction prompts)

- [ ] **Step 1: Create `src/lib/text-chunker.ts`**

```typescript
interface TextChunk {
  index: number
  title: string // detected chapter/section heading, or "Part N"
  text: string
  startLine: number
  endLine: number
}

const MAX_CHUNK_CHARS = 35_000
const OVERLAP_LINES = 20

/**
 * Split large text into chunks, preferring natural chapter boundaries.
 * Returns original text as single chunk if under threshold.
 */
export function chunkText(fullText: string): TextChunk[] {
  if (fullText.length <= MAX_CHUNK_CHARS) {
    return [{ index: 0, title: 'Full Text', text: fullText, startLine: 0, endLine: fullText.split('\n').length - 1 }]
  }

  const lines = fullText.split('\n')

  // 1. Detect chapter boundaries (common heading patterns)
  const boundaries = detectBoundaries(lines)

  // 2. If no boundaries found, split by fixed size
  if (boundaries.length <= 1) {
    return splitBySize(lines)
  }

  // 3. Group sections into chunks that fit under MAX_CHUNK_CHARS
  return groupSections(lines, boundaries)
}
```

Implement `detectBoundaries`, `splitBySize`, `groupSections`:
- `detectBoundaries`: regex for "Chapter N", "第N章", numbered sections, all-caps headings
- `splitBySize`: sliding window of MAX_CHUNK_CHARS with OVERLAP_LINES overlap
- `groupSections`: merge adjacent sections until reaching MAX_CHUNK_CHARS, then start new chunk

- [ ] **Step 2: Create `src/lib/kp-merger.ts`**

```typescript
import type { Stage2Result, FinalKP, ModuleGroup } from './services/kp-extraction-types'

/**
 * Merge KP results from multiple chunks into a single unified result.
 */
export function mergeChunkResults(results: Stage2Result[]): Stage2Result {
  // 1. Concatenate all KPs, all modules
  // 2. Deduplicate modules by name similarity (fuzzy match)
  // 3. Reassign KPs to merged modules
  // 4. Deduplicate KPs with >80% content overlap
  // 5. Recalculate cluster assignments
  return mergedResult
}
```

Key dedup logic:
- Module names: normalize (trim, lowercase) and merge if >80% similar
- KP dedup: compare `description` + `detailed_content`, skip if duplicate
- Maintain correct `kp_code` numbering after merge

- [ ] **Step 3: Modify `kp-extraction-service.ts`**

In the main extraction function, add chunking logic:

```typescript
import { chunkText } from '../text-chunker'
import { mergeChunkResults } from '../kp-merger'

// In extractKPs or equivalent:
const chunks = chunkText(fullText)

if (chunks.length === 1) {
  // Existing single-extraction path (unchanged)
  const result = await runFullExtraction(chunks[0].text)
  await writeResultsToDB(bookId, result)
} else {
  // Multi-chunk path
  const chunkResults: Stage2Result[] = []
  for (const chunk of chunks) {
    logAction('chunk_extraction_start', `Chunk ${chunk.index + 1}/${chunks.length}: ${chunk.title}`)
    const result = await runFullExtraction(chunk.text)
    chunkResults.push(result)
  }
  const merged = mergeChunkResults(chunkResults)
  await writeResultsToDB(bookId, merged)
}
```

- [ ] **Step 4: Test with a large text file**

Create a test PDF or TXT file with >50K characters. Upload and verify:
- Text is split into chunks
- Each chunk extracts KPs independently
- Merged result produces a coherent module map

- [ ] **Step 5: Commit**

```bash
git add src/lib/text-chunker.ts src/lib/kp-merger.ts src/lib/services/kp-extraction-service.ts
git commit -m "feat(m6): large PDF chunking — text splitter + KP merger + extraction integration"
```

---

### Task 8: PDF Reader Replacement

**Assignee:** Gemini
**Files:**
- Modify: `src/app/books/[bookId]/reader/page.tsx`
- Modify: `src/app/books/[bookId]/reader/ScreenshotOverlay.tsx`
- Modify: `package.json`
- Reference: `src/app/books/[bookId]/reader/AiChatDialog.tsx` (do NOT modify)

- [ ] **Step 1: Install react-pdf-viewer**

```bash
npm install @react-pdf-viewer/core @react-pdf-viewer/default-layout
```

`@react-pdf-viewer/default-layout` includes zoom, search, page navigation, bookmarks, and thumbnails out of the box.

- [ ] **Step 2: Replace PDF rendering in `reader/page.tsx`**

Replace the current custom PDF viewer with `@react-pdf-viewer/default-layout`:

```tsx
import { Worker, Viewer } from '@react-pdf-viewer/core'
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout'
import '@react-pdf-viewer/core/lib/styles/index.css'
import '@react-pdf-viewer/default-layout/lib/styles/index.css'

// In component:
const defaultLayoutPluginInstance = defaultLayoutPlugin()

return (
  <Worker workerUrl={`https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`}>
    <div style={{ height: '100%' }}>
      <Viewer
        fileUrl={`/api/books/${bookId}/pdf`}
        plugins={[defaultLayoutPluginInstance]}
      />
    </div>
  </Worker>
)
```

**Critical:** Preserve the screenshot overlay. The overlay must sit on top of the viewer and capture canvas content. Read the current `page.tsx` carefully to understand how the overlay is positioned relative to the viewer.

- [ ] **Step 3: Adapt `ScreenshotOverlay.tsx`**

The current overlay uses `scrollContainer.querySelectorAll('canvas')` to find page canvases.

Check if `@react-pdf-viewer/core` renders pages as `<canvas>` elements. If yes:
- Find the correct container selector for the new viewer's DOM
- Update `querySelectorAll` target if the container class/structure changed

If the new viewer uses a different rendering approach:
- Adapt coordinate calculation to match new DOM structure
- Test that captured regions map correctly to page content

- [ ] **Step 4: Remove old PDF dependencies if unused**

Check if `pdfjs-dist`, `pdf2json`, `pdf-parse` are still needed by other parts of the codebase (backend PDF text extraction uses `pdf-parse`). Only remove truly unused packages.

- [ ] **Step 5: Test**

```bash
npm run dev
# 1. Open a book's reader page
# 2. Verify: zoom in/out, search text, page navigation, bookmarks
# 3. Verify: screenshot selection still works (drag region → OCR → ask AI)
# 4. Verify: no layout issues with sidebar
```

- [ ] **Step 6: Commit**

```bash
git add src/app/books/[bookId]/reader/ package.json
git commit -m "feat(m6): replace PDF reader with react-pdf-viewer — zoom, search, bookmarks"
```

---

### Task 9: Bug Fixes

**Assignee:** Codex
**Files:** TBD after diagnosis

- [ ] **Step 1: Diagnose test_ch1_2 "PDF处理失败"**

```sql
SELECT id, title, parse_status, kp_extraction_status FROM books WHERE title LIKE '%test_ch1%';
```

Check what state the book is in. Likely `parse_status = 'error'` but PDF exists.

Fix: either reset the status, or add recovery logic in the book detail page to detect "file exists but status is error" and offer retry.

- [ ] **Step 2: Diagnose 读财报 module-map white screen**

This book was uploaded as TXT. Check:
- Does the module map API return data for this book?
- Does the page component handle empty/null module data?
- Is there a missing error boundary?

Fix: add proper handling for non-PDF books or books without completed KP extraction.

**Note:** These bugs may resolve naturally after PostgreSQL migration (fresh DB, no stale state from prior failed runs). Test on the new database first before spending time on dedicated fixes. If the bugs don't reproduce, mark as resolved.

- [ ] **Step 3: Test fixes**

Verify both books display correctly after fixes.

- [ ] **Step 4: Commit**

```bash
git commit -m "fix(m6): resolve data-state bugs — test_ch1_2 parse status + 读财报 module map"
```

---

### Task 10: Deployment

**Assignee:** Codex
**Files:**
- Create: `Dockerfile`
- Create: `Dockerfile.ocr`
- Create: `docker-compose.yml`
- Create: `.dockerignore`
- Modify: `scripts/ocr_server.py` (bind address + port config)

- [ ] **Step 1: Create `Dockerfile` for Next.js app**

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/lib/schema.sql ./src/lib/schema.sql

EXPOSE 3000
CMD ["node", "server.js"]
```

**Note:** Requires `output: 'standalone'` in `next.config.ts`.

- [ ] **Step 2: Create `Dockerfile.ocr` for PaddleOCR**

```dockerfile
FROM python:3.10-slim

WORKDIR /app
RUN apt-get update && apt-get install -y libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
RUN pip install paddlepaddle paddleocr flask
# NOTE: PaddlePaddle is large (~2GB). Final image will be ~3-4GB. This is expected.
COPY scripts/ocr_server.py .

ENV OCR_HOST=0.0.0.0
ENV OCR_PORT=8000

CMD ["python", "ocr_server.py"]
```

- [ ] **Step 3: Modify `scripts/ocr_server.py`**

Change bind address to configurable:
```python
host = os.environ.get('OCR_HOST', '0.0.0.0')
port = int(os.environ.get('OCR_PORT', '8000'))
```

Replace the hardcoded `127.0.0.1:9876`.

- [ ] **Step 4: Create `docker-compose.yml`**

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://dev:dev@db:5432/textbook_teacher
      - OCR_SERVICE_URL=http://ocr:8000
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - AI_MODEL=${AI_MODEL:-anthropic:claude-sonnet-4-6}
      - SESSION_SECRET=${SESSION_SECRET}
    depends_on:
      - db
      - ocr
    volumes:
      - uploads:/app/data/uploads

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=textbook_teacher
      - POSTGRES_USER=dev
      - POSTGRES_PASSWORD=dev
    volumes:
      - pgdata:/var/lib/postgresql/data

  ocr:
    build:
      context: .
      dockerfile: Dockerfile.ocr
    environment:
      - OCR_HOST=0.0.0.0
      - OCR_PORT=8000

volumes:
  pgdata:
  uploads:
```

- [ ] **Step 5: Add `output: 'standalone'` to Next.js config**

In `next.config.ts`:
```typescript
const nextConfig = {
  output: 'standalone',
  // ... existing config
}
```

- [ ] **Step 6: Test locally**

```bash
docker-compose up --build
# Visit http://localhost:3000
# Register, upload PDF, verify full flow
```

- [ ] **Step 7: Deploy to Railway/Fly.io**

Follow platform-specific instructions. Key config:
- Set all environment variables
- Attach PostgreSQL add-on
- Configure persistent volume for uploads

- [ ] **Step 8: Commit**

```bash
git add Dockerfile Dockerfile.ocr docker-compose.yml .dockerignore scripts/ocr_server.py next.config.ts
git commit -m "feat(m6): deployment — Dockerfiles + docker-compose + standalone output"
```

---

### Task 11: Smoke Test + Docs Update

**Assignee:** Claude (not dispatched)

- [ ] **Step 1: End-to-end smoke test on deployed instance**

Verify all success criteria from spec:
1. Register with invite code + email
2. Upload 200+ page PDF → KPs extracted successfully
3. PDF reader: zoom, search, page navigation
4. Screenshot AI works
5. Complete learning flow: read → Q&A → test → review
6. User isolation: second user can't see first user's books
7. No data-state bugs

- [ ] **Step 2: Update `docs/architecture.md`**

- DB tables: 21 → 24 (add users, invite_codes, sessions)
- Add auth pages (/login, /register) to page tree
- Add auth API routes to API group
- Update DB section: SQLite → PostgreSQL
- Add deployment architecture section
- Update chunking flow in extraction contract

- [ ] **Step 3: Update `docs/project_status.md`**

Mark M6 complete, update current milestone status.

- [ ] **Step 4: Update `docs/changelog.md`**

Record all M6 changes.

- [ ] **Step 5: Update `CLAUDE.md`**

- Remove "禁止引入多用户 / 登录 / 注册系统"
- Update tech stack (SQLite → PostgreSQL)
- Add deployment section
- Update any other outdated content

- [ ] **Step 6: Commit + push**

```bash
git add docs/ CLAUDE.md
git commit -m "docs(m6): M6 complete — architecture, project status, changelog, CLAUDE.md updates"
git push
```

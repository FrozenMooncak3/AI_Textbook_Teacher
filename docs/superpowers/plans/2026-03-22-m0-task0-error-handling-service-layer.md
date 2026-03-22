# M0 Task 0: Structured Error Handling + Service Layer Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the error handling infrastructure and service layer pattern that all M1-M5 API routes will follow, with one working example (books GET).

**Architecture:** Three-tier error classes (UserError/SystemError/non-critical) + handleRoute wrapper that auto-maps errors to HTTP responses + service layer convention where routes are thin and services hold all business logic.

**Tech Stack:** TypeScript, Next.js 15 API Routes, better-sqlite3

**Design spec:** `docs/superpowers/specs/2026-03-22-error-handling-service-layer-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/errors.ts` | UserError + SystemError class definitions |
| Create | `src/lib/handle-route.ts` | handleRoute wrapper function |
| Create | `src/lib/services/book-service.ts` | Book listing + lookup business logic |
| Modify | `src/app/api/books/route.ts` | Refactor GET to use handleRoute + bookService (POST untouched) |
| Modify | `AGENTS.md` | Add coding standards section + fix invariant #5 |

---

## Task 1: Error Classes

**Files:**
- Create: `src/lib/errors.ts`

- [ ] **Step 1: Create `src/lib/errors.ts`**

```typescript
// src/lib/errors.ts

export class UserError extends Error {
  readonly code: string
  readonly statusCode: number

  constructor(message: string, code: string, statusCode: number = 400) {
    super(message)
    this.name = 'UserError'
    this.code = code
    this.statusCode = statusCode
  }
}

export class SystemError extends Error {
  readonly originalError?: unknown

  constructor(message: string, originalError?: unknown) {
    super(message)
    this.name = 'SystemError'
    this.originalError = originalError
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/errors.ts
git commit -m "M0-T0: add UserError and SystemError classes"
```

---

## Task 2: handleRoute Wrapper

**Files:**
- Create: `src/lib/handle-route.ts`
- Depends on: `src/lib/errors.ts` (Task 1), `src/lib/log.ts` (existing)

- [ ] **Step 1: Create `src/lib/handle-route.ts`**

```typescript
// src/lib/handle-route.ts

import { NextRequest, NextResponse } from 'next/server'
import { UserError, SystemError } from './errors'
import { logAction } from './log'

interface RouteResult {
  data: unknown
  status?: number
}

type RouteContext = { params: Promise<Record<string, string>> }

type RouteHandler = (
  req: NextRequest,
  context?: RouteContext
) => Promise<RouteResult>

export function handleRoute(fn: RouteHandler) {
  return async (req: NextRequest, context?: RouteContext): Promise<NextResponse> => {
    try {
      const result = await fn(req, context)
      return NextResponse.json(
        { success: true, data: result.data },
        { status: result.status ?? 200 }
      )
    } catch (err) {
      // 请求体解析错误（malformed JSON）→ 用户错误
      if (err instanceof SyntaxError) {
        return NextResponse.json(
          { success: false, error: '请求格式错误', code: 'INVALID_JSON' },
          { status: 400 }
        )
      }

      if (err instanceof UserError) {
        return NextResponse.json(
          { success: false, error: err.message, code: err.code },
          { status: err.statusCode }
        )
      }

      // SystemError 或未知错误
      const message = err instanceof SystemError
        ? err.message
        : String(err)
      const original = err instanceof SystemError
        ? err.originalError
        : err

      // logAction 内部已有 try/catch 静默处理，不会因日志失败而影响错误响应
      logAction('系统错误', `${message} | ${String(original)}`, 'error')

      return NextResponse.json(
        { success: false, error: '服务暂时不可用，请稍后重试', code: 'SYSTEM_ERROR' },
        { status: 500 }
      )
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/handle-route.ts
git commit -m "M0-T0: add handleRoute wrapper with three-tier error handling"
```

---

## Task 3: Book Service Module

**Files:**
- Create: `src/lib/services/book-service.ts`
- Depends on: `src/lib/errors.ts` (Task 1), `src/lib/db.ts` (existing)

- [ ] **Step 1: Create `src/lib/services/` directory**

```bash
mkdir -p src/lib/services
```

- [ ] **Step 2: Create `src/lib/services/book-service.ts`**

```typescript
// src/lib/services/book-service.ts

import { getDb } from '../db'
import { UserError, SystemError } from '../errors'

interface Book {
  id: number
  title: string
  parse_status: string
  created_at: string
}

export const bookService = {
  list(): Book[] {
    try {
      const db = getDb()
      return db.prepare(
        'SELECT id, title, parse_status, created_at FROM books ORDER BY created_at DESC'
      ).all() as Book[]
    } catch (err) {
      throw new SystemError('查询教材列表失败', err)
    }
  },

  getById(id: number): Book {
    try {
      const db = getDb()
      const book = db.prepare(
        'SELECT id, title, parse_status, created_at FROM books WHERE id = ?'
      ).get(id) as Book | undefined
      if (!book) {
        throw new UserError('教材不存在', 'NOT_FOUND', 404)
      }
      return book
    } catch (err) {
      if (err instanceof UserError) throw err
      throw new SystemError('查询教材失败', err)
    }
  },
}
```

**Note:** `kp_extraction_status` column will be added in M0 Task 1 (database schema rewrite). When Task 1 is implemented, add `kp_extraction_status` to the `Book` interface and both SELECT queries.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/book-service.ts
git commit -m "M0-T0: add book-service with list and getById"
```

---

## Task 4: Refactor books/route.ts GET

**Files:**
- Modify: `src/app/api/books/route.ts`
- Depends on: Task 2 (handleRoute), Task 3 (bookService)

- [ ] **Step 1: Read the current file**

Read `src/app/api/books/route.ts` to confirm the current GET handler.

Current GET (lines 67-73):
```typescript
export async function GET() {
  const db = getDb()
  const books = db
    .prepare('SELECT id, title, created_at, parse_status FROM books ORDER BY created_at DESC')
    .all()
  return NextResponse.json({ books })
}
```

- [ ] **Step 2: Replace the GET handler**

Replace `export async function GET()` with:

```typescript
export const GET = handleRoute(async () => {
  const books = bookService.list()
  return { data: books }
})
```

- [ ] **Step 3: Update imports**

Add at the top of the file:
```typescript
import { handleRoute } from '@/lib/handle-route'
import { bookService } from '@/lib/services/book-service'
```

Remove `getDb` from imports (only if POST doesn't use it — check first). The current POST handler uses `getDb` directly, so **keep the `getDb` import**. Also keep all other existing imports (`NextRequest`, `NextResponse`, `logAction`, `writeFile`, `mkdir`, `join`, `spawn`).

The final file should look like:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { logAction } from '@/lib/log'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { spawn } from 'child_process'
import { handleRoute } from '@/lib/handle-route'
import { bookService } from '@/lib/services/book-service'

const UPLOADS_DIR = join(process.cwd(), 'data', 'uploads')

// GET: refactored to use handleRoute + bookService
export const GET = handleRoute(async () => {
  const books = bookService.list()
  return { data: books }
})

// POST: unchanged (FormData + file I/O + subprocess, will be refactored in M1)
export async function POST(req: NextRequest) {
  // ... entire existing POST body unchanged ...
}
```

**Important:** Do NOT change any code inside the POST function. Copy it exactly as-is.

- [ ] **Step 4: Verify the app starts**

Run: `npm run dev`
Expected: App starts without errors on `http://localhost:3000`.

- [ ] **Step 5: Manually verify GET /api/books**

Open in browser or run:
```bash
curl http://localhost:3000/api/books
```

Expected response format (with empty database):
```json
{ "success": true, "data": [] }
```

Note the format change: previously `{ books: [...] }`, now `{ success: true, data: [...] }`. This is the intended breaking change for the response format. The frontend will need updating when Gemini works on it.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/books/route.ts
git commit -m "M0-T0: refactor books GET to use handleRoute + bookService"
```

---

## Task 5: Update AGENTS.md

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Fix product invariant #5**

Find line 66 in `AGENTS.md`:
```
5. Q&A 是一次一题：显示一题 → 用户作答 → 点"下一题" → 全部答完后 AI 逐题评价
```

Replace with:
```
5. Q&A 是一次一题 + 即时反馈：显示一题 → 用户作答 → 立即显示评分和解析 → 点"下一题"继续
```

This aligns with CLAUDE.md invariant #5 and the decision in `docs/decisions.md` (2026-03-21).

- [ ] **Step 2: Add coding standards section**

Insert the following section before the `## 工作流程` section (before line 91):

```markdown
## 编码规范（M0 起所有新代码必须遵守）

### 错误处理
- 用户输入错误：`throw new UserError(message, code, statusCode)`（从 `@/lib/errors` 导入）
- 系统错误（AI/DB/IO）：`throw new SystemError(message, originalError)`
- 非关键操作失败：try/catch 后静默，不影响主流程
- 禁止在 route handler 中直接 `return NextResponse.json({ error: ... })`

### 路由结构
- JSON API 路由必须使用 `handleRoute()` 包装（从 `@/lib/handle-route` 导入）
- 流式响应路由（如 Claude streaming）不使用 `handleRoute`，直接写原生 handler
- Route 只做：解析请求 → 调用服务 → return { data, status }
- 业务逻辑写在 `src/lib/services/*.ts`
- 使用 `export const GET = handleRoute(...)` 风格，不使用 `export async function GET`

### 服务模块
- 每个领域一个服务文件（book-service.ts, module-service.ts 等）
- 服务函数不依赖 HTTP 对象（不 import next/server）
- 服务函数接收普通参数，返回普通数据，出错 throw 错误类
- 示范文件：`src/lib/services/book-service.ts`

---
```

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "M0-T0: add coding standards to AGENTS.md, fix invariant #5"
```

---

## Task 6: Final Verification

- [ ] **Step 1: Run TypeScript check on the whole project**

```bash
npx tsc --noEmit
```

Expected: No errors (or only pre-existing errors unrelated to our changes).

- [ ] **Step 2: Start the app and verify**

```bash
npm run dev
```

| # | Check | How | Expected |
|---|-------|-----|----------|
| 1 | App starts | `npm run dev` | No errors |
| 2 | GET /api/books | `curl http://localhost:3000/api/books` | `{ "success": true, "data": [...] }` |
| 3 | POST /api/books | Upload page in browser | Still works (unchanged), returns `{ bookId: N }` |
| 4 | errors.ts exists | `cat src/lib/errors.ts` | UserError + SystemError classes |
| 5 | handle-route.ts exists | `cat src/lib/handle-route.ts` | handleRoute function |
| 6 | book-service.ts exists | `cat src/lib/services/book-service.ts` | bookService object |
| 7 | AGENTS.md updated | `grep "编码规范" AGENTS.md` | Section found |
| 8 | Invariant #5 fixed | `grep "即时反馈" AGENTS.md` | Matches CLAUDE.md |

- [ ] **Step 3: Final commit (only if any unstaged changes remain from above tasks)**

```bash
git status
# Only stage files from this plan if needed:
# git add src/lib/errors.ts src/lib/handle-route.ts src/lib/services/book-service.ts src/app/api/books/route.ts AGENTS.md
# git commit -m "M0-T0: structured error handling + service layer foundation complete"
```

Note: Each task already has its own commit. This step is only needed if any changes were missed.

---

## Completion Criteria

1. `src/lib/errors.ts` exports `UserError` and `SystemError`
2. `src/lib/handle-route.ts` exports `handleRoute` that auto-maps errors to unified JSON responses
3. `src/lib/services/book-service.ts` exports `bookService` with `list()` and `getById()`
4. `GET /api/books` returns `{ success: true, data: [...] }` format
5. `POST /api/books` still works unchanged
6. `AGENTS.md` has coding standards section and correct invariant #5
7. TypeScript compiles without errors

## What Comes Next

After this task, proceed to M0 Task 1 (Database Schema Rewrite) per `docs/superpowers/plans/2026-03-21-m0-foundation.md`.

**Note:** When Task 1 adds the `kp_extraction_status` column to the `books` table, update `book-service.ts` to add `kp_extraction_status` to the `Book` interface and both SELECT queries.

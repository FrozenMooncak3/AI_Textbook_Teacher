# 基础设施改进：结构化错误处理 + 服务层分离

**日期**：2026-03-22
**状态**：已审核
**参与者**：项目负责人 + Claude（PM/架构师）
**灵感来源**：Harness (github.com/harness/harness) 架构调研

---

## 1. 背景与动机

当前 API 路由存在两个结构性问题：

**错误处理混乱**：用户输入错误、Claude API 崩溃、日志写入失败——全部混在各 route 的 try/catch 里，格式不统一（有的返回 `{ error }` 有的加 `{ code }`），有些 route 记日志有些不记。

**业务逻辑与 HTTP 耦合**：所有 route handler 直接执行 SQL 查询、调用 Claude API、解析 JSON 响应。没有服务层。

这两个问题在 M1-M5 重写大量 API 时会被放大——如果不在 M0 建好地基，Codex 会延续旧模式。

---

## 2. 设计目标

1. 所有错误分为三级：用户错误 / 系统错误 / 非关键警告
2. 所有 API 响应格式统一
3. Route handler 只做 HTTP 解析 + 调用服务 + 返回结果
4. 业务逻辑封装在服务模块中，不依赖 HTTP 对象
5. M0 只做基础设施 + 1 个示范，M1-M5 通过 AGENTS.md 编码规范传导

---

## 3. 错误分类体系

### 3.1 三个层级

| 错误类 | 使用场景 | HTTP 状态码 | 用户看到 | 系统行为 |
|--------|---------|-------------|---------|---------|
| `UserError` | 用户输入有问题（格式错、资源不存在、违反业务规则） | 400 / 404 / 409 / 422 | 具体的中文提示 | 不记日志 |
| `SystemError` | AI 挂了、数据库崩了、文件读写失败 | 500 | "服务暂时不可用，请稍后重试" | 记错误日志（含完整错误栈） |
| 非关键警告 | 日志写入失败、非核心后台任务失败 | 不返回给用户 | 用户无感 | 尝试记日志，失败也算了 |

### 3.2 错误类定义

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

### 3.3 使用示例

```typescript
// 用户错误 — 抛出时附带用户可读消息 + 机器可读 code + 状态码
throw new UserError('请填写教材名称', 'MISSING_TITLE', 400)
throw new UserError('教材不存在', 'NOT_FOUND', 404)
throw new UserError('模块已存在，不可重复生成', 'DUPLICATE', 409)
throw new UserError('不支持的文件格式', 'UNSUPPORTED_FORMAT', 422)

// 系统错误 — 保留原始错误用于日志，对外隐藏细节
throw new SystemError('Claude API 调用失败', originalError)
throw new SystemError('数据库写入失败', originalError)

// 非关键警告 — 沿用 logAction() 静默失败模式，不需要专门的类
```

---

## 4. 统一响应格式

### 4.1 格式定义

**成功响应：**

```json
{ "success": true, "data": { ... } }
```

**失败响应：**

```json
{ "success": false, "error": "用户可读消息", "code": "MACHINE_CODE" }
```

### 4.2 现状 vs 改造后

| 维度 | 现在 | 改造后 |
|------|------|--------|
| 成功格式 | 各 route 不同（`{ modules: [...] }`、`{ id: 1 }`） | 统一 `{ success: true, data: ... }` |
| 失败格式 | 有的 `{ error }`，有的 `{ error, code }` | 统一 `{ success: false, error, code }` |
| 前端判断 | 猜格式 | 检查 `success` 字段 |

---

## 5. handleRoute 包装函数

### 5.1 功能

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

// 注意：handleRoute 仅适用于返回 JSON 的 API 路由。
// 流式响应路由（如未来的 Claude streaming）不使用 handleRoute，直接写原生 handler。
```

### 5.2 Route 改造示例

**改造前（`src/app/api/books/route.ts` GET）：**

```typescript
export async function GET() {
  const db = getDb()
  const books = db.prepare('SELECT * FROM books ORDER BY created_at DESC').all()
  return NextResponse.json(books)
}
```

**改造后：**

```typescript
import { handleRoute } from '@/lib/handle-route'
import { bookService } from '@/lib/services/book-service'

// 注意：使用 handleRoute 的路由统一用 export const 风格（取代旧的 export async function）
export const GET = handleRoute(async () => {
  const books = bookService.list()
  return { data: books }
})

// POST 暂不改造（涉及 FormData + 文件 I/O + 子进程），保持原样，M1 再重构
export async function POST(req: NextRequest) { /* 现有代码不动 */ }
```

---

## 6. 服务层结构

### 6.1 目录

```
src/lib/
├── errors.ts                ← 错误类
├── handle-route.ts          ← 路由包装函数
├── services/
│   ├── book-service.ts      ← M0 示范
│   └── ...                  ← M1-M5 按需新增
├── claude.ts                ← 不动
├── db.ts                    ← 不动
├── log.ts                   ← 不动
└── mistakes.ts              ← M0 plan 已有改造计划
```

### 6.2 服务模块规范

**职责边界：**

| 层 | 做什么 | 不做什么 |
|----|--------|---------|
| Route（前厅） | 解析 HTTP 请求体、提取路径参数、调用服务、返回 RouteResult | 不碰数据库、不调 Claude、不写业务逻辑 |
| Service（后厨） | 输入验证、数据库读写、调用 Claude、组装结果、throw 错误类 | 不依赖 HTTP 对象（不知道 req/res/NextResponse 是什么） |

**Service 函数签名规则：**
- 接收普通参数（string、number、object）
- 返回普通数据对象
- 出错时 throw `UserError` 或 `SystemError`
- 不引入 `next/server` 的任何东西

### 6.3 示范：book-service.ts

**M0 示范范围**：仅重构 GET（列表）。POST（上传）涉及 FormData 解析、文件写入、OCR 子进程启动等大量 I/O 操作，属于 M1 重构范围，M0 不动。

```typescript
// src/lib/services/book-service.ts

import { getDb } from '../db'
import { UserError, SystemError } from '../errors'

interface Book {
  id: number
  title: string
  parse_status: string
  kp_extraction_status: string
  created_at: string
}

export const bookService = {
  list(): Book[] {
    try {
      const db = getDb()
      return db.prepare(
        'SELECT id, title, parse_status, kp_extraction_status, created_at FROM books ORDER BY created_at DESC'
      ).all() as Book[]
    } catch (err) {
      throw new SystemError('查询教材列表失败', err)
    }
  },

  getById(id: number): Book {
    const db = getDb()
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(id) as Book | undefined
    if (!book) {
      throw new UserError('教材不存在', 'NOT_FOUND', 404)
    }
    return book
  },
}
```

---

## 7. AGENTS.md 更新内容

在 AGENTS.md 中新增"编码规范"章节：

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
```

同时修复 AGENTS.md 中产品不变量 #5 与 CLAUDE.md 的不一致（批量反馈 → 即时反馈）。

---

## 8. M0 交付物清单

| 文件 | 动作 | 内容 |
|------|------|------|
| `src/lib/errors.ts` | 新建 | UserError + SystemError 类定义 |
| `src/lib/handle-route.ts` | 新建 | handleRoute 包装函数（含 SyntaxError 兜底） |
| `src/lib/services/book-service.ts` | 新建 | 教材列表 + 按 ID 查询（仅 GET，POST 不动） |
| `src/app/api/books/route.ts` | 改造 | GET 用 handleRoute + bookService 重写，POST 保持原样 |
| `AGENTS.md` | 更新 | 新增编码规范章节 + 修复产品不变量 #5 |

---

## 9. 可逆性

**容易反悔。** 所有改动都是加法（新文件 + 一个 route 改造）。回退只需删除新文件、git checkout 恢复 books/route.ts。不影响其他任何 route 或功能。

---

## 10. 与 M0 现有计划的关系

本设计是 M0 的补充任务（Task 0），在 Task 1（数据库 schema 重写）之前执行。原有 Task 1-6 不受影响。

执行顺序：**本设计（Task 0）→ Task 1（数据库）→ Task 2（prompt 模板）→ ...**

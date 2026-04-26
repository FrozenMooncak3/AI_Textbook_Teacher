# OCR + KP 成本架构 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `task-execution` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地 7 决策（D0/D0-PPT/D5/D6/D1/D2/D7）—— Gemini 全下线换 DeepSeek V3.2 + Qwen3-Max 备选 / PDF MD5 半全局缓存 / 月度 500 元预算 + 单本 1.5 元上限 / 上传额度 + 邀请扩额 + rate-limit / D0 文件类型收紧 + 邮箱收集 + .pptx 支持。完成后单本 KP 成本从 ~7 元 → ~0.7 元（10x 降本），支持 100 用户 / 2 周抖音引流目标。

**Architecture:** 三层增量改造（DB schema → 服务层新增 → 现有路由 hook 接入）+ 一次模型切换（env 切到 DeepSeek + 教学护城河补丁）。所有变更对老用户无感（schema NULL-safe，老路径回退）。OCR 链路保留为 standby（M5+ 重启）。

**Tech Stack:** Next.js 15 App Router / pg 异步 / Vercel AI SDK（@ai-sdk/openai compat baseURL 接 DeepSeek + DashScope）/ Cloudflare R2 / Vercel Cron / python-pptx（OCR server 共部署）

**Spec source:** `docs/superpowers/specs/2026-04-25-ocr-cost-architecture-design.md`（7 决策 lock + Round 1+2 review 通过）
**WIP trail:** `docs/superpowers/specs/2026-04-25-ocr-cost-brainstorm-state.md`

---

## File Structure

按工程职责而非决策顺序组织。每个文件单一职责，新增服务模块独立测试，老路由接入仅改入口。

### 新增文件（13 个）

| 文件 | 职责 | 来源决策 |
|---|---|---|
| `src/lib/services/cost-meter-service.ts` | 写 cost_log + 累加 monthly_cost_meter + budget guard | D1 |
| `src/lib/services/quota-service.ts` | quota / rate-limit 查询 + 减扣（事务） | D7 |
| `src/lib/services/kp-cache-service.ts` | kp_cache 命中查询 + 写入 + 命中率上报 | D6 |
| `src/lib/services/cost-estimator.ts` | 单本 token estimate + 1.5 元拦截 | D1 |
| `src/lib/pdf-md5.ts` | PDF buffer 流式 MD5（避免内存爆） | D6 |
| `src/lib/services/budget-email-alert.ts` | resend.com / SMTP 发邮件给 BUDGET_ALERT_EMAIL | D1 |
| `src/app/api/email-collection/scan-pdf-waitlist/route.ts` | 拒绝时邮箱收集 | D0 |
| `src/app/api/cron/monthly-cost-reset/route.ts` | 月初 1 号 0:00 北京 reset meter | D1 |
| `src/app/api/cron/abuse-alert/route.ts` | 每日扫 book_uploads_log >5 本告警 | D7 |
| `src/components/upload/ScanPdfRejectionModal.tsx` | 拒绝弹窗 + 邮箱表单 | D0 |
| `src/components/upload/QuotaIndicator.tsx` | 顶栏显示 book_quota_remaining | D7 |
| `src/components/book/CacheHitBadge.tsx` | "已为 N 同学解析过" 社交信号 | D6 |
| `scripts/pptx_parser.py` | python-pptx 抽 text frames + tables + notes | D0-PPT |

### 修改文件（11 个）

| 文件 | 改动 | 来源决策 |
|---|---|---|
| `src/lib/schema.sql` | 新增 5 表 + books 加 2 列 + users 加 3 列 | D1/D6/D7 |
| `src/lib/ai.ts` | 注册 deepseek + qwen provider，扩 ProviderModelId 类型 | D5 |
| `src/lib/teacher-model.ts` | 扩 TeacherModelId + premium-locked 修正 + free 路由 deepseek | D5 |
| `src/lib/r2-client.ts` | export getR2Client / getR2Bucket / getR2ObjectBuffer + buildObjectKey 加 contentType（PPTX 支持） | D0+D6 |
| `src/lib/services/kp-extraction-service.ts` | cache 命中查询 + DeepSeek/Qwen fallback chain + cost_log 写入 | D5+D6+D1 |
| `src/lib/upload-flow.ts` | 命中时跳过 classify+extract，直接复用 modules+KPs | D6 |
| `src/app/api/uploads/presign/route.ts` | contentType 白名单（pdf+pptx）+ size + quota + rate-limit + 月度预算 | D0+D1+D7 |
| `src/app/api/books/confirm/route.ts` | page-count + classifier 拦截 + PPT slide-count + MD5 + cache hook + quota 减扣 | D0+D6+D7 |
| `src/app/api/auth/register/route.ts` | 邀请码 used → quota +1 | D7 |
| `src/app/api/teaching-sessions/[sessionId]/messages/route.ts` | 调用后写 cost_log（免费档计入 monthly meter） | D1 |
| `scripts/ocr_server.py` | 加 `/parse-pptx` 端点（PPT 路径复用 OCR Cloud Run） | D0-PPT |
| `Dockerfile.ocr` | line 6 内联 pip install 末尾追加 `python-pptx==0.6.23` | D0-PPT |
| `src/app/upload/page.tsx` | client-side .pptx 加白名单 + size 校验 + 错误态对接 modal | D0+D7 |
| `vercel.json` | 加 2 条 cron schedule | D1+D7 |

### 删除/不动文件

| 文件 | 状态 | 原因 |
|---|---|---|
| `scripts/ocr_server.py` | 不动（standby） | OCR 链路保留 M5+ 重启 |
| `cloudbuild.ocr.yaml` | 不动 | OCR Cloud Run 部署链 standby |

---

## Phase 0 — DB schema + AI provider 基础设施（约 1.5 工作日）

### Task 0.1: schema.sql 新增 5 表 + 加列

**Files:**
- Modify: `src/lib/schema.sql`（追加到末尾）

**Recommended dispatch:** Codex（标准档；纯 SQL，零运行时风险，老数据 NULL-safe）

**Acceptance criteria:**
- 5 张新表 idempotent CREATE（CREATE TABLE IF NOT EXISTS）
- books / users 加列用 ALTER TABLE ADD COLUMN IF NOT EXISTS（兼容老库）
- `initDb()` 启动时自动跑这段 SQL（已有机制，无需新代码）

- [ ] **Step 1: 在 `src/lib/schema.sql` 文件末尾追加以下 SQL**

```sql
-- ========================================================================
-- 2026-04-25: OCR + KP 成本架构（D1/D6/D7）— 5 张新表 + books 2 列 + users 3 列
-- 来源: docs/superpowers/specs/2026-04-25-ocr-cost-architecture-design.md
-- ========================================================================

-- D6: KP 全书级缓存（半全局共享，无 user_id；教材客观知识点跨用户复用）
CREATE TABLE IF NOT EXISTS kp_cache (
  id            BIGSERIAL PRIMARY KEY,
  pdf_md5       TEXT UNIQUE NOT NULL,
  page_count    INTEGER NOT NULL,
  language      TEXT NOT NULL CHECK (language IN ('zh', 'en')),
  model_used    TEXT NOT NULL,
  kp_payload    JSONB NOT NULL,
  hit_count     INTEGER NOT NULL DEFAULT 0,
  last_hit_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kp_cache_md5 ON kp_cache(pdf_md5);

-- D1: 月度账户预算 meter（month-of-year reset by cron `0 16 1 * *` UTC = 北京 1 号 0:00）
CREATE TABLE IF NOT EXISTS monthly_cost_meter (
  id              BIGSERIAL PRIMARY KEY,
  year_month      TEXT UNIQUE NOT NULL,             -- 'YYYY-MM' 北京时区
  total_cost_yuan NUMERIC(10, 4) NOT NULL DEFAULT 0,
  alert_80_sent   BOOLEAN NOT NULL DEFAULT FALSE,   -- 80% 预警邮件已发
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_monthly_cost_meter_ym ON monthly_cost_meter(year_month);

-- D1: 每次 LLM 调用的成本明细（KP 提取 / 教学对话）
CREATE TABLE IF NOT EXISTS cost_log (
  id          BIGSERIAL PRIMARY KEY,
  book_id     INTEGER REFERENCES books(id) ON DELETE SET NULL,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  call_type   TEXT NOT NULL CHECK (call_type IN ('kp_extraction', 'teaching_free', 'teaching_premium')),
  model       TEXT NOT NULL,
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_yuan   NUMERIC(10, 6) NOT NULL DEFAULT 0,
  cache_hit   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cost_log_book ON cost_log(book_id);
CREATE INDEX IF NOT EXISTS idx_cost_log_user_date ON cost_log(user_id, created_at);

-- D7: 上传事件流水（rate-limit + 异常检测查询用；写入时机 = confirm 成功后）
CREATE TABLE IF NOT EXISTS book_uploads_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_book_uploads_log_user_time ON book_uploads_log(user_id, created_at);

-- D0: 拒绝时邮箱收集（launch list / 众筹早鸟池）
CREATE TABLE IF NOT EXISTS email_collection_list (
  id                 BIGSERIAL PRIMARY KEY,
  email              TEXT NOT NULL,
  reject_reason      TEXT NOT NULL CHECK (reject_reason IN ('scanned_pdf', 'too_large', 'too_many_pages', 'too_many_slides', 'unsupported_type')),
  book_filename      TEXT,
  book_size_bytes    BIGINT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  launch_notified_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_email_collection_email ON email_collection_list(email);

-- D6: books 加 file_md5 + cache_hit 列
ALTER TABLE books ADD COLUMN IF NOT EXISTS file_md5 TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS cache_hit BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_books_md5 ON books(file_md5);

-- D7: users 加 quota / invite_code_used / suspicious_flag 列
ALTER TABLE users ADD COLUMN IF NOT EXISTS book_quota_remaining INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_code_used TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspicious_flag BOOLEAN NOT NULL DEFAULT FALSE;
```

- [ ] **Step 2: 本地 dev DB 跑一次 `initDb()` 验证 idempotent**

Run: `npm run dev`（启动会自动 trigger initDb）→ 检查 logs 无错误 + Postgres `\dt` 看到 5 张新表

Expected: 启动日志显示 `initDb completed`，psql `\d kp_cache` 显示完整 schema

- [ ] **Step 3: Commit**

```
chore(m4.7): D1/D6/D7 schema migration — 5 表 + books/users 加列

新增 kp_cache（半全局，无 user_id）/ monthly_cost_meter / cost_log /
book_uploads_log / email_collection_list；books +file_md5/cache_hit；
users +book_quota_remaining/invite_code_used/suspicious_flag。

来源 spec/2026-04-25-ocr-cost-architecture-design.md §6.3 §7.3-7.5 §8。
```

---

### Task 0.2: ai.ts 注册 DeepSeek + Qwen provider

**Files:**
- Modify: `src/lib/ai.ts`

**Recommended dispatch:** Codex（标准档；类型扩展 + 1 个新 provider 注册，已有 createOpenAI 模式可参考；零业务逻辑）

**Acceptance criteria:**
- DeepSeek 走 `createOpenAI({ baseURL: 'https://api.deepseek.com' })` OpenAI compat（spec §13.2 #5 验证用此路径而非 `@ai-sdk/deepseek` 官方 SDK，避免新 npm 依赖）
- Qwen 走 `createOpenAI({ baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1' })` DashScope OpenAI compat
- ProviderModelId 扩为 5 字面量 union：`anthropic:` | `google:` | `openai:` | `deepseek:` | `qwen:`
- customFetch 代理透传保留（已有逻辑）
- 类型 export 同步：`export type { ProviderModelId }`

> **API 变更注意（commit 前必跑 grep）**：现有 `src/lib/ai.ts:63` 是 `type ProviderModelId`（非 export）。本任务把它改成 `export type`，并被 `src/lib/teacher-model.ts` (Task 0.3) 与 `src/lib/services/cost-estimator.ts` (Task 1.5) import。Codex commit 前跑 `git grep -n "ProviderModelId" src/` 确认无静默 break；如有外部命名冲突先重命名再合并。

- [ ] **Step 1: 写完整 ai.ts**

```typescript
import { createProviderRegistry } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'

function getCustomFetch(): typeof globalThis.fetch | undefined {
  const proxy =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy

  if (!proxy) {
    return undefined
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ProxyAgent, fetch: undiciFetch } = require('undici') as typeof import('undici')
  const proxyAgent = new ProxyAgent(proxy)

  return (async (url: string | URL | Request, init?: RequestInit) => {
    const response = await undiciFetch(url as string, {
      ...(init ?? {}),
      dispatcher: proxyAgent,
    } as Parameters<typeof undiciFetch>[1])

    const body = await response.arrayBuffer()
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    })
  }) as typeof globalThis.fetch
}

const customFetch = getCustomFetch()

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  ...(customFetch ? { fetch: customFetch } : {}),
})

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  ...(customFetch ? { fetch: customFetch } : {}),
})

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
  ...(customFetch ? { fetch: customFetch } : {}),
})

// D5 (2026-04-25): DeepSeek V3.2 via OpenAI-compat baseURL (避免新依赖)
const deepseek = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
  ...(customFetch ? { fetch: customFetch } : {}),
})

// D5 (2026-04-25): Qwen3-Max via DashScope OpenAI-compat baseURL
const qwen = createOpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  ...(customFetch ? { fetch: customFetch } : {}),
})

const registry = createProviderRegistry({
  anthropic,
  google,
  openai,
  deepseek,
  qwen,
})

export type ProviderModelId =
  | `anthropic:${string}`
  | `google:${string}`
  | `openai:${string}`
  | `deepseek:${string}`
  | `qwen:${string}`

export const AI_MODEL_ID =
  (process.env.AI_MODEL as ProviderModelId | undefined) || 'anthropic:claude-sonnet-4-6'

export const AI_MODEL_FALLBACK_ID =
  (process.env.AI_MODEL_FALLBACK as ProviderModelId | undefined) || 'qwen:qwen3-max'

export const timeout = 300_000

export function getModel() {
  return registry.languageModel(AI_MODEL_ID)
}

export function getFallbackModel() {
  return registry.languageModel(AI_MODEL_FALLBACK_ID)
}

export { registry }
```

- [ ] **Step 2: 写单元测试**

Create: `src/lib/__tests__/ai.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { registry, AI_MODEL_ID, AI_MODEL_FALLBACK_ID } from '../ai'

describe('ai.ts provider registry', () => {
  it('registers all 5 providers', () => {
    // Ensure no provider lookup throws
    expect(() => registry.languageModel('anthropic:claude-sonnet-4-6')).not.toThrow()
    expect(() => registry.languageModel('google:gemini-2.5-pro')).not.toThrow()
    expect(() => registry.languageModel('openai:gpt-4o')).not.toThrow()
    expect(() => registry.languageModel('deepseek:deepseek-chat')).not.toThrow()
    expect(() => registry.languageModel('qwen:qwen3-max')).not.toThrow()
  })

  it('AI_MODEL_ID defaults to sonnet when env unset', () => {
    expect(AI_MODEL_ID).toMatch(/^(anthropic|google|openai|deepseek|qwen):/)
  })

  it('AI_MODEL_FALLBACK_ID defaults to qwen3-max', () => {
    expect(AI_MODEL_FALLBACK_ID).toMatch(/^(anthropic|google|openai|deepseek|qwen):/)
  })
})
```

- [ ] **Step 3: 跑测试 + lint + tsc**

Run: `npm run test -- src/lib/__tests__/ai.test.ts`
Run: `npm run lint && npm run typecheck`

Expected: 3 测试 PASS / lint clean / tsc exit 0

- [ ] **Step 4: Commit**

```
feat(m4.7/D5): ai.ts 注册 deepseek + qwen provider

OpenAI-compat baseURL 路径接 DeepSeek (api.deepseek.com) 与 Qwen
(DashScope compatible-mode/v1)，无新 npm 依赖；ProviderModelId
扩为 5 字面量 union；新增 AI_MODEL_FALLBACK 环境变量配 fallback chain。

来源 spec/2026-04-25-ocr-cost-architecture-design.md §5.4。
```

---

### Task 0.3: teacher-model.ts 类型扩展 + premium-locked 修正

**Files:**
- Modify: `src/lib/teacher-model.ts`

**Recommended dispatch:** Codex（标准档；4-6 行修改 + 2 个测试用例，逻辑非常局部）

**Acceptance criteria:**
- TeacherModelId 类型同 ai.ts 同步扩为 5 字面量 union（导入 ProviderModelId 即可）
- isTeacherModelId whitelist 加 `deepseek:` / `qwen:`
- **关键护城河补丁**：`getTeacherModel(tier='premium', overrideModel)` 永远返回 `tierModelMap.premium`（即 sonnet-4-6），**忽略 overrideModel**；override 仅对 tier='free' 生效
- tierModelMap.free 改为 `'deepseek:deepseek-chat'`（D5 lock）

- [ ] **Step 1: 写完整 teacher-model.ts**

```typescript
import type { Tier } from './entitlement'
import type { ProviderModelId } from './ai'

export type TeacherModelId = ProviderModelId

const tierModelMap: Record<Tier, TeacherModelId> = {
  free: 'deepseek:deepseek-chat',
  premium: 'anthropic:claude-sonnet-4-6',
}

function isTeacherModelId(value: string): value is TeacherModelId {
  return (
    value.startsWith('anthropic:') ||
    value.startsWith('google:') ||
    value.startsWith('openai:') ||
    value.startsWith('deepseek:') ||
    value.startsWith('qwen:')
  )
}

/**
 * 教学护城河补丁（spec §5.5，D5 lock 2026-04-25）：
 * tier='premium' 永远返回 Sonnet 4.6，忽略任何 prompt_templates.model override；
 * override 仅对 tier='free' 生效（用于免费档微调）。
 */
export function getTeacherModel(tier: Tier, overrideModel?: string | null): TeacherModelId {
  if (tier === 'premium') {
    return tierModelMap.premium
  }

  if (overrideModel && isTeacherModelId(overrideModel)) {
    return overrideModel
  }

  return tierModelMap[tier]
}
```

- [ ] **Step 2: 写单元测试**

Create: `src/lib/__tests__/teacher-model.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { getTeacherModel } from '../teacher-model'

describe('getTeacherModel — 教学护城河补丁', () => {
  it('premium tier 永远返回 sonnet-4-6（忽略 override）', () => {
    expect(getTeacherModel('premium')).toBe('anthropic:claude-sonnet-4-6')
    expect(getTeacherModel('premium', 'deepseek:deepseek-chat')).toBe('anthropic:claude-sonnet-4-6')
    expect(getTeacherModel('premium', 'google:gemini-2.5-flash')).toBe('anthropic:claude-sonnet-4-6')
    expect(getTeacherModel('premium', null)).toBe('anthropic:claude-sonnet-4-6')
  })

  it('free tier 默认返回 deepseek-chat', () => {
    expect(getTeacherModel('free')).toBe('deepseek:deepseek-chat')
  })

  it('free tier override 生效（用于微调）', () => {
    expect(getTeacherModel('free', 'qwen:qwen3-max')).toBe('qwen:qwen3-max')
  })

  it('free tier 无效 override 回退到 tierModelMap', () => {
    expect(getTeacherModel('free', 'invalid-string')).toBe('deepseek:deepseek-chat')
    expect(getTeacherModel('free', null)).toBe('deepseek:deepseek-chat')
  })
})
```

- [ ] **Step 3: DB 检查现状（spec §5.5 要求）**

Run: 连 Neon dev branch 跑

```sql
SELECT id, role, stage, model
FROM prompt_templates
WHERE model IS NOT NULL;
```

Expected: 0 行（spec §5.5 说 seed 5 条都是 model=NULL）。如有非 NULL row 在 commit 前先与用户确认是否有意覆盖。

- [ ] **Step 4: 跑测试 + lint + tsc**

Run: `npm run test -- src/lib/__tests__/teacher-model.test.ts`
Run: `npm run lint && npm run typecheck`

Expected: 4 测试 PASS

- [ ] **Step 5: Commit**

```
fix(m4.7/D5): getTeacherModel premium 永远返回 sonnet（教学护城河补丁）

修复 prompt_templates.model 优先级漏洞——付费用户可能被路由到非 Sonnet
模型（spec §5.5）。tier='premium' 永远 hardcode sonnet-4-6，override 仅
对 tier='free' 生效。同步 tierModelMap.free 改 deepseek-chat (D5 lock)。

来源 spec/2026-04-25-ocr-cost-architecture-design.md §5.5。
```

---

### Task 0.4: r2-client.ts exports 整合（Task 1.4 / 2.2 前置）

**Files:**
- Modify: `src/lib/r2-client.ts`

**Recommended dispatch:** Codex（轻量档；3 个 export 追加 + 1 个函数签名变更，~15 行）

**背景**：现有 `r2-client.ts` 只 export `buildObjectKey` / `uploadPdf` / `getSignedPdfUrl` / `buildPresignedPutUrl` / `deletePdf`；`getR2Client()` 是文件内私有函数，`getR2Bucket()` 不存在。Phase 1 (Task 1.4 pdf-md5) 与 Phase 2 (Task 2.2 confirm) 都需要这三个 helper —— 必须在 Phase 1 之前先 export 完成，否则 Task 1.4 编译失败。

**Acceptance criteria:**
- `getR2Client()` 改为 export（保留懒加载缓存逻辑）
- 新增 `getR2Bucket(): string` export（读 R2_BUCKET env，缺则抛 Error）
- 新增 `getR2ObjectBuffer(objectKey: string): Promise<Buffer>` export（基于 GetObjectCommand + transformToByteArray）
- `buildObjectKey(bookId, contentType?)` 新签名：默认 `application/pdf` 行为不变；PPTX 走 `.pptx` 后缀（spec §6.1 PPT 路径需要）
- 现有 5 个 export 行为不变；既有 5 处调用站点（uploadPdf / getSignedPdfUrl / buildPresignedPutUrl / deletePdf / 现有 confirm route）保持向后兼容

- [ ] **Step 1: 修改 r2-client.ts**

```typescript
// src/lib/r2-client.ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

let cachedClient: S3Client | null = null

function readConfig(): {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
} {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('R2 env vars missing: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET all required')
  }

  return { accountId, accessKeyId, secretAccessKey, bucket }
}

// 改为 export（原私有函数）
export function getR2Client(): S3Client {
  if (cachedClient) return cachedClient
  const { accountId, accessKeyId, secretAccessKey } = readConfig()
  cachedClient = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  })
  return cachedClient
}

// 新增 export
export function getR2Bucket(): string {
  const bucket = process.env.R2_BUCKET
  if (!bucket) throw new Error('R2_BUCKET missing')
  return bucket
}

// 新增 export — 用于 pdf-md5 / confirm pdf-parse / pptx 处理
export async function getR2ObjectBuffer(objectKey: string): Promise<Buffer> {
  const client = getR2Client()
  const bucket = getR2Bucket()
  const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }))
  if (!result.Body) throw new Error(`R2 object empty: ${objectKey}`)
  // AWS SDK v3：Body 在 Node 环境是 Readable / IncomingMessage，统一用 transformToByteArray
  const bytes = await (result.Body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray()
  return Buffer.from(bytes)
}

// 签名扩展：支持 PPTX
const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
}

export function buildObjectKey(
  bookId: number,
  contentType: string = 'application/pdf'
): string {
  if (!Number.isInteger(bookId) || bookId <= 0) {
    throw new Error(`Invalid bookId for R2 object key: ${bookId}`)
  }
  const ext = CONTENT_TYPE_TO_EXT[contentType]
  if (!ext) throw new Error(`Unsupported contentType for R2 key: ${contentType}`)
  return `books/${bookId}/original.${ext}`
}

// 以下 export 保持现状（uploadPdf / getSignedPdfUrl / buildPresignedPutUrl / deletePdf）
// buildPresignedPutUrl 也加 contentType 参数支持 PPTX：
export async function buildPresignedPutUrl(
  bookId: number,
  contentType: string = 'application/pdf',
  expirySeconds: number = 900
): Promise<{ uploadUrl: string; objectKey: string }> {
  const { bucket } = readConfig()
  const objectKey = buildObjectKey(bookId, contentType)

  const uploadUrl = await getSignedUrl(
    getR2Client(),
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: contentType,
    }),
    { expiresIn: expirySeconds }
  )

  return { uploadUrl, objectKey }
}

// uploadPdf / getSignedPdfUrl / deletePdf 保持原签名不变（PDF 专用，不改动）
export async function uploadPdf(bookId: number, buffer: Buffer): Promise<string> {
  const { bucket } = readConfig()
  const key = buildObjectKey(bookId, 'application/pdf')
  await getR2Client().send(new PutObjectCommand({
    Bucket: bucket, Key: key, Body: buffer, ContentType: 'application/pdf',
  }))
  return key
}

export async function getSignedPdfUrl(objectKey: string, expirySeconds = 3600): Promise<string> {
  const { bucket } = readConfig()
  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
    { expiresIn: expirySeconds }
  )
}

export async function deletePdf(objectKey: string): Promise<void> {
  const { bucket } = readConfig()
  await getR2Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }))
}
```

- [ ] **Step 2: 验证现有调用站点不破**

Run: `git grep -n "buildObjectKey\|buildPresignedPutUrl\|getR2" src/`
Expected: 调用站点都是无 contentType 参数的 PDF 路径（默认值兜住）；如发现位置传第二参数为数字（旧 expirySeconds），按位置参数语义改为 named 调用 `buildPresignedPutUrl(bookId, undefined, expiry)` 或保留默认。

- [ ] **Step 3: tsc + lint + 跑现有 confirm/upload 测试**

Run: `npm run typecheck && npm run lint`
Run: `npm run test -- src/lib/__tests__/r2-client.test.ts`（如已有）
Expected: 全 PASS（向后兼容）

- [ ] **Step 4: Commit**

```
chore(m4.7/D0+D6): r2-client.ts exports —— Task 1.4/2.2 前置

export getR2Client / getR2Bucket / getR2ObjectBuffer；buildObjectKey
+buildPresignedPutUrl 加 contentType 参数支持 PPTX（默认 PDF 向后兼容）。
为 Phase 1 pdf-md5 + Phase 2 confirm + Phase 3 PPT 解析铺路。

来源 spec/2026-04-25-ocr-cost-architecture-design.md §6.1 §6.2。
```

---

## Phase 1 — 核心服务层（约 2 工作日）

### Task 1.1: cost-meter-service.ts（写 cost_log + 累加月度 meter）

**Files:**
- Create: `src/lib/services/cost-meter-service.ts`
- Test: `src/lib/services/__tests__/cost-meter-service.test.ts`

**Recommended dispatch:** Codex（标准档；纯服务层，pg 同步事务 + 1 张表 UPSERT，无外部依赖）

**Acceptance criteria:**
- `recordCost({ bookId?, userId?, callType, model, inputTokens, outputTokens, costYuan, cacheHit })` 写 cost_log
- 同事务累加 monthly_cost_meter（year_month = 北京时区 'YYYY-MM'，UPSERT）
- `getCurrentMonthSpent(): Promise<number>` 查月度累计
- `isBudgetExceeded(): Promise<boolean>` 单元测试可覆盖（>= MONTHLY_BUDGET_TOTAL = 500）
- 80% 阈值（400 元）触发邮件预警（一次性 flag alert_80_sent，避免重发）— 由 `triggerBudgetAlert` 完成
- 北京时区 `YYYY-MM` 计算：UTC 时间 + 8h 后取年月

- [ ] **Step 1: 实现服务**

```typescript
// src/lib/services/cost-meter-service.ts
import { query, queryOne, run } from '@/lib/db'
import { logAction } from '@/lib/log'

export type CallType = 'kp_extraction' | 'teaching_free' | 'teaching_premium'

export interface RecordCostInput {
  bookId?: number | null
  userId?: number | null
  callType: CallType
  model: string
  inputTokens: number
  outputTokens: number
  costYuan: number
  cacheHit?: boolean
}

const MONTHLY_BUDGET_TOTAL = Number(process.env.MONTHLY_BUDGET_TOTAL ?? '500')
const ALERT_THRESHOLD_PCT = 0.8

function getBeijingYearMonth(): string {
  const now = new Date()
  // UTC + 8h = 北京时区
  const beijing = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const yyyy = beijing.getUTCFullYear()
  const mm = String(beijing.getUTCMonth() + 1).padStart(2, '0')
  return `${yyyy}-${mm}`
}

/**
 * 写 cost_log + UPSERT monthly_cost_meter（同事务）
 * Note: pg pool 的 query() 是单连接事务边界由调用方控制；这里用 single-statement
 * 写入 + UPSERT，pg 单语句天然原子，无需显式 BEGIN/COMMIT。
 */
export async function recordCost(input: RecordCostInput): Promise<void> {
  // 仅免费档教学 + KP 提取计入 monthly_cost_meter；付费档 Sonnet 走独立 Anthropic billing
  const countTowardsBudget =
    input.callType === 'kp_extraction' || input.callType === 'teaching_free'

  await run(
    `INSERT INTO cost_log (book_id, user_id, call_type, model, input_tokens, output_tokens, cost_yuan, cache_hit)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      input.bookId ?? null,
      input.userId ?? null,
      input.callType,
      input.model,
      input.inputTokens,
      input.outputTokens,
      input.costYuan,
      input.cacheHit ?? false,
    ]
  )

  if (countTowardsBudget) {
    const ym = getBeijingYearMonth()
    await run(
      `INSERT INTO monthly_cost_meter (year_month, total_cost_yuan, last_updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (year_month) DO UPDATE
       SET total_cost_yuan = monthly_cost_meter.total_cost_yuan + EXCLUDED.total_cost_yuan,
           last_updated_at = NOW()`,
      [ym, input.costYuan]
    )

    // 触发 80% 预警邮件（fire-and-forget，不阻塞主流程）
    void triggerBudgetAlertIfThreshold(ym).catch((err) => {
      void logAction('budget_alert_check_failed', `ym=${ym}, err=${String(err)}`, 'error')
    })
  }
}

export async function getCurrentMonthSpent(): Promise<number> {
  const ym = getBeijingYearMonth()
  const row = await queryOne<{ total_cost_yuan: string }>(
    `SELECT total_cost_yuan FROM monthly_cost_meter WHERE year_month = $1`,
    [ym]
  )
  return row ? Number(row.total_cost_yuan) : 0
}

export async function isBudgetExceeded(): Promise<boolean> {
  const spent = await getCurrentMonthSpent()
  return spent >= MONTHLY_BUDGET_TOTAL
}

async function triggerBudgetAlertIfThreshold(yearMonth: string): Promise<void> {
  const row = await queryOne<{ total_cost_yuan: string; alert_80_sent: boolean }>(
    `SELECT total_cost_yuan, alert_80_sent FROM monthly_cost_meter WHERE year_month = $1`,
    [yearMonth]
  )
  if (!row) return
  const spent = Number(row.total_cost_yuan)
  if (spent >= MONTHLY_BUDGET_TOTAL * ALERT_THRESHOLD_PCT && !row.alert_80_sent) {
    // mark sent first to避免并发重发
    await run(
      `UPDATE monthly_cost_meter SET alert_80_sent = TRUE WHERE year_month = $1 AND alert_80_sent = FALSE`,
      [yearMonth]
    )
    // 实际邮件发送由 budget-email-alert.ts 完成（Task 1.6）
    const { sendBudgetAlertEmail } = await import('./budget-email-alert')
    await sendBudgetAlertEmail({
      yearMonth,
      spent,
      threshold: MONTHLY_BUDGET_TOTAL * ALERT_THRESHOLD_PCT,
      total: MONTHLY_BUDGET_TOTAL,
      severity: 'warning',
    })
  }
}
```

- [ ] **Step 2: 写单元测试**

```typescript
// src/lib/services/__tests__/cost-meter-service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { recordCost, getCurrentMonthSpent, isBudgetExceeded } from '../cost-meter-service'
import { run, queryOne } from '@/lib/db'

// Mock DB layer
vi.mock('@/lib/db', () => ({
  run: vi.fn().mockResolvedValue({ rowCount: 1 }),
  queryOne: vi.fn(),
}))

describe('cost-meter-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('recordCost 写 cost_log 并 UPSERT monthly_cost_meter（kp_extraction 计入预算）', async () => {
    await recordCost({
      bookId: 1,
      userId: 1,
      callType: 'kp_extraction',
      model: 'deepseek:deepseek-chat',
      inputTokens: 1000,
      outputTokens: 500,
      costYuan: 0.5,
    })
    expect(run).toHaveBeenCalledTimes(2) // cost_log + monthly_cost_meter UPSERT
  })

  it('teaching_premium 不计入 monthly_cost_meter（独立 Anthropic billing）', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce(null) // no existing alert row
    await recordCost({
      bookId: null,
      userId: 1,
      callType: 'teaching_premium',
      model: 'anthropic:claude-sonnet-4-6',
      inputTokens: 2000,
      outputTokens: 1000,
      costYuan: 7.0,
    })
    // 仅 cost_log 1 次，无 monthly_cost_meter
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('isBudgetExceeded 在 spent >= 500 时返回 true', async () => {
    vi.mocked(queryOne).mockResolvedValue({ total_cost_yuan: '500' })
    expect(await isBudgetExceeded()).toBe(true)
  })

  it('isBudgetExceeded 在 spent < 500 时返回 false', async () => {
    vi.mocked(queryOne).mockResolvedValue({ total_cost_yuan: '499.99' })
    expect(await isBudgetExceeded()).toBe(false)
  })

  it('getCurrentMonthSpent 在 meter 不存在时返回 0', async () => {
    vi.mocked(queryOne).mockResolvedValue(null)
    expect(await getCurrentMonthSpent()).toBe(0)
  })
})
```

- [ ] **Step 3: 跑测试 + lint + tsc**

Run: `npm run test -- src/lib/services/__tests__/cost-meter-service.test.ts`

Expected: 5 测试 PASS

- [ ] **Step 4: Commit**

```
feat(m4.7/D1): cost-meter-service —— cost_log + 月度预算 meter

recordCost 写 cost_log 并 UPSERT monthly_cost_meter（北京时区 YYYY-MM）；
仅 kp_extraction + teaching_free 计入预算；teaching_premium 独立 billing；
80% 阈值（400 元）触发一次性预警邮件（alert_80_sent flag 防重发）。

来源 spec/2026-04-25-ocr-cost-architecture-design.md §2.2 §11.1。
```

---

### Task 1.2: quota-service.ts（quota / rate-limit / 邀请扩额）

**Files:**
- Create: `src/lib/services/quota-service.ts`
- Test: `src/lib/services/__tests__/quota-service.test.ts`

**Recommended dispatch:** Codex（标准档；事务 + 简单 CRUD，但要求严格事务边界）

**Acceptance criteria:**
- `checkQuotaAndRateLimit(userId)`：返回 `{ ok: true } | { ok: false, reason: 'quota_exceeded' | 'rate_limit_1h' }`，**只读**（不消耗）
- `consumeQuotaAndLogUpload(userId, bookId)`：事务内 (a) `book_quota_remaining -= 1`，(b) INSERT book_uploads_log，(c) WHERE `book_quota_remaining > 0` 否则返回失败标志
- `incrementQuotaForInviteCode(userId, inviteCode)`：邀请码已用 → `book_quota_remaining += 1` + `invite_code_used = code`（同事务，避免重复扩额）
- 1 小时 rate-limit 查询：`SELECT COUNT(*) FROM book_uploads_log WHERE user_id = ? AND created_at > NOW() - INTERVAL '1 hour'`，>= 1 拦截

- [ ] **Step 1: 实现服务**

```typescript
// src/lib/services/quota-service.ts
import { query, queryOne, run } from '@/lib/db'

export type QuotaCheckResult =
  | { ok: true }
  | { ok: false; reason: 'quota_exceeded' | 'rate_limit_1h' }

export async function checkQuotaAndRateLimit(userId: number): Promise<QuotaCheckResult> {
  const user = await queryOne<{ book_quota_remaining: number }>(
    `SELECT book_quota_remaining FROM users WHERE id = $1`,
    [userId]
  )
  if (!user || user.book_quota_remaining <= 0) {
    return { ok: false, reason: 'quota_exceeded' }
  }

  const recent = await queryOne<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM book_uploads_log
     WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
    [userId]
  )
  if (recent && Number(recent.cnt) >= 1) {
    return { ok: false, reason: 'rate_limit_1h' }
  }

  return { ok: true }
}

/**
 * 事务内消耗 quota + 写 upload log。
 * 时机：confirm 路由成功后调用（不在 presign 时；spec §7.4）。
 * 返回 false 表示 quota 已耗尽（race condition 防御）。
 */
export async function consumeQuotaAndLogUpload(
  userId: number,
  bookId: number
): Promise<boolean> {
  // pg 单条 UPDATE WHERE 已是原子；用 RETURNING 确认确实扣到了
  const result = await query<{ id: number }>(
    `UPDATE users
     SET book_quota_remaining = book_quota_remaining - 1
     WHERE id = $1 AND book_quota_remaining > 0
     RETURNING id`,
    [userId]
  )
  if (result.length === 0) {
    return false
  }
  await run(
    `INSERT INTO book_uploads_log (user_id, book_id) VALUES ($1, $2)`,
    [userId, bookId]
  )
  return true
}

/**
 * 邀请码已用 → quota +1。
 * 防重复扩额：用 invite_code_used IS NULL 守卫。
 * 返回 false 表示已经用过别的邀请码。
 */
export async function incrementQuotaForInviteCode(
  userId: number,
  inviteCode: string
): Promise<boolean> {
  const result = await query<{ id: number }>(
    `UPDATE users
     SET book_quota_remaining = book_quota_remaining + 1,
         invite_code_used = $2
     WHERE id = $1 AND invite_code_used IS NULL
     RETURNING id`,
    [userId, inviteCode]
  )
  return result.length > 0
}
```

- [ ] **Step 2: 写单元测试**

```typescript
// src/lib/services/__tests__/quota-service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  checkQuotaAndRateLimit,
  consumeQuotaAndLogUpload,
  incrementQuotaForInviteCode,
} from '../quota-service'
import { query, queryOne, run } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  run: vi.fn().mockResolvedValue({ rowCount: 1 }),
}))

describe('quota-service', () => {
  beforeEach(() => vi.clearAllMocks())

  it('checkQuotaAndRateLimit ok 当 quota>0 + 1h 内无上传', async () => {
    vi.mocked(queryOne)
      .mockResolvedValueOnce({ book_quota_remaining: 1 }) // user
      .mockResolvedValueOnce({ cnt: '0' }) // rate limit
    const r = await checkQuotaAndRateLimit(1)
    expect(r).toEqual({ ok: true })
  })

  it('checkQuotaAndRateLimit quota_exceeded 当 quota=0', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce({ book_quota_remaining: 0 })
    const r = await checkQuotaAndRateLimit(1)
    expect(r).toEqual({ ok: false, reason: 'quota_exceeded' })
  })

  it('checkQuotaAndRateLimit rate_limit_1h 当 1h 内已上传 1 本', async () => {
    vi.mocked(queryOne)
      .mockResolvedValueOnce({ book_quota_remaining: 5 })
      .mockResolvedValueOnce({ cnt: '1' })
    const r = await checkQuotaAndRateLimit(1)
    expect(r).toEqual({ ok: false, reason: 'rate_limit_1h' })
  })

  it('consumeQuotaAndLogUpload 成功扣额 + 写 log', async () => {
    vi.mocked(query).mockResolvedValueOnce([{ id: 1 }])
    expect(await consumeQuotaAndLogUpload(1, 100)).toBe(true)
    expect(run).toHaveBeenCalledWith(
      expect.stringContaining('book_uploads_log'),
      [1, 100]
    )
  })

  it('consumeQuotaAndLogUpload 失败当 race 后 quota=0', async () => {
    vi.mocked(query).mockResolvedValueOnce([])
    expect(await consumeQuotaAndLogUpload(1, 100)).toBe(false)
    expect(run).not.toHaveBeenCalled()
  })

  it('incrementQuotaForInviteCode 防重复扩额', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ id: 1 }]) // 第 1 次成功
      .mockResolvedValueOnce([]) // 第 2 次失败（invite_code_used 已 set）
    expect(await incrementQuotaForInviteCode(1, 'ABC')).toBe(true)
    expect(await incrementQuotaForInviteCode(1, 'XYZ')).toBe(false)
  })
})
```

- [ ] **Step 3: 跑测试 + lint + tsc**

Expected: 6 测试 PASS

- [ ] **Step 4: Commit**

```
feat(m4.7/D7): quota-service —— quota check + rate-limit + 邀请扩额

checkQuotaAndRateLimit 入口只读；consumeQuotaAndLogUpload 在 confirm 成功
后事务消耗 quota + 写 book_uploads_log；incrementQuotaForInviteCode 防
重复扩额（invite_code_used IS NULL 守卫）。

来源 spec/2026-04-25-ocr-cost-architecture-design.md §7.3-7.4。
```

---

### Task 1.3: kp-cache-service.ts（命中查询 + 写入 + 命中率）

**Files:**
- Create: `src/lib/services/kp-cache-service.ts`
- Test: `src/lib/services/__tests__/kp-cache-service.test.ts`

**Recommended dispatch:** Codex（标准档；JSONB 序列化 + 事务复用 modules + KPs，是核心 cache hit 路径）

**Acceptance criteria:**
- `lookupCache(pdfMd5, pageCount, language)` 返回 `{ hit: true, payload } | { hit: false }`
- `applyCacheToBook(bookId, userId, payload)` 事务内：
  - INSERT 所有 modules（按 payload.modules 顺序）
  - 对每个 module INSERT knowledge_points + clusters
  - UPDATE books 的 parse_status='done', kp_extraction_status='completed', cache_hit=TRUE, raw_text= payload.raw_text（如有）
  - UPDATE kp_cache.hit_count += 1, last_hit_at = NOW()
- `writeCacheFromBook(bookId, pdfMd5, pageCount, language, modelUsed)`：聚合该 book 所有 modules + KPs → JSONB → INSERT INTO kp_cache（ON CONFLICT DO NOTHING）
- `getCacheHitCount(pdfMd5)`：仅供 UI badge 用（"已为 N 同学解析过"）

**Cache payload shape**（关键契约）：

```typescript
export interface CachePayload {
  raw_text: string  // 教材原文（可选，节省再 OCR）
  modules: Array<{
    title: string
    summary: string
    order_index: number
    page_start: number | null
    page_end: number | null
    text_status: string
    ocr_status: string
    kp_extraction_status: string
    knowledge_points: Array<{
      kp_code: string
      section_name: string
      description: string
      type: string
      importance: number
      detailed_content: string
      ocr_quality: string
      cluster_name?: string  // cluster 关联
    }>
    clusters: Array<{
      name: string
    }>
  }>
}
```

- [ ] **Step 1: 实现服务**（伪代码骨架，Codex 补全；要求事务边界用 `pg` connection.query 的 BEGIN/COMMIT，避免单条 UPSERT 失败时 books 已 update 但 modules 没建）

```typescript
// src/lib/services/kp-cache-service.ts
import { Pool } from 'pg'
import { query, queryOne, run } from '@/lib/db'
import { logAction } from '@/lib/log'

export interface CachePayload {
  raw_text?: string
  modules: Array<{
    title: string
    summary: string
    order_index: number
    page_start: number | null
    page_end: number | null
    text_status: string
    ocr_status: string
    kp_extraction_status: string
    knowledge_points: Array<{
      kp_code: string
      section_name: string
      description: string
      type: string
      importance: number
      detailed_content: string
      ocr_quality: string
      cluster_name?: string
    }>
    clusters: Array<{ name: string }>
  }>
}

export type LookupResult =
  | { hit: true; payload: CachePayload; modelUsed: string }
  | { hit: false }

export async function lookupCache(
  pdfMd5: string,
  pageCount: number,
  language: 'zh' | 'en'
): Promise<LookupResult> {
  const row = await queryOne<{ kp_payload: CachePayload; model_used: string }>(
    `SELECT kp_payload, model_used FROM kp_cache
     WHERE pdf_md5 = $1 AND page_count = $2 AND language = $3`,
    [pdfMd5, pageCount, language]
  )
  if (!row) return { hit: false }
  return { hit: true, payload: row.kp_payload, modelUsed: row.model_used }
}

/**
 * 事务复用：把 cache payload 中的 modules + KPs 写到 bookId 名下，
 * 同步 UPDATE books.parse_status='done' / kp_extraction_status='completed' / cache_hit=TRUE。
 * 失败时回滚。成功后 UPDATE kp_cache.hit_count += 1。
 *
 * 实现要点（Codex 补全）：
 * - 使用 `pool.connect()` 拿一个 client
 * - BEGIN
 * - INSERT modules（按 order_index 顺序），保留 module_id 映射
 * - 对每个 module，先 INSERT clusters 拿 cluster_ids 映射，再 INSERT knowledge_points
 *   （按 cluster_name 关联）
 * - UPDATE books SET parse_status='done', kp_extraction_status='completed',
 *   cache_hit=TRUE, raw_text=COALESCE($payload.raw_text, raw_text)
 * - UPDATE kp_cache SET hit_count = hit_count + 1, last_hit_at = NOW()
 *   WHERE pdf_md5 = $pdfMd5
 * - COMMIT
 *
 * 异常处理：catch 全部异常 ROLLBACK + 抛 + logAction
 */
export async function applyCacheToBook(
  bookId: number,
  payload: CachePayload,
  pdfMd5: string
): Promise<void> {
  // TODO Codex: 用 pool.connect() 拿 client 跑显式事务（BEGIN/COMMIT/ROLLBACK）
  // 参考现有 src/lib/db.ts 是否已 export pool — 若没 export 需追加 `export const pool = new Pool(...)`
  // 或在这里复用 `query<T>` 的 pool（如果 db.ts 内部有 pool）
  throw new Error('TODO Codex: 实现事务包裹的 applyCacheToBook')
}

/**
 * 聚合 book 当前所有 modules + KPs → CachePayload → INSERT INTO kp_cache。
 * 时机：当 books.kp_extraction_status 从 processing 转 completed 时调用。
 * ON CONFLICT (pdf_md5) DO NOTHING — 并发安全。
 */
export async function writeCacheFromBook(
  bookId: number,
  pdfMd5: string,
  pageCount: number,
  language: 'zh' | 'en',
  modelUsed: string
): Promise<void> {
  // 查 modules
  const modules = await query<{
    id: number
    title: string
    summary: string
    order_index: number
    page_start: number | null
    page_end: number | null
    text_status: string
    ocr_status: string
    kp_extraction_status: string
  }>(
    `SELECT id, title, summary, order_index, page_start, page_end,
            text_status, ocr_status, kp_extraction_status
     FROM modules WHERE book_id = $1 ORDER BY order_index`,
    [bookId]
  )

  // 查 raw_text（可选；不传也能省再 OCR）
  const bookRow = await queryOne<{ raw_text: string | null }>(
    `SELECT raw_text FROM books WHERE id = $1`,
    [bookId]
  )

  const modulePayloads: CachePayload['modules'] = []
  for (const m of modules) {
    const kps = await query<{
      kp_code: string
      section_name: string
      description: string
      type: string
      importance: number
      detailed_content: string
      ocr_quality: string
      cluster_id: number | null
    }>(
      `SELECT kp_code, section_name, description, type, importance,
              detailed_content, ocr_quality, cluster_id
       FROM knowledge_points WHERE module_id = $1`,
      [m.id]
    )

    const clusters = await query<{ id: number; name: string }>(
      `SELECT id, name FROM clusters WHERE module_id = $1`,
      [m.id]
    )

    const clusterIdToName = new Map(clusters.map((c) => [c.id, c.name]))
    modulePayloads.push({
      title: m.title,
      summary: m.summary,
      order_index: m.order_index,
      page_start: m.page_start,
      page_end: m.page_end,
      text_status: m.text_status,
      ocr_status: m.ocr_status,
      kp_extraction_status: m.kp_extraction_status,
      knowledge_points: kps.map((kp) => ({
        kp_code: kp.kp_code,
        section_name: kp.section_name,
        description: kp.description,
        type: kp.type,
        importance: kp.importance,
        detailed_content: kp.detailed_content,
        ocr_quality: kp.ocr_quality,
        cluster_name: kp.cluster_id ? clusterIdToName.get(kp.cluster_id) : undefined,
      })),
      clusters: clusters.map((c) => ({ name: c.name })),
    })
  }

  const payload: CachePayload = {
    raw_text: bookRow?.raw_text ?? undefined,
    modules: modulePayloads,
  }

  await run(
    `INSERT INTO kp_cache (pdf_md5, page_count, language, model_used, kp_payload)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (pdf_md5) DO NOTHING`,
    [pdfMd5, pageCount, language, modelUsed, JSON.stringify(payload)]
  )

  void logAction('kp_cache_written', `bookId=${bookId}, md5=${pdfMd5}, pages=${pageCount}`)
}

export async function getCacheHitCount(pdfMd5: string): Promise<number> {
  const row = await queryOne<{ hit_count: number }>(
    `SELECT hit_count FROM kp_cache WHERE pdf_md5 = $1`,
    [pdfMd5]
  )
  return row?.hit_count ?? 0
}
```

- [ ] **Step 2: 写单元测试 + 集成测试**

测试用例（写在 `src/lib/services/__tests__/kp-cache-service.test.ts`）：
- `lookupCache` hit / miss 两条路径（mock queryOne）
- `writeCacheFromBook` 聚合 modules + KPs（mock query/queryOne/run）
- `applyCacheToBook` 事务路径（用真实 dev DB 跑集成测试更靠谱；可选 mark 为 `it.skip` 留人工跑）
- `getCacheHitCount` 默认 0

Expected: 4-5 测试 PASS

- [ ] **Step 3: Commit**

```
feat(m4.7/D6): kp-cache-service —— PDF MD5 全书级缓存

lookupCache 命中查询；applyCacheToBook 事务复用 modules + KPs（BEGIN/COMMIT/
ROLLBACK，失败回滚）；writeCacheFromBook 聚合书完整数据 INSERT
ON CONFLICT DO NOTHING；getCacheHitCount 供 UI badge。

来源 spec/2026-04-25-ocr-cost-architecture-design.md §6.2-6.5。
```

---

### Task 1.4: pdf-md5.ts（流式 hash）

**Files:**
- Create: `src/lib/pdf-md5.ts`
- Test: `src/lib/__tests__/pdf-md5.test.ts`

**Recommended dispatch:** Codex（标准档；纯工具函数，~30 行）

**Acceptance criteria:**
- `computePdfMd5FromR2(objectKey): Promise<string>`：从 R2 GET object → 流式喂 crypto.createHash('md5') → 返回 hex
- 不一次性 buffer 整个 PDF（避免 50MB PDF × 100 用户挤爆 Vercel isolate 内存）
- AWS SDK 已有的 GetObjectCommand 配合 ReadableStream 直接 pipe

- [ ] **Step 1: 实现**

```typescript
// src/lib/pdf-md5.ts
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import { getR2Client, getR2Bucket } from '@/lib/r2-client' // 已由 Task 0.4 export

export async function computePdfMd5FromR2(objectKey: string): Promise<string> {
  const client = getR2Client()
  const bucket = getR2Bucket()
  const result = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: objectKey })
  )
  if (!result.Body) {
    throw new Error(`R2 object body empty for key=${objectKey}`)
  }

  const hash = createHash('md5')
  // AWS SDK Body 是 ReadableStream | Blob | Buffer，Node 环境是 ReadableStream
  const stream = Readable.from(result.Body as AsyncIterable<Buffer>)
  for await (const chunk of stream) {
    hash.update(chunk)
  }
  return hash.digest('hex')
}
```

- [ ] **Step 2: 单元测试**

```typescript
// src/lib/__tests__/pdf-md5.test.ts
import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
// 这里只测 hash 算法本身（mock R2 太复杂；hash 算法 stable 是 stdlib）

describe('pdf-md5', () => {
  it('crypto md5 算法稳定（先验测试）', () => {
    const h = createHash('md5').update(Buffer.from('hello')).digest('hex')
    expect(h).toBe('5d41402abc4b2a76b9719d911017c592')
  })
})
```

实战测试在 Phase 5 真机部署后跑（uploadPDF + 验证 books.file_md5 列填充正常）。

- [ ] **Step 3: Commit**

```
feat(m4.7/D6): pdf-md5.ts —— 流式 MD5（避免内存爆）

GetObjectCommand 拉 R2 stream 喂 createHash('md5')，避免一次性 buffer
50MB PDF；用于 confirm 路由计算 file_md5 + cache lookup。
```

---

### Task 1.5: cost-estimator.ts（单本 1.5 元拦截）

**Files:**
- Create: `src/lib/services/cost-estimator.ts`
- Test: `src/lib/services/__tests__/cost-estimator.test.ts`

**Recommended dispatch:** Codex（轻量档；~20 行函数 + 1 张定价表常量）

**Acceptance criteria:**
- `estimateBookCostYuan(pageCount, model): number` —— 按 page × 800 token/页 input + 4K output × N modules 估算
- 返回 yuan，保留 4 位小数
- 内置定价表（DeepSeek / Qwen / Gemini Flash），未知 model 抛 Error
- `MAX_PER_BOOK_YUAN = Number(process.env.MONTHLY_BUDGET_PER_BOOK ?? '1.5')`
- `assertWithinBookBudget(estimate)` —— 超 1.5 元抛 UserError "教材太大，请减少页数或联系我们升级"
- **`computeMessageCost(modelId, usage): number`** —— Task 2.5 (teaching messages) 与 Task 2.4 (kp-extraction) 都依赖；复用 PRICING_TABLE 实算 promptTokens × input + completionTokens × output / 1M tokens；未知 model 抛 Error；返回 yuan 4 位小数

- [ ] **Step 1: 实现**

```typescript
// src/lib/services/cost-estimator.ts
import { UserError } from '@/lib/errors'

// 定价表（spec §5.1，单位：人民币 / 1M tokens）
const PRICING_TABLE: Record<string, { input: number; output: number }> = {
  // DeepSeek V3.2 (2026-04-25 quote, USD→CNY ≈ 7.2)
  'deepseek:deepseek-chat': { input: 1.94, output: 7.92 }, // $0.27/M, $1.10/M × 7.2
  // Qwen3-Max DashScope 国内站
  'qwen:qwen3-max': { input: 0.83, output: 4.95 }, // ~$0.115/$0.688 × 7.2
  // Gemini 2.5 Flash fallback
  'google:gemini-2.5-flash': { input: 2.16, output: 18 }, // $0.30/$2.50 × 7.2
  // Sonnet 4.6 (教学付费档独立 billing，仅供参考)
  'anthropic:claude-sonnet-4-6': { input: 21.6, output: 108 }, // $3/$15 × 7.2
}

const TOKENS_PER_PAGE_INPUT = 800
const TOKENS_OUTPUT_PER_MODULE = 4000
const ESTIMATED_MODULES_PER_BOOK = 4

export function estimateBookCostYuan(pageCount: number, modelId: string): number {
  const pricing = PRICING_TABLE[modelId]
  if (!pricing) {
    throw new Error(`Unknown model for cost estimation: ${modelId}`)
  }
  const inputTokens = pageCount * TOKENS_PER_PAGE_INPUT
  const outputTokens = TOKENS_OUTPUT_PER_MODULE * ESTIMATED_MODULES_PER_BOOK
  const yuan = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
  return Number(yuan.toFixed(4))
}

export const MAX_PER_BOOK_YUAN = Number(process.env.MONTHLY_BUDGET_PER_BOOK ?? '1.5')

export function assertWithinBookBudget(estimateYuan: number): void {
  if (estimateYuan > MAX_PER_BOOK_YUAN) {
    throw new UserError(
      `教材成本估算 ${estimateYuan.toFixed(2)} 元超出单本上限 ${MAX_PER_BOOK_YUAN} 元，请减少页数或联系我们升级`,
      'BOOK_BUDGET_EXCEEDED',
      400
    )
  }
}

/**
 * 实算单次 LLM 调用成本（Task 2.5 teaching messages / Task 2.4 KP 抽取共用）。
 * usage 字段沿用 ai-sdk v5 形态：{ promptTokens, completionTokens }。
 * 未知 model 抛 Error（避免静默把成本计为 0 漏统计）。
 */
export interface MessageUsage {
  promptTokens: number
  completionTokens: number
}

export function computeMessageCost(modelId: string, usage: MessageUsage): number {
  const pricing = PRICING_TABLE[modelId]
  if (!pricing) {
    throw new Error(`Unknown model for cost computation: ${modelId}`)
  }
  const yuan =
    (usage.promptTokens * pricing.input + usage.completionTokens * pricing.output) /
    1_000_000
  return Number(yuan.toFixed(4))
}
```

- [ ] **Step 2: 单元测试**

```typescript
// src/lib/services/__tests__/cost-estimator.test.ts
import { describe, it, expect } from 'vitest'
import { estimateBookCostYuan, assertWithinBookBudget, MAX_PER_BOOK_YUAN } from '../cost-estimator'
import { UserError } from '@/lib/errors'

describe('cost-estimator', () => {
  it('100 页 DeepSeek 估算 ~0.28 元（80K input + 16K output）', () => {
    const yuan = estimateBookCostYuan(100, 'deepseek:deepseek-chat')
    // 100*800/1M = 0.08M; 4*4000/1M = 0.016M
    // 0.08 * 1.94 + 0.016 * 7.92 ≈ 0.155 + 0.127 ≈ 0.282
    expect(yuan).toBeGreaterThan(0.2)
    expect(yuan).toBeLessThan(0.4)
  })

  it('未知 model 抛 Error', () => {
    expect(() => estimateBookCostYuan(100, 'unknown:x')).toThrow()
  })

  it('assertWithinBookBudget 超 1.5 元抛 UserError', () => {
    expect(() => assertWithinBookBudget(2.0)).toThrow(UserError)
  })

  it('assertWithinBookBudget 1.0 元放行', () => {
    expect(() => assertWithinBookBudget(1.0)).not.toThrow()
  })

  it('MAX_PER_BOOK_YUAN 默认 1.5', () => {
    expect(MAX_PER_BOOK_YUAN).toBe(1.5)
  })
})

describe('computeMessageCost', () => {
  it('DeepSeek 1K input + 500 output ≈ 0.006 元', () => {
    const yuan = computeMessageCost('deepseek:deepseek-chat', {
      promptTokens: 1000,
      completionTokens: 500,
    })
    // (1000*1.94 + 500*7.92) / 1M ≈ 0.00194 + 0.00396 ≈ 0.0059
    expect(yuan).toBeGreaterThan(0.005)
    expect(yuan).toBeLessThan(0.01)
  })

  it('Sonnet 1K input + 500 output 显著高于 DeepSeek', () => {
    const sonnetYuan = computeMessageCost('anthropic:claude-sonnet-4-6', {
      promptTokens: 1000,
      completionTokens: 500,
    })
    expect(sonnetYuan).toBeGreaterThan(0.07) // ~0.0756
  })

  it('未知 model 抛 Error', () => {
    expect(() =>
      computeMessageCost('unknown:x', { promptTokens: 100, completionTokens: 100 })
    ).toThrow()
  })
})
```

> **Test imports**: 上述 test file 顶部 imports 同步加 `computeMessageCost`：
> `import { estimateBookCostYuan, assertWithinBookBudget, MAX_PER_BOOK_YUAN, computeMessageCost } from '../cost-estimator'`

- [ ] **Step 3: Commit**

```
feat(m4.7/D1): cost-estimator —— 单本 1.5 元上限拦截

estimateBookCostYuan(pages, model) 用 page×800 token + 4×4K output 估算；
内置 DeepSeek/Qwen/Gemini-Flash/Sonnet 定价表；assertWithinBookBudget
超额抛 UserError BOOK_BUDGET_EXCEEDED 拦上传。

来源 spec/2026-04-25-ocr-cost-architecture-design.md §2.1 §5.1。
```

---

### Task 1.6: budget-email-alert.ts（resend.com 邮件发送）

**Files:**
- Create: `src/lib/services/budget-email-alert.ts`

**Recommended dispatch:** Codex（轻量档；HTTPS POST 一个 endpoint，已有 fetch 模式可参考）

**Acceptance criteria:**
- 用 resend.com API（如未配 RESEND_API_KEY 则降级到 console.error，不阻塞 + 写 logAction 'budget_alert_email_skipped'）
- 中文邮件模板（标题 + body）
- 4 类告警：80% 预警 / 100% 触顶 / 单用户 >5 本 / KP fallback 触发频繁
- 不在客户端调用（必须 server-only，apiKey 不暴露）

- [ ] **Step 1: 实现**

```typescript
// src/lib/services/budget-email-alert.ts
import { logAction } from '@/lib/log'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const BUDGET_ALERT_EMAIL = process.env.BUDGET_ALERT_EMAIL ?? 'zs2911@nyu.edu'
const SENDER = 'AI Textbook <noreply@ai-textbook.example.com>' // 上线前用户在 resend.com 配 verified domain 后改

export interface BudgetAlertInput {
  yearMonth: string
  spent: number
  threshold: number
  total: number
  severity: 'warning' | 'critical'
}

export interface AbuseAlertInput {
  userId: number
  userEmail: string
  monthlyUploadCount: number
}

export async function sendBudgetAlertEmail(input: BudgetAlertInput): Promise<void> {
  const subject =
    input.severity === 'critical'
      ? `🚨 [AI Textbook] 月度预算触顶 ${input.spent.toFixed(2)} / ${input.total} 元`
      : `⚠️ [AI Textbook] 月度预算 80% 预警 ${input.spent.toFixed(2)} / ${input.total} 元`

  const body = `
${input.yearMonth} 月度账户预算${input.severity === 'critical' ? '已触顶' : '已达 80% 预警线'}：

- 当前累计：${input.spent.toFixed(2)} 元
- 阈值：${input.threshold.toFixed(2)} 元
- 月度上限：${input.total} 元

${input.severity === 'critical' ? '新上传已被自动拦截，老用户继续可用。' : '继续监控，超 100% 将拦截新上传。'}

如需查看详情，登录 admin dashboard 或检查 Vercel cron 日志。
`.trim()

  await sendEmail(subject, body)
}

export async function sendAbuseAlertEmail(input: AbuseAlertInput): Promise<void> {
  const subject = `[AI Textbook] 用户上传异常 user=${input.userId}`
  const body = `
检测到用户异常上传（过去 30 天 ${input.monthlyUploadCount} 本，>5 本告警阈值）：

- userId: ${input.userId}
- email: ${input.userEmail}
- 月度上传数: ${input.monthlyUploadCount}

已自动设置 users.suspicious_flag=TRUE，未自动停服。请人工 review。
`.trim()

  await sendEmail(subject, body)
}

async function sendEmail(subject: string, body: string): Promise<void> {
  if (!RESEND_API_KEY) {
    void logAction('budget_alert_email_skipped', `RESEND_API_KEY 未配，subject="${subject}"`, 'warn')
    console.warn('[budget-alert] RESEND_API_KEY missing, would have sent:', subject)
    return
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: SENDER,
        to: BUDGET_ALERT_EMAIL,
        subject,
        text: body,
      }),
    })
    if (!res.ok) {
      const errBody = await res.text()
      void logAction('budget_alert_email_failed', `status=${res.status}, body=${errBody}`, 'error')
    } else {
      void logAction('budget_alert_email_sent', `subject="${subject}"`)
    }
  } catch (err) {
    void logAction('budget_alert_email_exception', String(err), 'error')
  }
}
```

- [ ] **Step 2: Commit**

```
feat(m4.7/D1): budget-email-alert —— resend.com 邮件告警

4 类告警（80%/100% 预算 + 用户异常 + 模型 fallback 频繁）；RESEND_API_KEY
未配时降级到 console.warn + logAction，不阻塞主流程。
```

---

## Phase 2 — API 层 + Cron（约 1.5 工作日）

### Task 2.1: presign 路由扩展（D0 contentType + D1 + D7 拦截）

**Files:**
- Modify: `src/app/api/uploads/presign/route.ts`

**Recommended dispatch:** Codex（标准档；多个守卫拼装但都来自服务层，不写新逻辑）

**Acceptance criteria:**
- contentType 白名单扩为 `application/pdf` + `application/vnd.openxmlformats-officedocument.presentationml.presentation`（拒 .ppt 旧格式）
- size 上限改为 **10 MB**（spec D0 lock）
- 入口加守卫顺序（任一失败立刻 4xx）：
  1. `checkQuotaAndRateLimit(userId)` — quota_exceeded → 403 / rate_limit_1h → 429
  2. `isBudgetExceeded()` — 触顶 → 503 + 提示"月度预算已用完，请下月再试或联系我们"
- 返回 `{ uploadUrl, objectKey, bookId }` 不变（保留 books pending row）

- [ ] **Step 1: 改文件**（部分代码示意，Codex 补全）

```typescript
import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { insert } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'
import { buildPresignedPutUrl } from '@/lib/r2-client'
import { checkQuotaAndRateLimit } from '@/lib/services/quota-service'
import { isBudgetExceeded } from '@/lib/services/cost-meter-service'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // D0 lock: 10 MB

const PDF_CONTENT_TYPE = 'application/pdf'
const PPTX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

const RequestSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  size: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
  contentType: z.enum([PDF_CONTENT_TYPE, PPTX_CONTENT_TYPE]),
})

export const POST = handleRoute(async (req) => {
  const user = await requireUser(req)
  const body: unknown = await req.json()
  const parsed = RequestSchema.safeParse(body)

  if (!parsed.success) {
    throw new UserError(
      parsed.error.issues[0]?.message ?? 'Invalid request',
      'INVALID_REQUEST',
      400
    )
  }

  // D7: quota + 1h rate-limit
  const quotaCheck = await checkQuotaAndRateLimit(user.id)
  if (!quotaCheck.ok) {
    if (quotaCheck.reason === 'quota_exceeded') {
      throw new UserError('上传额度已用完，邀请好友可获取 +1 本额度', 'QUOTA_EXCEEDED', 403)
    }
    throw new UserError('上传太频繁，1 小时后再试', 'RATE_LIMIT_1H', 429)
  }

  // D1: 月度账户预算
  if (await isBudgetExceeded()) {
    throw new UserError(
      '本月预算已用完，请下月再试或联系我们升级',
      'MONTHLY_BUDGET_EXCEEDED',
      503
    )
  }

  const { filename, size, contentType } = parsed.data

  const bookId = await insert(
    `INSERT INTO books (
       user_id,
       title,
       raw_text,
       parse_status,
       kp_extraction_status,
       upload_status,
       file_size
     )
     VALUES ($1, $2, '', 'pending', 'pending', 'pending', $3)
     RETURNING id`,
    [user.id, filename, size]
  )

  const { uploadUrl, objectKey } = await buildPresignedPutUrl(bookId, 900, contentType)

  await logAction(
    'book_presign_issued',
    `bookId=${bookId}, filename=${filename}, size=${size}, contentType=${contentType}`
  )

  return {
    data: { bookId, uploadUrl, objectKey },
  }
})
```

注：`buildPresignedPutUrl` 现在固定 `application/pdf`；需扩第 3 参数 `contentType` 透传（Codex 同步改 `src/lib/r2-client.ts`，详见 Step 2）。

- [ ] **Step 2: 扩 r2-client.ts buildPresignedPutUrl**

`src/lib/r2-client.ts` 的 `buildPresignedPutUrl(bookId, ttlSeconds)` 改为 `buildPresignedPutUrl(bookId, ttlSeconds, contentType: string = 'application/pdf')`，PutObjectCommand `ContentType` 字段透传 contentType；objectKey 后缀按 contentType 决定 `.pdf` / `.pptx`（用 `buildObjectKey(bookId, contentType)`）。`buildObjectKey` 同步加第 2 参数 `contentType`，返回 `books/{userId}/{uuid}.{ext}` （ext = pdf 或 pptx）。

- [ ] **Step 3: 更新 r2-client.test.ts（如有）+ presign 路由测试**

- [ ] **Step 4: Commit**

```
feat(m4.7/D0+D1+D7): presign 路由 quota/rate-limit/budget 拦截 + .pptx 白名单

- 文件大小上限改 10 MB（D0 lock）
- contentType 白名单加 application/vnd.openxmlformats-officedocument.presentationml.presentation
- 入口加守卫：quota_exceeded → 403 / rate_limit_1h → 429 / 月度预算 → 503
- buildPresignedPutUrl + buildObjectKey 第 3 参数 contentType 透传

来源 spec/2026-04-25-ocr-cost-architecture-design.md §7.1 §7.3-7.4 §9.2。
```

---

### Task 2.2: confirm 路由扩展（page-count + classifier + MD5 + cache hook + slide-count + quota 减扣）

**Files:**
- Modify: `src/app/api/books/confirm/route.ts`

**Recommended dispatch:** Codex（重档；多分支 + cache hit 跳过、quota 事务、cost estimator 拦截，是核心入口路由）

**Acceptance criteria:**
- HeadObject 后立刻算 PDF MD5（流式）→ 写 books.file_md5
- contentType 分支：`application/pdf` 走 PDF 路径；`application/vnd.openxmlformats-officedocument.presentationml.presentation` 走 PPT 路径（Task 3.2）
- PDF 路径：
  - lookupCache(md5, pageCount, language) — hit → applyCacheToBook → consumeQuotaAndLogUpload → return `{ bookId, processing: false, cacheHit: true }`
  - miss → cost-estimator 拦截（>1.5 元抛 UserError）→ runClassifyAndExtract（fire-and-forget via `after()`）→ consumeQuotaAndLogUpload → return `{ bookId, processing: true }`
- 拒绝路径（page-count > 100 / classifier image-ratio 超阈值 / size > 10MB / 非纯文字 PDF）：
  - 不消耗 quota
  - 返回 4xx + reject_reason，前端显示 ScanPdfRejectionModal
- pageCount 校验：依赖 pdf-parse 提前算（在 confirm 路由里也跑一次轻量解析拿 pageCount，不依赖 Cloud Run）

- [ ] **Step 1: 改文件骨架**（关键路径，Codex 补全细节）

```typescript
import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { after } from 'next/server'
import { z } from 'zod'
import pdfParse from 'pdf-parse'
import { requireUser } from '@/lib/auth'
import { queryOne, run } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'
import { buildObjectKey, getR2Client, getR2Bucket, getR2ObjectBuffer } from '@/lib/r2-client'
import { runClassifyAndExtract } from '@/lib/upload-flow'
import { computePdfMd5FromR2 } from '@/lib/pdf-md5'
import { lookupCache, applyCacheToBook } from '@/lib/services/kp-cache-service'
import { consumeQuotaAndLogUpload } from '@/lib/services/quota-service'
import { estimateBookCostYuan, assertWithinBookBudget } from '@/lib/services/cost-estimator'
import { AI_MODEL_ID } from '@/lib/ai'
import { parsePptx } from '@/lib/pptx-parse' // Task 3.2 实现

const MAX_PAGES = 100
const MAX_PPTX_SLIDES = 200

const RequestSchema = z.object({
  bookId: z.number().int().positive(),
  title: z.string().trim().min(1).max(255),
  contentType: z.enum([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ]),
})

export const POST = handleRoute(async (req) => {
  const user = await requireUser(req)
  const body: unknown = await req.json()
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    throw new UserError(
      parsed.error.issues[0]?.message ?? 'Invalid request',
      'INVALID_REQUEST',
      400
    )
  }
  const { bookId, title, contentType } = parsed.data

  // 复用现有 books row + ownership check
  const book = await queryOne<{
    id: number
    user_id: number
    upload_status: string
    parse_status: string
    file_size: string
  }>(
    `SELECT id, user_id, upload_status, parse_status, file_size
     FROM books WHERE id = $1 AND user_id = $2`,
    [bookId, user.id]
  )
  if (!book) throw new UserError('Book not found', 'NOT_FOUND', 404)

  // 已 confirmed 走幂等
  if (book.upload_status === 'confirmed') {
    if (book.parse_status === 'error') {
      throw new UserError('上一次处理失败，请删除书重新上传', 'PROCESSING_FAILED', 409)
    }
    return { data: { bookId, processing: true } }
  }

  const objectKey = buildObjectKey(bookId, contentType)

  // HeadObject 校验
  await verifyR2HeadObject(objectKey, Number(book.file_size), bookId)

  // 算 MD5（流式）
  const fileMd5 = await computePdfMd5FromR2(objectKey)

  // 分支：PDF vs PPTX
  if (contentType === 'application/pdf') {
    return await handlePdfConfirm({ bookId, userId: user.id, objectKey, title, fileMd5 })
  } else {
    return await handlePptxConfirm({ bookId, userId: user.id, objectKey, title, fileMd5 })
  }
})

async function handlePdfConfirm({
  bookId, userId, objectKey, title, fileMd5,
}: {
  bookId: number; userId: number; objectKey: string; title: string; fileMd5: string
}) {
  // 1. 拉 PDF buffer 跑 pdf-parse 拿页数（不下载完整文件优化，这步必须）
  const buffer = await getR2ObjectBuffer(objectKey) // 已有 helper 或追加
  const parsed = await pdfParse(buffer)
  const pageCount = parsed.numpages

  // 2. D0 拒绝：页数 > 100
  if (pageCount > MAX_PAGES) {
    throw new UserError(
      `PDF 页数 ${pageCount} 超过 100 页上限`,
      'TOO_MANY_PAGES',
      400
    )
  }

  // 3. D0 拒绝：扫描 PDF（image-page-ratio 阈值，复用 src/lib/classify-pdf.ts）
  // 此处不阻塞 confirm；image-page-ratio 由 runClassifyAndExtract 内部决定。
  // 但若已知是图像式 PDF（pdf-parse text 输出 < 阈值），confirm 立即拒。
  const textRatio = parsed.text.trim().length / Math.max(parsed.numpages, 1)
  if (textRatio < 50) {
    // 每页 < 50 字符 ≈ 扫描或纯图片
    throw new UserError(
      '检测到这是扫描版 PDF，目前仅支持文字版 PDF',
      'SCANNED_PDF_REJECTED',
      400
    )
  }

  // 4. D6 cache lookup（zh 默认；后续可加 language detection）
  const cache = await lookupCache(fileMd5, pageCount, 'zh')
  if (cache.hit) {
    // 命中 — 写 books.file_md5 + cache_hit + 复用 modules + KPs
    await run(
      `UPDATE books SET file_md5 = $1, cache_hit = TRUE, upload_status = 'confirmed', title = $2 WHERE id = $3`,
      [fileMd5, title, bookId]
    )
    await applyCacheToBook(bookId, cache.payload, fileMd5)
    const consumed = await consumeQuotaAndLogUpload(userId, bookId)
    if (!consumed) {
      throw new UserError('额度同时被消耗，请刷新页面重试', 'QUOTA_RACE', 409)
    }
    await logAction('book_confirmed_cache_hit', `bookId=${bookId}, md5=${fileMd5}`)
    return { data: { bookId, processing: false, cacheHit: true } }
  }

  // 5. D1 cost estimator 拦截
  const estimateYuan = estimateBookCostYuan(pageCount, AI_MODEL_ID)
  assertWithinBookBudget(estimateYuan)

  // 6. 写 books + fire-and-forget classify
  await run(
    `UPDATE books
     SET file_md5 = $1, upload_status = 'confirmed', parse_status = 'processing', title = $2
     WHERE id = $3 AND upload_status = 'pending'`,
    [fileMd5, title, bookId]
  )

  // 7. quota 减扣 + book_uploads_log（成功后才扣，spec §7.4）
  const consumed = await consumeQuotaAndLogUpload(userId, bookId)
  if (!consumed) {
    throw new UserError('额度同时被消耗，请刷新页面重试', 'QUOTA_RACE', 409)
  }

  after(async () => {
    try {
      await runClassifyAndExtract(bookId, objectKey)
    } catch (error) {
      await logAction('runClassifyAndExtract unhandled', `bookId=${bookId}: ${String(error)}`, 'error')
    }
  })

  await logAction('book_confirmed_pdf', `bookId=${bookId}, md5=${fileMd5}, pages=${pageCount}, est=${estimateYuan}`)
  return { data: { bookId, processing: true } }
}

async function handlePptxConfirm({
  bookId, userId, objectKey, title, fileMd5,
}: {
  bookId: number; userId: number; objectKey: string; title: string; fileMd5: string
}) {
  // PPT 路径详见 Task 3.2
  // 1. parsePptx → { slides: [...], rawText: string }
  // 2. slide_count > 200 拒
  // 3. cache lookup（zh, slide_count = pageCount）
  // 4. 不命中走 KP 提取（无 OCR 路径）
  // 5. quota 减扣
  throw new Error('TODO Task 3.2: implement PPTX confirm path')
}

async function verifyR2HeadObject(objectKey: string, expectedSize: number, bookId: number) {
  const client = getR2Client()
  const bucket = getR2Bucket()
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }))
    const actualSize = head.ContentLength ?? 0
    if (expectedSize > 0 && actualSize !== expectedSize) {
      await logAction(
        'book_upload_size_mismatch',
        `bookId=${bookId}, expected=${expectedSize}, actual=${actualSize}`,
        'error'
      )
      throw new UserError('Upload size mismatch', 'UPLOAD_INCOMPLETE', 400)
    }
  } catch (err) {
    if (err instanceof UserError) throw err
    await logAction('book_upload_missing_object', `bookId=${bookId}, err=${String(err)}`, 'error')
    throw new UserError('Upload not found in storage', 'UPLOAD_INCOMPLETE', 400)
  }
}
```

- [ ] **Step 2: r2-client.ts helper 复用**

`getR2Client` / `getR2Bucket` / `getR2ObjectBuffer` 已在 **Task 0.4** export 完成，Task 2.2 直接 import 即可，无需追加。

- [ ] **Step 3: 跑 confirm 路由集成测试**

模拟 4 路径：(a) cache hit (b) cache miss + 估价通过 (c) page > 100 拒 (d) 扫描 PDF 拒

- [ ] **Step 4: Commit**

```
feat(m4.7/D0+D1+D6+D7): confirm 路由 — 全路径扩展

PDF 分支：HeadObject → 流式 MD5 → pdf-parse 拿 pageCount → D0 拒（>100 页 /
扫描）→ D6 cache lookup（hit 跳过全管线）→ D1 估价拦（>1.5 元）→ runClassifyAndExtract
fire-and-forget → D7 quota 减扣 + book_uploads_log。
PPT 分支预留（Task 3.2 实现）。

来源 spec/2026-04-25-ocr-cost-architecture-design.md §6.2 §7.1-7.4 §9.2。
```

---

### Task 2.3: register 路由扩展（D7 邀请码扩额）

**Files:**
- Modify: `src/app/api/auth/register/route.ts`

**Recommended dispatch:** Codex（轻量档；1-2 行新增逻辑）

**Acceptance criteria:**
- 注册流程现有：邀请码 + 邮箱 + 密码（M6 已实现）
- 新增：邀请码已用 → 调 `incrementQuotaForInviteCode(newUserId, code)` 给 +1 本额度
- 不修改邀请码 used_count 逻辑（已有）
- 注册时新用户 `book_quota_remaining` 已默认 1（schema），用了邀请码后变 2

- [ ] **Step 1: 派 Codex 改 register/route.ts**

让 Codex 找现有邀请码使用点（`UPDATE invite_codes SET used_count = used_count + 1`），在 INSERT users 之后追加：

```typescript
// 新用户使用邀请码 → quota +1（D7 lock，spec §7.3）
if (inviteCode) {
  const { incrementQuotaForInviteCode } = await import('@/lib/services/quota-service')
  await incrementQuotaForInviteCode(newUserId, inviteCode)
}
```

- [ ] **Step 2: 单元测试 + 跑现有测试无回归**

- [ ] **Step 3: Commit**

```
feat(m4.7/D7): register 路由 —— 邀请码扩额 +1 本

新用户使用邀请码注册即调 incrementQuotaForInviteCode 给 +1 本额度
（用 invite_code_used 守卫防重复扩额）。

来源 spec/2026-04-25-ocr-cost-architecture-design.md §7.3。
```

---

### Task 2.4: kp-extraction-service hook（cache 命中 + fallback chain + cost_log）

**Files:**
- Modify: `src/lib/services/kp-extraction-service.ts`

**Recommended dispatch:** Codex（重档；现有服务最复杂的一处，3 个新逻辑交织：cache 写入触发点 / fallback chain / cost 记录）

**Acceptance criteria:**
- KP 调用时机：`extractModule(bookId, moduleId, moduleText, moduleName)`
- 调用前：（cache 命中查询不在此层做，已在 confirm 路由做）
- 调用后：写 cost_log（input/output tokens 取自 AI SDK response.usage）
- JSON parse 失败 → 重试 1 次 → 仍失败 → fallback 到 AI_MODEL_FALLBACK（Qwen3-Max）→ 仍失败抛 + 写 logAction 'kp_fallback_chain_exhausted'
- 当 books.kp_extraction_status 由 syncBookKpStatus 推到 'completed' 时（即所有 modules 都完成），调 `writeCacheFromBook(bookId, file_md5, page_count, language, model_used)`
  - language 默认 'zh'，page_count 取 books.text_pages_count + scanned_pages_count（或 PDF 总页数）
  - model_used 取 AI_MODEL_ID（fallback 走 Qwen 时取实际用的）

- [ ] **Step 1: 找现有 syncBookKpStatus 函数 + extractModule 函数，hook 进 cost log + cache write 逻辑**

派 Codex 完成具体代码。要求：
- `extractModule` 末尾计算 cost（用 cost-estimator + 实际 token usage 互相校准；优先实际 usage）→ recordCost(callType='kp_extraction', ...)
- syncBookKpStatus 推到 'completed' 时 fire-and-forget 调 `void writeCacheFromBook(...).catch(logErr)`
- `parseJSON` retry：用现有 `retryWithBackoff` 或新增 `parseKPWithFallback(modelText, fallbackModelId)`

- [ ] **Step 2: 测试 fallback chain**

写一个集成测试，用 mock AI SDK 返回 `'invalid json'` 第 1 次，第 2 次 valid → 验证 retry 成功；返回 invalid 2 次 → 验证 fallback model 被调用。

- [ ] **Step 3: Commit**

```
feat(m4.7/D1+D5+D6): kp-extraction-service —— cost log + fallback + cache write

extractModule 末尾用 ai-sdk usage 计算实际 cost → recordCost(kp_extraction)；
parseJSON 失败重试 1 次仍失败 → fallback 到 AI_MODEL_FALLBACK (Qwen3-Max)；
syncBookKpStatus 推到 'completed' 时 fire-and-forget 调 writeCacheFromBook
聚合 modules + KPs 写 kp_cache（ON CONFLICT DO NOTHING）。

来源 spec/2026-04-25-ocr-cost-architecture-design.md §5.3-5.4 §6.2 §9.3。
```

---

### Task 2.5: teaching-sessions/messages hook（cost_log + 仅免费档计入 monthly meter）

**Files:**
- Modify: `src/app/api/teaching-sessions/[sessionId]/messages/route.ts`

**Recommended dispatch:** Codex（轻量档；route 末尾追加一段 hook 即可）

**Acceptance criteria:**
- 现有 retry chain 跑完后（成功响应给前端前），调 recordCost
- callType：根据 user.tier — `free` → `teaching_free` / `premium` → `teaching_premium`
- monthly meter 累加：仅 teaching_free 计入（spec §2.2 + §5.5）；premium 走 Anthropic 独立 billing
- token usage 取 ai-sdk response.usage

> **MVP 兜底说明**（spec §5.5 + 现状 `src/lib/entitlement.ts:7` 注释 "MVP 所有用户永远 premium"）：当前 `getUserTier()` 硬编码返回 `'premium'`，所以本 task 落地后 100% 教学调用会被分类成 `teaching_premium`（独立 Anthropic billing，不计 monthly_cost_meter）。这是有意为之 —— 教学护城河保留 Sonnet。M5+ 接订阅系统后 `getUserTier` 改为读 users.tier，DeepSeek-free 路由才真正生效。本 task 实现保持完整（不要为了"现在用不到"裁掉 free 分支），等订阅一接上就工作。

- [ ] **Step 1: 派 Codex 在 messages 路由末尾 hook**（伪代码）

```typescript
// 在 ai-sdk generateObject / generateText 调用之后
const tier = await getUserTier(userId) // 已有 helper
const callType: CallType = tier === 'premium' ? 'teaching_premium' : 'teaching_free'
const costYuan = computeMessageCost(modelId, response.usage)
void recordCost({
  bookId: null,
  userId,
  callType,
  model: modelId,
  inputTokens: response.usage.promptTokens,
  outputTokens: response.usage.completionTokens,
  costYuan,
}).catch((err) => logAction('teaching_cost_log_failed', String(err), 'error'))
```

`computeMessageCost` 复用 cost-estimator 的定价表 lookup（按 model + token usage 实算）。

- [ ] **Step 2: Commit**

```
feat(m4.7/D1): teaching-sessions/messages —— cost_log 写入

每次教学对话后写 cost_log；free tier 计入 monthly_cost_meter；premium tier
独立 Anthropic billing 不计入此 500 元上限。

来源 spec/2026-04-25-ocr-cost-architecture-design.md §2.2 §9.3。
```

---

### Task 2.6: scan-pdf-waitlist 端点（邮箱收集）

**Files:**
- Create: `src/app/api/email-collection/scan-pdf-waitlist/route.ts`

**Recommended dispatch:** Codex（轻量档；纯 INSERT 端点）

**Acceptance criteria:**
- 不需要 requireUser（拒绝场景用户可能未注册）
- 入 `{ email, rejectReason, bookFilename?, bookSizeBytes? }`，简单 zod 校验
- INSERT email_collection_list
- 返回 `{ ok: true }`

- [ ] **Step 1: 实现**

```typescript
import { z } from 'zod'
import { run } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'

const RequestSchema = z.object({
  email: z.string().email(),
  rejectReason: z.enum(['scanned_pdf', 'too_large', 'too_many_pages', 'too_many_slides', 'unsupported_type']),
  bookFilename: z.string().max(255).optional(),
  bookSizeBytes: z.number().int().nonnegative().optional(),
})

export const POST = handleRoute(async (req) => {
  const body: unknown = await req.json()
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    throw new UserError(
      parsed.error.issues[0]?.message ?? 'Invalid request',
      'INVALID_REQUEST',
      400
    )
  }
  const { email, rejectReason, bookFilename, bookSizeBytes } = parsed.data

  await run(
    `INSERT INTO email_collection_list (email, reject_reason, book_filename, book_size_bytes)
     VALUES ($1, $2, $3, $4)`,
    [email, rejectReason, bookFilename ?? null, bookSizeBytes ?? null]
  )

  await logAction('email_collected', `email=${email}, reason=${rejectReason}`)
  return { data: { ok: true } }
})
```

- [ ] **Step 2: Commit**

```
feat(m4.7/D0): scan-pdf-waitlist 端点 —— 拒绝时邮箱收集

POST /api/email-collection/scan-pdf-waitlist 接 email + rejectReason +
bookFilename + bookSizeBytes，INSERT email_collection_list；不需要登录。
launch list 用于众筹早鸟池 + 抖音引流硬通货。

来源 spec/2026-04-25-ocr-cost-architecture-design.md §7.2 §9.1。
```

---

### Task 2.7: cron monthly-cost-reset 端点

**Files:**
- Create: `src/app/api/cron/monthly-cost-reset/route.ts`

**Recommended dispatch:** Codex（轻量档；定时任务模式）

**Acceptance criteria:**
- 仅 GET（Vercel cron 默认 GET）
- 鉴权：用 Vercel cron secret（`process.env.CRON_SECRET`，header `x-vercel-cron-secret` 或 query `?secret=`）
- 该端点本身不做"reset"——直接读当月 meter 行总结后发月度报告邮件，UPSERT 行为已经是月初新行（year_month 不同）
- 同时 alert 上月触顶（如果 alert_80_sent=true 但月度未发月度报告）→ 发"上月预算 X 元，本月 reset" 邮件给 BUDGET_ALERT_EMAIL
- 月初 1 号 0:00 北京 = UTC 16:00 前一天 / 实际 cron `0 16 1 * *`（spec §11.4 已 lock）

- [ ] **Step 1: 实现**

```typescript
import { handleRoute } from '@/lib/handle-route'
import { queryOne } from '@/lib/db'
import { sendBudgetAlertEmail } from '@/lib/services/budget-email-alert'
import { UserError } from '@/lib/errors'
import { logAction } from '@/lib/log'

export const GET = handleRoute(async (req) => {
  // Vercel cron 鉴权
  const cronSecret = req.headers.get('x-vercel-cron-secret')
  if (cronSecret !== process.env.CRON_SECRET) {
    throw new UserError('Unauthorized', 'UNAUTHORIZED', 401)
  }

  // 找上月 year_month
  const now = new Date()
  const beijing = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  // 当前已是新月度首日，所以"上月"是当前月份 -1
  let lastYear = beijing.getUTCFullYear()
  let lastMonth = beijing.getUTCMonth() // 0-11，已经是当月
  if (lastMonth === 0) { lastYear -= 1; lastMonth = 12 } else { /* lastMonth 已是 1-based 上月 */ }
  const lastYm = `${lastYear}-${String(lastMonth).padStart(2, '0')}`

  // 上月数据
  const lastMeter = await queryOne<{ total_cost_yuan: string; alert_80_sent: boolean }>(
    `SELECT total_cost_yuan, alert_80_sent FROM monthly_cost_meter WHERE year_month = $1`,
    [lastYm]
  )

  if (lastMeter) {
    await sendBudgetAlertEmail({
      yearMonth: lastYm,
      spent: Number(lastMeter.total_cost_yuan),
      threshold: Number(process.env.MONTHLY_BUDGET_TOTAL ?? '500') * 0.8,
      total: Number(process.env.MONTHLY_BUDGET_TOTAL ?? '500'),
      severity: lastMeter.alert_80_sent ? 'warning' : 'warning',
    })
  }

  await logAction('monthly_cost_reset_cron', `lastYm=${lastYm}, sent=${!!lastMeter}`)
  return { data: { ok: true, reportedFor: lastYm } }
})
```

- [ ] **Step 2: Commit**

```
feat(m4.7/D1): monthly-cost-reset cron —— 月度报告邮件

每月 1 号 0:00 北京（cron `0 16 1 * *` UTC）触发；查上月 monthly_cost_meter
发月度账单邮件给 BUDGET_ALERT_EMAIL；新月度自动用新 year_month UPSERT。

来源 spec/2026-04-25-ocr-cost-architecture-design.md §2.2 §11.4。
```

---

### Task 2.8: cron abuse-alert 端点

**Files:**
- Create: `src/app/api/cron/abuse-alert/route.ts`

**Recommended dispatch:** Codex（轻量档；GROUP BY 查询 + 邮件 + flag 更新）

**Acceptance criteria:**
- 每日 UTC 0:00 触发（cron `0 0 * * *`）
- 查 book_uploads_log GROUP BY user_id WHERE created_at > NOW() - INTERVAL '30 days' HAVING count > 5
- 对每个命中：标记 users.suspicious_flag=TRUE + 发 sendAbuseAlertEmail
- 不阻断用户操作（unprivileged review）

- [ ] **Step 1: 实现**

```typescript
import { handleRoute } from '@/lib/handle-route'
import { query, run } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { logAction } from '@/lib/log'
import { sendAbuseAlertEmail } from '@/lib/services/budget-email-alert'

export const GET = handleRoute(async (req) => {
  const cronSecret = req.headers.get('x-vercel-cron-secret')
  if (cronSecret !== process.env.CRON_SECRET) {
    throw new UserError('Unauthorized', 'UNAUTHORIZED', 401)
  }

  const offenders = await query<{ user_id: number; cnt: string; email: string }>(
    `SELECT bul.user_id, COUNT(*)::TEXT AS cnt, u.email
     FROM book_uploads_log bul
     JOIN users u ON u.id = bul.user_id
     WHERE bul.created_at > NOW() - INTERVAL '30 days'
       AND u.suspicious_flag = FALSE
     GROUP BY bul.user_id, u.email
     HAVING COUNT(*) > 5`
  )

  for (const row of offenders) {
    await run(`UPDATE users SET suspicious_flag = TRUE WHERE id = $1`, [row.user_id])
    await sendAbuseAlertEmail({
      userId: row.user_id,
      userEmail: row.email,
      monthlyUploadCount: Number(row.cnt),
    })
  }

  await logAction('abuse_alert_cron', `flagged=${offenders.length}`)
  return { data: { ok: true, flaggedCount: offenders.length } }
})
```

- [ ] **Step 2: Commit**

```
feat(m4.7/D7): abuse-alert cron —— 单用户月度 >5 本告警

每日 UTC 0:00 扫 book_uploads_log GROUP BY user_id HAVING > 5；命中即
标 users.suspicious_flag=TRUE + sendAbuseAlertEmail，不自动停服由人工 review。

来源 spec/2026-04-25-ocr-cost-architecture-design.md §7.5 §11.2。
```

---

### Task 2.9: vercel.json cron 配置

**Files:**
- Modify: `vercel.json`（如不存在则 create）

**Recommended dispatch:** Codex（轻量档；纯配置）

- [ ] **Step 1: 改 vercel.json**

```json
{
  "crons": [
    {
      "path": "/api/cron/monthly-cost-reset",
      "schedule": "0 16 1 * *"
    },
    {
      "path": "/api/cron/abuse-alert",
      "schedule": "0 0 * * *"
    }
  ]
}
```

注：Vercel Hobby plan 限 daily cron（每天最多 1 次，但月度 1 号执行也算 daily）。需在 Vercel Dashboard 验证 Hobby 配额。Pro plan 才支持任意 cron。如果 Hobby 不支持 monthly cron，降级方案：用每日 cron 在路由内部 if 当日 == 1 + 时区检查。

- [ ] **Step 2: Commit**

```
chore(m4.7/D1+D7): vercel.json 加 cron schedule

monthly-cost-reset @ 0 16 1 * * UTC（=北京 1 号 0:00）；
abuse-alert @ 0 0 * * * UTC。
```

---

## Phase 3 — PPT 解析（约 1 工作日）

### Task 3.1: pptx_parser.py 部署到 OCR server

**Files:**
- Create: `scripts/pptx_parser.py`
- Modify: `scripts/ocr_server.py`（加 `/parse-pptx` 端点）
- Modify: `Dockerfile.ocr`（line 6 内联 pip install 末尾追加 `python-pptx==0.6.23`；项目无 requirements.txt 文件）

**Recommended dispatch:** Codex（标准档；Python 改动）

**Decision**：与 OCR server 共部署（spec §13.2 #1 plan 阶段定）— 理由：
- 已有 Cloud Run 服务，加端点不需要新基础设施
- python-pptx 体积小（<5MB），不会显著增加 Docker image
- 鉴权链路（IAM + X-App-Token）已搭好

**Acceptance criteria:**
- `/parse-pptx { r2_object_key, book_id }` POST 端点（与 /classify-pdf 等同模式）
- 用 python-pptx 抽 text frames + tables + notes（**不抽 picture 元素**）
- 按幻灯片顺序输出 `{ slides: [{ index, title, body, notes }], slide_count, raw_text }`
- raw_text 用 `--- SLIDE N ---` 分隔（与 PDF `--- PAGE N ---` 一致风格）
- slide_count > 200 直接返 4xx + reject_reason='too_many_slides'

- [ ] **Step 1: 写 pptx_parser.py**

```python
# scripts/pptx_parser.py
from pptx import Presentation
from io import BytesIO

def parse_pptx(buffer: bytes) -> dict:
    prs = Presentation(BytesIO(buffer))
    slides = []
    raw_parts = []
    for idx, slide in enumerate(prs.slides, start=1):
        title = ''
        body_parts = []
        notes = ''
        if slide.shapes.title:
            title = slide.shapes.title.text or ''
        for shape in slide.shapes:
            if shape == slide.shapes.title:
                continue
            if shape.has_text_frame:
                body_parts.append(shape.text_frame.text)
            elif shape.has_table:
                for row in shape.table.rows:
                    for cell in row.cells:
                        body_parts.append(cell.text_frame.text)
            # 跳过 picture 元素（spec §7.1 PPT 嵌入图片 OCR 不做）
        if slide.has_notes_slide:
            notes = slide.notes_slide.notes_text_frame.text or ''
        body = '\n'.join(body_parts).strip()
        slides.append({'index': idx, 'title': title, 'body': body, 'notes': notes})
        raw_parts.append(f'--- SLIDE {idx} ---\n# {title}\n\n{body}\n\nNOTES: {notes}')
    return {
        'slides': slides,
        'slide_count': len(slides),
        'raw_text': '\n\n'.join(raw_parts),
    }
```

- [ ] **Step 2: 在 ocr_server.py 加 /parse-pptx 端点**

```python
# scripts/ocr_server.py 追加
from pptx_parser import parse_pptx

MAX_PPTX_SLIDES = 200

@app.route('/parse-pptx', methods=['POST'])
def parse_pptx_endpoint():
    _require_bearer(request)
    body = request.get_json()
    object_key = body.get('r2_object_key')
    book_id = body.get('book_id')
    if not object_key or not book_id:
        return {'error': 'missing fields'}, 400
    buffer = _download_r2(object_key)
    result = parse_pptx(buffer)
    if result['slide_count'] > MAX_PPTX_SLIDES:
        return {'error': 'too_many_slides', 'slide_count': result['slide_count']}, 400
    return result
```

- [ ] **Step 3: Dockerfile.ocr 加 python-pptx 依赖**

项目当前无 `requirements.txt`；`Dockerfile.ocr` line 6 是单行内联 `pip install`：

```dockerfile
# 现状（line 6）：
RUN pip install flask PyMuPDF pymupdf4llm Pillow numpy boto3 google-cloud-vision sentry-sdk requests

# 改为（末尾追加 python-pptx==0.6.23）：
RUN pip install flask PyMuPDF pymupdf4llm Pillow numpy boto3 google-cloud-vision sentry-sdk requests python-pptx==0.6.23
```

> 不创建 `requirements.txt` —— 与 OCR 镜像现状保持一致；后续若依赖再多可考虑迁，本次最小改动。

- [ ] **Step 4: 部署 Cloud Run（push trigger Cloud Build → 自动 deploy）**

Run: `git push` 后等 Cloud Build 自动 build + deploy（M4.6 T16 已配 cloudbuild.ocr.yaml）

Expected: Cloud Run revision 新版上线 + `/parse-pptx` 端点可达

- [ ] **Step 5: Commit**

```
feat(m4.7/D0-PPT): scripts/pptx_parser.py + /parse-pptx 端点

python-pptx 抽 text_frames + tables + notes（跳过 picture 元素），按
SLIDE 序号分隔生成 raw_text；slide_count > 200 拒；与 OCR server 共部署
（IAM + X-App-Token 鉴权链复用）。

来源 spec/2026-04-25-ocr-cost-architecture-design.md §7.1。
```

---

### Task 3.2: confirm 路由 PPT 分支（Task 2.2 占位补全）

**Files:**
- Modify: `src/app/api/books/confirm/route.ts`
- Create: `src/lib/pptx-parse.ts`（封装 OCR server /parse-pptx 调用）

**Recommended dispatch:** Codex（标准档；contentType 分支 + service 调用）

**Acceptance criteria:**
- `parsePptx(objectKey, bookId): Promise<{ slides, slideCount, rawText }>` 调用 Cloud Run /parse-pptx（用现有 ocr-auth.ts buildOcrHeaders）
- handlePptxConfirm 路径：
  - parsePptx → slide_count > 200 → 直接拒（虽然 server 也拒，但 client side 也拦保险）
  - cache lookup（fileMd5, slideCount as pageCount, 'zh'）→ hit 走 applyCacheToBook 路径
  - miss → 写 books（raw_text 直接填入；不需要 OCR 链路）→ 触发 KP 提取（直接 triggerReadyModulesExtraction，跳过 classify + extract-text）
  - quota 减扣
- PPT 不需要 cost-estimator 拦截（slide_count 200 上限已经限定 token 量在 2K-3K 内）

- [ ] **Step 1: 实现 pptx-parse.ts**

```typescript
// src/lib/pptx-parse.ts
import { buildOcrHeaders } from '@/lib/ocr-auth'

export interface PptxParseResult {
  slides: Array<{ index: number; title: string; body: string; notes: string }>
  slideCount: number
  rawText: string
}

export async function parsePptx(objectKey: string, bookId: number): Promise<PptxParseResult> {
  const url = `${process.env.OCR_SERVER_URL}/parse-pptx`
  const headers = await buildOcrHeaders(url)
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ r2_object_key: objectKey, book_id: bookId }),
  })
  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`parsePptx failed status=${res.status}: ${errBody}`)
  }
  const data = await res.json()
  return {
    slides: data.slides,
    slideCount: data.slide_count,
    rawText: data.raw_text,
  }
}
```

- [ ] **Step 2: handlePptxConfirm 实现**（compose 进 Task 2.2 的 confirm route.ts）

伪代码（Codex 补全）：

```typescript
async function handlePptxConfirm({ bookId, userId, objectKey, title, fileMd5 }) {
  const { slideCount, rawText } = await parsePptx(objectKey, bookId)
  if (slideCount > 200) {
    throw new UserError(`PPT 张数 ${slideCount} 超过 200 张上限`, 'TOO_MANY_SLIDES', 400)
  }

  // cache lookup
  const cache = await lookupCache(fileMd5, slideCount, 'zh')
  if (cache.hit) {
    await run(`UPDATE books SET file_md5=$1, cache_hit=TRUE, upload_status='confirmed', title=$2, raw_text=$3 WHERE id=$4`,
      [fileMd5, title, rawText, bookId])
    await applyCacheToBook(bookId, cache.payload, fileMd5)
    const consumed = await consumeQuotaAndLogUpload(userId, bookId)
    if (!consumed) throw new UserError('额度同时被消耗', 'QUOTA_RACE', 409)
    return { data: { bookId, processing: false, cacheHit: true } }
  }

  // miss — 写 books with rawText + 直接触发 KP（无 OCR 链路）
  await run(
    `UPDATE books SET file_md5=$1, upload_status='confirmed', parse_status='done', title=$2, raw_text=$3 WHERE id=$4`,
    [fileMd5, title, rawText, bookId]
  )
  // 建模块（Codex 跑现有 chunkText + INSERT modules 流程，但跳过 classifier）
  // 然后 triggerReadyModulesExtraction(bookId)
  const { triggerReadyModulesExtraction } = await import('@/lib/services/kp-extraction-service')
  // ... 模块拆分 + 写 modules（参考 src/app/api/books/route.ts 的 chunkText 用法）
  after(async () => {
    try {
      await triggerReadyModulesExtraction(bookId)
    } catch (err) {
      await logAction('pptx_kp_trigger_failed', `bookId=${bookId}: ${String(err)}`, 'error')
    }
  })

  const consumed = await consumeQuotaAndLogUpload(userId, bookId)
  if (!consumed) throw new UserError('额度同时被消耗', 'QUOTA_RACE', 409)

  await logAction('book_confirmed_pptx', `bookId=${bookId}, md5=${fileMd5}, slides=${slideCount}`)
  return { data: { bookId, processing: true } }
}
```

- [ ] **Step 3: Commit**

```
feat(m4.7/D0-PPT): confirm 路由 PPT 分支 + pptx-parse 服务

调用 OCR server /parse-pptx 抽文本 + slide_count；> 200 拒；cache lookup
hit 复用 modules + KPs；miss 直接写 books raw_text + 触发 KP 提取（跳过
classifier + OCR）；quota 减扣。

来源 spec/2026-04-25-ocr-cost-architecture-design.md §7.1 §9.2。
```

---

## Phase 4 — 前端（约 1 工作日）

### Task 4.1: upload page 客户端校验扩展

**Files:**
- Modify: `src/app/upload/page.tsx`

**Recommended dispatch:** Gemini（标准档；UI 状态 + client validate）

**Acceptance criteria:**
- 文件类型 input accept 加 `.pptx`：`accept=".pdf,.txt,.pptx"`
- size 上限 client 校验 10 MB（spec D0 lock，从 50 MB 改）
- 上传时根据 file.type 决定 contentType 字段（pdf vs pptx）
- 错误态对接 ScanPdfRejectionModal（Task 4.2）：当后端返回 4xx + rejectReason 时显示 modal 而非简单 alert
- TXT 分支保留（仍走 `POST /api/books`）

- [ ] **Step 1: 派 Gemini 改 upload page**

提供完整 dispatch unit 含期望状态机变更：
- 6 态状态机扩展：增加 `rejected` 状态 → 显示 ScanPdfRejectionModal
- onError handler：捕获 4xx + rejectReason 后切到 rejected 态

- [ ] **Step 2: Commit**

```
feat(m4.7/D0+D7): upload page —— .pptx 白名单 + 10MB 上限 + reject modal

accept 加 .pptx；client size 校验 10MB；4xx + rejectReason 切到 rejected 态
打开 ScanPdfRejectionModal；保留 TXT 分支走旧 /api/books 路径。

来源 spec/2026-04-25-ocr-cost-architecture-design.md §7.1。
```

---

### Task 4.2: ScanPdfRejectionModal 组件

**Files:**
- Create: `src/components/upload/ScanPdfRejectionModal.tsx`

**Recommended dispatch:** Gemini（标准档；新组件 + Modal 复用）

**Acceptance criteria:**
- 基于现有 Modal 组件（M4 已有 `src/components/ui/Modal.tsx` 或类似）
- 文案（spec §7.2）："📚 检测到这是扫描版 PDF（图像式）。我们目前还在打磨大型扫描书的识别能力，**留下邮箱**，开放第一时间通知你 + 众筹支持者享受**早鸟解锁特权**。〔输入邮箱〕〔我先用电子版试试〕"
- email 表单 + 提交按钮（disabled until 输入合法 email）
- 提交 → POST /api/email-collection/scan-pdf-waitlist → 显示成功 / 关闭 modal
- 关闭按钮："我先用电子版试试" → 关闭 modal 回到上传页

- [ ] **Step 1: 派 Gemini 实现**

- [ ] **Step 2: Commit**

```
feat(m4.7/D0): ScanPdfRejectionModal —— 拒绝弹窗 + 邮箱收集

Amber Companion 风格 Modal；文案对接 spec §7.2；email 校验 + POST
/api/email-collection/scan-pdf-waitlist；"我先用电子版试试" 关闭 modal。

来源 spec/2026-04-25-ocr-cost-architecture-design.md §7.2。
```

---

### Task 4.3: QuotaIndicator 组件

**Files:**
- Create: `src/components/upload/QuotaIndicator.tsx`

**Recommended dispatch:** Gemini（轻量档；纯展示组件）

**Acceptance criteria:**
- props：`{ remaining: number; total: number }`
- 显示 "剩余上传额度 X 本" + 视觉化 dots（已用 vs 剩余）
- 当 remaining=0 显示 "已用完，邀请好友 +1 本" + 邀请码生成 CTA（M5+ 实现，MVP 先 placeholder）
- 上传页顶部 mount

- [ ] **Step 1: 派 Gemini**（需先在 upload page 拉 user 数据 / 加 GET /api/me 扩字段 book_quota_remaining）

- [ ] **Step 2: Commit**

```
feat(m4.7/D7): QuotaIndicator 组件 —— 显示剩余上传额度

upload page 顶部 mount；remaining=0 显示邀请 CTA placeholder；视觉化
dots 已用/剩余对比。

来源 spec/2026-04-25-ocr-cost-architecture-design.md §7.3。
```

---

### Task 4.4: CacheHitBadge 组件（社交信号）

**Files:**
- Create: `src/components/book/CacheHitBadge.tsx`

**Recommended dispatch:** Gemini（轻量档；小展示组件）

**Acceptance criteria:**
- props：`{ hitCount: number }`
- 文案 "✓ 已为 N 个同学解析过这本书"（hitCount > 0 才显示）
- 视觉：绿色 / Amber Companion 风格
- mount 位置：preparing 页 + Action Hub（书首页）顶部

- [ ] **Step 1: 派 Gemini**

API 数据来源：`GET /api/books/[id]/status` 扩 cache_hit + cache_hit_count 字段（前端拉同一份 status payload，无需新端点）

- [ ] **Step 2: Commit**

```
feat(m4.7/D6): CacheHitBadge —— "已为 N 同学解析过" 社交信号

preparing 页 + Action Hub 顶部 mount；从 GET /api/books/[id]/status 拉
cache_hit_count；hitCount > 0 才显示，视觉化 GitHub stars 风格。

来源 spec/2026-04-25-ocr-cost-architecture-design.md §6.5。
```

---

## Phase 5 — Env + 模型切换 + 回归测试（约半工作日）

### Task 5.1: Vercel env 配置

**Files:**
- Vercel API（用户授权 Claude 自助操作 — 见 memory `feedback_vercel-self-service.md`）

**Recommended dispatch:** Claude 自助（用 .ccb/ 已有 Vercel API helper）

**Acceptance criteria:**
- 新增 env 4 条：
  - `DEEPSEEK_API_KEY`（用户从 platform.deepseek.com 申请后给 Claude 写）
  - `DASHSCOPE_API_KEY`（用户从 dashscope.console.aliyun.com 申请）
  - `RESEND_API_KEY`（用户从 resend.com 申请，否则 budget alert 降级 console）
  - `CRON_SECRET`（Claude 用 `crypto.randomBytes(32).toString('hex')` 生成）
- 修改 env 4 条：
  - `AI_MODEL` `google:gemini-2.5-pro` → `deepseek:deepseek-chat`
  - `AI_MODEL_FALLBACK` （新增）`qwen:qwen3-max`
  - `MONTHLY_BUDGET_PER_BOOK` （新增）`1.5`
  - `MONTHLY_BUDGET_TOTAL` （新增）`500`
  - `BUDGET_ALERT_EMAIL` （新增）`zs2911@nyu.edu`
- 备份当前 env 到 `.ccb/vercel-env-backup-2026-04-25.json`（已有 backup pattern）

- [ ] **Step 1: backup 当前 env**
- [ ] **Step 2: 等用户提供 DEEPSEEK_API_KEY + DASHSCOPE_API_KEY + RESEND_API_KEY**（这三个必须用户从外部账户拿）
- [ ] **Step 3: Claude 用 Vercel API 写新 env**
- [ ] **Step 4: redeploy（推 commit 触发自动 redeploy）**
- [ ] **Step 5: 验证 env 落地（vercel env ls）**

---

### Task 5.2: KP 回归测试（≥3 本中文教材）

**Files:**
- Create: `scripts/kp-regression-test.ts`（一次性脚本）

**Recommended dispatch:** Codex（标准档；测试脚本）

**Acceptance criteria:**
- fixture 选 3 本：(a) 文字版中文经济学教材（Mankiw 中文版） (b) 文字版中文计算机教材 (c) 文字版中文文科教材（哲学 / 政治）
- 每本跑：`extractModule` × 4 modules → 检查 (a) JSON parse 成功率 100% (b) 每 module KP 数量 ≥ 5 (c) 4 个 type 覆盖（factual/conceptual/procedural/analytical/evaluative）
- 对比 Gemini Pro baseline diff（之前已存的 KP）
- 失败 → 自动 fallback Qwen 重跑 → 仍失败 ROLLBACK 到 Gemini Flash

- [ ] **Step 1: 派 Codex 写测试脚本**
- [ ] **Step 2: 跑回归 → 人工抽查 10 KP 是否合理**
- [ ] **Step 3: Commit 测试脚本（不上 production）**

---

### Task 5.3: 教学回归测试（5 角色 × 10 对话）

**Recommended dispatch:** 用户人工跑（Codex 写脚手架）

**Acceptance criteria:**
- 5 阶段（factual/conceptual/procedural/analytical/evaluative）每阶段 10 个对话样本
- DeepSeek free 档对话连贯性 ≥ 7/10（人工评分）
- 比 Gemini Flash-Lite baseline 不退化
- 所有 status 字段（teaching/ready_to_advance/struggling）覆盖到

- [ ] **Step 1: Codex 写脚手架（自动跑 50 个对话 + 输出 JSON 结果文件）**
- [ ] **Step 2: 用户人工抽查 50 个回答**
- [ ] **Step 3: 不达标 → 走 fallback chain（Qwen3-Max free 档）+ 调 prompt（spec §5.3 prompt 不重写但 prompt_templates 可微调）**

---

### Task 5.4: 部署 + smoke test

**Recommended dispatch:** Claude（用户授权一条龙）

**Acceptance criteria:**
- master commit push → Vercel 自动 redeploy
- 跑 4 路径 smoke：
  - PDF 上传成功（cache miss）
  - PDF 上传成功（cache hit，重传同书）
  - PDF 上传被拒（>10MB / 扫描）→ ScanPdfRejectionModal 显示
  - .pptx 上传成功
- 验证 cost_log + monthly_cost_meter 写入正常
- 验证 quota -1 + book_uploads_log 写入正常

---

## Phase 6 — 收尾（约半工作日）

### Task 6.1: docs/architecture.md 同步（按 spec §附录 B）

**Recommended dispatch:** Claude（PM 职责，docs 改动 Claude 自己写）

**Acceptance criteria:**
- §摘要卡 表名清单加 5 张表
- §核心 API 加 3 端点（presign/confirm 改动 + scan-pdf-waitlist + cron 2 个）
- §⚠️ 核心约束加 D6 半全局共享 + D7 quota / suspicious_flag
- §AI 模型层加 DeepSeek + Qwen + ProviderModelId 类型扩展
- §错误处理 / 重试层加 fallback chain
- §教学护城河层加 premium-tier-locked 修正
- §部署层加 DEEPSEEK_API_KEY / DASHSCOPE_API_KEY / RESEND_API_KEY
- §成本控制层（新增章节）

- [ ] **Step 1: Claude 直接 Edit architecture.md**
- [ ] **Step 2: Commit**

```
docs(m4.7): architecture.md 同步 OCR 成本架构 7 决策

按 spec §附录 B 全量同步：5 张新表 / 3 新端点 / D6 D7 ⚠️ 约束 /
DeepSeek + Qwen 注册 / fallback chain / 教学护城河补丁 /
成本控制层（新增章节）。
```

---

### Task 6.2: docs/changelog.md + docs/project_status.md 更新

**Recommended dispatch:** Claude

- [ ] **Step 1: changelog.md 加 2026-04-25 entry**
- [ ] **Step 2: project_status.md 切到 M4.7 OCR 成本架构 in_progress / M4.6 closed**

---

### Task 6.3: 关闭 brainstorm 清理

**Recommended dispatch:** Claude（用户授权）

- [ ] **Step 1: 删 `MEMORY.md` 中 OCR Cost Brainstorm WIP pointer**
- [ ] **Step 2: 删 memory 文件 `project_ocr-cost-brainstorm-wip.md`**
- [ ] **Step 3: docs/memory-audit-log.md 追加 1 行 `op:delete | file:project_ocr-cost-brainstorm-wip.md | reason:brainstorm 完成`**
- [ ] **Step 4: WIP spec `2026-04-25-ocr-cost-brainstorm-state.md` **保留**（决策 trail 用，不删；可 archive 到独立目录或加"已完成"标记）**

---

## 5-Question Decision Recap（CLAUDE.md 强约束 — 决策 lock 时填，全部 lock）

> Spec §14 已有合表，此处复述并 plan 阶段刷新（D5 现在的代价 1-2 → 1.5 工作日）。

| 决策 | 它是什么 | 现在的代价 | 给我们带来什么 | 关闭哪些未来的门 | 选错后果 | 可逆性 |
|---|---|---|---|---|---|---|
| **D0 MVP 范围切割** | TXT + 文字版 PDF + .pptx / ≤10MB / ≤100 页 / ≤200 张 / 拒绝时收邮箱 | 半天 dispatch | OCR 成本归零 + 邮箱池营销资产 | 不服务"扫纸质书" + 不做 .ppt 旧格式 | 太严流失 / 太松烧钱 | 🟢 容易（改数字 / 白名单） |
| **D1 单本 1.5 / 月 500 元** | 系统级"刹车"超额自动拦 + 邮件告警 | 1 工作日 | break-even 防御 + 抖音引流可放心扩 | 偶尔超大教材会被拒 | 改 env 秒切 | 🟢 容易（环境变量） |
| **D2 100 用户 / 2 周** | 第一阶段抖音 / 小红书引流目标 | 0（数字） | 营销节奏 + 邀请码发放 + 缓存命中率验证 | 设大设小都不致命 | 看第一周数据调 | 🟢 极易 |
| **D5 KP 模型** | Gemini 全下线 → DeepSeek V3.2 + Qwen3-Max 备 + Sonnet 付费档不动 | **1.5 工作日**（含 ai.ts provider 首次注册） | 单本 7 元 → 0.7 元（10x 降本）+ Google 账户关停 | DeepSeek 64K 上下文 + 2026-07-24 EOL | 中文质量回归 → fallback Qwen | 🟡 中等（env 30min 切回，需 Google 充值激活） |
| **D6 缓存** | PDF MD5 全书级 + 半全局共享 + provider auto cache | 1 工作日 | 命中率 20-25% × 90% off → 月度再省 22% + 社交信号 | 章节级延后 M5+ | 命中率不达预期 → brainstorm 升粒度 | 🟢 容易（关 cache 查询） |
| **D7 上传额度 + 流控** | 首本免费 + 邀请 +1 / 1 小时 1 本 / >5 本告警 | 1-2 工作日 | 单人燃烧上限 + 邀请杠杆 + 异常早发现 | 已发邀请码不能撤回 | 调整需通知用户 | 🟡 中等 |

总工程量预估：**~7 工作日**（spec 估 ~5-6 工作日 + spec round 1 review +0.5 + plan reviewer 加 r2-client 整合 Task 0.4 +0.5）。Codex/Gemini 平行 dispatch 约 **4-5 自然日**（部分 task 可平行）。

---

## Execution Handoff

Plan 完成。**用户已授权 "一条龙全部你自己搞定"** —— 默认走 **Subagent-Driven Execution**：

- Phase 0-3：Codex 标准档（DB/Service/Route/PPT 后端） + Gemini Phase 4（4 UI 任务）— 各 task 用 task-execution skill dispatch + Full Review
- Phase 5 env 配置 + 部署：Claude 自助
- Phase 5 回归测试：Codex 写脚手架 + 用户人工抽查（必须用户参与，Claude 不能假冒抽查）
- Phase 6 docs 收尾：Claude 直接 Edit

**REQUIRED SUB-SKILL（plan 落地后转入）**: `superpowers:subagent-driven-development` 或 `task-execution`，按 task 维度 dispatch + 两阶段 review。

**关键依赖（先确保然后才能 Phase 5）**：
1. 用户去 platform.deepseek.com 申请 DEEPSEEK_API_KEY（5 分钟）
2. 用户去 dashscope.console.aliyun.com 申请 DASHSCOPE_API_KEY（10 分钟，需阿里云账号）
3. 用户去 resend.com 申请 RESEND_API_KEY + verify domain（30 分钟，可选；不配则 budget alert 降级 console.warn）

Phase 0-4 不依赖以上 secret，可以先行落地，Phase 5 切换前再补 secret。

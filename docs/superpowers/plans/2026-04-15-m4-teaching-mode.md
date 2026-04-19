---
date: 2026-04-15
topic: M4教学模式最小闭环
type: plan
status: in_progress
keywords: [M4, teaching-mode, teacher-AI, prompt, transcript]
last_patched: 2026-04-19
---

# M4 教学模式最小闭环 Implementation Plan

> **云化 patch（2026-04-19 round 4）**：本 plan 写于 2026-04-15 时假设本地 Docker，阶段 1/2 已上线后迁移到 Neon `m4-dev` 分支 + `npm run dev`。经四轮 agent review 修订：
>
> **L1 修（round 2）**：(1) 统一 env 加载为 `node --env-file=.env.local`（禁用 `export $(grep...)` 秘钥泄露路径 + 禁用 `psql "$DATABASE_URL"` 依赖）；(2) Task 1 DROP CONSTRAINT 改为 `pg_constraint` 动态 DO block（覆盖任意 PG 自动命名）；(3) Task 1 Step 1.1 补 prod 非 0 硬停 + 汇报路径；(4) Task 3 补 `books.learning_mode` / `preferred_learning_mode` 列（Task 12 依赖）+ 幂等性双跑 + 完整性 spot check；(5) Task 10 Step 10.4 改成 agent 可执行（无浏览器）：用 `/api/auth/login` + `-c ./.tmp-cookies.txt`，cookie 名统一为 `session_token`（源于 `src/lib/auth.ts:6`）；(6) Task 18 Step 18.2 状态枚举修正（`'teaching' | 'ready_to_advance' | 'struggling'`，移除伪造的 `'continue'` / `allClustersDone`）。
>
> **L2 修（round 3）**：(7) Task 12 加 Step 12.0a `learning_status` 枚举扩展——`VALID_STATUSES` + `VALID_TRANSITIONS` 加 `'taught'` / `'qa_in_progress'`（`modules.learning_status` 列无 DB CHECK，只需改应用层）；(8) Task 12 加 Step 12.0b `GET /api/modules/[moduleId]` endpoint（Task 17/19 依赖）；(9) Task 12 加 Step 12.0c `GET /api/modules/[moduleId]/clusters` endpoint（Task 18 跨 cluster 推进依赖，返回 `clusters[].kp_ids`）；(10) Task 12 Step 12.3 start-qa 明确 `qaSessionId = moduleId`（仓库无 `qa_sessions` 表，按既有 QA 系统 keyed by module）；(11) Task 12 Step 12.2 `'not_started'` → `'unstarted'`（匹配 schema default）；(12) Task 18 Step 18.2 重写跨 cluster 推进：每 cluster 一个 teaching_session + 完成态 PATCH `'taught'`。
>
> **Runtime 修（round 4，T0 实机验证发现）**：(13) 所有 `node --env-file=.env.local --experimental-strip-types scripts/*.ts` 命令换成 `npx tsx --env-file=.env.local scripts/*.ts`——Node 24 下原生 `--experimental-strip-types` 对 extensionless 内部 import（如 `from '../src/lib/xyz'`）报 ERR_MODULE_NOT_FOUND，`tsx` 走自己的 resolver 能处理；(14) 所有 `new Pool()` 无参构造改为 `new Pool({connectionString:process.env.DATABASE_URL})`——pg@8 的 `Pool()` 不会自动读 `DATABASE_URL`，会 fallback 到 `localhost:5432` 导致 `ECONNREFUSED`；(15) Step 0.2 Expected 放宽到 `PostgreSQL` 前缀（Neon 当前底层 PG 17.8，不是 plan 原写的 PG 16）。
>
> 原 docker 命令在 git 历史保留（commit before 2026-04-19）。

> **For agentic workers:** REQUIRED SUB-SKILL: 本项目采用 CCB 分派（Codex 后端 / Gemini 前端），按 `docs/ccb-protocol.md` 流程通过 `structured-dispatch` 下发。每个 task 是一次独立 dispatch。步骤用 checkbox (`- [ ]`) 跟踪进度。

**Goal:** 落地 M4 Phase 2 教学对话最小闭环的所有后端地基——schema 改动、teacher AI 角色 + 5 套 prompt、transcript JSONB 信封、cluster 推进判定、错误重试、entitlement 读取——使后续 UI 层（L2 决策）可以直接对接 API。

**Architecture:**
- Schema 走幂等 `src/lib/schema.sql`（CREATE TABLE IF NOT EXISTS + ALTER TABLE IF NOT EXISTS + DROP CONSTRAINT IF EXISTS）
- Teacher 作为第 6 个 AI 角色加入 `prompt_templates` 表，5 个 stage 对应 5 种 KP 类型教学法
- Prompt 三层：Layer 1（`src/lib/teacher-prompts.ts` TS 常量）+ Layer 2（DB 5 条模板）+ Layer 3（API route 运行时注入）
- Transcript 用 JSONB 信封 `{ version, state, messages }`；AI 每轮只返回增量 `{ status, kpTakeaway, message }`，API 层负责 merge
- 失败走 3 次指数退避重试（网络错 + Zod 校验错同路径），失败后 `state.lastError` 写库；对话状态保留不降级模型
- 前置硬依赖：KP type 枚举从旧 5 值迁移到新 5 值（父 spec §4.3）

**Tech Stack:** Next.js 15 App Router / TypeScript 严格模式 / PostgreSQL (pg 驱动) / Vercel AI SDK `ai@^6.0.141` 的 `generateObject` / **Zod（M4 首次引入）** / `node:test` + `tsx` 跑 `.ts` 测试脚本

**Design Spec:** `docs/superpowers/specs/2026-04-15-m4-teaching-mode-design.md`
**Parent Spec:** `docs/superpowers/specs/2026-04-12-teaching-system-design.md`

---

## Codebase 已验证事实（Codex 无需重复核实）

本 plan 编写前通过 `grep` / `Read` 实地核对下列事实；任何 task 若与此矛盾，以此节为准。

### 1. 关键模块导出清单

| 文件 | 实际导出（2026-04-15 核实） |
|------|------|
| `src/lib/db.ts` | `pool`（Pool 实例）、`query<T>(sql, params)`、`queryOne<T>(sql, params)`、`run(sql, params)`（返回 `QueryResult`）、`insert(sql, params)`（自动补 RETURNING id）、`initDb()`。**没有 `getPool()`。** |
| `src/lib/auth.ts` | `requireUser(request: Request): Promise<User>`（line 92，无 token/session 时 `throw new UserError('Unauthorized', 'UNAUTHORIZED', 401)`）、`requireBookOwner`、`requireModuleOwner`、`requireReviewScheduleOwner`、`hashPassword`、`verifyPassword`、`createSession`、`getUserFromSession`、`destroySession`、`getSessionCookieOptions`、`SESSION_COOKIE`。**没有 `getSessionUser`。** |
| `src/lib/ai.ts` | `AI_MODEL_ID`（字符串常量）、`timeout`（`300_000`）、`getModel()`（返回 default model）。**`registry` 当前是 module 作用域变量（line 57），未导出。Task 8 会追加 `export { registry }`。** |
| `src/lib/prompt-templates.ts` | `getActiveTemplate(role, stage)`（返回 `{id, role, stage, version, template_text, is_active}`；加 model 列后多一字段）、`renderTemplate(template, vars)`（`{var}` 占位替换）、`getPrompt(role, stage, vars)`、`upsertTemplate(role, stage, templateText)`（现签名；Task 7 加第 4 个参数 `model`）。**用 `run()` 和 `queryOne()`，不是 `db.query()`。** |
| `src/lib/seed-templates.ts` | `seedTemplates()`；内部常量 `INSERT_TEMPLATE_SQL`（line 458）、`UPSERT_TEMPLATE_SQL`（line 461）、`SEED_TEMPLATES: TemplateSeed[]`。`TemplateSeed` interface 当前 3 字段（`role`/`stage`/`template_text`）。`seedRoleTemplates(role)` 对单个 role UPSERT。 |

### 2. 关键数据库表实际列

| 表 | 列（2026-04-15 读 `src/lib/schema.sql` 得） |
|------|------|
| `clusters` | `id` (SERIAL PK) / `module_id` / `name` / `current_p_value` / `last_review_result` / `consecutive_correct` / `created_at`。**没有 `order_index`。** KP 列表排序用 `ORDER BY kp.id ASC`（或按 `kp_code`）。 |
| `knowledge_points` | `id` / `module_id` / `kp_code` / `section_name` / `description` / `type` / `importance` / `detailed_content` / `cluster_id` / `ocr_quality` / `created_at`。**没有 `name` 列、没有 `order_index` 列。**“KP 名称”场景用 `section_name` 或 `kp_code`，内容用 `description` 或 `detailed_content`。 |
| `prompt_templates` | 当前：`id` / `role` / `stage` / `version` / `template_text` / `is_active`，`UNIQUE(role, stage, version)`。Task 3 将追加 `model TEXT NULL` 列。ON CONFLICT 子句可直接引用此 UNIQUE 约束。 |
| `users` | 有 `id SERIAL PK`、`email` 等。`teaching_sessions.user_id` / `user_subscriptions.user_id` 均 `REFERENCES users(id)`。 |

### 3. 运行时环境（云化；2026-04-19 patch — 阶段 1/2 已上线）

本机已无 Docker 依赖。M4 dev loop 走 Neon `m4-dev` 分支（与 prod main 分支隔离）+ 本地 `npm run dev`。Task 结束 `git push` 到 master → Vercel 自动部署到 prod；`initDb()` 启动时幂等 apply `schema.sql` + seed 模板。

| 项 | 值 |
|------|------|
| DB 连接 | Neon `m4-dev` 分支 connection string（`postgresql://...@ep-xxx-pooler...neon.tech/neondb?sslmode=require`），存 `.env.local` 的 `DATABASE_URL`。`.env*` 在 `.gitignore`。**不再用 docker compose db / dev:dev / localhost:5432。** |
| 本地跑脚本 | **唯一推荐**：`npx tsx --env-file=.env.local scripts/<name>.ts`（Node 20.6+ 原生读 `.env.local` + 直跑 `.ts`，变量只注入子进程）。**禁止** `export $(grep -v '^#' .env.local \| xargs)`——秘钥里含 `=` / `+` / `/`（R2 密钥、JWT、proxy URL 常见）会被 shell 再展开或 word-split，在 CI/审计日志泄露。 |
| 起 Next.js dev server | `npm run dev`（自动读 `.env.local`；启动触发 `initDb()` → apply `schema.sql` + seed 6 role 模板到 Neon m4-dev 分支） |
| 只 apply schema | `npx tsx --env-file=.env.local scripts/init-neon-schema.ts`（既有脚本；**不** seed 模板，只应用 `src/lib/schema.sql`，幂等） |
| 重新 seed 模板到 DB | 重启 `npm run dev`（initDb 内部调 seedTemplates；Turbopack hot reload **不** 重新跑 initDb，必须 Ctrl+C + `npm run dev`） |
| DB 查询验证 | **唯一推荐**：`node --env-file=.env.local -e "const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query('<SQL>').then(r=>console.log(JSON.stringify(r.rows,null,2))).catch(e=>{console.error(e);process.exit(1)}).finally(()=>p.end())"`（无 shell 展开风险，不依赖 psql 安装）。**备选**：Neon Dashboard → m4-dev 分支 → SQL Editor 手动贴查询（本 plan 的自动化 step 不走这条）。**禁止** `psql "$DATABASE_URL" -c "..."`——需要本机装 psql + 需要 shell 能正确展开 `$DATABASE_URL`（Windows Git Bash 对含 `@` / `?` / `&` 的 URL 常出问题）。 |
| `gen_random_uuid()` 前提 | 必须 `CREATE EXTENSION IF NOT EXISTS pgcrypto`。当前 `schema.sql` **没有这行**，Task 3 会加。Neon 默认允许 pgcrypto。 |
| Commit 策略 | 每个 Task 直接推 master（单人 + CCB 串行，出问题 `git revert`）。push 后 Vercel 自动部署 prod；schema changes 均为幂等 additive（`ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` / `DROP CONSTRAINT IF EXISTS`），对 prod 安全。Task 1 动 `knowledge_points.type` 约束前需确认 prod 该表 COUNT=0（父 spec §4.3 line 217 已 asserted，Task 1 Step 1.1 再验）。 |

### 4. 关键版本

| 包 | 当前版本 | 备注 |
|------|------|------|
| `ai` | `^6.0.141` | `generateObject` 的 `usage` 形状为 `{ inputTokens, outputTokens }`（不是 `promptTokens` / `completionTokens`）。TypeValidationError 运行时实例 `.name === 'AI_TypeValidationError'`。 |
| `@ai-sdk/anthropic` | `^3.0.64` | 与 `ai@6` 兼容 |
| `@ai-sdk/google` | `^3.0.53` | 同上 |
| `@ai-sdk/openai` | `^3.0.48` | 同上 |
| `zod` | **未安装** | Task 2 首次引入，装 `zod@^3`（AI SDK v6 用 Zod 3 Standard Schema） |

### 5. 既有旧 KP type 值的硬编码位置

`seed-templates.ts` 内 extractor 模板模板文本硬写了旧 5 值，必须同步更新（Task 1）：
- line 82-87：`- position` / `- calculation` / `- c1_judgment` / `- c2_evaluation` / `- definition`
- line 115：`"type": "position|calculation|c1_judgment|c2_evaluation|definition"`
- line 186：同格式重复出现
- line 271 / 280 / 353 / 380：`single_choice` / `essay` 等——**属于 `exam_questions.question_type`，语义不同，保留不动**

---

## 文件清单（Codex 实施时的全景）

### 新建文件

| 路径 | 责任 |
|------|-----|
| `src/lib/teaching-types.ts` | `TranscriptV1` / `TranscriptMessage` TS 类型，跨前后端复用 |
| `src/lib/teacher-prompts.ts` | Layer 1 共享规则常量（7 块） + `TranscriptOutputSchema` Zod schema + `buildTeacherMessages` 组装函数 |
| `src/lib/teacher-model.ts` | `tierModelMap` + `getTeacherModel(tier, override)` |
| `src/lib/entitlement.ts` | MVP 占位 `getUserTier(userId): Promise<Tier>`（永远返回 `'premium'`） + `canUseTeaching(userId)`（父 spec §6 命名） |
| `src/lib/retry.ts` | `retryWithBackoff(fn, opts)` + `classifyError(e)` 分类 retryable vs 永久 |
| `src/app/api/teaching-sessions/route.ts` | `POST` 创建 session；返回 `{ sessionId, transcript }` |
| `src/app/api/teaching-sessions/[sessionId]/messages/route.ts` | `POST` 发消息；内部 retry + `generateObject` + merge + 写 DB |
| `scripts/test-m4-task1-kp-migration.ts` | Task 1 验证脚本（`.ts`，用 `tsx` 跑） |
| `scripts/test-m4-task3-schema.ts` | Task 3 验证脚本 |
| `scripts/test-m4-task4-retry.ts` | Task 4 验证脚本 |
| `scripts/test-m4-task10-messages-api.ts` | Task 10 端到端验证 |

### 修改文件

| 路径 | 改动 |
|------|-----|
| `src/lib/schema.sql` | 顶部加 `CREATE EXTENSION IF NOT EXISTS pgcrypto;` + knowledge_points `type` CHECK 替换（DO block 查 `pg_constraint` 动态 drop + ADD 命名约束，幂等）+ 新增 `source_anchor JSONB` 列 + `prompt_templates` 新增 `model` 列 + `books` 加 `learning_mode` / `preferred_learning_mode`（命名 CHECK 同 DO block 幂等）+ `teaching_sessions` / `user_subscriptions` 新建 + transcript 默认值为完整信封对象 |
| `src/lib/services/kp-extraction-types.ts` | `KPType` 枚举替换为新 5 值（`factual` / `conceptual` / `procedural` / `analytical` / `evaluative`）；同文件其他旧值同步更新 |
| `src/lib/prompt-templates.ts` | `upsertTemplate` 签名加 `model?: string \| null`；UPDATE / INSERT SQL 加 `model` 列 |
| `src/lib/seed-templates.ts` | extractor 模板文本旧 5 值全部替换为新 5 值（line 82-87 / 115 / 186）；`INSERT_TEMPLATE_SQL` / `UPSERT_TEMPLATE_SQL` 加 `model` 列；`TemplateSeed` 接口加 `model?` 字段；`seedRoleTemplates` / `seedTemplates` 调用处追加第 4 参数 `seed.model ?? null`；`SEED_TEMPLATES` 追加 5 条 `role='teacher'` 记录 |
| `src/lib/ai.ts` | 追加 `export { registry }`（当前 line 57 是 module-internal） |
| `package.json` | 新增 `"zod": "^3.23.0"` 依赖 |
| `docs/superpowers/specs/2026-04-12-teaching-system-design.md` | 父 spec 3 处 patch（§4.4 line 231 transcript 默认值 / §4.6 prompt_templates.model 新列 / 附录 B 文件列表） |
| `docs/architecture.md` | 5 处更新（milestone-audit 时由 Claude 做） |

---

## 任务分组与依赖图

```
Task 0 (本地云化环境摸底) ─→ 所有后续 task

依赖无前置：
  Task 1 (KP 枚举迁移)
  Task 2 (zod 依赖)
  Task 3 (schema 追加)
  Task 4 (retry.ts)
  Task 5 (teaching-types.ts)
  Task 6 (entitlement + teacher-model)

依赖链：
  Task 1  ─┐
  Task 7   │
  Task 2   ├─→ Task 8 (teacher-prompts.ts) ─→ Task 9 (seed 5 teacher 模板)
  Task 5  ─┘                                          │
  Task 3  ─┬─→ Task 10 (API routes) ←───────────────┘
  Task 4  ─┤                    ↑
  Task 5  ─┤                    │
  Task 6  ─┤                    │
  Task 7  ─┘                    │
                                ↓
                      Task 11 (端到端集成测试)
                                ↓
                      Task D1 / D2 (文档 patch，Claude)
```

**显式边**：
- Task 8 依赖：Task 1（KPType 新枚举）+ Task 2（zod）+ Task 5（TranscriptV1 类型）
- Task 9 依赖：Task 7（`TemplateSeed.model` 字段）+ Task 8（5 stage 的 kpTypeToStage 映射）
- Task 10 依赖：Task 3（schema 已落）+ Task 4（retry）+ Task 5（类型）+ Task 6（`getUserTier` / `getTeacherModel`）+ Task 7（upsertTemplate/getActiveTemplate 识别 model 列）+ Task 8（`TranscriptOutputSchema` / `buildTeacherMessages` / `registry` 已 export）+ Task 9（DB 里有 5 条 teacher 模板）

**Task 0-7 可按顺序单独 dispatch**；Task 8 起必须前置 task 全绿。Task D1/D2 由 Claude 在 milestone-audit 阶段做。

---

## Task 0: 本地云化环境摸底（pre-flight）

**Why first:** 阶段 1/2 已上线，M4 开发走 Neon `m4-dev` 分支 + 本地 `npm run dev`。先验 `.env.local` 指对分支 + tsx/node 可用 + `npm run dev` 起得来 + initDb 日志无红字。省得每个后续 task 开头踩坑。

**Files:**
- Read-only：`.env.local`（敏感，不 commit）、`package.json`、`src/lib/schema.sql`、`scripts/init-neon-schema.ts`

### Steps

- [ ] **Step 0.1: `.env.local` 存在且指向 Neon m4-dev 分支**

```bash
grep -E "^(DATABASE_URL|ANTHROPIC_API_KEY|AI_MODEL)=" .env.local | sed 's/=.*$/=<REDACTED>/'
```

Expected: 至少 3 行输出（key 名）。然后人工核对 `DATABASE_URL` 的 host 部分是 m4-dev 分支的 endpoint（通常 host 串里含 `br-m4-dev` 或 branch id 尾缀；**不是** main/prod 分支的 endpoint）。若指向 prod，停下来汇报 Claude——产品负责人需在 Neon Dashboard 拿 m4-dev 分支的 connection string 替换。

- [ ] **Step 0.2: Neon 连通性 smoke（任一通过即可）**

```bash
# 推荐 C：纯 Node，无需额外安装
node --env-file=.env.local -e "const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query('SELECT version()').then(r=>console.log(r.rows[0].version)).finally(()=>p.end())"
```

Expected: 打印 PostgreSQL 版本串（Neon 底层当前 PG17.x，过去版本可能是 PG16——都可接受；只要输出以 `PostgreSQL ` 开头即过）。

**备选**：Neon Dashboard → m4-dev 分支 → SQL Editor → `SELECT version();`（仅当 Node 命令报错时的 fallback，不作首选——`psql` 已在 Codebase §3 禁用）

- [ ] **Step 0.3: Node / tsx 版本**

```bash
node --version      # 要求 ≥ 20.6（`--env-file` 从 20.6 起）
npx tsx --version   # devDependencies 应已包含
```

Expected: node ≥ 20.6 + tsx 版本号。若 tsx 缺，`npm install -D tsx` 并单独 commit 一笔。

- [ ] **Step 0.4: 既有纯函数测试基线（不碰 DB）**

```bash
npx tsx --env-file=.env.local scripts/test-prompt-templates.ts
```

Expected: `All prompt template tests passed`。该脚本只测 `renderTemplate` 字符串替换，不读 DB——`--env-file` 是为了保持命令形式统一；若 `.env.local` 不存在 Node 会忽略此参数。若此脚本就倒退，停下来——本 plan 起始已坏，与 Neon 分支无关。

- [ ] **Step 0.5: `npm run dev` 冷启 + initDb 日志检**

在另一个终端跑：

```bash
npm run dev
```

Expected:
1. 控制台看到 `Ready in X.Xs`（Turbopack 启动）
2. 早期日志含 `initDb` / `seeded` 类标记（不同版本略有差异），且无 `ECONNREFUSED` / `password authentication failed` / `SSL` / `relation does not exist` 等红字
3. 浏览器打开 `http://localhost:3000/` 主页能正常渲染（不用登录）

确认后 Ctrl+C 关掉。本 task 不要求持续占终端——各后续 task 如需 dev server 会在 step 文本里明说。

- [ ] **Step 0.6: 汇报（不 commit，无代码改动）**

粘贴 Step 0.2 的 version 输出 + Step 0.5 的 Ready 行 + 首屏渲染 OK 的简短确认到完成报告。本 task 零 commit。

---

## Task 1: KP type 枚举迁移（硬前置）

**Why first:** Task 8 的 teacher-prompts.ts、Task 9 的 seed 模板、Task 10 的 API 全部按新 5 值（`factual` / `conceptual` / `procedural` / `analytical` / `evaluative`）写。此 task 先落可让后续 teacher 路径读得到对应 KP。

**Files:**
- Modify: `src/lib/schema.sql`（CHECK 约束 + 新增列）
- Modify: `src/lib/services/kp-extraction-types.ts`（`KPType` 枚举）
- Modify: `src/lib/seed-templates.ts`（extractor 模板文本硬编码的旧 5 值）
- Create: `scripts/test-m4-task1-kp-migration.ts`

**Context the agent needs:**
- 父 spec `docs/superpowers/specs/2026-04-12-teaching-system-design.md` §4.3（line 191-219）含完整 DDL
- 子 spec `2026-04-15-m4-teaching-mode-design.md` §1 "前置依赖"
- 父 §4.3 line 217 明确："**无需数据迁移**：当前数据库一个 KP 都没提取过"
- Codebase §5：seed-templates.ts line 82-87 / 115 / 186 写了旧值，必须同步

### Steps

- [ ] **Step 1.1: 核实 DB 无 KP 数据（m4-dev 分支 + prod main 分支双验）**

```bash
# 1. Neon m4-dev 分支（开发）
node --env-file=.env.local -e "const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query('SELECT COUNT(*)::int AS count FROM knowledge_points').then(r=>console.log(JSON.stringify(r.rows[0]))).catch(e=>{console.error(e);process.exit(1)}).finally(()=>p.end())"
```

Expected: `{"count":0}`。

**2. prod main 分支也需为 0**：在 Neon Dashboard 打开 main（prod）分支 → SQL Editor 贴：

```sql
SELECT COUNT(*) FROM knowledge_points;
SELECT type, COUNT(*) FROM knowledge_points GROUP BY type;
```

Expected: 第 1 行 COUNT=0；第 2 行 0 行返回。

**若任一非 0（m4-dev 或 prod main），硬停**：
- **m4-dev 非 0**：说明本地开发残留旧数据。在 Claude 协调下一次性 `TRUNCATE knowledge_points CASCADE`（dev 分支允许），再继续 Step 1.2。
- **prod main 非 0**：父 spec §4.3 line 217 "零 KP" 假设已经被打破，**立刻停下，不可 push 到 master**。push 后 Vercel 会在 prod 跑 `initDb()` → apply 新 CHECK 约束，届时若有旧值行会 SQL error 且中断启动。此时 agent **必须**：
  1. 完成报告里写清 `prod main knowledge_points 实际有 <N> 行，旧 type 值分布：<type列表>`
  2. 直接退出 Task 1，**不改 schema.sql，不 commit，不 push**
  3. 由 Claude 决定补一条数据迁移任务（把旧 5 值行改写为新 5 值映射后再走 Task 1）；不在本 agent session 内自作主张迁移

汇报给 Claude 的一句话格式：`"Task 1 Step 1.1 fail: prod main knowledge_points COUNT=<N>, distribution={<old_type>:<count>}, halted before schema change"`。

- [ ] **Step 1.2: 修改 `src/lib/schema.sql` 中 knowledge_points type CHECK**

定位 line 59 左右的列定义：

```sql
type TEXT NOT NULL CHECK(type IN ('position','calculation','c1_judgment','c2_evaluation','definition')),
```

替换为**去除 inline CHECK**（只保留类型声明；后续用命名 CONSTRAINT 管理，才能幂等 DROP + ADD）：

```sql
type TEXT NOT NULL,
```

然后在 `CREATE TABLE knowledge_points (...);` **之后**追加下列块。**为什么用 DO block 而不是单一 `DROP CONSTRAINT IF EXISTS <name>`**：inline `CHECK(...)` 由 PG 自动命名，通常是 `<table>_<col>_check`（即 `knowledge_points_type_check`），但如果之前有人手动命过别的名字、或列里写过多个 inline CHECK 导致 `_check1` / `_check2` 编号后缀，单一名字就漏掉；DO block 通过 `pg_constraint` 查实际约束名逐个 drop，100% 覆盖。

```sql
-- 幂等迁移：查 pg_constraint 把 knowledge_points.type 上所有 CHECK 约束全 drop，再 ADD 新的命名约束
DO $$
DECLARE
  con_name TEXT;
BEGIN
  FOR con_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    WHERE t.relname = 'knowledge_points'
      AND n.nspname = 'public'
      AND c.contype = 'c'
      AND a.attname = 'type'
  LOOP
    EXECUTE format('ALTER TABLE knowledge_points DROP CONSTRAINT %I', con_name);
  END LOOP;
END $$;

ALTER TABLE knowledge_points ADD CONSTRAINT knowledge_points_type_check
  CHECK (type IN ('factual', 'conceptual', 'procedural', 'analytical', 'evaluative'));

ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS source_anchor JSONB;
```

幂等性验证：连续跑 2 次 `init-neon-schema.ts` 应无报错；第 2 次 DO block 的 `FOR` 循环命中 1 条（即第 1 次 ADD 进去的新约束），再次 drop 后再 ADD，语义等价。

- [ ] **Step 1.3: 替换 `src/lib/services/kp-extraction-types.ts`**

grep 定位 `KPType` 声明：

```bash
grep -n "KPType" src/lib/services/kp-extraction-types.ts
```

将旧 union type 替换为：

```ts
export type KPType = 'factual' | 'conceptual' | 'procedural' | 'analytical' | 'evaluative'
```

全文件内凡引用旧 5 值的地方（常量数组、默认值、测试 fixture、JSDoc）全部同步更新。

- [ ] **Step 1.4: 搜索 `src/` 内对旧 5 值的引用**

```bash
grep -rn "\bposition\b\|\bcalculation\b\|\bc1_judgment\b\|\bc2_evaluation\b\|\bdefinition\b" src/lib src/app/api
```

对每处匹配：
- 若上下文是 KP type → 更新为新 5 值的合理映射（旧 `position`→`factual`、`calculation`→`procedural`、`definition`→`conceptual`、`c1_judgment`→`analytical`、`c2_evaluation`→`evaluative`）
- 若上下文是 `exam_questions.question_type`（schema.sql line 158 / 220 附近）→ **保留不动**（考题类型，与 KP type 语义不同，父 spec 未要求改）
- 若上下文是 `QualityGates` 字段名（`src/lib/services/kp-extraction-types.ts:43-46` 的 `calculation_kp_complete` / `c2_kp_have_signals` 等，以及 `src/lib/kp-merger.ts:219-220`、`src/lib/seed-templates.ts:166-167`）→ **保留不动**。这些是 extractor AI 输出 JSON schema 的字段名，重命名会破坏 AI JSON 契约；留给后续 milestone 重设计 quality gates 时再改（不在 M4 scope）

- [ ] **Step 1.5: 更新 `src/lib/seed-templates.ts` 内 extractor 模板文本**

定位 line 82-87、line 115、line 186（见 Codebase §5），把模板字符串内：

```
- position
- calculation
- c1_judgment
- c2_evaluation
- definition
```

及：

```
"type": "position|calculation|c1_judgment|c2_evaluation|definition"
```

全部替换为：

```
- factual（事实性）
- conceptual（概念性）
- procedural（程序性）
- analytical（分析性）
- evaluative（评价性）
```

及：

```
"type": "factual|conceptual|procedural|analytical|evaluative"
```

**不要动** line 271 / 280 / 353 / 380 的 `single_choice` / `calculation` / `essay` / `c2_evaluation`——这些是 examiner 的 `exam_questions.question_type`，语义独立。

- [ ] **Step 1.6: 应用新 schema 到 Neon m4-dev 分支 + seed UPSERT extractor 新模板**

```bash
# 1. 应用 schema.sql（幂等；DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT + ADD COLUMN IF NOT EXISTS）
npx tsx --env-file=.env.local scripts/init-neon-schema.ts

# 2. 重启 dev server 触发 seedTemplates（init-neon-schema 不 seed 模板）
# 若 npm run dev 未在跑：npm run dev
# 若在跑：Ctrl+C + npm run dev
```

Expected: `schema applied successfully`；`npm run dev` 早期日志含 seedTemplates 相关输出，无红字。

验证 extractor 模板已更新：

```bash
node --env-file=.env.local -e "const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query(\"SELECT role, stage, LEFT(template_text, 200) AS snippet FROM prompt_templates WHERE role='extractor' AND template_text LIKE '%position%'\").then(r=>console.log('rows:',r.rows.length,JSON.stringify(r.rows,null,2))).catch(e=>{console.error(e);process.exit(1)}).finally(()=>p.end())"
```

Expected: `rows: 0`（旧值已全替换）。

- [ ] **Step 1.7: 验证约束生效（反例）**

```bash
node --env-file=.env.local -e "const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query(\"INSERT INTO knowledge_points (module_id, kp_code, section_name, description, importance, type, detailed_content) VALUES (1, 'T1', 'test-section', 'test-desc', 3, 'position', 'test-content') RETURNING id\").then(r=>{console.error('UNEXPECTED INSERT SUCCESS',r.rows);process.exit(1)}).catch(e=>console.log('EXPECTED FAIL:',e.message)).finally(()=>p.end())"
```

Expected: 输出 `EXPECTED FAIL:` 后跟 `violates check constraint "knowledge_points_type_check"`。若输出 `UNEXPECTED INSERT SUCCESS` 则约束未生效，停下来排查。

验证 `source_anchor` 列：

```bash
node --env-file=.env.local -e "const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query(\"SELECT column_name FROM information_schema.columns WHERE table_name='knowledge_points' AND column_name='source_anchor'\").then(r=>console.log('rows:',r.rows.length,JSON.stringify(r.rows))).catch(e=>{console.error(e);process.exit(1)}).finally(()=>p.end())"
```

Expected: `rows: 1`，内容为 `[{"column_name":"source_anchor"}]`。

- [ ] **Step 1.8: 写 `scripts/test-m4-task1-kp-migration.ts` 自动化验证**

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// 测试前置：确保存在一个合法 module_id（step 1.1 已验证 kp 为 0）
async function getAnyModuleId(): Promise<number> {
  const r = await pool.query<{ id: number }>('SELECT id FROM modules ORDER BY id LIMIT 1')
  if (!r.rows[0]) {
    throw new Error('测试需要 modules 表至少 1 行，请先 seed。')
  }
  return r.rows[0].id
}

test('knowledge_points.type 仅接受新 5 值', async () => {
  const moduleId = await getAnyModuleId()
  const validValues = ['factual', 'conceptual', 'procedural', 'analytical', 'evaluative']
  for (const v of validValues) {
    const kpCode = `m4-test-${v}-${Date.now()}`
    const r = await pool.query<{ id: number }>(
      `INSERT INTO knowledge_points
         (module_id, kp_code, section_name, description, importance, type, detailed_content)
       VALUES ($1, $2, 'test-section', 'test-desc', 3, $3, 'test-content')
       RETURNING id`,
      [moduleId, kpCode, v]
    )
    assert.ok(r.rows[0].id, `应接受 ${v}`)
    await pool.query(`DELETE FROM knowledge_points WHERE id=$1`, [r.rows[0].id])
  }
  await assert.rejects(
    () =>
      pool.query(
        `INSERT INTO knowledge_points
           (module_id, kp_code, section_name, description, importance, type, detailed_content)
         VALUES ($1, 'm4-test-old', 'test-section', 'test-desc', 3, 'position', 'test-content')`,
        [moduleId]
      ),
    /knowledge_points_type_check/
  )
})

test('source_anchor 列存在且 nullable jsonb', async () => {
  const r = await pool.query<{
    column_name: string
    is_nullable: string
    data_type: string
  }>(
    `SELECT column_name, is_nullable, data_type FROM information_schema.columns
     WHERE table_name='knowledge_points' AND column_name='source_anchor'`
  )
  assert.equal(r.rows.length, 1)
  assert.equal(r.rows[0].is_nullable, 'YES')
  assert.equal(r.rows[0].data_type, 'jsonb')
})

test('extractor 模板不再含旧 5 值硬编码', async () => {
  const r = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM prompt_templates
     WHERE role='extractor' AND template_text LIKE '%position%'`
  )
  assert.equal(r.rows[0].count, '0', 'extractor 模板内仍有旧值 "position"')
})

await pool.end()
```

- [ ] **Step 1.9: 运行验证脚本**

```bash
npx tsx --env-file=.env.local scripts/test-m4-task1-kp-migration.ts
```

Expected: 3 tests pass，无 assert 失败。

- [ ] **Step 1.10: Commit**

```bash
git add src/lib/schema.sql src/lib/services/kp-extraction-types.ts src/lib/seed-templates.ts scripts/test-m4-task1-kp-migration.ts
git commit -m "feat(m4): migrate KP type enum to new 5 values + add source_anchor column"
```

---

## Task 2: 新增 zod 依赖

**Why:** 决策 6/12 需要 `generateObject({ schema: ZodSchema })` 做运行时 AI 输出校验；Vercel AI SDK 的 `AI_TypeValidationError` 只在 schema 是 runtime 校验器（Zod / Valibot）时抛出，纯 TS type 不产生此错。仓库此前从未用 zod。

**Files:**
- Modify: `package.json`（+ `package-lock.json`）

### Steps

- [ ] **Step 2.1: 安装 zod**

```bash
npm install zod@^3.23.0
```

（`ai@^6.0.141` 基于 Standard Schema，最低 Zod 3.23+。装当前主版本即可。）

- [ ] **Step 2.2: 运行时互通性 smoke**

```bash
node -e "const { z } = require('zod'); const s = z.object({ n: z.number() }); console.log('zod ok:', s.parse({ n: 1 }).n === 1)"
```

Expected: `zod ok: true`

- [ ] **Step 2.3: `generateObject` + Zod 组合 smoke（可选，若时间允许）**

新起一个 ad-hoc 文件（不 commit）：

```ts
import { generateObject } from 'ai'
import { z } from 'zod'
// 此 smoke 不真调 API，只确认 import 链不报 TS 错
const schema = z.object({ ok: z.boolean() })
console.log('compile ok:', typeof generateObject, typeof schema)
```

（文件写在项目根 `./tmp-zod-ai-smoke.ts`，Windows/Unix 通用；不 commit）

```bash
npx tsx ./tmp-zod-ai-smoke.ts && rm ./tmp-zod-ai-smoke.ts
```

Expected: `compile ok: function object`。

- [ ] **Step 2.4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(m4): add zod dependency for generateObject schema validation"
```

---

## Task 3: schema 追加（pgcrypto + prompt_templates.model + books.learning_mode + teaching_sessions + user_subscriptions）

**Files:**
- Modify: `src/lib/schema.sql`
- Create: `scripts/test-m4-task3-schema.ts`

**Context:**
- 子 spec §2.1：`prompt_templates` 加 `model TEXT NULL` 列
- 父 spec §4.3 line 154-157：`books` 加 `learning_mode` + `preferred_learning_mode`（Task 12 L2 后端依赖）
- 子 spec §3.1：`teaching_sessions.transcript` DEFAULT 改为信封对象
- 父 spec §4.4 / §4.5：teaching_sessions + user_subscriptions 完整 DDL
- Codebase §3：必须加 `CREATE EXTENSION IF NOT EXISTS pgcrypto`（`gen_random_uuid()` 依赖）

### Steps

- [ ] **Step 3.1: 在 `schema.sql` 顶部（所有 CREATE TABLE 之前）加 pgcrypto**

定位文件第 1 行之后、第一个 `CREATE TABLE` 之前，插入：

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

- [ ] **Step 3.2: `prompt_templates` 加 `model` 列**

定位 `prompt_templates` 表（约 line 240 起的 CREATE TABLE）。在 `CREATE TABLE ... (...)` 之后追加（保持幂等，不动 CREATE TABLE 本体）：

```sql
ALTER TABLE prompt_templates ADD COLUMN IF NOT EXISTS model TEXT NULL;
```

（不改 CREATE TABLE 列列表的原因：幂等性——对既有库和新库都适用；不需要 migration。）

- [ ] **Step 3.2b: `books` 表加 `learning_mode` + `preferred_learning_mode` 列（Task 12 依赖）**

父 spec §4.3 line 154-157 定义。在 `books` 表 `CREATE TABLE` 之后追加：

```sql
ALTER TABLE books ADD COLUMN IF NOT EXISTS learning_mode TEXT NOT NULL DEFAULT 'full';
ALTER TABLE books ADD COLUMN IF NOT EXISTS preferred_learning_mode TEXT;

-- 幂等命名 CHECK（若上次 migration 已加则先 drop 再 add）
DO $$
DECLARE
  con_name TEXT;
BEGIN
  FOR con_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    WHERE t.relname = 'books'
      AND n.nspname = 'public'
      AND c.contype = 'c'
      AND a.attname IN ('learning_mode', 'preferred_learning_mode')
  LOOP
    EXECUTE format('ALTER TABLE books DROP CONSTRAINT %I', con_name);
  END LOOP;
END $$;

ALTER TABLE books ADD CONSTRAINT books_learning_mode_check
  CHECK (learning_mode IN ('teaching', 'full'));
ALTER TABLE books ADD CONSTRAINT books_preferred_learning_mode_check
  CHECK (preferred_learning_mode IN ('teaching', 'full') OR preferred_learning_mode IS NULL);
```

**为什么分两列**：`learning_mode` = 当前生效模式（上传时用户选，可切）。`preferred_learning_mode` = 用户意图记录（降级场景保留，未来升级回 premium 时自动恢复）。父 spec §6.3。**既有 books 行**：default `'full'` 向后兼容（prod 既有 book 全部被视为 full 模式；不是 teaching，不违反护城河）。

- [ ] **Step 3.3: 追加 `teaching_sessions` 表定义**

在 schema.sql 末尾（或按 schema 其他 ALTER 之后）追加：

```sql
CREATE TABLE IF NOT EXISTS teaching_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  cluster_id INTEGER REFERENCES clusters(id) ON DELETE SET NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transcript JSONB NOT NULL DEFAULT '{"version":1,"state":{"depth":"full","currentKpId":null,"coveredKpIds":[],"strugglingStreak":0,"startedAt":null,"lastActiveAt":null,"tokensInTotal":0,"tokensOutTotal":0},"messages":[]}'::jsonb,
  depth TEXT NOT NULL DEFAULT 'full' CHECK (depth IN ('light', 'full')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_teaching_sessions_module ON teaching_sessions(module_id);
CREATE INDEX IF NOT EXISTS idx_teaching_sessions_user ON teaching_sessions(user_id);
```

⚠️ **与父 spec line 231 的差异**：父 spec 原 DEFAULT 是 `'[]'::jsonb`，本 M4 覆写为完整信封对象（决策 4 硬约束）。父 spec 同步 patch 由 Task D1 做。

- [ ] **Step 3.4: 追加 `user_subscriptions` 表定义**

（父 spec §4.5 原文）：

```sql
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'premium' CHECK (tier IN ('free', 'premium')),
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
```

既有用户 backfill（幂等，EXISTS 子查询）：

```sql
INSERT INTO user_subscriptions (user_id, tier, effective_at)
SELECT u.id, 'premium', NOW() FROM users u
WHERE NOT EXISTS (SELECT 1 FROM user_subscriptions s WHERE s.user_id = u.id);
```

- [ ] **Step 3.5: 应用新 schema 到 Neon m4-dev 分支 + 幂等性双跑验证**

```bash
# 第 1 次：干净应用
npx tsx --env-file=.env.local scripts/init-neon-schema.ts
# 第 2 次：幂等验证（所有 DDL 均为 IF NOT EXISTS / DROP-then-ADD，第 2 次必须无报错）
npx tsx --env-file=.env.local scripts/init-neon-schema.ts
```

Expected: 两次都输出 `schema applied successfully`，stderr 无任何行。

**完整性 spot check**（不 assert，仅人眼 + 报告粘贴）：

```bash
node --env-file=.env.local -e "const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});(async()=>{const r=await p.query(\"SELECT 'pgcrypto' AS name, (SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pgcrypto'))::text AS present UNION ALL SELECT 'teaching_sessions', (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='teaching_sessions'))::text UNION ALL SELECT 'user_subscriptions', (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='user_subscriptions'))::text UNION ALL SELECT 'prompt_templates.model', (SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='prompt_templates' AND column_name='model'))::text UNION ALL SELECT 'books.learning_mode', (SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='books' AND column_name='learning_mode'))::text UNION ALL SELECT 'books.preferred_learning_mode', (SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='books' AND column_name='preferred_learning_mode'))::text\");console.log(JSON.stringify(r.rows,null,2));await p.end()})().catch(e=>{console.error(e);process.exit(1)})"
```

Expected: 6 行全部 `present: "true"`。任一 `false` → init-neon-schema.ts 未应用到那项，停下来排查（最常见原因：schema.sql 的 ALTER 块写错、或 Pool 连到了错误分支）。

**dev server 重启**：若 `npm run dev` 已在跑，Ctrl+C + `npm run dev`，确保 initDb 日志无 error / fatal，能看到新表被 `seedTemplates` 识别。

- [ ] **Step 3.6: 写验证脚本 `scripts/test-m4-task3-schema.ts`**

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

test('pgcrypto extension 已启用', async () => {
  const r = await pool.query<{ extname: string }>(
    `SELECT extname FROM pg_extension WHERE extname='pgcrypto'`
  )
  assert.equal(r.rows.length, 1, 'pgcrypto 必须已启用（gen_random_uuid 依赖）')
})

test('prompt_templates.model 列存在且 nullable', async () => {
  const r = await pool.query<{
    column_name: string
    is_nullable: string
    data_type: string
  }>(
    `SELECT column_name, is_nullable, data_type FROM information_schema.columns
     WHERE table_name='prompt_templates' AND column_name='model'`
  )
  assert.equal(r.rows.length, 1)
  assert.equal(r.rows[0].is_nullable, 'YES')
  assert.equal(r.rows[0].data_type, 'text')
})

test('teaching_sessions 表存在且 transcript 默认值是信封对象', async () => {
  const r = await pool.query<{ column_default: string | null }>(
    `SELECT column_default FROM information_schema.columns
     WHERE table_name='teaching_sessions' AND column_name='transcript'`
  )
  assert.equal(r.rows.length, 1)
  assert.ok(r.rows[0].column_default, 'transcript 必须有 DEFAULT')
  assert.ok(r.rows[0].column_default!.includes('"version":1'), 'transcript default 应含 version:1')
  assert.ok(r.rows[0].column_default!.includes('"messages":[]'), 'transcript default 应含 messages:[]')
  assert.ok(r.rows[0].column_default!.includes('"strugglingStreak":0'), 'transcript default state.strugglingStreak 应为 0')
})

test('user_subscriptions 表存在且所有既有 users 已 backfill premium', async () => {
  await pool.query(`SELECT tier FROM user_subscriptions LIMIT 1`) // 表必须存在
  const missing = await pool.query<{ id: number }>(
    `SELECT u.id FROM users u
     WHERE NOT EXISTS (SELECT 1 FROM user_subscriptions s WHERE s.user_id = u.id)`
  )
  assert.equal(missing.rows.length, 0, `应无用户缺 subscription，实际缺 ${missing.rows.length} 个`)
})

test('books 表有 learning_mode 列（default full, CHECK 生效）', async () => {
  const r = await pool.query<{
    column_name: string
    column_default: string | null
    is_nullable: string
  }>(
    `SELECT column_name, column_default, is_nullable FROM information_schema.columns
     WHERE table_name='books' AND column_name='learning_mode'`
  )
  assert.equal(r.rows.length, 1)
  assert.equal(r.rows[0].is_nullable, 'NO')
  assert.ok(r.rows[0].column_default?.includes("'full'"), `learning_mode default 应为 'full'，实得 ${r.rows[0].column_default}`)
})

test('books.preferred_learning_mode 列存在且 nullable', async () => {
  const r = await pool.query<{ is_nullable: string }>(
    `SELECT is_nullable FROM information_schema.columns
     WHERE table_name='books' AND column_name='preferred_learning_mode'`
  )
  assert.equal(r.rows.length, 1)
  assert.equal(r.rows[0].is_nullable, 'YES')
})

test('books.learning_mode CHECK 约束拒绝非法值', async () => {
  // 必须有至少一个 user 才能 INSERT 一行测试数据
  const u = await pool.query<{ id: number }>(`SELECT id FROM users ORDER BY id LIMIT 1`)
  if (u.rows.length === 0) return // skip，seed 后再跑
  const title = `m4-test-book-${Date.now()}`
  await assert.rejects(
    () =>
      pool.query(
        `INSERT INTO books (user_id, title, learning_mode) VALUES ($1, $2, 'invalid_mode')`,
        [u.rows[0].id, title]
      ),
    /violates check constraint/
  )
})

test('teaching_sessions UUID 生成可用（gen_random_uuid）', async () => {
  const r = await pool.query<{ gen_random_uuid: string }>(`SELECT gen_random_uuid()`)
  assert.match(r.rows[0].gen_random_uuid, /^[0-9a-f-]{36}$/)
})

await pool.end()
```

- [ ] **Step 3.7: 运行验证**

```bash
npx tsx --env-file=.env.local scripts/test-m4-task3-schema.ts
```

Expected: 8 tests pass（pgcrypto / prompt_templates.model / teaching_sessions.transcript default / user_subscriptions backfill / books.learning_mode default / books.preferred_learning_mode nullable / books.learning_mode CHECK / gen_random_uuid）。

- [ ] **Step 3.8: Commit**

```bash
git add src/lib/schema.sql scripts/test-m4-task3-schema.ts
git commit -m "feat(m4): add pgcrypto + prompt_templates.model + teaching_sessions + user_subscriptions"
```

---

## Task 4: `src/lib/retry.ts` 重试与错误分类

**Files:**
- Create: `src/lib/retry.ts`
- Create: `scripts/test-m4-task4-retry.ts`

**Context:** 子 spec §2.3——3 次指数退避（1s → 2s → 4s），内容层 Zod 校验失败与网络错走同一路径，4xx（除 429）不重试。

### Steps

- [ ] **Step 4.1: 写 `src/lib/retry.ts`**

```ts
export type RetryOpts = {
  maxAttempts?: number
  baseMs?: number
}

export type ErrorClass = 'retryable_network' | 'retryable_validation' | 'permanent'

export function classifyError(e: unknown): ErrorClass {
  if (e instanceof Error) {
    // AI SDK Zod 校验 / JSON 解析失败 → 可重试（内容层错）
    if (e.name === 'AI_TypeValidationError' || e.name === 'AI_JSONParseError') {
      return 'retryable_validation'
    }
    // fetch 超时 / abort
    if (e.name === 'AbortError' || e.name === 'TimeoutError') {
      return 'retryable_network'
    }
    // HTTP 4xx / 5xx（AI SDK throw ApiError 带 status；pg/fetch 也可能挂 status）
    const status = (e as { status?: number }).status
    if (status === 429 || (typeof status === 'number' && status >= 500)) {
      return 'retryable_network'
    }
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return 'permanent'
    }
  }
  // 兜底：未知错误按网络问题 retry（宁愿多试一次）
  return 'retryable_network'
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: RetryOpts = {}
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3
  const baseMs = opts.baseMs ?? 1000
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastError = e
      const cls = classifyError(e)
      if (cls === 'permanent') {
        throw e
      }
      if (attempt === maxAttempts - 1) {
        break
      }
      const delay = baseMs * Math.pow(2, attempt)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastError
}
```

- [ ] **Step 4.2: 写 `scripts/test-m4-task4-retry.ts`**

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { retryWithBackoff, classifyError } from '../src/lib/retry'

test('classifyError: AI_TypeValidationError → retryable_validation', () => {
  const e = Object.assign(new Error('bad'), { name: 'AI_TypeValidationError' })
  assert.equal(classifyError(e), 'retryable_validation')
})

test('classifyError: AI_JSONParseError → retryable_validation', () => {
  const e = Object.assign(new Error('bad'), { name: 'AI_JSONParseError' })
  assert.equal(classifyError(e), 'retryable_validation')
})

test('classifyError: status 429 → retryable_network', () => {
  const e = Object.assign(new Error('rate limit'), { status: 429 })
  assert.equal(classifyError(e), 'retryable_network')
})

test('classifyError: status 500 → retryable_network', () => {
  const e = Object.assign(new Error('server'), { status: 500 })
  assert.equal(classifyError(e), 'retryable_network')
})

test('classifyError: status 400 → permanent', () => {
  const e = Object.assign(new Error('bad req'), { status: 400 })
  assert.equal(classifyError(e), 'permanent')
})

test('retryWithBackoff: 第 2 次成功', async () => {
  let calls = 0
  const result = await retryWithBackoff(async () => {
    calls++
    if (calls < 2) {
      throw Object.assign(new Error('transient'), { status: 500 })
    }
    return 'ok'
  }, { baseMs: 10 })
  assert.equal(result, 'ok')
  assert.equal(calls, 2)
})

test('retryWithBackoff: 3 次失败抛最后错误', async () => {
  let calls = 0
  await assert.rejects(
    () =>
      retryWithBackoff(async () => {
        calls++
        throw Object.assign(new Error(`attempt ${calls}`), { status: 500 })
      }, { baseMs: 10 }),
    /attempt 3/
  )
  assert.equal(calls, 3)
})

test('retryWithBackoff: permanent 错立即抛不重试', async () => {
  let calls = 0
  await assert.rejects(() =>
    retryWithBackoff(async () => {
      calls++
      throw Object.assign(new Error('bad req'), { status: 400 })
    }, { baseMs: 10 })
  )
  assert.equal(calls, 1)
})
```

- [ ] **Step 4.3: 运行测试**

```bash
npx tsx --env-file=.env.local scripts/test-m4-task4-retry.ts
```

Expected: 所有 8 个 `test(...)` 通过。（retry.ts 不依赖 DB，但保持统一命令形式；`--env-file` 参数若文件不存在 Node 会忽略，不影响本测试）

- [ ] **Step 4.4: Commit**

```bash
git add src/lib/retry.ts scripts/test-m4-task4-retry.ts
git commit -m "feat(m4): add retry.ts with exponential backoff + error classification"
```

---

## Task 5: `src/lib/teaching-types.ts` TS 类型

**Files:**
- Create: `src/lib/teaching-types.ts`

**Context:** 子 spec §3.1 的 TranscriptV1 + TranscriptMessage 类型定义。N1 修复后 `startedAt` / `lastActiveAt` 允许 `string | null`（初始状态）。

### Steps

- [ ] **Step 5.1: 写 `src/lib/teaching-types.ts`**

```ts
export type TeachingDepth = 'full' | 'light'
export type TeachingStatus = 'teaching' | 'ready_to_advance' | 'struggling'
export type KPType = 'factual' | 'conceptual' | 'procedural' | 'analytical' | 'evaluative'

export type TranscriptStateError = {
  reason: 'teacher_unavailable' | 'invalid_output'
  at: string
  attemptCount: number
}

export type TranscriptState = {
  depth: TeachingDepth
  currentKpId: number | null
  coveredKpIds: number[]
  strugglingStreak: number
  startedAt: string | null
  lastActiveAt: string | null
  tokensInTotal: number
  tokensOutTotal: number
  lastError?: TranscriptStateError
}

export type TranscriptMessageBase = {
  ts: string
}

export type SocraticQuestion = TranscriptMessageBase & {
  kind: 'socratic_question'
  role: 'teacher'
  content: string
  kpId?: number
  tokensIn?: number
  tokensOut?: number
  model?: string
}

export type StudentResponse = TranscriptMessageBase & {
  kind: 'student_response'
  role: 'user'
  content: string
}

export type KpTakeaway = TranscriptMessageBase & {
  kind: 'kp_takeaway'
  role: 'teacher'
  kpId: number
  summary: string
  tokensIn?: number
  tokensOut?: number
  model?: string
}

export type StrugglingHint = TranscriptMessageBase & {
  kind: 'struggling_hint'
  role: 'teacher'
  content: string
  kpId?: number
  tokensIn?: number
  tokensOut?: number
  model?: string
}

export type TranscriptMessage =
  | SocraticQuestion
  | StudentResponse
  | KpTakeaway
  | StrugglingHint

export type TranscriptV1 = {
  version: 1
  state: TranscriptState
  messages: TranscriptMessage[]
}

export function emptyTranscript(): TranscriptV1 {
  return {
    version: 1,
    state: {
      depth: 'full',
      currentKpId: null,
      coveredKpIds: [],
      strugglingStreak: 0,
      startedAt: null,
      lastActiveAt: null,
      tokensInTotal: 0,
      tokensOutTotal: 0,
    },
    messages: [],
  }
}
```

- [ ] **Step 5.2: 类型检查**

```bash
npx tsc --noEmit
```

Expected: 无 error。

- [ ] **Step 5.3: Commit**

```bash
git add src/lib/teaching-types.ts
git commit -m "feat(m4): add teaching-types.ts (TranscriptV1 envelope + message variants)"
```

---

## Task 6: `src/lib/entitlement.ts` + `src/lib/teacher-model.ts`

**Files:**
- Create: `src/lib/entitlement.ts`（全新创建——Codebase §1 已确认当前不存在）
- Create: `src/lib/teacher-model.ts`

**Context:** 子 spec §2.1。

### Steps

- [ ] **Step 6.1: 写 `src/lib/entitlement.ts`**

```ts
// MVP: 所有用户永远 premium（子 spec §2.1 Step 5 / 决策 1）
// 未来：读 user_subscriptions 表取 tier（父 spec §6）

export type Tier = 'free' | 'premium'

export async function getUserTier(_userId: number): Promise<Tier> {
  return 'premium'
}

export async function canUseTeaching(userId: number): Promise<boolean> {
  const tier = await getUserTier(userId)
  return tier === 'premium'
}
```

（父 spec §6 提到的 `canUseTeaching` 就是本文件的第二个 export——M4 阶段由 teaching API route 调用；UI 的付费墙弹窗是 L2 范畴。）

- [ ] **Step 6.2: 写 `src/lib/teacher-model.ts`**

```ts
import type { Tier } from './entitlement'

const tierModelMap: Record<Tier, string> = {
  free: 'google:gemini-2.5-flash-lite',
  premium: 'anthropic:claude-sonnet-4-6',
}

export function getTeacherModel(tier: Tier, overrideModel?: string | null): string {
  return overrideModel ?? tierModelMap[tier]
}
```

- [ ] **Step 6.3: 类型检查**

```bash
npx tsc --noEmit
```

Expected: 无 error。

- [ ] **Step 6.4: Commit**

```bash
git add src/lib/entitlement.ts src/lib/teacher-model.ts
git commit -m "feat(m4): add entitlement.ts (getUserTier/canUseTeaching) + teacher-model.ts"
```

---

## Task 7: `src/lib/prompt-templates.ts` + `src/lib/seed-templates.ts` model 列支持

**Files:**
- Modify: `src/lib/prompt-templates.ts`（`upsertTemplate` 签名 + SQL）
- Modify: `src/lib/seed-templates.ts`（`TemplateSeed` 接口 + SQL 常量 + 调用处）

**Context:** 子 spec §2.1 step 6。Codebase §1：`prompt-templates.ts` 现有实现用 `run()`（不是 `db.query()`），先 SELECT existing → UPDATE or INSERT；本 task 保留 2 分支结构。

### Steps

- [ ] **Step 7.1: 修改 `src/lib/prompt-templates.ts`**

首先 `PromptTemplate` interface 加 `model` 字段（select 回来的行会含此列，Task 3 已经把列加上了）：

```ts
interface PromptTemplate {
  id: number
  role: string
  stage: string
  version: number
  template_text: string
  is_active: number
  model: string | null
}
```

然后 `upsertTemplate` 签名扩展 `model?` 参数并同步 SQL：

```ts
export async function upsertTemplate(
  role: string,
  stage: string,
  templateText: string,
  model?: string | null
): Promise<void> {
  const existing = await queryOne<{ id: number }>(
    'SELECT id FROM prompt_templates WHERE role = $1 AND stage = $2 AND is_active = 1',
    [role, stage]
  )

  if (existing) {
    await run(
      'UPDATE prompt_templates SET template_text = $1, model = $2 WHERE id = $3',
      [templateText, model ?? null, existing.id]
    )
    return
  }

  await run(
    'INSERT INTO prompt_templates (role, stage, version, template_text, is_active, model) VALUES ($1, $2, 1, $3, 1, $4)',
    [role, stage, templateText, model ?? null]
  )
}
```

- [ ] **Step 7.2: 修改 `src/lib/seed-templates.ts`——SQL 常量 + 接口 + 调用处**

接口加 `model?`：

```ts
interface TemplateSeed {
  role: string
  stage: string
  template_text: string
  model?: string | null  // 默认 null
}
```

更新两个 SQL 常量（line 458 / 461 附近）：

```ts
const INSERT_TEMPLATE_SQL =
  'INSERT INTO prompt_templates (role, stage, version, template_text, is_active, model) VALUES ($1, $2, 1, $3, 1, $4)'

const UPSERT_TEMPLATE_SQL = `
  INSERT INTO prompt_templates (role, stage, version, template_text, is_active, model)
  VALUES ($1, $2, 1, $3, 1, $4)
  ON CONFLICT(role, stage, version) DO UPDATE
  SET template_text = excluded.template_text,
      model = excluded.model
`
```

调用处（`seedRoleTemplates` / `seedTemplates` 两处 `run(...)` 调用）在参数数组末尾追加 `template.model ?? null`：

```ts
await run(UPSERT_TEMPLATE_SQL, [template.role, template.stage, template.template_text, template.model ?? null])
// ...
await run(INSERT_TEMPLATE_SQL, [template.role, template.stage, template.template_text, template.model ?? null])
```

- [ ] **Step 7.3: 跑既有 prompt-templates 测试确保不倒退**

```bash
npx tsx --env-file=.env.local scripts/test-prompt-templates.ts
```

Expected: `All prompt template tests passed`。若测试脚本不知道 `model` 字段，输出应仍通过（它可能 SELECT * 或只验核心字段）；若失败，查失败原因，补测即可。

- [ ] **Step 7.4: 重启 dev server 触发 initDb → seedTemplates**

```bash
# 若 npm run dev 在跑：Ctrl+C + npm run dev
# 否则：npm run dev
```

Expected: 启动日志无 error / fatal；seedTemplates 对新代码路径 UPSERT 既有 5 role × stage 模板（`model` 列为 NULL）。

验证既有模板 model 列为 NULL：

```bash
node --env-file=.env.local -e "const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query(\"SELECT role, stage, model FROM prompt_templates WHERE role IN ('extractor','coach','examiner','reviewer','assistant') ORDER BY role, stage\").then(r=>console.log(JSON.stringify(r.rows,null,2))).catch(e=>{console.error(e);process.exit(1)}).finally(()=>p.end())"
```

Expected: 所有行 `model` 列为 null。

- [ ] **Step 7.5: Commit**

```bash
git add src/lib/prompt-templates.ts src/lib/seed-templates.ts
git commit -m "feat(m4): prompt-templates & seed-templates support model column"
```

---

## Task 8: `src/lib/teacher-prompts.ts` Layer 1 + Zod schema + builder，并 export ai.ts registry

**Files:**
- Create: `src/lib/teacher-prompts.ts`
- Modify: `src/lib/ai.ts`（追加 `export { registry }`，供 Task 10 API 使用）

**Context:** 子 spec §2.2——7 块共享规则 + `TranscriptOutputSchema` + `buildTeacherMessages`。本 task 额外处理 `registry` 导出（Codebase §1 确认当前 `registry` 仅 module-internal）。

### Steps

- [ ] **Step 8.1: 修改 `src/lib/ai.ts`**

在文件末尾加一行：

```ts
export { registry }
```

- [ ] **Step 8.2: 写 `src/lib/teacher-prompts.ts`**

```ts
import { z } from 'zod'
import type {
  TranscriptV1,
  KPType,
} from './teaching-types'

// ==== Layer 1: 跨 5 类型共享的规则常量（7 块） ====

export const COGNITIVE_OFFLOADING_RULES = `
【认知卸载防护硬规则】
绝对禁止：
1. 直接给出完整答案
2. 代替学生思考或推理
3. 跳过关键步骤直接给结论
4. 替学生总结本 KP 的核心观点（等学生自己说）

必须：
- 把问题拆成小步，逐步引导
- 只给提示（hint），不给答案（answer）
- 让学生自己说出每一个关键推理步骤
`.trim()

export const CONFUSION_DIAGNOSTIC = `
【困惑诊断】
学生困惑分 4 层，按以下顺序识别并应对：
1. 词汇困惑（不认识某术语）→ 先给简明定义 + 一个日常类比
2. 概念困惑（定义懂但不理解内在逻辑）→ 用正反例对比
3. 推理困惑（懂概念但不会推导）→ 示范 1 步 + 让学生接 2 步
4. 元认知困惑（不知道自己哪里卡住）→ 让学生复述自己的理解，从复述中定位
`.trim()

export const FEEDBACK_PRINCIPLES = `
【反馈原则】
学生回答后分 3 类处理：
1. 知识性错误（事实错 / 定义错）→ 明确指出错在哪，给正确版本 + 一句解释
2. 推理错误（事实对但推导跳了一步）→ 用"你说 X，那如果 Y 呢？"反问，让学生自己发现
3. 表达不清（意思可能对但说得含糊）→ 追问"能不能用更具体的例子说明？"
`.trim()

export const RESPONSE_LENGTH_CONTROL = `
【回应长度控制】
每轮回复 100-200 字；只讲一个主要点；最多 3 段。不要一次塞太多信息。
`.trim()

export const OUTPUT_SCHEMA_CONTRACT = `
【输出格式】
你必须返回一个 JSON 对象，严格匹配以下结构：
{
  "status": "teaching" | "ready_to_advance" | "struggling",
  "kpTakeaway": null 或 一段不超过 150 字的本 KP 核心观点总结,
  "message": "给学生看的本轮话（遵守上面的回应长度控制）"
}

status 语义：
- "teaching"：本轮是正常教学对话，继续启发
- "ready_to_advance"：学生已掌握当前 KP，建议推进到下一个（且必须把 kpTakeaway 填成本 KP 的核心观点总结）
- "struggling"：学生在当前 KP 上仍困惑，下一轮换教学角度

kpTakeaway 只在 status="ready_to_advance" 时非 null；其他两种 status 时必须为 null。
`.trim()

export const STRUGGLING_SEMANTICS = `
【struggling 累积规则】
如果学生连续 3 轮仍困惑，系统会冻结当前教学并让学生二选一（回去再读原文 / 跳到 QA）。
所以当你判定 "struggling" 时，尽量换一个完全不同的切入角度——不要重复上一轮的讲法。
`.trim()

export const TEACHER_ROLE_BOUNDARY = `
【角色边界】
你是 Phase 2 教学对话的老师，职责只有一个：把当前 KP 教懂。
- 你不负责出题评分（那是 examiner 的活）
- 你不负责 QA 答疑（那是 coach 的活）
- 学生问 "这道题怎么做" 时，把他们引导回当前 KP 的理解上，不替他们解题
`.trim()

export const LAYER1_SHARED_RULES = [
  COGNITIVE_OFFLOADING_RULES,
  CONFUSION_DIAGNOSTIC,
  FEEDBACK_PRINCIPLES,
  RESPONSE_LENGTH_CONTROL,
  OUTPUT_SCHEMA_CONTRACT,
  STRUGGLING_SEMANTICS,
  TEACHER_ROLE_BOUNDARY,
].join('\n\n---\n\n')

// ==== AI 输出 Zod schema（决策 4 + I4 修复后形状） ====
// refine: status='ready_to_advance' ⇔ kpTakeaway !== null。
// 任一违反 → 抛 AI_TypeValidationError → retry.ts 归 retryable_validation 走重试。

export const TranscriptOutputSchema = z
  .object({
    status: z.enum(['teaching', 'ready_to_advance', 'struggling']),
    kpTakeaway: z.string().max(400).nullable(),
    message: z.string().min(1).max(600),
  })
  .refine(
    (v) => (v.status === 'ready_to_advance') === (v.kpTakeaway !== null),
    {
      message:
        'kpTakeaway must be non-null iff status === "ready_to_advance"',
      path: ['kpTakeaway'],
    }
  )

export type TranscriptOutput = z.infer<typeof TranscriptOutputSchema>

// ==== KPType → stage 映射 ====

export function kpTypeToStage(type: KPType): string {
  const map: Record<KPType, string> = {
    factual: 'teach_factual',
    conceptual: 'teach_conceptual',
    procedural: 'teach_procedural',
    analytical: 'teach_analytical',
    evaluative: 'teach_evaluative',
  }
  return map[type]
}

// ==== Layer 3: 运行时组装 messages ====

export type BuildTeacherMessagesInput = {
  layer2Template: string  // 已经过 renderTemplate({kp_content}/{cluster_kps}/{struggling_streak}) 渲染
  transcript: TranscriptV1
  studentInput: string
}

type AIMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export function buildTeacherMessages(input: BuildTeacherMessagesInput): AIMessage[] {
  const { layer2Template, transcript, studentInput } = input

  const systemPrompt = [
    LAYER1_SHARED_RULES,
    '---',
    '【本轮教学法与角色】',
    layer2Template,
  ].join('\n\n')

  // 取最近 10 条（超出即截断，保留最新）。kp_takeaway 也带上让 AI 知道之前讲过什么。
  const recent = transcript.messages.slice(-10)
  const historyMessages: AIMessage[] = recent.map((m) => {
    if (m.kind === 'student_response') {
      return { role: 'user', content: m.content }
    }
    if (m.kind === 'socratic_question' || m.kind === 'struggling_hint') {
      return { role: 'assistant', content: m.content }
    }
    if (m.kind === 'kp_takeaway') {
      return { role: 'assistant', content: `[kp_takeaway kpId=${m.kpId}] ${m.summary}` }
    }
    const never: never = m
    throw new Error(`未知 TranscriptMessage kind: ${JSON.stringify(never)}`)
  })

  return [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    { role: 'user', content: studentInput },
  ]
}
```

- [ ] **Step 8.3: 类型检查**

```bash
npx tsc --noEmit
```

Expected: 无 error。若因 `ai.ts` export 导致下游 import 爆 type 错 → 按 TS 报错修正。

- [ ] **Step 8.4: 单元 smoke（可选）**

```bash
node -e "
const { TranscriptOutputSchema } = require('./dist/lib/teacher-prompts.js');
" 2>&1 || echo "无 dist 产物时跳过此步"
```

更简的：`tsx` 跑一段内联 TS：

```bash
npx tsx -e "
import { TranscriptOutputSchema } from './src/lib/teacher-prompts'
const ok = TranscriptOutputSchema.safeParse({ status: 'teaching', kpTakeaway: null, message: '你觉得呢？' })
const bad = TranscriptOutputSchema.safeParse({ status: 'ready_to_advance', kpTakeaway: null, message: 'done' })
console.log('happy:', ok.success, 'refine-violation:', !bad.success)
"
```

Expected: `happy: true refine-violation: true`。

- [ ] **Step 8.5: Commit**

```bash
git add src/lib/teacher-prompts.ts src/lib/ai.ts
git commit -m "feat(m4): teacher-prompts.ts (Layer 1 + Zod schema with refine + builder); export registry"
```

---

## Task 9: Seed 5 条 teacher prompt_templates 记录

**Files:**
- Modify: `src/lib/seed-templates.ts`（`SEED_TEMPLATES` 数组追加 5 条；在 `seedTemplates()` 调用链末尾加 `await seedRoleTemplates('teacher')`）

**Context:**
- 子 spec §2.2 的 5 条 Layer 2 教学法模板（Option B 共享骨架 + 类型特定 5 步）
- 教学法内容源：`docs/research/2026-04-11-pedagogy-knowledge-matching.md` §51-157 的 5 步教学流程 + `docs/research/2026-04-11-ai-prompt-encoding.md` 的教师 persona

### Steps

- [ ] **Step 9.1: 在 `SEED_TEMPLATES` 末尾追加 5 条 teacher seed**

每条共用骨架 + 类型特定 5 步。骨架：

```
你是【教师人格】。本 cluster 的所有 KP 列表：{cluster_kps}
当前正在教学的 KP：{kp_content}
已经连续 struggling 轮数：{struggling_streak}

【5 步教学流程】
<每个 KP 类型特有的流程描述>

【本轮任务】
根据上面的对话历史 + 学生刚才的回答，判定 status（teaching / ready_to_advance / struggling），
按 Layer 1 输出格式返回 JSON。
```

**factual（教授型）**：
```ts
{
  role: 'teacher',
  stage: 'teach_factual',
  template_text: `你是教授型老师，擅长用类比把抽象概念锚定到学生已有的生活经验上。
本 cluster 的所有 KP：{cluster_kps}
当前 KP：{kp_content}
已连续 struggling 轮数：{struggling_streak}

【教学流程：5 步】
1. 类比锚定：先用学生熟悉的事物打个比方
2. 正式定义：给出精确表述
3. 理解追问：让学生用自己的话说回来
4. 学生复述验证：学生说得对再问一个边界情况
5. 间隔测验：在后续 3-4 轮穿插式回访该 KP

【本轮任务】
根据对话历史和学生最新回答，选择下一步。
- 学生已能准确复述定义 + 答对边界问题 → status="ready_to_advance"，kpTakeaway 填本 KP 核心观点总结
- 连续卡词汇或定义 → status="struggling"
- 其他情况 → status="teaching"`,
  model: null,
},
```

**conceptual（导师型）**：
```ts
{
  role: 'teacher',
  stage: 'teach_conceptual',
  template_text: `你是导师型老师，善于激活学生已有知识、用桥梁类比搭建概念，再用正反例让学生触及本质。
本 cluster 的所有 KP：{cluster_kps}
当前 KP：{kp_content}
已连续 struggling 轮数：{struggling_streak}

【教学流程：5 步】
1. 激活先知：问学生对这个概念已有的理解
2. 类比桥梁：找一个结构同构的日常例子
3. 正反例对比：举 2 个是 / 2 个否，让学生指出差别在哪
4. 学生自述：让学生用自己的话说这个概念的"内在逻辑"
5. 迁移应用：给一个新情境，让学生判断属不属于本概念

【本轮任务】
- 学生能主动区分正反例 + 做对一个迁移 → status="ready_to_advance" + kpTakeaway
- 连续卡在分不清正反例 → status="struggling"
- 其他 → status="teaching"`,
  model: null,
},
```

**procedural（教练型）**：
```ts
{
  role: 'teacher',
  stage: 'teach_procedural',
  template_text: `你是教练型老师，用完整演示 → Faded Example → 独立练习 → 变式 → 错误分析的路径让学生把程序内化。
本 cluster 的所有 KP：{cluster_kps}
当前 KP：{kp_content}
已连续 struggling 轮数：{struggling_streak}

【教学流程：5 步】
1. 完整演示：给一个完整解题过程，讲清每一步为什么
2. Faded Example：留 1-2 步让学生补
3. 独立练习：学生从头做一道类似题
4. 变式：同样的程序用到一个结构变体问题上
5. 错误分析：让学生讲自己哪一步最容易错、为什么

【本轮任务】
- 学生能独立完成变式题 + 讲清错因 → status="ready_to_advance" + kpTakeaway
- 连续卡在同一步骤 → status="struggling"（下一轮换一种 Faded 切入）
- 其他 → status="teaching"`,
  model: null,
},
```

**analytical（师傅型）**：
```ts
{
  role: 'teacher',
  stage: 'teach_analytical',
  template_text: `你是师傅型老师，按认知学徒制 Modeling → Coaching → Scaffolding → Articulation → Reflection 带学生把分析性思考内化。
本 cluster 的所有 KP：{cluster_kps}
当前 KP：{kp_content}
已连续 struggling 轮数：{struggling_streak}

【教学流程：5 步】
1. Modeling：师傅边做边讲，把内部推理显性化
2. Coaching：学生做，你旁边问"你为什么选这一步？"
3. Scaffolding：给脚手架提示，逐步撤掉
4. Articulation：让学生讲自己的分析过程，不只是结论
5. Reflection：回顾这次分析里最难的一步，提炼成一个一般化原则

【本轮任务】
- 学生能清晰说出自己的分析步骤 + 提炼出一般化原则 → status="ready_to_advance" + kpTakeaway
- 连续只给结论讲不出过程 → status="struggling"
- 其他 → status="teaching"`,
  model: null,
},
```

**evaluative（同行型）**：
```ts
{
  role: 'teacher',
  stage: 'teach_evaluative',
  template_text: `你是同行型老师，用真实案例 → 学生初判 → 反面证据 → What-if → 立场迭代的流程让学生建立有证据支持的评价能力。
本 cluster 的所有 KP：{cluster_kps}
当前 KP：{kp_content}
已连续 struggling 轮数：{struggling_streak}

【教学流程：5 步】
1. 真实案例：给一个有争议的真实情境
2. 学生初判：让学生先表态 + 说 2 条理由
3. 反面证据：拿出反驳学生立场的事实
4. What-if：改一两个情境参数，让学生说立场会不会变、为什么
5. 立场迭代：让学生给出修正后的立场 + 依据

【本轮任务】
- 学生能主动吸收反面证据并迭代立场 → status="ready_to_advance" + kpTakeaway
- 连续死守初判不理会反面证据 → status="struggling"（下一轮换一个更强的反例）
- 其他 → status="teaching"`,
  model: null,
},
```

- [ ] **Step 9.2: `seedTemplates()` 追加 teacher 分派**

找到 `seedTemplates` 内末尾的 `await seedRoleTemplates(...)` 链（line 490-494），追加一行：

```ts
await seedRoleTemplates('teacher')
```

- [ ] **Step 9.3: 重启 dev server 触发 seedTemplates UPSERT 5 teacher 模板**

```bash
# 若 npm run dev 在跑：Ctrl+C + npm run dev
# 否则：npm run dev
```

Expected: 启动日志无 error；seed 完 `prompt_templates` 表应含 5 条 role=teacher 行。

- [ ] **Step 9.4: 验证 DB 已有 5 条 teacher 模板**

```bash
node --env-file=.env.local -e "const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query(\"SELECT stage, LENGTH(template_text) AS len, model FROM prompt_templates WHERE role='teacher' ORDER BY stage\").then(r=>console.log('rows:',r.rows.length,JSON.stringify(r.rows,null,2))).catch(e=>{console.error(e);process.exit(1)}).finally(()=>p.end())"
```

Expected: `rows: 5`，每行 `model` 为 null，`len` > 300。

验证每条含占位符（Task 10 会依赖）：

```bash
node --env-file=.env.local -e "const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query(\"SELECT stage FROM prompt_templates WHERE role='teacher' AND (template_text LIKE '%{kp_content}%' AND template_text LIKE '%{cluster_kps}%' AND template_text LIKE '%{struggling_streak}%')\").then(r=>console.log('rows:',r.rows.length,JSON.stringify(r.rows))).catch(e=>{console.error(e);process.exit(1)}).finally(()=>p.end())"
```

Expected: `rows: 5`（所有 stage 都含 3 个占位符）。

- [ ] **Step 9.5: Commit**

```bash
git add src/lib/seed-templates.ts
git commit -m "feat(m4): seed 5 teacher prompt templates (factual/conceptual/procedural/analytical/evaluative)"
```

---

## Task 10: `POST /api/teaching-sessions` + `POST /api/teaching-sessions/[sessionId]/messages`

**Files:**
- Create: `src/app/api/teaching-sessions/route.ts`
- Create: `src/app/api/teaching-sessions/[sessionId]/messages/route.ts`
- Create: `scripts/test-m4-task10-messages-api.ts`

**Context:**
- 子 spec §2.1（模型调度）、§2.2（Layer 3 注入）、§2.3（错误处理）、§3.1（transcript merge 规则 + 伪码）、§4.1（advance 判定 + struggling 拦截）
- 决策 2（session 生命周期）推 L2——MVP 实现：客户端传 `moduleId` + `clusterId`，后端 INSERT 返回 `id`
- **Codebase §1 关键**：import `pool` / `query` / `queryOne` from `@/lib/db`；`requireUser(request)` from `@/lib/auth`（throw UserError 被我们 catch 转 401）；`registry` 在 Task 8 已导出
- **Codebase §2 关键**：`knowledge_points` 没有 `name` / `order_index`——SELECT 改用 `section_name`, `description`（拼给 AI 的 kp_content）与 `ORDER BY id ASC`（cluster KP 顺序）

### Steps

- [ ] **Step 10.1: 写 `src/app/api/teaching-sessions/route.ts`（POST 创建 session）**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { pool, queryOne } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { canUseTeaching } from '@/lib/entitlement'
import { emptyTranscript } from '@/lib/teaching-types'

export async function POST(req: NextRequest) {
  let user
  try {
    user = await requireUser(req)
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  if (!(await canUseTeaching(user.id))) {
    return NextResponse.json({ error: 'TEACHING_LOCKED' }, { status: 402 })
  }

  const body = await req.json().catch(() => ({}))
  const moduleId = Number(body.moduleId)
  const clusterId = body.clusterId != null ? Number(body.clusterId) : null
  const depth = body.depth === 'light' ? 'light' : 'full'

  if (!Number.isInteger(moduleId) || moduleId <= 0) {
    return NextResponse.json({ error: 'MODULE_ID_REQUIRED' }, { status: 400 })
  }

  // 授权：module 必须属于当前用户
  const moduleOwner = await queryOne<{ id: number }>(
    `SELECT m.id FROM modules m JOIN books b ON b.id = m.book_id
     WHERE m.id = $1 AND b.user_id = $2`,
    [moduleId, user.id]
  )
  if (!moduleOwner) {
    return NextResponse.json({ error: 'MODULE_NOT_FOUND' }, { status: 404 })
  }

  const initTranscript = emptyTranscript()
  initTranscript.state.depth = depth

  // 如给 clusterId，把 currentKpId 设为该 cluster 首个 KP（ORDER BY id ASC）
  if (clusterId && Number.isInteger(clusterId)) {
    const firstKp = await queryOne<{ id: number }>(
      `SELECT id FROM knowledge_points
       WHERE cluster_id = $1
       ORDER BY id ASC
       LIMIT 1`,
      [clusterId]
    )
    if (firstKp) {
      initTranscript.state.currentKpId = firstKp.id
    }
  }

  const result = await pool.query<{ id: string; transcript: unknown }>(
    `INSERT INTO teaching_sessions (module_id, cluster_id, user_id, transcript, depth)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     RETURNING id, transcript`,
    [moduleId, clusterId ?? null, user.id, JSON.stringify(initTranscript), depth]
  )

  return NextResponse.json({
    sessionId: result.rows[0].id,
    transcript: result.rows[0].transcript,
  })
}
```

- [ ] **Step 10.2: 写 `src/app/api/teaching-sessions/[sessionId]/messages/route.ts`（POST 发消息）**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { pool, queryOne } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { registry } from '@/lib/ai'
import { getUserTier } from '@/lib/entitlement'
import { getTeacherModel } from '@/lib/teacher-model'
import { renderTemplate, getActiveTemplate } from '@/lib/prompt-templates'
import {
  TranscriptOutputSchema,
  buildTeacherMessages,
  kpTypeToStage,
} from '@/lib/teacher-prompts'
import { retryWithBackoff, classifyError } from '@/lib/retry'
import type { TranscriptV1, TranscriptMessage, KPType } from '@/lib/teaching-types'

type KpRow = {
  id: number
  section_name: string
  description: string
  type: KPType
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  let user
  try {
    user = await requireUser(req)
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { sessionId } = await params
  const body = await req.json().catch(() => ({}))
  const studentInput: unknown = body.message
  if (typeof studentInput !== 'string' || studentInput.trim().length === 0) {
    return NextResponse.json({ error: 'MESSAGE_REQUIRED' }, { status: 400 })
  }

  // 读 session + 授权
  const sessRow = await queryOne<{
    id: string
    user_id: number
    cluster_id: number | null
    transcript: TranscriptV1
  }>(
    `SELECT id, user_id, cluster_id, transcript FROM teaching_sessions WHERE id=$1`,
    [sessionId]
  )
  if (!sessRow) {
    return NextResponse.json({ error: 'SESSION_NOT_FOUND' }, { status: 404 })
  }
  if (sessRow.user_id !== user.id) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const envelope = sessRow.transcript
  const clusterId = sessRow.cluster_id

  // 决策 3 struggling 硬上限：已达 3 → 拒调模型
  if (envelope.state.strugglingStreak >= 3) {
    return NextResponse.json(
      { error: 'STRUGGLING_FROZEN', forcedChoice: ['reread_source', 'skip_to_qa'] },
      { status: 409 }
    )
  }

  if (!envelope.state.currentKpId) {
    return NextResponse.json({ error: 'NO_CURRENT_KP' }, { status: 400 })
  }

  const kp = await queryOne<KpRow>(
    `SELECT id, section_name, description, type
     FROM knowledge_points WHERE id=$1`,
    [envelope.state.currentKpId]
  )
  if (!kp) {
    return NextResponse.json({ error: 'KP_NOT_FOUND' }, { status: 500 })
  }

  const clusterKps: KpRow[] = clusterId
    ? (
        await pool.query<KpRow>(
          `SELECT id, section_name, description, type
           FROM knowledge_points WHERE cluster_id=$1 ORDER BY id ASC`,
          [clusterId]
        )
      ).rows
    : [kp]

  // 查 Layer 2 模板 + 决定模型
  const stage = kpTypeToStage(kp.type)
  const template = await getActiveTemplate('teacher', stage)
  const tier = await getUserTier(user.id)
  const modelId = getTeacherModel(tier, (template as { model?: string | null }).model)

  const renderedLayer2 = renderTemplate(template.template_text, {
    kp_content: `${kp.section_name}\n${kp.description}`,
    cluster_kps: clusterKps.map((k) => `- ${k.section_name}`).join('\n'),
    struggling_streak: String(envelope.state.strugglingStreak),
  })

  const messages = buildTeacherMessages({
    layer2Template: renderedLayer2,
    transcript: envelope,
    studentInput,
  })

  // 调 AI + retry（3 次指数退避；Zod refine 违反 + 5xx/429 都会进 retry）
  let aiOutput: import('@/lib/teacher-prompts').TranscriptOutput
  let usageRecord: { inputTokens?: number; outputTokens?: number } | undefined
  try {
    const result = await retryWithBackoff(async () => {
      return await generateObject({
        model: registry.languageModel(modelId),
        schema: TranscriptOutputSchema,
        messages,
      })
    })
    aiOutput = result.object
    usageRecord = result.usage
  } catch (e) {
    const cls = classifyError(e)
    const reason: 'teacher_unavailable' | 'invalid_output' =
      cls === 'retryable_validation' ? 'invalid_output' : 'teacher_unavailable'
    envelope.state.lastError = {
      reason,
      at: new Date().toISOString(),
      attemptCount: 3,
    }
    await pool.query(
      `UPDATE teaching_sessions SET transcript=$1::jsonb WHERE id=$2`,
      [JSON.stringify(envelope), sessionId]
    )
    return NextResponse.json({ error: reason, retryable: true }, { status: 503 })
  }

  // ==== merge AI 输出回 envelope（子 spec §3.1 I1 伪码）====
  const now = new Date().toISOString()
  if (!envelope.state.startedAt) envelope.state.startedAt = now
  envelope.state.lastActiveAt = now
  envelope.state.strugglingStreak =
    aiOutput.status === 'struggling' ? envelope.state.strugglingStreak + 1 : 0
  if (usageRecord?.inputTokens) envelope.state.tokensInTotal += usageRecord.inputTokens
  if (usageRecord?.outputTokens) envelope.state.tokensOutTotal += usageRecord.outputTokens
  delete envelope.state.lastError  // 成功一轮清掉上次错误

  // append student message
  envelope.messages.push({
    kind: 'student_response',
    role: 'user',
    content: studentInput,
    ts: now,
  })

  // append teacher message
  const teacherKind: 'struggling_hint' | 'socratic_question' =
    aiOutput.status === 'struggling' ? 'struggling_hint' : 'socratic_question'
  envelope.messages.push({
    kind: teacherKind,
    role: 'teacher',
    content: aiOutput.message,
    ts: now,
    kpId: kp.id,
    tokensIn: usageRecord?.inputTokens,
    tokensOut: usageRecord?.outputTokens,
    model: modelId,
  } as TranscriptMessage)

  // ready_to_advance → 追加 kp_takeaway + 更新 coveredKpIds + 推进 currentKpId
  if (aiOutput.status === 'ready_to_advance' && aiOutput.kpTakeaway) {
    envelope.messages.push({
      kind: 'kp_takeaway',
      role: 'teacher',
      kpId: kp.id,
      summary: aiOutput.kpTakeaway,
      ts: now,
      model: modelId,
    })
    if (!envelope.state.coveredKpIds.includes(kp.id)) {
      envelope.state.coveredKpIds.push(kp.id)
    }
    const idx = clusterKps.findIndex((k) => k.id === kp.id)
    if (idx >= 0 && idx + 1 < clusterKps.length) {
      envelope.state.currentKpId = clusterKps[idx + 1].id
    }
    // 若已是最后一个 KP，保留 currentKpId 不变；前端据 coveredKpIds.length === clusterKps.length 判 done
  }

  await pool.query(
    `UPDATE teaching_sessions SET transcript=$1::jsonb WHERE id=$2`,
    [JSON.stringify(envelope), sessionId]
  )

  return NextResponse.json({
    status: aiOutput.status,
    message: aiOutput.message,
    kpTakeaway: aiOutput.kpTakeaway,
    strugglingStreak: envelope.state.strugglingStreak,
    currentKpId: envelope.state.currentKpId,
    coveredKpIds: envelope.state.coveredKpIds,
  })
}
```

**关于 `usage` 形状**：`ai@^6.0.141` 的 `generateObject` 返回 `{ object, usage }`，`usage` = `{ inputTokens, outputTokens, totalTokens }`。本 plan 代码按此写；若 tsc 报 property 不存在，按实际类型 narrowing。

- [ ] **Step 10.3: 类型检查**

```bash
npx tsc --noEmit
```

Expected: 无 error。若报错：
- `registry` 未导出 → 确认 Task 8 step 8.1 已做
- `usage.inputTokens` 不存在 → 用 optional chaining（当前代码已用 `?.`）
- params 类型报错 → 确认用的是 `params: Promise<{sessionId:string}>` + `await params`（本仓 Next.js 15 App Router，所有 dynamic `[id]/route.ts` 都是 async params，参考 `src/app/api/conversations/[conversationId]/messages/route.ts:22-24`）

- [ ] **Step 10.4: 起本地 dev server 跑一次手动 smoke（agent 无浏览器路径）**

```bash
# 另一个终端跑
npm run dev
```

等到 `Ready in X.Xs` 再继续。

**登录拿 cookie（无浏览器）**：agent 无法打开浏览器，必须通过 `/api/auth/login` 拿到 `session_token` cookie。凭据从 Claude 预先写好的 `.env.local` 额外字段 `TEST_EMAIL` / `TEST_PASSWORD` 读（若未配置，先 `POST /api/auth/register` 建一个测试账号）。cookie 名为 **`session_token`**（源于 `src/lib/auth.ts:6` `SESSION_COOKIE`，**不是** `textbook_teacher_session`）。

```bash
# 0. 准备测试账号 email/password（若不存在）
TEST_EMAIL="$(node --env-file=.env.local -e 'process.stdout.write(process.env.TEST_EMAIL || "")')"
TEST_PASSWORD="$(node --env-file=.env.local -e 'process.stdout.write(process.env.TEST_PASSWORD || "")')"
[ -z "$TEST_EMAIL" ] && { echo 'ERROR: .env.local 缺 TEST_EMAIL/TEST_PASSWORD，先补上或用 /api/auth/register 建账号'; exit 1; }

# 1. 登录拿 cookie（-c 把 Set-Cookie 存到本地文件，后续请求 -b 从中读）
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c ./.tmp-cookies.txt \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" | head -c 500 ; echo
# 期望：200，响应体 { "success": true, "data": { "id": <int>, "email": "...", "display_name": "..." } }
# （login route 通过 handleRoute 包了 { success, data } 外壳——src/lib/handle-route.ts:34；Task 10 的 teaching-sessions route 走的是裸 NextResponse.json 风格，两种风格并存）
# .tmp-cookies.txt 内含 session_token（持久化，不受 head -c 500 stdout 截断影响）

# 2. 确认 cookie 文件已写入 session_token
grep session_token ./.tmp-cookies.txt || { echo 'ERROR: 未拿到 session_token'; exit 1; }

# 3. 创建 teaching session（moduleId/clusterId 从下一条 node 命令查到的真实 ID 代入）
node --env-file=.env.local -e "const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query(\"SELECT m.id AS module_id, c.id AS cluster_id FROM modules m JOIN clusters c ON c.module_id=m.id LIMIT 1\").then(r=>console.log(JSON.stringify(r.rows[0]))).catch(e=>{console.error(e);process.exit(1)}).finally(()=>p.end())"
# 记下输出的 module_id / cluster_id

curl -s -X POST http://localhost:3000/api/teaching-sessions \
  -H "Content-Type: application/json" \
  -b ./.tmp-cookies.txt \
  -d '{"moduleId": <module_id>, "clusterId": <cluster_id>, "depth": "full"}'
# 期望：200，返回 { sessionId, transcript }

# 4. 发消息（sessionId 从上面拿）
curl -s -X POST "http://localhost:3000/api/teaching-sessions/<sessionId>/messages" \
  -H "Content-Type: application/json" \
  -b ./.tmp-cookies.txt \
  -d '{"message": "我不太明白这个概念，能举个例子吗？"}'
# 期望：200，返回 { status, message, kpTakeaway, strugglingStreak, currentKpId, coveredKpIds }

# 5. 清理
rm -f ./.tmp-cookies.txt
```

若 `.env.local` 无 `TEST_EMAIL`：在 Step 10.4 最前先 `curl -X POST /api/auth/register -d '{"email":"m4test@example.com","password":"pw-m4-test","displayName":"m4test"}'`，再把这对凭据写入 `.env.local` 的 `TEST_EMAIL` / `TEST_PASSWORD`（不 commit）。

- [ ] **Step 10.5: 写 `scripts/test-m4-task10-messages-api.ts` 自动化 smoke**

```ts
import test from 'node:test'
import assert from 'node:assert/strict'

const BASE = process.env.APP_BASE_URL || 'http://localhost:3000'
const AUTH_COOKIE = process.env.TEST_AUTH_COOKIE

test('teaching session happy path', async (t) => {
  if (!AUTH_COOKIE) {
    t.skip('需要 TEST_AUTH_COOKIE 环境变量（格式：session_token=xxx；`session_token` 是 src/lib/auth.ts:6 SESSION_COOKIE 名）')
    return
  }
  const moduleId = Number(process.env.TEST_MODULE_ID ?? 1)
  const clusterId = Number(process.env.TEST_CLUSTER_ID ?? 1)

  const createRes = await fetch(`${BASE}/api/teaching-sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: AUTH_COOKIE },
    body: JSON.stringify({ moduleId, clusterId, depth: 'full' }),
  })
  assert.equal(createRes.status, 200, await createRes.text())
  const created = (await createRes.json()) as {
    sessionId: string
    transcript: { version: number; state: { currentKpId: number | null } }
  }
  assert.ok(created.sessionId, 'sessionId 必须返回')
  assert.equal(created.transcript.version, 1)
  assert.ok(
    created.transcript.state.currentKpId,
    'cluster 有 KP 时应自动 set currentKpId'
  )

  const msg1 = await fetch(
    `${BASE}/api/teaching-sessions/${created.sessionId}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: AUTH_COOKIE },
      body: JSON.stringify({
        message: '我不太明白这个概念，能举个具体例子吗？',
      }),
    }
  )
  assert.equal(msg1.status, 200, await msg1.text())
  const r1 = (await msg1.json()) as {
    status: string
    message: string
    strugglingStreak: number
  }
  assert.ok(
    ['teaching', 'ready_to_advance', 'struggling'].includes(r1.status),
    `status=${r1.status} 不在枚举里`
  )
  assert.ok(r1.message && r1.message.length > 0, 'message 必须非空')
  assert.equal(typeof r1.strugglingStreak, 'number')
})
```

- [ ] **Step 10.6: 跑测试**

```bash
# npm run dev 需在另一个终端持续跑
# <cookie> 从 Step 10.4 的 ./.tmp-cookies.txt 拿：grep -E '^[^#].*session_token' ./.tmp-cookies.txt | awk '{print $NF}'
TEST_AUTH_COOKIE="session_token=<cookie>" TEST_MODULE_ID=<id> TEST_CLUSTER_ID=<id> \
  npx tsx --env-file=.env.local scripts/test-m4-task10-messages-api.ts
```

Expected: test pass。若 SKIP 是因 env 未设，Step 10.4 的手动 curl 通过即可接受。

- [ ] **Step 10.7: Commit**

```bash
git add src/app/api/teaching-sessions scripts/test-m4-task10-messages-api.ts
git commit -m "feat(m4): add teaching-sessions create + messages API with retry + Zod validation"
```

---

## Task 11: 端到端集成测试（可选，验证特殊路径）

**Files:**
- Extend: `scripts/test-m4-task10-messages-api.ts` 或新 `scripts/test-m4-integration.ts`

**Context:** 触发 3 轮 struggling → 验证 409 冻结；触发 ready_to_advance → 验证 kpTakeaway + coveredKpIds 推进；模拟重试耗尽 → 验证 503 + lastError 写入。

若 Task 10 happy path 手动 smoke 已充分覆盖，可合并到 Task 10 并跳过本 task。

### Steps

- [ ] **Step 11.1: 触发 3 轮 struggling 测 409**

真 AI 调用很难复现 struggling，改为直接 mutate DB：

```sql
UPDATE teaching_sessions
SET transcript = jsonb_set(transcript, '{state,strugglingStreak}', '3'::jsonb)
WHERE id='<test sessionId>';
```

再发一次消息 → 期望 `409 STRUGGLING_FROZEN`。

- [ ] **Step 11.2: 触发 ready_to_advance 测推进**

学生给出非常完整的答复（"A 是 X，原因是..."），AI 大概率返回 `status='ready_to_advance'`；验证 DB 里 `coveredKpIds` 新增当前 kp.id、`currentKpId` 推进到下一个。

- [ ] **Step 11.3: 触发 503 测 lastError 写入**

临时在 env 里把 `ANTHROPIC_API_KEY` 置成无效字符串，重启 app → 发消息 → 期望返回 503 + DB 里 `transcript.state.lastError.reason='teacher_unavailable'`。测完恢复 env。

- [ ] **Step 11.4: Commit**

```bash
git add scripts/test-m4-integration.ts
git commit -m "test(m4): integration tests for struggling freeze + kp advance + error state"
```

---

## Task D1（Claude 做）: 父 spec 3 处 patch

**Files:**
- Modify: `docs/superpowers/specs/2026-04-12-teaching-system-design.md`

Task D1 和 D2 由 Claude 做，**不属于 Codex dispatch 范围**；在 Codex 跑完 Task 1-10 后，Claude 在 `milestone-audit` skill 触发时一次性处理。

### Steps

- [ ] **D1.1:** 父 spec §4.4 line 231：`transcript JSONB ... DEFAULT '[]'::jsonb` → 替换为完整信封 JSON（同子 spec §3.1 C2 修复版）
- [ ] **D1.2:** 父 spec §4.6：追加说明 `prompt_templates.model TEXT NULL` 新列（子 spec §2.1 I2 修复）
- [ ] **D1.3:** 父 spec 附录 B 修改文件列表：追加 `src/lib/schema.sql`、`src/lib/prompt-templates.ts`、`src/lib/seed-templates.ts`、`src/lib/ai.ts`（加 registry export）、`package.json`
- [ ] **D1.4:** Commit：
```bash
git add docs/superpowers/specs/2026-04-12-teaching-system-design.md
git commit -m "docs(m4): patch parent teaching-system-design spec per M4 child spec (C2/I2 fixes)"
```

---

## Task D2（Claude 做，milestone-audit 阶段）: architecture.md 5 处更新

**Files:**
- Modify: `docs/architecture.md`

见子 spec §9 列出的 5 个必改章节：AI 角色表 / API 组 / DB 表 / 学习状态流 / 新接口契约章节。

在 Codex 完成 Task 1-10 后由 Claude 触发 `milestone-audit` skill 时做，不属于 Codex dispatch 范围。

---

## 验证清单（M4 完工判断标准）

- [ ] Task 0（摸底无 commit）+ Task 1-10 全部 commit 入 master
- [ ] `npx tsc --noEmit` 零 error
- [ ] 所有 `scripts/test-m4-*.ts` 脚本 pass
- [ ] DB 手工 query 确认：
  - `SELECT COUNT(*) FROM prompt_templates WHERE role='teacher';` = 5
  - `SELECT transcript->'state'->>'strugglingStreak' FROM teaching_sessions LIMIT 1;` 不为 NULL（证明信封默认值正确；无 session 时可通过 `INSERT ... DEFAULT` 构造一条）
  - `SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pgcrypto');` 返回 `t`
  - `SELECT COUNT(*) FROM prompt_templates WHERE role='extractor' AND template_text LIKE '%position%';` = 0
- [ ] 手工 smoke：创建 session + 发 2-3 条消息 + 观察 AI 回复与 DB 状态一致
- [ ] 父 spec 3 处 patch 合入（Task D1）
- [ ] architecture.md 5 处更新（Task D2，milestone-audit 阶段）
- [ ] docs/project_status.md、docs/changelog.md 更新（milestone 收尾标配）

---

## L2 UI 层任务（2026-04-16 追加）

> **L2 brainstorm 已完成**（决策 8/9/10/11 全锁），spec §5.1-§5.4 已写。
> L3 延后：决策 2（session 创建时机）/ 5（cost tracking）/ 7（中断恢复）/ 13（任务拆分）。

**Design Spec 参考**：`docs/superpowers/specs/2026-04-15-m4-teaching-mode-design.md` §5.1-§5.4 + §4.3

---

### L2 依赖图

```
Tier A（可与 L1 并行，纯前端组件 + 小 API）：
  Task 12 (Codex): L2 后端 4 件套
  Task 13 (Gemini): Modal/Dialog 组件
  Task 14 (Gemini): BookTOC 组件（基础态 + 引导态）
  Task 15 (Gemini): ObjectivesList 组件

Tier B（依赖 Tier A 组件 + Task 12 API）：
  Task 16 (Gemini): /books/[bookId] 页面改造
    ← Task 12 + 13 + 14
  Task 17 (Gemini): /modules/[moduleId]/activate 页面
    ← Task 15

Tier C（依赖 L1 Task 10 API 完成）：
  Task 18 (Gemini): /modules/[moduleId]/teach 页面（最重）
    ← L1 Task 10
  Task 19 (Gemini): /modules/[moduleId]/teaching-complete 中间页
    ← Task 12 (start-qa API) + Task 18
```

关键路径：L1 Task 10 → L2 Task 18 → L2 Task 19。Tier A 全部可与 L1 并行。

---

### L2 文件清单

**新建文件**：

| 文件 | Task | 角色 |
|------|------|------|
| `src/app/api/modules/[moduleId]/route.ts` | 12 | Codex |
| `src/app/api/modules/[moduleId]/clusters/route.ts` | 12 | Codex |
| `src/app/api/books/[bookId]/switch-mode/route.ts` | 12 | Codex |
| `src/app/api/books/[bookId]/modules/[moduleId]/reset-and-start/route.ts` | 12 | Codex |
| `src/app/api/modules/[moduleId]/start-qa/route.ts` | 12 | Codex |
| `src/lib/book-meta-analyzer.ts` | 12 | Codex |
| `src/components/ui/Modal.tsx` | 13 | Gemini |
| `src/components/BookTOC/index.tsx` | 14 | Gemini |
| `src/components/BookTOC/BookTOCItem.tsx` | 14 | Gemini |
| `src/components/ObjectivesList.tsx` | 15 | Gemini |
| `src/components/ModeSwitch/ModeSwitchDialog.tsx` | 16 | Gemini |
| `src/app/modules/[moduleId]/activate/page.tsx` | 17 | Gemini |
| `src/app/modules/[moduleId]/teach/page.tsx` | 18 | Gemini |
| `src/app/modules/[moduleId]/teaching-complete/page.tsx` | 19 | Gemini |

**修改文件**：

| 文件 | Task | 改动 |
|------|------|------|
| `src/app/api/modules/[moduleId]/status/route.ts` | 12 | Codex（扩展 VALID_STATUSES / VALID_TRANSITIONS 加 `'taught'` + `'qa_in_progress'`） |
| `src/app/books/[bookId]/page.tsx` | 16 | HeroCard 加模式徽章 + 切换按钮 + 左侧 BookTOC 集成 |

---

## Task 12: L2 后端 4 件套（Codex）

**目标**：6 个 L2 新增 API endpoint + 1 个推荐规则模块 + 1 个 learning_status 枚举扩展

**依赖**：L1 Task 3（schema 落地，books 表有 `learning_mode` 列）

**文件**：
- 新建 `src/app/api/modules/[moduleId]/route.ts`（GET 模块详情 + KP 列表；Task 17/19 依赖）
- 新建 `src/app/api/modules/[moduleId]/clusters/route.ts`（GET cluster 列表 + 每 cluster 的 KP 索引；Task 18 跨 cluster 推进依赖）
- 新建 `src/app/api/books/[bookId]/switch-mode/route.ts`
- 新建 `src/app/api/books/[bookId]/modules/[moduleId]/reset-and-start/route.ts`
- 新建 `src/app/api/modules/[moduleId]/start-qa/route.ts`
- 新建 `src/lib/book-meta-analyzer.ts`
- 修改 `src/app/api/modules/[moduleId]/status/route.ts`（VALID_STATUSES + VALID_TRANSITIONS 补 `'taught'` / `'qa_in_progress'`）

### Steps

- [ ] **Step 12.0a: 扩展 `learning_status` 枚举（修 `src/app/api/modules/[moduleId]/status/route.ts`）**

既有 `VALID_STATUSES = ['unstarted', 'reading', 'qa', 'notes_generated', 'testing', 'completed']`（line 6）不含 teaching 流程需要的 `'taught'` / `'qa_in_progress'`。`modules.learning_status` 列 **无 DB CHECK 约束**（`src/lib/schema.sql:35` 只是 `TEXT NOT NULL DEFAULT 'unstarted'`），故只需改应用层。

把该文件 line 6-14 的常量替换为：

```ts
const VALID_STATUSES = [
  'unstarted',
  'reading',
  'taught',           // M4 新增：教学阶段完成
  'qa_in_progress',   // M4 新增：Q&A 进行中
  'qa',
  'notes_generated',
  'testing',
  'completed',
]
const VALID_TRANSITIONS: Record<string, string[]> = {
  unstarted: ['reading', 'taught'],       // M4：teaching 模式从 unstarted 直接到 taught
  reading: ['qa'],
  taught: ['qa_in_progress'],             // M4：teaching 完成 → start-qa
  qa_in_progress: ['qa', 'notes_generated'], // 兼容既有 flow
  qa: ['notes_generated'],
  notes_generated: ['testing', 'completed'],
  testing: ['completed'],
  completed: [],
}
```

**Design rationale**：teaching 模式的 module 走 `unstarted → taught → qa_in_progress → qa → notes_generated → testing → completed`；原 full 模式走 `unstarted → reading → qa → ...` 不变。`taught` 由 Task 18 前端在 module 所有 cluster 的所有 KP 都 covered 时 PATCH 进入。

- [ ] **Step 12.0b: 新建 `GET /api/modules/[moduleId]/route.ts`（Task 17/19 依赖）**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireModuleOwner } from '@/lib/auth'
import { queryOne, query } from '@/lib/db'
import { UserError } from '@/lib/errors'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const { moduleId } = await params
  const id = Number(moduleId)
  try {
    await requireModuleOwner(req, id)
  } catch (e) {
    if (e instanceof UserError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.statusCode })
    }
    throw e
  }
  const mod = await queryOne<{
    id: number
    book_id: number
    title: string
    summary: string
    order_index: number
    kp_count: number
    cluster_count: number
    learning_status: string
  }>(
    `SELECT id, book_id, title, summary, order_index, kp_count, cluster_count, learning_status
     FROM modules WHERE id=$1`,
    [id]
  )
  if (!mod) return NextResponse.json({ error: 'Module not found' }, { status: 404 })

  const kps = await query<{
    id: number
    kp_code: string
    section_name: string
    description: string
    importance: number
    cluster_id: number | null
  }>(
    `SELECT id, kp_code, section_name, description, importance, cluster_id
     FROM knowledge_points WHERE module_id=$1 ORDER BY id ASC`,
    [id]
  )

  return NextResponse.json({ ...mod, knowledge_points: kps })
}
```

**契约**：
- Task 17 `activate/page.tsx` 用 `{ title, kp_count, learning_status }`
- Task 19 `teaching-complete/page.tsx` 用 `{ title, knowledge_points: [{section_name}] }`
- **不返回** `kp.type` / `kp.detailed_content` / `kp.ocr_quality`（护城河——parent spec §5.4 `不展示：教学对话片段、KP type、KP importance`；importance 这里返回了但 Task 19 不渲染，为了 Task 17 的"重要 KP 标红"等未来可能用到；若 spec 严禁则从 SELECT 移除）
- `requireModuleOwner` 抛 `UNAUTHORIZED` / `NOT_FOUND` 由外层 catch 映射成 401 / 403 / 404

- [ ] **Step 12.0c: 新建 `GET /api/modules/[moduleId]/clusters/route.ts`（Task 18 依赖）**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireModuleOwner } from '@/lib/auth'
import { query } from '@/lib/db'
import { UserError } from '@/lib/errors'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const { moduleId } = await params
  const id = Number(moduleId)
  try {
    await requireModuleOwner(req, id)
  } catch (e) {
    if (e instanceof UserError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.statusCode })
    }
    throw e
  }

  const rows = await query<{
    id: number
    name: string
    kp_ids: number[]
  }>(
    `SELECT c.id, c.name,
       COALESCE(
         ARRAY_AGG(kp.id ORDER BY kp.id ASC) FILTER (WHERE kp.id IS NOT NULL),
         ARRAY[]::int[]
       ) AS kp_ids
     FROM clusters c
     LEFT JOIN knowledge_points kp ON kp.cluster_id = c.id
     WHERE c.module_id = $1
     GROUP BY c.id, c.name
     ORDER BY c.id ASC`,
    [id]
  )
  return NextResponse.json({ clusters: rows })
}
```

**契约**：响应 `{ clusters: [{id, name, kp_ids: [int]}, ...] }`。前端 Task 18 据此实现跨 cluster 推进：已知当前 cluster id → 找 index → +1 取下一个；若 `kp_ids.length === coveredKpIds ∩ kp_ids` 则跳过空 cluster（虽 schema 上允许但 M4 scope 不会出现）。

- [ ] **Step 12.1: `POST /api/books/[bookId]/switch-mode`**
  - 请求体：`{ newMode: 'teaching' | 'full' }`
  - 行为：`UPDATE books SET learning_mode = $1 WHERE id = $2`
  - 校验：`requireUser(request)` + book 归属当前用户
  - 返回：`{ ok: true, learningMode: newMode }`

- [ ] **Step 12.2: `POST /api/books/[bookId]/modules/[moduleId]/reset-and-start`**
  - 请求体：`{}`
  - 行为：
    1. 校验 module 属于 book + book 归属当前用户
    2. `UPDATE modules SET learning_status = 'unstarted' WHERE id = $1`（枚举值为 `'unstarted'`，不是 `'not_started'`——`src/lib/schema.sql:35` 的 default 就是这个）
    3. 返回 `{ ok: true, redirectUrl: '/modules/{moduleId}/activate' }`
  - **不删除** 既有 QA / test 数据（spec §5.3.5 明确；仓库无 `qa_sessions` 表，问答记录在 `qa_questions` / `qa_responses`，keyed by module_id，不动即可）

- [ ] **Step 12.3: `POST /api/modules/[moduleId]/start-qa`**
  - 请求体：`{}`
  - 行为：
    1. 校验 `modules.learning_status === 'taught'`，否则 400 `{ error: 'Teaching phase not complete', code: 'TEACHING_NOT_DONE' }`
    2. `UPDATE modules SET learning_status = 'qa_in_progress' WHERE id = $1`（走新扩展的 VALID_TRANSITIONS `'taught' → 'qa_in_progress'`）
    3. 返回 `{ qaSessionId: <moduleId>, redirectUrl: '/modules/<moduleId>/qa' }`
  - **不造新表**：仓库无 `qa_sessions` 表，现有 QA 系统以 `module_id` 作为 session 标识（`src/app/api/modules/[moduleId]/questions/route.ts` 生成题目 keyed by module）。`qaSessionId` 此处 = `moduleId`，Task 19 前端直接用于跳 `/modules/[moduleId]/qa/[qaSessionId]`。若未来真造 qa_sessions 表（非 M4 scope），替换此返回即可，前端不变（字段名抽象）。

- [ ] **Step 12.4: `src/lib/book-meta-analyzer.ts`**
  ```ts
  type ModeRecommendation = {
    recommended: 'teaching' | 'full' | null  // null = 不强推荐
    reason: string  // 推荐文案，直接用于弹窗
  }
  export function getRecommendation(bookMeta: {
    kpCount: number
    subject?: string
    scanQuality?: 'good' | 'fair' | 'poor'
  }): ModeRecommendation
  ```
  - 规则（spec §5.3.2）：KP ≥ 40 / 学科 ∈ {数学,物理,经济} / 扫描差 → 推荐教学；KP < 20 / 学科 ∈ {文学,历史} / 扫描好 → 推荐完整；其他 → null

- [ ] **Step 12.5: 验证脚本 `scripts/test-m4-task12-l2-apis.ts`**

  前置：`npm run dev` 在跑；`.env.local` 有 TEST_EMAIL/TEST_PASSWORD（Task 10 Step 10.4 已准备的账号）；用 login curl 拿 cookie 放入 `./.tmp-cookies.txt`（参考 Task 10 Step 10.4 命令）。

  Smoke 覆盖：
  1. `GET /api/modules/[id]` → 200，响应含 `{ id, title, knowledge_points: [...] }`
  2. `GET /api/modules/[id]/clusters` → 200，响应 `{ clusters: [{id, name, kp_ids}] }`；`kp_ids` 是数字数组
  3. `PATCH /api/modules/[id]/status` 从 `'unstarted'` 到 `'taught'` → 200（走新 VALID_TRANSITIONS）
  4. `POST /api/modules/[id]/start-qa` 在 `'taught'` 态下 → 200，返回 `{ qaSessionId, redirectUrl }`
  5. `POST /api/books/[id]/switch-mode` with `{ newMode: 'teaching' }` → 200
  6. `POST /api/books/[id]/modules/[mid]/reset-and-start` → 200，`learning_status` 变回 `'unstarted'`
  7. book-meta-analyzer 规则单元测试（KP=50/subject=数学 → teaching；KP=10/subject=文学 → full；KP=30 → null）

  跑：

  ```bash
  npx tsx --env-file=.env.local scripts/test-m4-task12-l2-apis.ts
  ```

  Expected: 7 tests pass。

- [ ] **Step 12.6: Commit**

---

## Task 13: Modal/Dialog 组件（Gemini）

**目标**：Component Library 新增通用弹窗组件，供 ModeSwitchDialog 和后续弹窗使用

**依赖**：无

**文件**：新建 `src/components/ui/Modal.tsx`

### Steps

- [ ] **Step 13.1: 新建 `src/components/ui/Modal.tsx`**
  - 使用 HTML `<dialog>` 元素 + Tailwind 样式（不引新依赖）
  - Props: `{ open, onClose, title, children }`
  - Amber Companion 风格：白底 + `border-amber-200` + rounded-xl + backdrop blur
  - 支持 ESC 关闭 + 点击 backdrop 关闭
  - 无障碍：`aria-modal="true"` + focus trap

- [ ] **Step 13.2: 验证**
  - 在 dev server 里临时挂载，确认打开/关闭/ESC/backdrop 均正常
  - 确认 Tailwind v4 样式生效

- [ ] **Step 13.3: Commit**

---

## Task 14: BookTOC 组件（Gemini）

**目标**：书级章节+模块目录组件，支持基础态（永久导航）+ 引导态（模式切换时选起点）

**依赖**：无（纯前端组件，数据从 page props 传入）

**文件**：新建 `src/components/BookTOC/index.tsx` + `BookTOCItem.tsx`

**Design spec**：§5.3.3

### Steps

- [ ] **Step 14.1: 新建 `src/components/BookTOC/BookTOCItem.tsx`**
  - 单个模块条目：序号 + 模块名 + 状态 badge（✓ 已完成 / 学习中 / 未开始）
  - Amber Companion 风格：`bg-amber-50` hover 态 + 左侧圆点

- [ ] **Step 14.2: 新建 `src/components/BookTOC/index.tsx`**
  - Props:
    ```ts
    type BookTOCProps = {
      modules: Array<{ id: string; name: string; learningStatus: string; moduleGroup?: string }>
      collapsed?: boolean
      onToggleCollapse?: () => void
      // 引导态
      guideMode?: boolean
      recommendedModuleId?: string  // 箭头指向哪个
      onModuleClick?: (moduleId: string) => void
    }
    ```
  - **基础态**：两层（`moduleGroup` → modules），可折叠/展开，`Ctrl+B` 或折叠按钮
  - **引导态**（`guideMode=true`）：
    - 整体：amber 发光边框 + 放大
    - 已完成/学习中模块灰化（`opacity-40`）
    - 未开始模块正常色 + 可点击
    - `recommendedModuleId` 模块旁显示脉冲动画箭头 `→`
    - 顶部浮动提示："👆 点击模块从这里开始教学"
  - 引导态退出：用户点模块 → 触发 `onModuleClick` → 父组件处理跳转

- [ ] **Step 14.3: 验证**
  - 在 `/books/[bookId]` 临时挂载，确认基础态渲染 + 折叠/展开
  - 手动传 `guideMode=true` 确认引导态动画

- [ ] **Step 14.4: Commit**

---

## Task 15: ObjectivesList 组件（Gemini）

**目标**：Phase 0 激活页的"本次你将掌握"知识点列表组件

**依赖**：无

**文件**：新建 `src/components/ObjectivesList.tsx`

**Design spec**：§5.1.2

### Steps

- [ ] **Step 15.1: 新建 `src/components/ObjectivesList.tsx`**
  - Props:
    ```ts
    type ObjectiveItem = {
      id: string    // kp.id
      title: string // 映射自 kp.section_name
      summary: string // 映射自 kp.description
    }
    type Props = { items: ObjectiveItem[] }
    ```
  - 每个 KP 一个独立 card：`bg-amber-50/80` + border + rounded-lg
  - 左侧序号徽章（① ② ③...，圆形背景）+ 中间 title（14px 粗体）+ summary（13px 次级色）
  - **严禁**：不接受 `kp.type` / `kp.importance` 任何 prop（护城河原则）

- [ ] **Step 15.2: 验证**
  - 传入 5 条 mock KP，确认渲染 + 样式

- [ ] **Step 15.3: Commit**

---

## Task 16: `/books/[bookId]` 页面改造（Gemini）

**目标**：现有 book 页面加入模式切换按钮 + BookTOC 左侧导航 + 弹窗交互

**依赖**：Task 12（switch-mode + reset-and-start API）+ Task 13（Modal）+ Task 14（BookTOC）

**文件**：
- 修改 `src/app/books/[bookId]/page.tsx`
- 新建 `src/components/ModeSwitch/ModeSwitchDialog.tsx`

**Design spec**：§5.3

### Steps

- [ ] **Step 16.1: 新建 `src/components/ModeSwitch/ModeSwitchDialog.tsx`**
  - 复用 Task 13 的 Modal 组件
  - Props: `{ open, onClose, bookId, currentMode, bookMeta, onSwitchComplete }`
  - 内容：标题 + 推荐提示（调 `book-meta-analyzer` API 或在前端计算）+ 3 维差异表 + 底部提示 + `[取消]` `[确定切换]`
  - 确认后调 `POST /api/books/[bookId]/switch-mode`，成功后 `onSwitchComplete()` 触发父组件进入 BookTOC 引导态
  - 文案参照 spec §5.3.4

- [ ] **Step 16.2: 修改 `src/app/books/[bookId]/page.tsx`**
  - HeroCard 右上角：当前模式徽章 `当前：🎓 教学模式` + `⇄ 切换模式` 按钮
  - 左侧加 BookTOC（从 API 获取 book.modules，传入 BookTOC）
  - 页面 state 管理：
    - `guideMode: boolean`（默认 false）
    - 弹窗确认后 → `setGuideMode(true)` → BookTOC 进入引导态
    - BookTOC `onModuleClick(moduleId)` → 调 `POST /api/books/[bookId]/modules/[moduleId]/reset-and-start` → 跳 `/modules/[moduleId]/activate`
  - 布局改为 `flex`：左侧 BookTOC（w-64，可折叠）+ 右侧主内容区（现有 HeroCard + 模块列表）

- [ ] **Step 16.3: 端到端验证**
  - 确认：按钮 → 弹窗 → 确认 → BookTOC 引导态 → 点模块 → 跳转 activate 页
  - 确认：取消弹窗不改变任何状态
  - 确认：ESC 关闭弹窗

- [ ] **Step 16.4: Commit**

---

## Task 17: `/modules/[moduleId]/activate` 激活页（Gemini）

**前置**：Task 12 Step 12.0b 已落 `GET /api/modules/[moduleId]` endpoint。本 task 调用该 endpoint 拿 `{ title, kp_count, learning_status, knowledge_points }`。


**目标**：教学模式 Phase 0 "读前指引"页面

**依赖**：Task 15（ObjectivesList）

**文件**：新建 `src/app/modules/[moduleId]/activate/page.tsx`

**Design spec**：§5.1

### Steps

- [ ] **Step 17.1: 新建 `src/app/modules/[moduleId]/activate/page.tsx`**
  - Fetch `GET /api/modules/[moduleId]`，取 module info + knowledge_points 数组
  - 映射：`{ id: kp.id, title: kp.section_name, summary: kp.description }` → 喂给 ObjectivesList
  - **不传** `kp.type` / `kp.importance`（护城河原则）
  - 布局：面包屑 + HeroCard（🎯 本次你将掌握 + 共 N 个知识点 · 预计 {N×7} 分钟）+ ObjectivesList + AmberButton（开始教学 →）
  - 点按钮 → 调 `POST /api/modules/[moduleId]/teaching-sessions`（决策 2 锁定后明确 API 细节；MVP 先 hardcode 一个 session 创建请求）→ 跳 `/modules/[moduleId]/teach`

- [ ] **Step 17.2: 验证**
  - 确认 ObjectivesList 渲染正确 KP 数据
  - 确认"开始教学"按钮跳转

- [ ] **Step 17.3: Commit**

---

## Task 18: `/modules/[moduleId]/teach` 教学页面（Gemini）

**前置**：Task 12 Step 12.0c 已落 `GET /api/modules/[moduleId]/clusters`（cluster 列表 + kp_ids 索引），Task 12 Step 12.0a 已扩展 VALID_TRANSITIONS 加 `'unstarted' → 'taught'`。本 task 依赖这两项跨 cluster 推进 + 完成态 PATCH。


**目标**：Phase 2 教学对话 UI——单栏对话 + cluster 进度 + AI streaming + 完成检测

**依赖**：L1 Task 10（teaching-sessions messages API）

**这是 L2 最重的 task**，预计 6-8h。

**文件**：新建 `src/app/modules/[moduleId]/teach/page.tsx`

**Design spec**：§5.2 + 父 §7.1

### Steps

- [ ] **Step 18.1: 页面骨架**
  - 顶部：cluster 标题（`当前：KP "需求弹性" · 第 2/5 个`）+ 进度条
  - 中间：对话消息列表（用户 + AI teacher，复用现有 `AIResponse` / `ChatBubble` 组件或新建 `TeachingChat`）
  - 底部：输入框 + 发送按钮 + "查看原文"链接

- [ ] **Step 18.2: 对话交互**
  - 发消息：`POST /api/teaching-sessions/[sessionId]/messages` with `{ message: userText }`（注意字段名是 `message`，不是 `userMessage`；参考 L1 Task 10 Step 10.4 curl 范例）
  - 响应体（一次返回，非 streaming）：`{ status, message, kpTakeaway, strugglingStreak, currentKpId, coveredKpIds }`。
  - 进入页面时先 fetch `GET /api/modules/[moduleId]/clusters`（Task 12 Step 12.0c 提供），拿 `clusters: [{id, name, kp_ids}]`。前端维护 `currentClusterIndex`（0-based 索引）+ `clusters` 数组，用于判进度和跨 cluster 推进。
  - 状态机（枚举由 L1 Task 8 Zod schema 硬校验：`'teaching' | 'ready_to_advance' | 'struggling'`）：
    - **`status === 'teaching'`** → 只追加 `message` 到对话区（teacher 气泡），不动进度条，等用户下一轮输入
    - **`status === 'struggling'`** → 同 `teaching` 追加 `message`，另显示小提示 "对这个知识点感到吃力？"。若 `strugglingStreak >= 3`，显示"查看原文"按钮更醒目（spec §6.2 讨论的 hint / 原文跳转入口；本 task 只占位提示，hint 系统是 T3 未来工作）
    - **`status === 'ready_to_advance'`** → 追加 `kpTakeaway`（独立样式的"本 KP 小结"卡片）→ 更新进度条（`coveredKpIds.length / 所有 cluster 的 kp_ids 总数`）→ 判断推进：
      - 本 cluster 的 `kp_ids` 是否全部在 `coveredKpIds` 里？
        - 否 → 继续当前 session 的对话，AI 下一轮自然推进到下一个 KP（后端 Task 10 已 `currentKpId = 本 cluster 下一个 KP`）
        - 是 → 当前 cluster 完成。判断是否还有下一 cluster：
          - `currentClusterIndex + 1 < clusters.length` → 前端调 `POST /api/teaching-sessions` 传 `{ moduleId, clusterId: clusters[currentClusterIndex+1].id, depth: 'full' }` 创建新 session（**每 cluster 一个独立 session** 是 M4 最小实现；同一 module 多 session 已允许——父 spec §4.4 teaching_sessions 表无 UNIQUE 约束）。前端 `sessionId` 切到新返回值，`currentClusterIndex++`，重置对话区，显示"开始学习 [下一 cluster.name]"
          - `currentClusterIndex + 1 === clusters.length` → 所有 cluster 完成。前端先 `PATCH /api/modules/[moduleId]/status` with `{ learning_status: 'taught' }`（走新 VALID_TRANSITIONS `'unstarted' → 'taught'`），成功后跳 `/modules/[moduleId]/teaching-complete`

  ⚠️ **不要用 `status === 'continue'` 或 `allClustersDone` 字段**：两者都不在 API 契约里。status 枚举只有 3 值。跨 cluster 推进由前端基于 `clusters` fetch 结果 + `coveredKpIds` 自行判定。

- [ ] **Step 18.3: 进度与 cluster 切换**
  - 顶部进度条（已完成 KP 数 / 总 KP 数）
  - cluster 切换时：清空当前对话区 → 显示新 KP 标题 → 自动发第一条"开始教学"消息（或显示 intro 文案）

- [ ] **Step 18.4: 错误处理 UI**
  - API 返回 429 / 503 → 显示 toast "AI 暂时繁忙，请稍候" + "重发" 按钮
  - API 返回 409（struggling 上限）→ 显示 "AI 老师建议你先回顾一下原文再继续" + 自动跳下一个 KP
  - 网络断 → 显示 "连接中断" + 自动重试

- [ ] **Step 18.5: 只读模式**
  - 如果用户通过浏览器 back 回到 teach 页，检测 `learning_status >= 'taught'` → 禁用输入框 + 显示"教学已完成"提示

- [ ] **Step 18.6: 端到端验证**
  - 创建 session → 发 2-3 条消息 → 观察 AI 回复 → 确认 cluster 推进 → 确认完成跳转
  - 确认错误态（手动断网 / mock 429）显示正确 UI

- [ ] **Step 18.7: Commit**

---

## Task 19: `/modules/[moduleId]/teaching-complete` 中间页（Gemini）

**前置**：Task 12 Step 12.0b 已落 `GET /api/modules/[moduleId]`。


**目标**：教学完成回顾 + 过渡到 Q&A 的手动按钮

**依赖**：Task 12（start-qa API）+ Task 18（teach 页完成后跳转到这里）

**文件**：新建 `src/app/modules/[moduleId]/teaching-complete/page.tsx`

**Design spec**：§5.4

### Steps

- [ ] **Step 19.1: 新建 `src/app/modules/[moduleId]/teaching-complete/page.tsx`**
  - Fetch `GET /api/modules/[moduleId]`，取 module info + knowledge_points 数组
  - 校验 `learning_status === 'taught'`，否则重定向到 book 页
  - 布局（复用 HeroCard + ContentCard + AmberButton）：
    - HeroCard：🎉 教学完成 + "你已跟 AI 老师学完本模块的 {N} 个知识点"
    - ContentCard：回顾清单（每 KP 一行：✓ + `kp.section_name`）
    - 过渡文案："接下来进入 Q&A 练习，通过逐题作答巩固理解。Q&A 不会显示教学对话记录，请独立思考。"
    - AmberButton：`[开始 Q&A 练习 →]`
  - **不展示**：教学对话片段、KP type、KP importance（护城河 + 不变量 #3 延伸）
  - 点按钮 → `POST /api/modules/[moduleId]/start-qa` → 返回 `{ qaSessionId }` → 跳 `/modules/[moduleId]/qa/[qaSessionId]`

- [ ] **Step 19.2: 验证**
  - 确认 `taught` 状态下正确渲染
  - 确认非 `taught` 状态重定向
  - 确认按钮调 start-qa → 跳 QA 页

- [ ] **Step 19.3: Commit**

---

## Task D3（Claude 做）: L2 architecture.md 更新

Task D1/D2 覆盖 L1 变更。本 task 在 L2 完成后追加 L2 的变更：

- [ ] **D3.1**: API 组追加 3 个 L2 端点（switch-mode / reset-and-start / start-qa）
- [ ] **D3.2**: UI 页面清单追加 4 个新页面（activate / teach / teaching-complete + books 页改造）
- [ ] **D3.3**: 组件库追加 4 个新组件（Modal / BookTOC / ObjectivesList / ModeSwitchDialog）
- [ ] **D3.4**: Commit

---

## L2 验证清单

- [ ] Task 12（Codex）3 个 API endpoint 全 smoke 通过
- [ ] Task 13-15（Gemini）3 个新组件独立渲染正常
- [ ] Task 16（Gemini）books 页切换模式全流程通过：按钮 → 弹窗 → BookTOC 引导态 → 点模块 → 跳 activate
- [ ] Task 17（Gemini）activate 页 ObjectivesList 渲染正确
- [ ] Task 18（Gemini）teach 页对话 + cluster 推进 + 完成跳转正常
- [ ] Task 19（Gemini）teaching-complete 中间页 → 开始 Q&A 跳转正常
- [ ] `npx tsc --noEmit` 零 error
- [ ] 护城河合规：全文 grep `kp.type` / `kp.importance` 不出现在任何前端组件中

---

## L3 延后清单（不在本 plan 范围）

以下决策延后到 L1+L2 实施稳定后再 brainstorm：
- Decision 2（session 创建时机——影响 activate → teach 的 API 调用细节）
- Decision 5（cost tracking 字段细节）
- Decision 7（中断恢复 endpoint）
- Decision 13（完整任务拆分——可能调整 Task 编号和合并策略）

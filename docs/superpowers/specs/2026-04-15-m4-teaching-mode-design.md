---
date: 2026-04-15
topic: M4教学模式最小闭环设计
type: spec
status: in_progress
keywords: [M4, teaching-mode, teacher-AI, transcript, prompt]
---

# M4 教学系统最小闭环 Design Spec

**设计日期**: 2026-04-15 启动
**Brainstorm WIP**: `docs/superpowers/specs/2026-04-15-m4-teaching-mode-brainstorm-state.md`
**父设计**: `docs/superpowers/specs/2026-04-12-teaching-system-design.md`

**范围**: M4 实施级 spec，父 spec 未拍板的 13 个决策的具体工程输出（数据模型细节、API schema、UI 规格、prompt 模板、task 拆分）。

> ⏳ **本文档随 brainstorm 逐决策追加**。brainstorm 完成前属于骨架状态，所有 `待拍` 标记随决策锁定替换为具体内容。

---

## 1. 背景

M4 是父教学系统设计 §2.1 定义的最小闭环里程碑。本 spec 解决父 §9 的 7 个开放问题 + 工程落地必需的追加决策（模型选择、失败处理、任务拆分等），共 13 项。

M4 完成后所有教学相关地基就绪，UI 允许简陋，用户可跑通核心教学对话 → QA → 测试流程。M5 在此基础上做 SplitPane + Phase 0 完整版 + 笔记 tab 等差异化升级。

### 前置依赖（审查 I5 硬修复）

**必须在 M4 任意 teacher 相关 task 启动前完成**：

父 spec §4.3 规划的 `knowledge_points.type` 迁移——当前 DB 和 TS 类型的 5 值是旧版：`position / calculation / c1_judgment / c2_evaluation / definition`（见 `src/lib/schema.sql:59`、`src/lib/services/kp-extraction-types.ts:25`）。本 M4 spec §2.2 的 5 个 teacher prompt stage（`teach_factual / teach_conceptual / teach_procedural / teach_analytical / teach_evaluative`）依赖 `kp.type` 为新 5 值。

如果这个 migration 被拖到 M4 之后，M4 teacher 路径上线即挂（查不到 `kp.type='factual'`，`getPrompt('teacher', 'teach_factual')` 也会因 stage 映射失败）。

**解法**：本 M4 第一个 task（见 §7 决策 13 任务拆分）必须是 "KP 类型迁移"——分两小步：
1. 数据库 migration：老 5 值 → 新 5 值（需要父 §4.3 指定的映射规则；若父 spec 未写则本 M4 需补）
2. `extractor` prompt 更新为输出新 5 值
3. `src/lib/services/kp-extraction-types.ts:KPType` TS 枚举替换
4. 既有 KP 数据回填 / 重新 extract（数据量大时走后台任务）

此任务完成前，§2.2 的 5 条 teacher 模板不能 seed 到生产（否则前端调用 `teach_factual` stage 查得到模板，但找不到对应 type 的 KP）。

---

## 2. 模型与 Prompt

### 2.1 teacher 模型选择（brainstorm 决策 1，2026-04-15 锁定）

**MVP 默认模型**：`anthropic:claude-sonnet-4-6`（premium tier）
**free tier 占位**：`google:gemini-2.5-flash-lite`（M4 不触发）

**实施步骤**：

1. **Schema 改动**：
   ```sql
   ALTER TABLE prompt_templates ADD COLUMN model TEXT NULL;
   ```
   同步 `src/lib/schema.sql` 中 `prompt_templates` 的 CREATE TABLE 定义（给新库初始化用）。

2. **新文件 `src/lib/teacher-model.ts`**：
   ```ts
   type Tier = 'free' | 'premium'

   const tierModelMap: Record<Tier, string> = {
     free: 'google:gemini-2.5-flash-lite',
     premium: 'anthropic:claude-sonnet-4-6',
   }

   export function getTeacherModel(tier: Tier, overrideModel?: string | null): string {
     return overrideModel ?? tierModelMap[tier]
   }
   ```

3. **teacher 消息路由集成**（`src/app/api/teaching-sessions/[sessionId]/messages/route.ts`，M4 实施时创建）：
   ```ts
   const tier = await getUserTier(userId) // 'free' | 'premium'，MVP 内永远 'premium'
   const template = await getPrompt('teacher', `teach_${kpType}`)
   const modelId = getTeacherModel(tier, template.model)
   const { text } = await generateText({
     model: registry.languageModel(modelId as ProviderModelId),
     // ...
   })
   ```

4. **teacher 模板初始种子数据**（`src/lib/seed-templates.ts`）：5 条记录的 `model` 字段全为 `null`——全走 `tierModelMap.premium`。

5. **`getUserTier(userId)` 归属**（审查 M1 补充）：放入 `src/lib/entitlement.ts`（与父 §6 `canUseTeaching()` 同文件）。MVP 实现永远 `return 'premium'`，未来改为 `SELECT tier FROM user_subscriptions WHERE user_id=$1`。decision 13 任务拆分时归入 "entitlement 基础" 任务。

6. **模板 CRUD 函数同步**（审查 I3 补充）：加 `model` 列后，以下两个文件需要同步改：
   - `src/lib/prompt-templates.ts`：`INSERT` 常量（line 73）和 `upsertTemplate` 的 UPDATE 分支（line 65）都要把 `model` 加入字段列表——否则未来通过 `upsertTemplate(role, stage, text, model?)` 改模板会悄悄丢 model 值
   - `src/lib/seed-templates.ts`：`INSERT_TEMPLATE_SQL` / `UPSERT_TEMPLATE_SQL` 常量（line 459, 462）同样补 model 字段
   - 两个文件函数签名都加 `model?: string | null` 可选参数，默认 NULL

**父 spec 同步 patch**（审查 I2 补充）：本决策对父 spec 的硬覆盖——父 spec 必须同步 patch：
- 父 §4.6（teacher 种子数据章节）：追加 "新增 `prompt_templates.model TEXT NULL` 列" 的说明
- 父 §附录 B 修改文件列表：追加 `src/lib/schema.sql`（prompt_templates 段）、`src/lib/prompt-templates.ts`、`src/lib/seed-templates.ts`

**为什么不预设 per-template model override**（YAGNI）：
- MVP 没有 head-to-head Socratic 教学 benchmark，无根据决定哪个 KP 类型必须 Opus
- 实际跑一轮后根据 token 消耗/用户反馈再 SQL 升级

**Provider 依赖状态**（已核实 `src/lib/ai.ts`）：
- `@ai-sdk/google` 已装（package.json:12，version ^3.0.53）
- `GOOGLE_GENERATIVE_AI_API_KEY` env 已配（ai.ts:47）
- registry 已注册 `google` provider（ai.ts:59）
- `google:gemini-2.5-flash-lite` 直接可调，无需新增依赖

**调研**：`docs/research/2026-04-15-teacher-model-selection.md`

### 2.2 5 套 teacher prompt 结构（brainstorm 决策 6，2026-04-15 锁定）

**选定方案**：Option B（共享骨架 + 类型特定插件）+ 共享 Zod schema（决策 4 约束带来的强制）+ 直接复用 `docs/research/2026-04-11-ai-prompt-encoding.md` 的 5 个教师人格与 `docs/research/2026-04-11-pedagogy-knowledge-matching.md` 的 5 套教学流程，不重新设计。

**拒绝的方案**：
- A（5 套完全独立）：维护成本高，认知卸载硬规则要跨 5 份复制，未来调整规则要改 5 次
- C（每类型独立 Zod schema）：决策 4 已锁统一 envelope（`version + state + messages`），所有类型输出相同 `TranscriptOutput` 结构，独立 schema 纯冗余

**三层架构落位**：

| 层 | 位置 | 内容 | 变更频率 |
|---|-----|------|---------|
| Layer 1（共享规则常量） | `src/lib/teacher-prompts.ts`（新建 TS 常量） | 认知卸载防护 / 困惑诊断 / 反馈原则 / 回应长度控制 / 输出 JSON schema 说明 / status 枚举语义 / teacher 角色边界 | 低（跨 5 类型共享） |
| Layer 2（类型特定教学法） | `prompt_templates` 表 5 条记录（`role='teacher'`, `stage='teach_{type}'`） | 教师人格定位 + 5 步教学流程模板 | 中（按 KP 类型定制） |
| Layer 3（运行时注入） | API route 组装时注入 | 当前 KP 内容 + 整个 cluster KPs 上下文 + 对话历史最近 10 轮 + strugglingStreak + 本轮学生输入 | 每次调用 |

**Layer 1 共享规则（7 块）**：

1. **认知卸载防护** — 来源 `ai-prompt-encoding.md` §168-185
   - 绝对禁止：直接给完整答案、代替学生思考、跳步省略推理、替学生总结结论
   - 必须：拆解问题、给 hint 不给 answer、让学生自己说出关键步骤
2. **困惑诊断** — 来源同源 §187-198
   - 4 层困惑识别（词汇/概念/推理/元认知）× 4 策略映射
3. **反馈原则** — 来源同源 §200-209
   - 错误三分类处理（知识性错误 / 推理错误 / 表达不清）
4. **回应长度控制** — 来源同源 §211-218
   - 100-200 字，每轮一个主点，最多 3 段
5. **输出 JSON schema 契约** — 决策 4 带来（审查 I4 收紧）
   - AI 每轮只返回**增量**：`TranscriptOutput = { status: 'teaching' | 'ready_to_advance' | 'struggling', kpTakeaway: string | null, message: string }`
   - `strugglingStreak` **不**在 AI 输出里（API 层权威，见 §4.1）；持久信封的其他 state 字段（tokens / coveredKpIds / lastActiveAt 等）也由 API 累加，不要求 AI 返回
   - merge 规则完整表见 §3.1 "AI 输出 → 持久信封 merge 规则"
6. **status 枚举语义** — 决策 3 带来
   - `teaching` / `ready_to_advance` / `struggling`；连续 3 轮 struggling 触发强制二选一（重读原文 / 跳 QA）
7. **teacher 角色边界**
   - teacher ≠ coach（coach 负责 Q&A 辅导，禁止解题）
   - teacher ≠ examiner（examiner 评分，teacher 不评分）

**Layer 2 五条模板（prompt_templates 新增）**：

| stage 值 | KP 类型 | 教师人格 | 5 步教学流程（来自 `pedagogy-knowledge-matching.md` §51-157） |
|---------|--------|---------|---------------------------------------------------|
| `teach_factual` | factual（事实记忆） | 教授型 | 类比锚定 → 正式定义 → 理解追问 → 学生复述 → 间隔测验 |
| `teach_conceptual` | conceptual（概念理解） | 导师型 | 激活先知 → 类比桥梁 → 正反例对比 → 学生自述 → 迁移应用 |
| `teach_procedural` | procedural（流程操作） | 教练型 | 完整演示 → Faded Example（部分空白） → 学生独立 → 变式练习 → 错误分析 |
| `teach_analytical` | analytical（分析推理） | 师傅型 | Modeling（示范思考） → Coaching（过程指导） → Scaffolding（搭架子） → Articulation（学生说出思路） → Reflection |
| `teach_evaluative` | evaluative（评价判断） | 同行型 | 真实案例 → 学生初判 → 反面证据注入 → What-if 假设 → 立场迭代 |

所有 5 条记录的 `model` 字段保持 NULL，走决策 1 定义的默认 fallback（Sonnet 4.6）。

**Layer 3 运行时注入变量（`src/lib/prompt-templates.ts` 的 `renderTemplate` 机制）**：

- `{kp_content}` — 当前 KP 的 name + description
- `{cluster_kps}` — cluster 内所有 KPs 的列表（teacher 需全局视角判断 advance）
- `{history}` — transcript.messages 最近 10 条（用户 + AI），格式化为对话文本
- `{struggling_streak}` — 当前连续 struggling 轮数（0-2，满 3 由 API 层拦截不再调模型）
- `{student_input}` — 本轮学生新输入

**调用方式**：API route `src/app/api/teaching-sessions/[sessionId]/messages/route.ts` 用 Vercel AI SDK `generateObject({ schema: TranscriptOutputSchema, messages: [...] })`，schema 校验失败落决策 12（§2.3）。

**新增依赖**（审查 C1 补充）：本 M4 首次引入 Zod。`package.json` 新增 `zod`（^3.x，与 AI SDK 兼容）。仓库此前从未使用 `generateObject` 或 Zod，Codex 实施时不得用 TypeScript `type` 替代——必须是运行时可校验的 Zod schema，否则决策 12 的 "内容层错误 → 重试循环" 完全失效（TS type 不产生 `AI_TypeValidationError`）。依赖加入后，`src/lib/teacher-prompts.ts` 从 `zod` import `z`，定义 `TranscriptOutputSchema = z.object({...})`。

**Layer 1 模板文字不入 prompt_templates 表**：Layer 1 规则属跨 5 类型共享的工程常量，放 TS 文件便于版本管理 + code review；表里只放 Layer 2 可替换教学法内容，未来调教学法不需要改代码。

**实施 deliverables**：
- `src/lib/teacher-prompts.ts`（新建）— Layer 1 的 7 块常量 + `TranscriptOutputSchema` Zod 定义 + `buildTeacherMessages(role, kp, cluster, history, streak, input)` 辅助函数
- `src/lib/seed-templates.ts`（追加 5 条 `role='teacher'` 记录）
- `src/app/api/teaching-sessions/[sessionId]/messages/route.ts`（新建）— 消费以上两项

### 2.3 错误/超时处理（brainstorm 决策 12，2026-04-15 锁定）

**选定方案**：Option A——3 次指数退避重试 + 失败后 toast + 对话状态完整保留。

**错误分类**（2 大类都走同一重试循环）：

| 类别 | 触发 | 处理 |
|------|-----|------|
| 网络层 | 超时 / 429 / 5xx / 断网 | 1s → 2s → 4s 退避重试 |
| 内容层 | `generateObject` 抛 `AI_TypeValidationError`（Zod schema 校验失败） | 同上，模型格式抽风重发大概率过 |

**4xx（除 429）不重试**：直接 500 + `console.error`，通常是代码 bug（schema 定义错 / 请求参数错），重试无意义。

**3 次失败后行为**：
- API 返回 503 + `{ reason: 'teacher_unavailable' | 'invalid_output', retryable: true }`
- `transcript.state.lastError = { reason, at: ISO timestamp, attemptCount: 3 }` 写入数据库；**不写入失败那轮的 assistant message**，保持对话历史洁净
- `transcript.state.lastActiveAt` 保留到最后一次**成功**的时刻
- 前端 toast 中文："AI 暂时不在线，请稍后继续"
- 用户可点"重发"按钮再试；或退出会话，下次重入（决策 7）

**不做模型降档 fallback**：决策 1 的 tier → model 映射是付费承诺，自动降档破坏承诺；付费用户悄悄被降档 = 教学质量与计费不匹配。

**strugglingStreak 与失败的隔离**：
- strugglingStreak=3 是教学状态（学生困惑），API 层拦截不再调模型、推"重读 / 跳 QA"二选一
- 失败是系统故障；重试成功后 strugglingStreak 照常演算；3 次失败不改 strugglingStreak（那轮视为未发生）

**envelope 扩展**（决策 4 的 state 新增可选字段）：

```ts
state: {
  status: 'teaching' | 'ready_to_advance' | 'struggling'
  strugglingStreak: number
  currentKpId: string
  lastActiveAt: string
  tokensInTotal: number
  tokensOutTotal: number
  lastError?: {
    reason: 'teacher_unavailable' | 'invalid_output'
    at: string
    attemptCount: number
  }
}
```

**实施 deliverables**：
- `src/lib/retry.ts`（新建，跨模块复用）— `retryWithBackoff(fn, { maxAttempts: 3, baseMs: 1000 })` + 错误分类 helper（区分 retryable 网络错 / Zod 错 / 不可重试 4xx）
- `src/app/api/teaching-sessions/[sessionId]/messages/route.ts` 内集成 `retryWithBackoff` 包 `generateObject` 调用
- 前端 teaching chat 组件消费 503 → toast + 重发按钮（具体组件名由决策 13 拆分时定）
- `transcript` TS 类型 `state` 扩展 `lastError?`（决策 4 的 §3.1 类型定义同步更新）

---

## 3. 数据模型

（父 spec §4 已拍全部 7 项 schema 改动，本节只追加 M4 落地细节）

### 3.1 teaching_sessions.transcript 格式（brainstorm 决策 4，2026-04-15 锁定）

**结构**：信封式 JSON——顶层 `version` + `state` + `messages`。state 显式存当前进度避免每次遍历 messages 派生；不扩 teaching_sessions 的 SQL 列定义。

**完整 schema**：

```json
{
  "version": 1,
  "state": {
    "depth": "full | light",
    "currentKpId": 123,
    "coveredKpIds": [121, 122],
    "strugglingStreak": 0,
    "startedAt": "2026-04-15T10:00:00Z",
    "lastActiveAt": "2026-04-15T10:15:00Z",
    "tokensInTotal": 5000,
    "tokensOutTotal": 800
  },
  "messages": [
    {"kind": "socratic_question", "role": "teacher", "content": "...", "kpId": 121, "ts": "...", "tokensIn": 1200, "tokensOut": 150, "model": "anthropic:claude-sonnet-4-6"},
    {"kind": "student_response", "role": "user", "content": "...", "ts": "..."},
    {"kind": "kp_takeaway", "role": "teacher", "kpId": 121, "summary": "...", "ts": "...", "tokensIn": 800, "tokensOut": 80, "model": "anthropic:claude-sonnet-4-6"},
    {"kind": "struggling_hint", "role": "teacher", "content": "...", "kpId": 122, "ts": "...", "tokensIn": 1500, "tokensOut": 200, "model": "anthropic:claude-sonnet-4-6"}
  ]
}
```

**消息字段表**（kind 决定附加字段）：

| kind | 必填 | 可选 |
|------|------|------|
| `socratic_question` | kind, role='teacher', content, ts | kpId, tokensIn, tokensOut, model |
| `student_response` | kind, role='user', content, ts | — |
| `kp_takeaway` | kind, role='teacher', kpId, summary, ts | tokensIn, tokensOut, model |
| `struggling_hint` | kind, role='teacher', content, ts | kpId, tokensIn, tokensOut, model |

**state 字段语义**：

- `version`：schema 版本号，M4 = 1；M5 增字段时 +1，迁移代码读 version 决定 parse 路径
- `depth`：'full' / 'light'，session 创建时定（决策 11 中途切换若启用，会动这里）
- `currentKpId`：当前正在教学的 KP id（默认 cluster 第一个 KP）
- `coveredKpIds`：已完成 takeaway 的 KP id 列表；UI 进度条 = coveredKpIds.length / cluster.kpCount
- `strugglingStreak`：连续 struggling 轮数计数器；§4.1 的 3 轮硬上限读这个；非 struggling 一轮 → 重置为 0
- `startedAt` / `lastActiveAt`：决策 7（中断恢复，L2 延后）的时间窗判断依据
- `tokensInTotal` / `tokensOutTotal`：session 累计；权威源是 per-message tokens，total 为 derived cache，写入时同步累加

**约束 / 规则**：

- 每次写入 = 一个事务：append message + 同步更新 state（包括 strugglingStreak 计数 + tokens 累加 + lastActiveAt）
- teacher 消息必须带 `model` 字段——决策 1 允许 per-template override，未来 KP 类型间可能用不同模型，逐条记录才能精确算成本
- 学生消息不带 tokens（学生输入不过 AI，无意义）
- `messages` 数组按时间顺序追加，不就地编辑（产品不变量延伸：教学历史不可改）

**DB 默认值必须对齐信封结构**（审查 C2 硬修复）：

父 spec §4.4（line 231）原定义 `transcript JSONB NOT NULL DEFAULT '[]'::jsonb` 是 JSON 数组，与本决策的对象型信封**不兼容**。新 session 若未显式写 `transcript` 列，DB 会填 `[]`，后端 `transcript.state.strugglingStreak++` 直接 NPE。

**M4 覆写父 spec line 231**：

```sql
CREATE TABLE IF NOT EXISTS teaching_sessions (
  ...
  transcript JSONB NOT NULL DEFAULT '{"version":1,"state":{"depth":"full","currentKpId":null,"coveredKpIds":[],"strugglingStreak":0,"startedAt":null,"lastActiveAt":null,"tokensInTotal":0,"tokensOutTotal":0},"messages":[]}'::jsonb,
  ...
);
```

（`startedAt` / `lastActiveAt` 初始为 null，由应用层首次写消息时设置；`depth` 默认 `'full'`，session 创建时若决策 11 启用可覆写。）

父 spec 同步 patch：§4.4 line 231 必须同步更新；§附录 B "修改文件" 列表追加 `src/lib/schema.sql`（teaching_sessions 段 transcript 列）。

**AI 输出 → 持久信封 merge 规则**（审查 I1 硬修复）：

AI 每轮返回的 `TranscriptOutput` 是**增量**，API 层负责 merge 进累计 `TranscriptV1`。权威源分配：

| state 字段 | 权威源 | 更新时机 |
|-----------|--------|---------|
| `version` | 常量 | session 创建时写 1，永不变 |
| `depth` | session 创建参数（决策 11 可覆写） | 创建时；切换深度时 |
| `currentKpId` | API 层 | advance 判定通过后 API 设为 next KP id |
| `coveredKpIds` | API 层 | 每当 AI 返回 `kpTakeaway` 非 null 时，API 把当前 KP id push 进数组 |
| `strugglingStreak` | **API 层**（AI 输出的该字段忽略） | 每轮写入时：若 AI 返回 `status='struggling'` 则 `+1`；否则归 0 |
| `startedAt` | API 层 | 第一条消息写入时设置 ISO now，之后不变 |
| `lastActiveAt` | API 层 | 每轮成功写入时刷新为 ISO now |
| `tokensInTotal` / `tokensOutTotal` | API 层 | 每轮成功写入时累加 message 的 tokensIn/tokensOut |
| `lastError` | API 层 | 决策 12 的 3 次重试失败时写入；成功后清空（`undefined`） |

AI 只需返回：`{ status, kpTakeaway?: string | null, message: string }`（决策 4/6 共享 Zod schema 的精确形状）。`strugglingStreak` 不在 Zod schema 里——避免 AI 和 API 计算结果打架。

写入算法（API route 伪码）：

```ts
const aiOutput = await generateObject({ schema: TranscriptOutputSchema, ... })
const envelope = await loadTranscript(sessionId)
envelope.state.lastActiveAt = new Date().toISOString()
envelope.state.strugglingStreak = aiOutput.status === 'struggling' ? envelope.state.strugglingStreak + 1 : 0
envelope.state.tokensInTotal += usage.inputTokens
envelope.state.tokensOutTotal += usage.outputTokens
envelope.messages.push({ kind: aiOutput.status === 'struggling' ? 'struggling_hint' : 'socratic_question', role: 'teacher', content: aiOutput.message, ts: now, ... })
if (aiOutput.kpTakeaway) {
  envelope.state.coveredKpIds.push(envelope.state.currentKpId!)
  envelope.messages.push({ kind: 'kp_takeaway', role: 'teacher', kpId: envelope.state.currentKpId!, summary: aiOutput.kpTakeaway, ts: now, ... })
}
await saveTranscript(sessionId, envelope)
```

**TS type 草案**（M4 实施时落到 `src/lib/teaching-types.ts`）：

```ts
export type TranscriptV1 = {
  version: 1
  state: {
    depth: 'full' | 'light'
    currentKpId: number | null
    coveredKpIds: number[]
    strugglingStreak: number
    startedAt: string | null  // ISO; null 直到首次写消息（DB 默认 null，应用层首次 append message 时设为 ISO now）
    lastActiveAt: string | null  // ISO; 同上
    tokensInTotal: number
    tokensOutTotal: number
    lastError?: {  // 决策 12 扩展（2026-04-15）：3 次重试失败时写入
      reason: 'teacher_unavailable' | 'invalid_output'
      at: string  // ISO
      attemptCount: number
    }
  }
  messages: TranscriptMessage[]
}

export type TranscriptMessage =
  | { kind: 'socratic_question'; role: 'teacher'; content: string; ts: string; kpId?: number; tokensIn?: number; tokensOut?: number; model?: string }
  | { kind: 'student_response'; role: 'user'; content: string; ts: string }
  | { kind: 'kp_takeaway'; role: 'teacher'; kpId: number; summary: string; ts: string; tokensIn?: number; tokensOut?: number; model?: string }
  | { kind: 'struggling_hint'; role: 'teacher'; content: string; ts: string; kpId?: number; tokensIn?: number; tokensOut?: number; model?: string }
```

### 3.2 cost tracking 字段位置

待拍（brainstorm 决策 5）

### 3.3 session 创建/生命周期时机

待拍（brainstorm 决策 2）

---

## 4. APIs

（父 spec §5 已拍契约，本节补 M4 实施细节）

### 4.1 cluster 完成判定 + shouldAdvance 语义（brainstorm 决策 3，2026-04-15 锁定）

**机制**：Option C 混合模式——AI 发状态建议，UI 显进度条，学生有跳过权，struggling 硬兜底。

**teacher 每轮响应 schema**：

```json
{
  "message": "Socratic 问题 / 解释 / 鼓励",
  "status": "teaching | ready_to_advance | struggling",
  "progress": {
    "currentKpId": 123,
    "coveredKpIds": [121, 122]
  },
  "kpTakeaway": {
    "kpId": 122,
    "summary": "1-2 句精简总结"
  }
}
```

(`kpTakeaway` 为 null 时表示本轮没教完 KP)

**status 语义 + UI 联动**：

| status | teacher 下一轮行为 | "下一节"按钮 UI | 附加 UI |
|--------|-----------------|----------------|--------|
| `teaching` | 继续启发式对话 | 存在但灰度 | — |
| `ready_to_advance` | 继续或等推进 | 变绿发光 | — |
| `struggling` | 换教学角度（换问法/类比） | 保持灰度 | 弹"查看原文"链接 |

**"下一节"按钮永远可点**——学生自主跳过权优先于 AI 判定。按钮文案：
- 中间 cluster：`→ 下一节`
- 本模块最后一个 cluster：`→ 进入 QA`

**无全局轮数上限**——有效教学对话可能 15+ 轮，一刀切会杀掉深度讨论。

**struggling 硬上限（唯一保底）**：

- 连续 3 轮 `status: 'struggling'` → 教学对话**冻结**
- 强制二选一，不提供"继续聊"：
  - `← 回去再读一次原文`（跳回 Phase 1，可重新开启 Phase 2）
  - `→ 直接进 QA 试试`（跳到 Phase 3，靠 QA 错题反馈补）
- 中间任意一轮非 struggling 计数清零
- 阈值 3 的依据：1 轮可能只是没答好；2 轮算趋势；3 轮是 AI 换过一次角度仍未通 = 系统性卡住

**strugglingStreak 权威源**（审查 I4 硬修复）：

- **API 层是唯一权威**——每轮 AI 调用成功后，API 读 `aiOutput.status`，若 `'struggling'` 则 `envelope.state.strugglingStreak += 1`，否则归 0，然后写 DB
- Zod schema（`TranscriptOutputSchema`）**不包含** `strugglingStreak` 字段——AI 不输出它，避免 "AI 说 2、API 算到 3" 的错位
- 达到 3 的拦截位置：**下一轮请求进入时**的最前检查——`if (envelope.state.strugglingStreak >= 3) return 409 + forcedChoiceUI`，不再调 teacher 模型
- 决策 12 的 3 次重试失败：**不改 strugglingStreak**（那轮视为未发生，保持既有值）

**KP 教学顺序**：按 cluster 内 knowledge_points 表的现有顺序（已按难度/重要度排过），不新增 schema 字段。

**transcript 写入语义**（本决策对决策 4 的硬约束）：

- teacher `message` → 根据 status 写入 `kind='socratic_question'`（teaching/ready_to_advance）或 `kind='struggling_hint'`（struggling）
- teacher `kpTakeaway` 非 null → 额外追加一条 `kind='kp_takeaway'` 消息（M4 种子，M5 笔记 tab 暴露）
- 学生输入 → 写入 `kind='student_response'`

**为什么不用全局硬上限**（用户 2026-04-15 明确否决）：

- 聊得深 ≠ 聊得坏；健康教学轨迹可能 15+ 轮，粗暴截断伤害体验
- 真正需要保底的是"循环无效"场景（AI 和学生反复错位），"struggling 连续 3 轮"已精确捕获此模式，无需代价更大的全局阈值

### 4.2 中断恢复 endpoint

待拍（brainstorm 决策 7）

### 4.3 教学深度 override 参数（brainstorm 决策 11，2026-04-16 锁定）

**拍定方案 A**：用户**不可 override** 教学深度。API **不接受** `depth` 参数覆盖。

**深度计算完全由后端自动决定**：
- `teaching_sessions.transcript.state.depth` 值（`full | light`）在 session 创建时由后端根据 KP importance 自动填入
- 规则：`importance >= 3` → `full`；否则 → `light`（父设计 §5.2 决策 2 已拍）
- 前端调 `POST /api/modules/[moduleId]/teaching-sessions` 时**不传** depth 字段；后端若收到 depth 参数则**忽略**

**UI 无任何深度选择器**：
- 激活页（§5.1）不加"教学深度"选项
- teach 页（§5.2）不加"切换深度"按钮
- 用户**不知道** "depth" 这个概念的存在（黑盒智能）

**为什么不暴露 depth（4 条理由）**：
1. YAGNI：MVP 无用户数据支持"哪些用户需要切深度"，先跑反馈
2. 认知负担：多一个"自动 / Light / Full"选择器 = 新用户第一次来就要思考区别
3. M5 付费抓手：自定义深度是天然的付费功能候选——免费=AI 自动，付费=可锁定全程 full
4. 护城河一致性：产品叙事是"AI 自动调整教学深度"，暴露 override 破坏黑盒智能感

**反悔成本**：
- M5 启用 override：给 `POST /api/modules/[moduleId]/teaching-sessions` 加 optional `depth` 参数 + 激活页加 radio，1 天工作量
- 给 API guard 包一层 entitlement check（免费用户忽略 depth 参数，付费用户生效）

---

## 5. UI

### 5.1 Phase 0 激活页（brainstorm 决策 9，2026-04-16 锁定）

**拍定方案 D**（新组件，非 A 纯朴素、非 B 复用 KnowledgePointList）。

#### 5.1.1 页面结构

`/modules/[moduleId]/activate` — 教学模式下用户点起点模块后进入；完整模式下不走这个页（照旧 reading → qa 流）。

```
面包屑：📖 {书名} / {模块名} / Phase 0 读前指引

┌── HeroCard ──────────────────────────────┐
│ 🎯 本次你将掌握                          │
│ 共 {N} 个知识点 · 预计 {minutes} 分钟    │
└──────────────────────────────────────────┘

ObjectivesList（新组件）
┌─ KP 卡片 1 ──────────────────────────┐
│ ①  需求价格弹性的定义与公式          │
│    一句话描述（从 KP summary 取）    │
├─ KP 卡片 2 ──────────────────────────┤
│ ②  弹性与斜率的区别                  │
│    ...                               │
└──────────────────────────────────────┘
... 省略 N 条

[ 开始教学 → ]  (AmberButton，占位在卡片列表下方)
```

#### 5.1.2 ObjectivesList 组件规格（新组件）

**文件**：`src/components/ObjectivesList.tsx`

**Props**：
```ts
type ObjectiveItem = {
  id: string         // KP id (knowledge_points.id)
  title: string      // 映射自 knowledge_points.section_name
  summary: string    // 映射自 knowledge_points.description（不新增 DB 字段）
}
type Props = {
  items: ObjectiveItem[]
}
```

**视觉**（Amber Companion 风格）：
- 每个 KP 一个独立 card（`bg-amber-50/80` + border + rounded-lg）
- 左侧序号徽章（`①②③...`，或数字 + 背景圆圈）
- 中间 title（14px 粗体）+ summary（13px 次级色）
- 卡片之间 8-12px 间距

**严格禁止**（见项目记忆 `project_internal-signals-moat.md`）：
- **不接受** `kp.type` 作为 prop
- **不接受** `kp.importance` 作为 prop
- 不渲染任何"factual/conceptual/analytical/..."标签
- 不渲染任何"★"重要性星级
- 这些字段是付费墙 / 推荐算法 / 个性化教学路径的差异化信号，UI 永不暴露

**为什么不复用 KnowledgePointList**：
- KnowledgePointList 是**书级知识点总览**组件，带 type badge，用于 Book 页展示整本书的知识结构
- 语义和 activate 页的"本模块学习目标"不同，共用组件反而让组件职责模糊
- KnowledgePointList 需要加 `simplified` prop 才能隐藏 badge，违反单一职责

**为什么不用 ContentCard + `<ol>`**：
- 朴素列表视觉单薄，用户"心理预热"感不强
- 用户对激活页体验有审美期待（付费产品质感）

#### 5.1.3 后端数据源

`GET /api/modules/[moduleId]` 现有 endpoint 返回 module + knowledge_points 数组。前端映射：`{ id: kp.id, title: kp.section_name, summary: kp.description }` 喂给 `ObjectivesList`，其他字段（type / importance / source_anchor 原文片段等）一律忽略。**不需要新增 DB 字段**。

**Gemini 注意**：fetch module 数据时拿到 KP 对象，**不要**把 `kp.type` 传给任何组件，也**不要**在 activate 页的 JSX 中出现 `kp.type` 或 `kp.importance` 的任何引用。

#### 5.1.4 文案

- 标题（HeroCard）：`🎯 本次你将掌握`
- 副标题：`共 {N} 个知识点 · 预计 {minutes} 分钟`（minutes 从 M4 L1 决策 1 的 Sonnet 4.6 教学深度估算：`N × 7` 分钟作为占位，后续可调）
- 按钮：`开始教学 →`

#### 5.1.5 状态迁移

用户点"开始教学" → 调 `POST /api/modules/[moduleId]/teaching-sessions`（决策 2 锁定时细化）→ learning_status 迁移（**具体中间态名称由决策 2 锁定后明确**，8 值枚举可能需扩展）→ 跳 `/modules/[moduleId]/teach`。

### 5.2 teach page（Phase 2 对话）

整体布局父 §7.1 已定（单栏对话 + 顶部 cluster 标题 + 底部查看原文 + 完成后"继续 QA"按钮）。M4 追加决定：

- ~~教学深度切换器（决策 11）~~ → **不做**（A 方案：用户不可 override，黑盒智能）
- 过渡到 QA 的交互（决策 10）→ **中间页方案 B**（§5.4）
- 中断恢复 UX（决策 7）→ 延后到 L3

### 5.3 模式切换弹窗 + BookTOC 引导态（brainstorm 决策 8，2026-04-15 锁定）

#### 5.3.1 架构概述

模式切换流程由**三个 UI 组件**协作完成：

| 组件 | 职责 | 文件 |
|------|------|------|
| HeroCard 右上角切换按钮 | 触发入口，显示当前模式徽章 | `src/app/books/[bookId]/page.tsx` |
| ModeSwitchDialog | 弹窗：告知差异 + 确认 | `src/components/ModeSwitch/ModeSwitchDialog.tsx` |
| BookTOC | 左侧章节/模块目录（基础态+引导态）**新组件** | `src/components/BookTOC/`（子目录——页面级复合组件，区别于 `ui/` 下的原子组件） |

交互流程：用户点按钮 → 弹窗（告知 3 维差异 + 推荐提示 + 确认）→ 点"确定切换" → 弹窗关闭 + 调用 `POST /api/books/:bookId/switch-mode`（仅更新 mode，不指定起点）→ 响应后 BookTOC 进入引导态 → 用户点任一模块 → 调用 `POST /api/books/:bookId/modules/:moduleId/reset-and-start` → 跳转 `/modules/[moduleId]/activate`。

#### 5.3.2 ModeSwitchDialog 规格

新建 `Modal` 组件（M4 L2 前置 task，Gemini）或使用 HTML `<dialog>` + Tailwind 样式。配合 `AmberButton`。内容结构：

1. **标题**：`切换到教学模式？` / `切换到完整模式？`
2. **推荐提示**（从 `book-meta-analyzer.ts` 获取）：`💡 [推荐语]`
3. **3 维差异表**（流程 / 时间 / 学习效果）——表格形式，不含"数据处理"维度
4. **底部提示**：`点"确定"后，左侧目录会进入选择模式，请选一个模块开始教学。`
5. **按钮**：`[取消]` `[确定切换]`

推荐规则（`book-meta-analyzer.ts` 轻量 if-else）：
- KP 数量 ≥ 40 / 学科 ∈ {数学, 物理, 经济} / 扫描质量 = 差 → 推荐教学
- KP 数量 < 20 / 学科 ∈ {文学, 历史} / 扫描质量 = 好 → 推荐完整
- 其他 → 不强推荐，文案中性（"两种模式都适合这本书，按你偏好选"）

#### 5.3.3 BookTOC 组件规格（新组件）

**位置**：`/books/[bookId]` 左侧永久组件，可折叠/展开（用户可隐藏）

**数据源**：book.modules（两层结构：章节 module_group → 模块 module）

**状态视觉**（基础态）：
- 已完成（completed）：✓ 勾 + 灰色
- 学习中（activating / reading / qa_in_progress / qa_complete / tested）：高亮色
- 未开始（not_started）：正常色

**引导态**（决策 8 专属，仅在模式切换后触发）：
- 目录整体：边框加粗 + 尺寸放大 + 柔和发光（amber 主色）
- 已完成/学习中模块：进一步灰化（降低对比）
- 未开始模块：正常色，可点击
- 箭头动画：指向"推荐起点模块"（`next not_started` 模块；若全部完成，指向第一模块）
- 悬浮提示文案：`👆 点击模块从这里开始教学`
- 点击未开始模块 → 调 `POST /api/books/:bookId/modules/:moduleId/reset-and-start` → 跳 Phase 0 激活页

**引导态退出**：用户点模块跳转即退出；或用户点"取消引导"按钮回到基础态。

#### 5.3.4 文案草稿（弹窗）

完整 → 教学方向：
```
标题：切换到教学模式？

💡 这本书 KP 密度较高（47 个），教学模式会把抽象概念拆开讲，
   更适合打基础。

| 维度     | 完整模式（当前）      | 教学模式（切换后）              |
|----------|----------------------|--------------------------------|
| 流程     | 读原文 → Q&A → 测试  | 读前指引 → 教学对话 → Q&A → 测试 |
| 时间     | 约 20 分钟/模块       | 约 35 分钟/模块（多教学对话）    |
| 学习效果 | 快速过完知识点        | AI 老师讲到你真的懂              |

点"确定"后，左侧目录会进入选择模式，请选一个模块开始教学。

  [ 取消 ]   [ 确定切换 ]
```

反向（教学 → 完整）结构同构，推荐语替换为"这本书 KP 较少（X 个）/ 内容偏实用，完整模式够用"。

#### 5.3.5 后端协作端点

| 端点 | 方法 | 请求体 | 行为 |
|------|------|-------|------|
| `/api/books/[bookId]/switch-mode` | POST | `{ newMode: 'teaching' \| 'full' }` | 仅更新 `books.learning_mode`，不碰 modules 状态 |
| `/api/books/[bookId]/modules/[moduleId]/reset-and-start` | POST | `{}` | 清除该 module 的 learning_status 到 `not_started` + 清相关 progress 字段；返回跳转 URL |

**起点模块 reset 范围**（`src/lib/books/reset-module.ts`）：
- `modules.learning_status` → `not_started`
- （knowledge_points 表无需 reset——KP 进度由 teaching_sessions / qa_responses 关联记录体现，不存在独立 progress 字段）
- 该 module 关联的 `qa_sessions` / `test_sessions` 不删除（历史记录保留，只是不再作为"当前进度"）
- `teaching_sessions` 不动（M4 新表，切换前无数据）

### 5.4 教学 → QA 过渡（brainstorm 决策 10，2026-04-16 锁定）

**拍定方案 B**：独立中间页 `/modules/[moduleId]/teaching-complete` + 用户主动点按钮进入 Q&A。

#### 5.4.1 过渡流程

1. 用户在 teach 页完成最后一个 cluster 的对话
2. 后端 `teaching-sessions/[sessionId]/messages` 响应携带 `allClustersDone: true`
3. 前端自动 `router.push('/modules/[moduleId]/teaching-complete')`——同时后端自动迁移 `learning_status: activating / reading → taught`
4. 中间页展示"教学完成回顾"
5. 用户点击"开始 Q&A 练习 →"按钮 → 前端调 `POST /api/modules/[moduleId]/start-qa` → 后端迁移 `learning_status: taught → qa_in_progress` + 创建 qa_session → 返回 `qaSessionId`
6. 前端跳 `/modules/[moduleId]/qa/[qaSessionId]`

#### 5.4.2 中间页 `/modules/[moduleId]/teaching-complete` 规格

**文件**：`src/app/modules/[moduleId]/teaching-complete/page.tsx`

**布局**（复用现有组件）：

```
┌─ HeroCard ────────────────────────────────┐
│ 🎉 教学完成                               │
│ 你已跟 AI 老师学完本模块的 {N} 个知识点    │
└───────────────────────────────────────────┘

┌─ ContentCard ──────────────────────────────┐
│ 回顾清单：                                 │
│ ✓ KP 1 标题                               │
│ ✓ KP 2 标题                               │
│ ...                                        │
│                                            │
│ 接下来进入 Q&A 练习，通过逐题作答巩固理解。│
│ Q&A 不会显示教学对话记录，请独立思考。     │
└────────────────────────────────────────────┘

[ 开始 Q&A 练习 → ]   (AmberButton)
```

**严格禁止**（遵守产品不变量 + 护城河）：
- 不展示任何教学对话片段（即使不变量 #3 只针对 test 阶段，中间页也保持一致——用户对"教学已封存"有明确预期）
- 不展示 KP type / 重要性等内部字段（见 `project_internal-signals-moat.md`）
- 不提供"返回 teach 页"的显式按钮（如果用户通过浏览器 back 回去，teach 页以**只读模式**展示，不允许继续对话）

#### 5.4.3 状态迁移细节

| 事件 | learning_status | URL |
|------|-----------------|-----|
| 最后 cluster 完成，后端响应 `allClustersDone: true` | `activating` → `taught`（后端自动迁移） | 前端跳 `/teaching-complete` |
| 用户在中间页停留（关浏览器 → 重开） | 保持 `taught` | 重开 book 页 → BookTOC 显示"学习中 · 教学已完成"→ 点击模块进 `/teaching-complete` |
| 用户点"开始 Q&A 练习"按钮 | `taught` → `qa_in_progress`（前端触发 `POST /start-qa`） | 跳 `/modules/[moduleId]/qa/[sessionId]` |

#### 5.4.4 后端端点

| 端点 | 方法 | 请求体 | 行为 |
|------|------|-------|------|
| `/api/modules/[moduleId]/start-qa` | POST | `{}` | 校验 learning_status === 'taught'；创建 qa_session；迁移 status → qa_in_progress；返回 `{ qaSessionId }` |

**不需新建**：`teaching-complete` 中间页的数据读取复用 `GET /api/modules/[moduleId]`（module + knowledge_points 数组，前端只取 `title` + 附上 `✓`）。

#### 5.4.5 边界情况

- **用户在中间页 reload**：仍显示中间页（`taught` 态稳定），可再次点"开始 Q&A"
- **用户从 BookTOC 切去别的模块**：允许，当前模块留在 `taught` 态，用户任何时候回来都能继续
- **teaching-sessions 被中断**（网络断/服务端崩）：最后 cluster 未完成，`allClustersDone` 为 false，走决策 12（错误/超时处理）的 retry 机制，不进中间页

---

## 6. Entitlement

（父 §6 已拍死 `canUseTeaching()` MVP 实现 + 402 guard 模板，M4 无追加决策）

---

## 7. 任务拆分（给 Codex / Gemini）

待拍（brainstorm 决策 13）

---

## 8. 产品不变量合规确认

M4 完成前必须确认：
- 产品不变量 #1（必须读完原文才能进 QA）：教学模式 Phase 1 → Phase 2 前读完判定保留
- 产品不变量 #2（QA 已答不可改）：无影响
- 产品不变量 #3（测试阶段禁看笔记/QA）：**延伸**——教学模式下 Phase 4 同时隐藏 teaching_sessions + reading_notes + module_notes
- 产品不变量 #4（80% 过关）：无影响
- 产品不变量 #5（QA 一次一题即时反馈）：无影响

---

## 9. 文档同步清单（M4 收尾必做）

（父 §附录 B 已列 21 个 learning_status 消费文件 + architecture.md 更新点，M4 实施时精确化。）

### architecture.md 必改 5 处（审查 I6 硬修复）

| # | 章节 | 改动 |
|---|-----|------|
| 1 | AI 角色表 | 从 5 个（extractor / coach / examiner / reviewer / assistant）增至 **6 个**——新增 `teacher` 角色，5 个 stage（`teach_factual / teach_conceptual / teach_procedural / teach_analytical / teach_evaluative`），职责 "Phase 2 教学对话，不解题不评分" |
| 2 | API 组 | 新增 "教学对话（M4）" 组：`POST /api/modules/[moduleId]/teaching-sessions`（创建，嵌套在 modules 下）、`POST /api/teaching-sessions/[sessionId]/messages`（发消息）、`GET /api/teaching-sessions/[sessionId]`（拉状态，决策 7 恢复用）。另新增 3 个 L2 端点：`POST /api/books/[bookId]/switch-mode`（切换模式）、`POST /api/books/[bookId]/modules/[moduleId]/reset-and-start`（重置起点模块）、`POST /api/modules/[moduleId]/start-qa`（从教学过渡到 QA） |
| 3 | DB 表 | 从 24 张增至 **26 张**——新增 `teaching_sessions`（父 §4.4）、`user_subscriptions`（父 §4.5） |
| 4 | 学习状态流 | 旧 6 状态（未开始 / 读中 / QA 中 / 测试中 / 已通过 / 待重考）扩展为 **新 8 状态**——追加 `teaching_in_progress` / `teaching_frozen_struggling`（见本 spec §4.1） |
| 5 | 新接口契约章节 | 新增 "教学对话（M4）"——列 `TranscriptV1` envelope 结构、`TranscriptOutputSchema`（AI 返回的 Zod schema 形状）、`retryWithBackoff` 调用约束、tier → model 映射、strugglingStreak API 权威源规则 |

### 父 spec patch 必改 3 处

| # | 父 spec 位置 | 改动来源 | 改动内容 |
|---|-------------|---------|---------|
| 1 | §4.4 line 231 | 本 spec §3.1（决策 4 / C2 修复） | `transcript JSONB DEFAULT '{...信封...}'::jsonb` 替换 `DEFAULT '[]'::jsonb` |
| 2 | §4.6 | 本 spec §2.1（决策 1 / I2 修复） | 追加 `prompt_templates.model TEXT NULL` 新列说明 |
| 3 | §附录 B 修改文件列表 | 本 spec §2.1 / §3.1 | 追加 `src/lib/schema.sql`（prompt_templates + teaching_sessions）、`src/lib/prompt-templates.ts`、`src/lib/seed-templates.ts`、`package.json`（zod 依赖） |

### package.json 变更

- **新增** `zod`（^3.x，Vercel AI SDK `generateObject` 运行时 schema 校验依赖，审查 C1 修复）

### M4 完成时触发的 milestone-audit skill 必须 cross-check 以上 5+3+1 项

---

## 附录 A：决策索引

| # | 决策 | 本 spec 章节 | 锁定日期 |
|---|------|------------|---------|
| 1 | teacher 模型选择 | §2.1 | **2026-04-15** |
| 2 | session 创建时机 | §3.3 | _待拍_ |
| 3 | cluster 完成判定 | §4.1 | **2026-04-15** |
| 4 | transcript 格式 | §3.1 | **2026-04-15** |
| 5 | cost tracking 字段 | §3.2 | _待拍_ |
| 6 | 5 套 teacher prompt 结构 | §2.2 | **2026-04-15** |
| 7 | 中断恢复机制 | §4.2, §5.2 | _待拍_ |
| 8 | 模式切换弹窗 UX + BookTOC 组件 | §5.3 | ✅ 2026-04-15 |
| 9 | Phase 0 激活页（ObjectivesList 新组件） | §5.1 | ✅ 2026-04-16 |
| 10 | 教学 → QA 过渡（中间页 + 主动按钮） | §5.4 | ✅ 2026-04-16 |
| 11 | 教学深度 user override（不做） | §4.3, §5.2 | ✅ 2026-04-16 |
| 12 | 教学失败/超时处理 | §2.3 | **2026-04-15** |
| 13 | M4 任务拆分 | §7 | _待拍_ |

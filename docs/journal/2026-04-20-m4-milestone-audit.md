---
date: 2026-04-20
type: audit
milestone: M4
scope: teaching-mode
status: resolved
tags: [M4, teaching-mode, milestone-audit, architecture-sync, moat-verification]
---

# M4 Teaching Mode 里程碑审计

## 变更范围

**里程碑起止**：2026-04-18（Task 1 KP 枚举迁移）→ 2026-04-20（Task 19 teaching-complete 页）

**改动文件数**：约 30 个（含测试脚本 5 个、schema 1 次、docs 若干）

**涉及类别**：
- 页面路由（3 个新页面：activate / teach / teaching-complete）
- API 端点（9 个：teaching-sessions + messages / modules route/clusters/status 扩展/start-qa / books switch-mode + reset-and-start）
- DB schema（2 新表 + 1 列新增 + pgcrypto 启用）
- AI 角色（teacher 新增 5 模板 + prompt_templates.model 字段）
- 工具库（6 个 src/lib 新模块）
- 前端组件（4 个新组件：Modal / BookTOC + Item / ObjectivesList / ModeSwitchDialog）

---

## 契约确认有效

✅ **页面路由**（对比 architecture.md §系统总图）
- 实际存在：`src/app/modules/[moduleId]/{activate,teach,teaching-complete}/page.tsx` — 与 architecture.md 页面树一致

✅ **API 端点**（对比 architecture.md §API 组 + §核心 API）
- 实际存在 `src/app/api/teaching-sessions/route.ts` + `[sessionId]/messages/route.ts`
- 实际存在 `src/app/api/modules/[moduleId]/{clusters,start-qa,route,status}/route.ts`
- 实际存在 `src/app/api/books/[bookId]/switch-mode/route.ts` + `[bookId]/modules/[moduleId]/reset-and-start/route.ts`
- 全部 8 条端点已登记 architecture.md

✅ **DB schema**（对比 architecture.md §DB 表 26 张）
- `teaching_sessions` at `src/lib/schema.sql:333` — 与 architecture.md 描述一致
- `user_subscriptions` at `src/lib/schema.sql:348` — 与 architecture.md 描述一致
- `prompt_templates.model` 列新增（与 §prompt 模板段一致）

✅ **AI 角色**（对比 architecture.md §AI 角色 6 个）
- `teacher` seed：`src/lib/seed-templates.ts` 含 5 条 `role:'teacher'` 记录（stage: factual/conceptual/procedural/analytical/evaluative），与 architecture.md 列表一致

✅ **学习状态流**（对比 architecture.md §学习状态流 8 状态）
- `src/app/api/modules/[moduleId]/status/route.ts` VALID_STATUSES + VALID_TRANSITIONS 与 architecture.md 迁移表逐项吻合

✅ **内部信号护城河**（硬约束）
- `src/app/modules/[moduleId]/**` grep `kp.type|kp.importance|kp.detailed_content|kp.ocr_quality` → 0 hits
- `src/app/api/modules/[moduleId]/clusters/route.ts` → 0 hits
- 前后端双层防护有效

---

## 已更新的契约

⚠️ **architecture.md 本次 M4 closeout 同步的变更**（commit e627202）：

1. **摘要卡 §0**：DB 表 24→26、AI 角色 5→6、学习流从单 6 状态扩为双入口 8 状态、核心 API +6 条 M4 端点、页面树 +3 页、核心约束加内部信号护城河硬约束
2. **系统总图 §1**：页面树补 activate/teach/teaching-complete、API 组加 teaching/ block、DB 表 26 张（加 teaching_sessions / user_subscriptions / 付费分类）、AI 角色加 teacher、学习状态流详述 8 状态 + 迁移表
3. **接口契约 §教学系统（M4）**：新章节，含 TranscriptV1 信封详细结构 + Zod refine + retryWithBackoff + tier → model 映射 + struggling 冻结机制 + API 契约 + 前端流程 + 内部信号护城河硬约束 + 新依赖 zod + pgcrypto
4. **接口契约 §prompt 模板**：追加 teacher×5 + `prompt_templates.model` 字段说明
5. **接口契约 §组件库**：L2 其他 8→9（+Modal）+ 新增"M4 教学专用组件（顶层非 ui/，3 组）"段

## 已修复的 ⚠️ 标记

**无**（本里程碑完成期间无发现既有 ⚠️ 断裂被修复）。

---

## 🆕 新增跨模块依赖

1. **Teaching → prompt_templates.model**：teacher 模板通过 `prompt_templates.model` 列指定模型，`src/lib/prompt-templates.ts:getPromptTemplate()` 返回 model 字段，`src/lib/ai.ts:resolveModel(template)` 逐级回退（template.model → tier 映射 → `AI_MODEL` env）。未来若新增 role（如 QA 专属模型），直接走同一路径即可。
2. **Teaching → Entitlement**：`canUseTeaching(tier)` + `user_subscriptions` 表形成付费墙预埋。MVP 全用户 premium，未来仅需改 `canUseTeaching()` 实现付费分级。
3. **Teaching → 学习状态机**：新增 `taught` / `qa_in_progress` 两个状态；reading 和 teaching 两条流最后在 `qa` / `notes_generated` 汇合再走原 `testing → completed` 尾链。Test/复习/笔记逻辑无需变动。
4. **Moat 护城河**：`kp.type / importance / detailed_content / ocr_quality` 在新增页面/API 中 grep 0 hits，建立了双层防护（SELECT 白名单 + Props 类型契约）。**未来 M5 / M6 所有新前端 dispatch 必须沿用此 grep 校验模板**。

## 🚨 严重断裂（closeout 前必修）

**无**（审计未发现严重断裂）。

---

## 🆕 新增 ⚠️ 技术债

### Tech Debt 1：start-qa API stale redirectUrl

**位置**：`src/app/api/modules/[moduleId]/start-qa/route.ts` 返回 `{ qaSessionId, redirectUrl: '/modules/${id}/qa' }`，但该路由**不存在**。canonical 路径是 `/books/${bookId}/modules/${moduleId}/qa`。

**当前规避**：T19 teaching-complete 前端强制忽略 `response.redirectUrl`，硬编码 canonical URL。

**影响**：任何未来调用 start-qa 的前端代码若直接用 redirectUrl 会 404。

**建议**：M5 开始前做独立 hotfix（小修），或 M5 首个任务里一并处理。

### Tech Debt 2：reading → taught 缺 VALID_TRANSITION

**位置**：`src/app/api/modules/[moduleId]/status/route.ts:17-24` VALID_TRANSITIONS 只定义 `unstarted → [reading, taught]`，`reading → [qa]`。如果用户读原文（reading）后想切到教学（taught），PATCH 会返回 409。

**当前影响**：小。TeachClient / activate flow 从 unstarted 直切 taught 正常；用户先读原文再切教学的冷门路径不支持。

**建议**：M5 开始或 milestone-audit 跟进时评估——允许 `reading → taught` 或用户说明必须 reset-and-start 才能切换。设计决策待下次 brainstorm。

---

## 📝 下个里程碑（M5 留存机制）注意事项

1. **前端 dispatch 模板强制保留 moat grep 校验**：M4 验证 grep 对捕获遗漏有效，继续沿用。
2. **Skeleton-driven dispatch 适用条件**：T18 30% 完成度 retry ×1 验证——当任务复杂度 ≥200 行前端 + 多状态机时，dispatch 附完整代码骨架可显著降低理解偏差。M5 若涉及复杂前端流（如 streak 可视化 / 多卡片协调），沿用此模式。
3. **Self-remediate docs 违规**：M4 中 Gemini 3 次违反"严禁改 docs"硬约束。已改用 self-remediate 模式（Claude 直接 Edit 修复，不再 retry 教 Gemini）。M5 继续沿用。
4. **Tech debt 登记入 M5 开局清单**：start-qa redirectUrl / reading→taught transition 二者选一个 M5 开头处理。

---

## Commits

- 架构同步：`e627202` docs(m4): sync architecture.md + parent spec per M4 child design
- 收尾同步：`604b5eb` docs(m4): closeout — T17-T19 changelog + T4-T6 补录 + M4 done

---

## Audit 检查清单

- [x] Step 1: 审计范围确定（3 页面 + 9 API + 2 表 + 1 列 + 6 lib + 4 组件）
- [x] Step 2: 定向审计（代码 vs architecture.md 对比 6 维度全通过）
- [x] Step 3: architecture.md 同步（commit e627202）
- [x] Step 4: ⚠️ 标记处理（发现 2 条新技术债 → Tech Debt 1/2 登记）
- [x] Step 5: 报告输出 → 本文件 + journal INDEX 更新

**Audit verdict：PASS — M4 可进入 closeout，无严重断裂阻塞。**

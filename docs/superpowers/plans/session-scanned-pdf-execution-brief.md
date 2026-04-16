---
date: 2026-03-28
topic: 扫描PDF执行Session简报
type: plan
status: resolved
keywords: [scanned-PDF, execution, session-brief, dispatch]
---

# Session 任务简报：扫描 PDF 计划执行

---

## 你是谁、要做什么

你是 ai-textbook-teacher 项目的 PM/架构师。这个 session 的唯一任务是：**执行扫描 PDF 升级的 9 个 task**，全自动派发到 Codex/Gemini，review，推进到完成。

设计和计划已经做完，不需要讨论。直接执行。

---

## 先读什么（按顺序）

### 必读 — 项目上下文
1. `CLAUDE.md` — 项目规则和角色分工
2. `docs/project_status.md` — 当前状态（扫描 PDF 待执行）
3. `docs/architecture.md` — 系统架构（接口契约，⚠️ 标记）

### 必读 — 本次执行依据
4. `docs/superpowers/plans/2026-04-12-scanned-pdf-plan.md` — **最重要**：9 个 task 的详细实施计划，每个 task 有完整代码、文件路径、验证步骤
5. `docs/superpowers/specs/2026-04-12-scanned-pdf-design.md` — 设计 spec（review 时的参照标准）

### 必读 — 执行状态
6. `.ccb/task-ledger.json` — 任务进度 ledger（9 tasks 全部 ready）
7. `.ccb/inbox/codex/016-dispatch.md` — T1 的 dispatch 已写好，可直接发送

---

## 你要做什么

### 用 task-execution skill 执行计划

调用 `/task-execution`，全自动模式：

- **不需要每个 task 问用户确认**，用户已预授权全部派发
- T1 的 dispatch 文件已写好（`.ccb/inbox/codex/016-dispatch.md`），直接发送即可
- T2-T7 需要写新的 dispatch 文件并发送给 Codex
- T8 写 dispatch 发送给 Gemini
- T9 是 Claude 自己做（docs 更新）

### 执行顺序

```
T1 (Schema + Docker) — Codex — dispatch 已写好
  ↓ review 通过后
T2 (classify-pdf) + T3 (extract-text) + T5 (text-chunker) — 可并行派发给 Codex
  ↓ 全部通过后
T4 (ocr-pdf scanned-only, 依赖 T2) + T6 (kp-extraction per-module, 依赖 T5) — 可并行
  ↓ 全部通过后
T7 (API routes, 依赖 T2+T3+T5+T6) — Codex
  ↓ review 通过后
T8 (Frontend, 依赖 T7) — Gemini
  ↓ review 通过后
T9 (Docs + verification) — Claude 自己做
```

### Review 规则

- T1, T5: Spot Check（1-2 文件，已知模式）
- T2, T3, T4, T6, T7, T8: Full Review（新端点/重写逻辑）
- T9: Auto-Pass

Full Review = 派 subagent 做 spec 合规检查 + Claude 自己读 diff 做质量检查。

### 关键提醒

1. **DB 函数签名**：`insert(sql, params)` 不是 ORM，是 raw SQL。`run(sql, params)` 返回 QueryResult。`queryOne<T>(sql, params)` 返回 T | undefined。
2. **OCR server DB 模式**：用 `psycopg2.connect(database_url)` + `run_write(connection, sql, params)`，不用 `get_db_connection()`。
3. **modules 表列名是 `title`**，不是 `name`。
4. **所有 ID 是 `number`**（SERIAL PRIMARY KEY），不是 string。
5. **`requireBookOwner(request, bookId)` 在 `@/lib/auth`**，不是 auth-helpers，参数是 (request, number)。
6. **`books.kp_extraction_status` 必须保持同步** — T7 里有 `syncBookKpStatus` helper 负责这个。
7. **ALTER TABLE 在 schema.sql 末尾**，不是中间。initDb 读整个文件执行一次。

### CCB 环境

- Pane 0=Claude, 1=Codex, 2=Gemini
- 派发：写 dispatch 文件到 `.ccb/inbox/<target>/`，然后 `wezterm cli send-text --pane-id <N>`
- 下一个 Codex dispatch 序号：016（已写好）→ 017, 018, ...
- 下一个 Gemini dispatch 序号：027

---

## 完成标准

全部 9 个 task 状态为 done 或 skipped → 跑 verification-before-completion → claudemd-check → 更新 project_status.md。

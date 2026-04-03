# Architecture.md 守护体系 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a closed-loop system ensuring `docs/architecture.md` always matches code reality, so milestone designs never build on wrong assumptions.

**Architecture:** 6 skill/doc files edited to create two checkpoints — milestone-audit (closeout verification) and brainstorming (pre-design re-verification). All files are within Claude's file boundary (`docs/**`, `.claude/skills/**`, `CLAUDE.md`).

**Tech Stack:** Markdown skill files, no code.

---

### Task 1: Finalize milestone-audit SKILL.md

**Files:**
- Modify: `.claude/skills/milestone-audit/SKILL.md` (entire file — draft exists, align with spec Section 3)

- [ ] **Step 1: Align skill with spec**

The existing draft is close but needs these adjustments to match the spec exactly:
- Section 3 flow is 5 steps (not 6): 确定范围 → 定向审计 → 更新 architecture.md → 处理 ⚠️ 标记 → 输出报告
- The audit table should have 6 categories (not 7) — ⚠️ 标记 handling is part of Step 4, not a separate audit dimension
- Report format must match spec Section 3 exactly
- Remove git SHA workflow details (too technical, keep it as "look at which files changed this milestone")

Rewrite the SKILL.md to:
```markdown
---
name: milestone-audit
description: 里程碑收尾时审计 architecture.md 接口契约。触发：里程碑任务全部完成后、closeout 前。
---

# Milestone Audit

里程碑收尾时对 `docs/architecture.md` 进行结构化审计，确保接口契约与代码现状一致。

## 为什么需要

`architecture.md` 是下个里程碑 brainstorming 的设计基础。如果它和代码不一致，设计就建在错误假设上。

现有防线只覆盖单任务粒度：
- `structured-dispatch`：派任务前检查相关合约（预防性，窄）
- `requesting-code-review`：review 后更新相关合约（反应性，窄）

本 skill 补上**里程碑粒度**的全量扫描（总结性，宽）。

## 触发条件

- 里程碑所有任务完成
- 最终 code review 通过
- 准备进入 closeout（finishing-a-development-branch）之前

## 执行步骤

### Step 1: 确定审计范围

查看本里程碑改了哪些文件，按类别归组：

```bash
# 找本里程碑的起始 commit（通过 changelog/project_status 确定日期）
git log --oneline --after="<milestone_start_date>" --name-only
```

按以下类别分组，只审计有改动的类别：

| 文件模式 | 类别 |
|----------|------|
| `src/app/**/page.tsx`, `layout.tsx` | 页面路由 |
| `src/app/api/**` | API 端点 |
| `src/lib/db.ts` | DB schema |
| `src/lib/seed-templates.ts` | AI prompt 模板 |
| `src/lib/**`（其他） | 工具库 |
| `src/components/**` | 前端组件 |

### Step 2: 定向审计

读取 `docs/architecture.md`，对每个**有改动的**类别执行对比：

| 类别 | 怎么查 |
|------|--------|
| 页面路由 | 用 Glob 工具搜索所有 `src/app/**/page.tsx`，对比 architecture.md 路由清单 |
| API 端点 | 用 Glob 工具搜索所有 `src/app/api/**/route.ts`，对比 architecture.md API 清单 |
| DB 表 | 读 `src/lib/db.ts`，找所有 CREATE TABLE 语句，对比 architecture.md 表清单 |
| AI 角色 | 读 `src/lib/seed-templates.ts`，找所有模板定义，对比 architecture.md 角色清单 |
| 接口契约 | 逐条读 architecture.md 契约描述，用 Grep/Read 去代码里确认还对不对 |
| 学习状态流 | 用 Grep 搜索 `learning_status` 赋值，对比 architecture.md 状态流图 |

**关键原则**：必须**读代码**确认，不能只看文件名下结论。重点放在跨模块连接点。

### Step 3: 更新 architecture.md

不一致的地方直接修正：
1. **系统总图**：更新路由、API、DB 表、AI 角色清单
2. **接口契约**：修改过期描述、新增跨模块依赖
3. **学习状态流**：更新状态转换（如有变化）

### Step 4: 处理 ⚠️ 标记

- 已修复的问题：摘掉 ⚠️ 标记，更新描述
- 新发现的断裂风险：标上 ⚠️，给下个里程碑看
- 🚨 **严重断裂**（影响下个里程碑的前提假设）：必须在 closeout 前修复，不带到下个里程碑

### Step 5: 输出报告

输出审计报告到对话中，同时写入 `docs/journal/<date>-m<N>-milestone-audit.md`，更新 journal INDEX.md。

报告格式：

```
═══ 里程碑审计报告：M<N> ═══

📊 变更范围
  改动文件数：X
  涉及类别：[列出被改动的类别]

✅ 契约确认有效
  - [契约名]

⚠️ 已更新的契约
  - [契约名]：[改了什么]

🆕 新增跨模块依赖
  - [描述]

🔧 ⚠️ 标记变化
  已修复（摘除）：...
  新发现（标记）：...

📝 下个里程碑注意事项
  - [风险点]

═══════════════════
```

---

## Chain 位置

**Closeout Chain**（完整版）：
1. requesting-code-review（最终 review）
2. **milestone-audit** ← 你在这里
3. claudemd-check（合规检查）
4. finishing-a-development-branch（分支收尾）

**Next step:** 审计完成并更新 architecture.md 后，调用 `claudemd-check`。
```

- [ ] **Step 2: Verify**

Read the file back, confirm it matches the spec Section 3 flow, audit table, and report format.

---

### Task 2: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add 架构地图 section**

Insert after the `## 技术栈` section (after line 31), before `## 产品不变量`:

```markdown
## 架构地图
`docs/architecture.md` 是系统现状的唯一真相源。所有里程碑设计必须基于它，不得凭记忆假设。
任何改动代码结构的工作完成后，必须同步更新。
```

- [ ] **Step 2: Add 禁止事项 entry**

Add to the 禁止事项 list (after the existing 4 items):

```markdown
- 禁止在里程碑收尾时跳过 milestone-audit（architecture.md 全量验证）
```

- [ ] **Step 3: Verify**

Read CLAUDE.md, confirm both additions are in correct positions.

---

### Task 3: Update brainstorming SKILL.md

**Files:**
- Modify: `.claude/skills/brainstorming/SKILL.md`

- [ ] **Step 1: Replace "Explore project context" in checklist**

Change checklist item 1 (line 24) from:
```
1. **Explore project context** — check files, docs, recent commits
```
to:
```
1. **Explore project context** — read the mandatory file list below, verify architecture.md accuracy
```

- [ ] **Step 2: Add mandatory read list and HARD-GATE**

Insert after the checklist (after line 32), before the `## Process Flow` section, a new section:

```markdown
## Mandatory Read List (Milestone-Level Work)

For milestone-level brainstorming, "explore project context" means reading these specific files:

| File | Why |
|------|-----|
| `docs/architecture.md` | System state — pages, APIs, DB tables, AI roles, interface contracts, ⚠️ markers |
| `docs/project_status.md` | Current progress, completed milestones, next step |
| `docs/journal/INDEX.md` | Parked ideas that might be relevant to this milestone |
| Previous milestone's spec (if any) | Prior design decisions |
| Related source code | architecture.md tells you which files matter — read them to confirm contracts are still accurate |

The first 4 are always read. The 5th is targeted based on architecture.md interface contracts.

<HARD-GATE>
For milestone-level work: if architecture.md and code are inconsistent, fix architecture.md FIRST before proceeding with design. Do not design on top of stale assumptions.
</HARD-GATE>
```

- [ ] **Step 3: Verify**

Read the brainstorming SKILL.md, confirm the read list and HARD-GATE are present and correctly placed.

---

### Task 4: Update claudemd-check SKILL.md

**Files:**
- Modify: `.claude/skills/claudemd-check/SKILL.md`

- [ ] **Step 1: Expand Step 3 to include architecture.md**

Change Step 3 (line 18-19) from:
```
3. **检查：任务完成更新**
   读 `docs/project_status.md` 和 `docs/changelog.md`，确认最后一条记录覆盖了本次工作。
```
to:
```
3. **检查：任务完成更新**
   读 `docs/project_status.md`、`docs/changelog.md` 和 `docs/architecture.md`，确认最后一条记录覆盖了本次工作。如果本次工作涉及页面、API、数据库、AI 角色或跨模块接口变化，architecture.md 必须已同步更新。
```

- [ ] **Step 2: Add milestone-audit check (new Step 9.5)**

Insert after Step 9 (沟通协议 check), before Step 10 (Skill 合规):

```markdown
9.5. **检查：milestone-audit（仅里程碑收尾时）**
   如果本次会话涉及里程碑收尾，检查 `docs/journal/` 中是否有对应的 `m<N>-milestone-audit.md` 审计记录。没有则报 ✗ 并要求先执行 milestone-audit skill。
```

- [ ] **Step 3: Update output format**

Add a new line to the output format block (after the 沟通协议 line):

```
✓/✗ 架构审计：已完成 milestone-audit / 非里程碑收尾，跳过
```

- [ ] **Step 4: Verify**

Read the claudemd-check SKILL.md, confirm all three changes are present.

---

### Task 5: Update session-init SKILL.md

**Files:**
- Modify: `.claude/skills/session-init/SKILL.md`

- [ ] **Step 1: Update trigger table (规则 3)**

Change the `里程碑结束` row in the trigger table from:
```
| 里程碑结束 | finishing-a-development-branch（分支收尾） |
```
to:
```
| 里程碑结束 | milestone-audit → finishing-a-development-branch |
```

- [ ] **Step 2: Update Closeout Chain (规则 5)**

Change:
```
**Closeout Chain** — 收尾：
1. requesting-code-review → 2. claudemd-check
```
to:
```
**Closeout Chain** — 收尾：
1. requesting-code-review → 2. milestone-audit → 3. claudemd-check → 4. finishing-a-development-branch
```

- [ ] **Step 3: Add milestone-audit to core skill table (Step 5)**

Add a new row to the core skill table and update the count from 10 to 11:

```
| **milestone-audit** | 里程碑收尾 architecture.md 全量验证 | 里程碑结束时自动 |
```

Update the heading from `### 核心流程 skill（session-init 管控）— 10 个` to `### 核心流程 skill（session-init 管控）— 11 个`.

- [ ] **Step 4: Verify**

Read session-init SKILL.md, confirm all three changes are present and consistent.

---

### Task 6: Update requesting-code-review SKILL.md

**Files:**
- Modify: `.claude/skills/requesting-code-review/SKILL.md`

- [ ] **Step 1: Update Chain Position**

Change the Closeout Chain section from:
```
**Closeout Chain** (step 1):
1. **requesting-code-review** ← you are here
2. claudemd-check
```
to:
```
**Closeout Chain** (step 1):
1. **requesting-code-review** ← you are here
2. milestone-audit
3. claudemd-check
4. finishing-a-development-branch
```

- [ ] **Step 2: Verify**

Read the requesting-code-review SKILL.md Chain Position section, confirm it matches.

---

### Task 7: Update journal INDEX.md

**Files:**
- Modify: `docs/journal/INDEX.md`

- [ ] **Step 1: Move milestone-audit from parked to resolved**

Remove from parked/工程流程:
```
- **T2** milestone-audit skill——里程碑结束时结构化审计接口契约 → [2026-04-03-milestone-audit-skill.md](./2026-04-03-milestone-audit-skill.md)
```

Add to resolved section:
```
- [infra:resolved] milestone-audit skill 已实现——architecture.md 守护体系（两道关卡闭环）（2026-04-03）→ [2026-04-03-milestone-audit-skill.md](./2026-04-03-milestone-audit-skill.md)
```

- [ ] **Step 2: Verify**

Read journal INDEX.md, confirm the entry moved correctly.

---

### Task 8: Commit

- [ ] **Step 1: Stage and commit all changes**

```bash
git add .claude/skills/milestone-audit/SKILL.md \
       .claude/skills/brainstorming/SKILL.md \
       .claude/skills/claudemd-check/SKILL.md \
       .claude/skills/session-init/SKILL.md \
       .claude/skills/requesting-code-review/SKILL.md \
       CLAUDE.md \
       docs/journal/INDEX.md \
       docs/superpowers/specs/2026-04-03-milestone-audit-design.md \
       docs/superpowers/plans/2026-04-03-milestone-audit-plan.md
git commit -m "feat: milestone-audit skill + architecture.md 守护体系"
git push origin master
```

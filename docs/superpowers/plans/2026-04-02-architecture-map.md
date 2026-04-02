# Architecture Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a two-layer architecture document that tracks cross-module dependencies and known break points, enforced by existing skill machinery.

**Architecture:** One new document (`docs/architecture.md`) with system overview + interface contracts. Two minor edits to existing files (`CLAUDE.md`, `session-init`) to hook into enforcement and loading.

**Tech Stack:** Markdown only. No code, no scripts, no new skills.

**Spec:** `docs/superpowers/specs/2026-04-02-architecture-map-design.md`

---

### Task 1: Create `docs/architecture.md`

**Files:**
- Create: `docs/architecture.md`

**Reference:** Current codebase state from M3→M4 audit (`docs/journal/2026-04-02-m3-to-m4-code-audit.md`)

- [ ] **Step 1: Write Layer 1 — System Overview**

```markdown
# 系统架构

## 系统总图

### 页面
/ (首页：书目列表)
├── /upload (上传 PDF)
└── /books/[bookId]
    ├── / (书详情)
    ├── /reader (PDF 阅读器 + 截图问 AI)
    ├── /module-map (模块地图)
    └── /modules/[moduleId]
        ├── / (模块学习：指引→阅读→QA→笔记)
        ├── /qa (QA session)
        ├── /test (测试 session)
        └── /mistakes (错题页)

### API 组
books/[bookId]/     — extract, status, pdf, module-map, screenshot-ask, notes, highlights, toc
modules/[moduleId]/ — status, guide, generate-questions, qa-feedback, questions, reading-notes,
                      generate-notes, evaluate, test/generate, test/submit, test/, mistakes

### DB 表（19 张）
用户数据：books, modules, conversations, messages, highlights, reading_notes, module_notes
学习数据：knowledge_points, clusters, qa_questions, qa_responses
测试数据：test_papers, test_questions, test_responses, mistakes
复习数据：review_schedule, review_records
系统数据：prompt_templates, logs

### AI 角色（5 个）
提取器(extractor) — KP 提取 + 模块地图
教练(coach)       — 读前指引 + QA 出题 + 反馈 + 笔记生成
考官(examiner)    — 测试出题 + 评分 + 错题诊断
复习官(reviewer)  — 复习出题 + 评分 + P 值更新
助手(assistant)   — 截图问 AI

### 学习状态流
unstarted → reading → qa → notes_generated → testing → completed
```

- [ ] **Step 2: Write Layer 2 — Interface Contracts**

```markdown
## 接口契约

### 提取 → 学习
- KP 提取完成后写入 knowledge_points，同时创建 clusters 并关联 kp.cluster_id
- modules.kp_count 和 cluster_count 在提取时设置
- 教练出题依赖 knowledge_points.type 做题型映射：
  calculation → worked_example，其他 → scaffolded_mc/short_answer/comparison

### 学习 → 测试
- QA 全部完成 → 生成笔记 → learning_status='notes_generated' → 可进入测试
- 考官出题读 knowledge_points（同一张表、同一个 kp_id 体系）
- 考官读取 mistakes 表 is_resolved=0 的记录，优先覆盖对应 KP

### 测试 → 复习
- ⚠️ 测试通过设 learning_status='completed'，但不创建 review_schedule、不更新 cluster P 值
- ⚠️ clusters.next_review_date 存在但无代码使用，与 review_schedule.due_date 语义冗余
- clusters.current_p_value 默认 2，无代码修改它
- clusters.consecutive_correct 默认 0，无代码修改它

### 错题流转
- mistakes 表 source 字段支持 'test'|'qa'|'review' 三个来源
- 当前只有 test/submit 写入（source='test'），qa 和 review 来源未实现
- mistakes.kp_id 关联 knowledge_points，用于出题时优先覆盖

### prompt 模板
- seed-templates.ts 种子化：extractor×3, coach×4, examiner×2, reviewer×1, assistant×1
- extractor 模板是乱码 UTF-8，但功能正常（创建时就是这样写的）
- examiner 模板已用正常中文重写（M3）
- ⚠️ reviewer 模板是乱码 UTF-8，M4 前需要重写
```

- [ ] **Step 3: Verify completeness**

Cross-check against:
- `src/lib/db.ts` — all 19 tables listed
- `src/app/` directory — all pages listed
- `src/app/api/` directory — all API groups listed
- `src/lib/seed-templates.ts` — all prompt templates listed
- M3→M4 audit report — all 3 break points marked with ⚠️

- [ ] **Step 4: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: create architecture map with system overview + interface contracts"
```

---

### Task 2: Update CLAUDE.md enforcement rule

**Files:**
- Modify: `CLAUDE.md` — "禁止事项" section

- [ ] **Step 1: Edit the rule**

Change:
```
- 禁止在未更新 `docs/project_status.md` 和 `docs/changelog.md` 的情况下声称任务完成
```
To:
```
- 禁止在未更新 `docs/project_status.md`、`docs/changelog.md` 和 `docs/architecture.md` 的情况下声称任务完成
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add architecture.md to milestone completion checklist"
```

---

### Task 3: Update session-init read list

**Files:**
- Modify: `.claude/skills/session-init/SKILL.md` — Step 1 table

- [ ] **Step 1: Add architecture.md to the load table**

In the "Read ALL of these in parallel" table, add a row:

| `docs/architecture.md` | System overview + interface contracts (check ⚠️ markers) |

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/session-init/SKILL.md
git commit -m "docs: add architecture.md to session-init read list"
```

---

### Task 4: Final verification

- [ ] **Step 1: Verify all 5 acceptance criteria**

1. `docs/architecture.md` exists and matches current codebase
2. CLAUDE.md "禁止事项" mentions architecture.md
3. session-init Step 1 reads architecture.md
4. Three ⚠️ markers present in interface contracts
5. No other files changed beyond the 3 in the change list

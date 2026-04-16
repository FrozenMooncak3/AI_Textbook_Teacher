---
date: 2026-04-02
topic: CCB文件消息系统替代ask
type: plan
status: resolved
keywords: [CCB, file-messaging, inbox, coordination]
---

# CCB 文件消息系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unreliable `ask` command with a file-based inbox messaging system for all Claude/Codex/Gemini communication.

**Architecture:** Messages are written to `.ccb/inbox/<recipient>/` as markdown files with frontmatter. Only short notifications are sent via `wezterm cli send-text`. All 3 agents follow the same write-file → short-notify protocol.

**Tech Stack:** Markdown files, bash (wezterm cli), no new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-02-ccb-file-messaging-design.md`

**Scope:** All changes are documentation/configuration — no `src/` code. All files are within Claude's write boundary.

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `.gitignore` | Add `.ccb/inbox/` ignore rule |
| Modify | `docs/ccb-protocol.md` | Rewrite Section 0 (comms infra) + Section 2 (dispatch flow) |
| Modify | `AGENTS.md` | Replace "完成报告" section with file messaging protocol |
| Modify | `GEMINI.md` | Same as AGENTS.md |
| Modify | `.claude/skills/structured-dispatch/SKILL.md` | Replace `ask` send flow with file + notify |
| Modify | `.claude/skills/session-init/SKILL.md` | Update wezterm/dispatch references |
| Modify | `.claude/skills/api-contract/SKILL.md` | Replace `/ask` notification flow |
| Modify | `.codex/skills/api-contract/SKILL.md` | Same as above |
| Create | `.ccb/inbox/claude/.gitkeep` | Bootstrap directory |
| Create | `.ccb/inbox/codex/.gitkeep` | Bootstrap directory |
| Create | `.ccb/inbox/gemini/.gitkeep` | Bootstrap directory |

---

### Task 0: Bootstrap inbox directories + .gitignore

**Files:**
- Modify: `.gitignore` (append after line 52)
- Create: `.ccb/inbox/claude/.gitkeep`, `.ccb/inbox/codex/.gitkeep`, `.ccb/inbox/gemini/.gitkeep`

- [ ] **Step 1: Create inbox directories**

```bash
mkdir -p .ccb/inbox/claude .ccb/inbox/codex .ccb/inbox/gemini
```

- [ ] **Step 2: Add .gitkeep files so directories exist in git**

```bash
touch .ccb/inbox/claude/.gitkeep .ccb/inbox/codex/.gitkeep .ccb/inbox/gemini/.gitkeep
```

- [ ] **Step 3: Update .gitignore**

**Append** the following lines at the end of `.gitignore` (after the existing `.claude/.stop-count` line on line 52). Do NOT modify or replace any existing lines:

```gitignore

# CCB inbox messages (runtime, not committed)
.ccb/inbox/**
!.ccb/inbox/*/.gitkeep
```

This ignores all inbox content but preserves the `.gitkeep` files so directory structure is maintained across clones.

- [ ] **Step 4: Verify**

```bash
git status
```

Expected: `.gitignore` modified, 3 `.gitkeep` files as new untracked.

- [ ] **Step 5: Commit**

```bash
git add .gitignore .ccb/inbox/claude/.gitkeep .ccb/inbox/codex/.gitkeep .ccb/inbox/gemini/.gitkeep
git commit -m "infra: bootstrap CCB inbox directories for file-based messaging"
```

---

### Task 1: Rewrite docs/ccb-protocol.md

**Files:**
- Modify: `docs/ccb-protocol.md`
- Reference: `docs/superpowers/specs/2026-04-02-ccb-file-messaging-design.md`

This is the source of truth — all other files reference it.

- [ ] **Step 1: Replace Section 0 (通信基础设施)**

Replace the current Section 0 (lines 8-29, the `ask`/`ccb-ping`/`pend` command table and async rules). The new Section 0 content is taken directly from spec Sections 3-8. Write the following subsections:

**Section heading:** `## 0. 通信基础设施` — opening paragraph states: 项目使用**文件消息系统**管理多 AI 协作。所有通信走"写文件 + 短通知"，不使用 `ask` 命令。

**Subsection `### 目录结构`** — show `.ccb/inbox/claude/`, `.ccb/inbox/codex/`, `.ccb/inbox/gemini/` with arrow annotations.

**Subsection `### 消息文件格式`** — file naming `<NNN>-<type>.md`, frontmatter with `from`, `type`, `ts` fields, then body.

**Subsection `### 发送流程（所有 agent 通用）`** — 4 steps: mkdir -p → write file → send-text notification → send Enter via `printf '\r'`.

**Subsection `### Pane 映射`** — table: Claude=0, Codex=1, Gemini=2. Note: 由 `.wezterm.lua` 三栏布局决定。

**Subsection `### 序号管理`** — scan max + 1, start from 001.

**Subsection `### 生命周期`** — 积累到里程碑结束，由 Claude 清理。

- [ ] **Step 2: Update Section 2 (任务派发流程)**

Replace the current Section 2 content with:

```markdown
## 2. 任务派发流程

- **派发前必须给用户看中文翻译**，用户批准后再写英文指令到 inbox
- Claude 写入 `.ccb/inbox/<target>/<NNN>-dispatch.md`，然后发短通知
- **不在 Codex / Gemini 执行任务时往他们的 session 发消息**——会打断正在执行的任务
- 要查进度只通过 `git diff` / `git log` / 读文件，不碰他们的 session
- 等用户主动告知完成后再介入 review
```

- [ ] **Step 3: Verify the whole file reads coherently**

Read `docs/ccb-protocol.md` end to end. Ensure no orphan references to `ask`/`pend`/`ccb-ping`.

- [ ] **Step 4: Commit**

```bash
git add docs/ccb-protocol.md
git commit -m "docs: rewrite ccb-protocol for file-based messaging system"
```

---

### Task 2: Update AGENTS.md

**Files:**
- Modify: `AGENTS.md`
- Reference: `docs/ccb-protocol.md` (updated in Task 1)

- [ ] **Step 1: Replace from `## 完成报告` heading (line 148) to end of file (line 177)**

Replace everything from `## 完成报告` to end of file (includes `## 上下文说明`) with:

```markdown
## 完成报告（文件消息协议）

每次完成被派发的任务后，**必须**通过文件消息系统向 Claude 发送完成报告。

### Pane 映射

| Agent | Pane ID |
|-------|---------|
| Claude | 0 |
| Codex | 1 |
| Gemini | 2 |

### 步骤

1. 确定序号：`ls .ccb/inbox/claude/` 查看最大序号，+1（目录为空从 `001` 开始）
2. 写报告文件：

```bash
mkdir -p .ccb/inbox/claude
cat > .ccb/inbox/claude/<NNN>-report.md << 'MSGEOF'
---
from: codex
type: report
ts: <当前时间>
---

[REPORT FROM: Codex]
Status: DONE / BLOCKED
Completed: T0, T1, T2 (简要说明)
Commits: abc1234, def5678
Build: PASS / FAIL (如果 FAIL 写原因)
Blocker: (如果 BLOCKED 写具体问题)
MSGEOF
```

3. 发送短通知：

```bash
echo "Read .ccb/inbox/claude/<NNN>-report.md — Codex task report" | wezterm cli send-text --pane-id 0 --no-paste
printf '\r' | wezterm cli send-text --pane-id 0 --no-paste
```

4. 若 wezterm 失败：重试 2 次（间隔 2 秒）；仍失败则同时写到项目根目录 `.codex-report.md` 作为 fallback。

### 规则

- 全部任务完成时发一次，不要每个小步骤都发
- 遇到 blocker 无法继续时也要发，说明卡在哪里
- 报告用英文（和派发指令一致）

## 上下文说明

这是 CCB 多模型协作架构。Codex 由 Claude 通过文件消息系统委派任务，每次会话是隔离的新上下文。本文件是 Codex 每次启动时读的唯一指令文件。
```

- [ ] **Step 2: Verify no orphan `ask claude` references remain**

Search the file for `ask claude`, `ask codex`, `ask gemini`. Should find zero.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: update AGENTS.md to file-based messaging protocol"
```

---

### Task 3: Update GEMINI.md

**Files:**
- Modify: `GEMINI.md`
- Reference: `AGENTS.md` (updated in Task 2, use as pattern)

- [ ] **Step 1: Replace from `## 完成报告` heading (line 75) to end of file (line 98)**

Replace everything from `## 完成报告` to end of file with:

```markdown
## 完成报告（文件消息协议）

每次完成被派发的任务后，**必须**通过文件消息系统向 Claude 发送完成报告。

### Pane 映射

| Agent | Pane ID |
|-------|---------|
| Claude | 0 |
| Codex | 1 |
| Gemini | 2 |

### 步骤

1. 确定序号：`ls .ccb/inbox/claude/` 查看最大序号，+1（目录为空从 `001` 开始）
2. 写报告文件：

```bash
mkdir -p .ccb/inbox/claude
cat > .ccb/inbox/claude/<NNN>-report.md << 'MSGEOF'
---
from: gemini
type: report
ts: <当前时间>
---

[REPORT FROM: Gemini]
Status: DONE / BLOCKED
Completed: T6, T7, T8 (简要说明)
Commits: abc1234, def5678
Build: PASS / FAIL (如果 FAIL 写原因)
Blocker: (如果 BLOCKED 写具体问题)
MSGEOF
```

3. 发送短通知：

```bash
echo "Read .ccb/inbox/claude/<NNN>-report.md — Gemini task report" | wezterm cli send-text --pane-id 0 --no-paste
printf '\r' | wezterm cli send-text --pane-id 0 --no-paste
```

4. 若 wezterm 失败：重试 2 次（间隔 2 秒）；仍失败则同时写到项目根目录 `.gemini-report.md` 作为 fallback。

### 规则

- 全部任务完成时发一次，不要每个小步骤都发
- 遇到 blocker 无法继续时也要发，说明卡在哪里
- 报告用英文（和派发指令一致）

## 上下文说明

这是 CCB 多模型协作架构。Gemini 由 Claude 通过文件消息系统委派任务，每次会话是隔离的新上下文。本文件是 Gemini 每次启动时读的唯一指令文件。
```

- [ ] **Step 2: Verify no orphan `ask` references remain**

- [ ] **Step 3: Commit**

```bash
git add GEMINI.md
git commit -m "docs: update GEMINI.md to file-based messaging protocol"
```

---

### Task 4: Update structured-dispatch skill

**Files:**
- Modify: `.claude/skills/structured-dispatch/SKILL.md`
- Reference: `docs/ccb-protocol.md` (Task 1)

- [ ] **Step 1: Update the Workflow section**

Replace step 4:
```
4. User approves -> send English dispatch via CCB `ask codex/gemini "..."` command
```
with:
```
4. User approves -> write English dispatch to `.ccb/inbox/<target>/<NNN>-dispatch.md`, then send short wezterm notification
```

- [ ] **Step 2: Add a "Send Procedure" section after the template**

Add **after** `## Reminders` section (line 64) and **before** `## Chain Position` (line 68):

```markdown
## Send Procedure

After user approves the dispatch:

1. Determine next sequence number: `ls .ccb/inbox/<target>/` → max NNN + 1 (start from `001` if empty)
2. Write the dispatch content (with frontmatter) to `.ccb/inbox/<target>/<NNN>-dispatch.md`
3. Send short notification:
   ```bash
   echo "Read .ccb/inbox/<target>/<NNN>-dispatch.md and execute the task inside" | wezterm cli send-text --pane-id <target_pane> --no-paste
   printf '\r' | wezterm cli send-text --pane-id <target_pane> --no-paste
   ```
4. Confirm to user: "已发送到 <target> inbox"

Pane IDs: Claude=0, Codex=1, Gemini=2
```

- [ ] **Step 3: Verify no orphan `ask codex` / `ask gemini` references**

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/structured-dispatch/SKILL.md
git commit -m "docs: update structured-dispatch skill to file-based messaging"
```

---

### Task 5: Update session-init skill

**Files:**
- Modify: `.claude/skills/session-init/SKILL.md`

- [ ] **Step 1: Update 规则 1 (自动派发)**

Find the auto-dispatch rule. Change step references from `ask` to the file-based flow. The current text:
```
当检测到需要给 Codex/Gemini 派任务时，自动按 structured-dispatch 模板执行：
```
This is already correct (references structured-dispatch, not `ask` directly). Verify no `ask` command appears in the session-init skill.

- [ ] **Step 2: Update Step 2 infrastructure signal**

The parking lot scan mentions "Wezterm 发送失败 → 影响所有后续派发". Update the example to reflect the new system:
```
文件消息发送失败 → 影响所有后续派发 → 必须拉出
```

- [ ] **Step 3: Add inbox scan to Step 1 (Load Context)**

Add to the "Also run" table:
```
| `ls .ccb/inbox/claude/ 2>/dev/null` | Unread messages from Codex/Gemini (completion reports, questions) |
| `ls .codex-report.md .gemini-report.md 2>/dev/null` | Fallback reports (wezterm notification failed) |
```

And in Step 2 (Assess Position), add signals:
```
| Files in `.ccb/inbox/claude/` | Unread messages — check for completion reports or blockers |
| `.codex-report.md` or `.gemini-report.md` exists | Fallback report — wezterm notification failed, read and process |
```

- [ ] **Step 4: Verify no orphan `ask`/`pend`/`ccb-ping` references**

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/session-init/SKILL.md
git commit -m "docs: update session-init skill for file-based messaging"
```

---

### Task 6: Update api-contract skills

**Files:**
- Modify: `.claude/skills/api-contract/SKILL.md:33-34`
- Modify: `.codex/skills/api-contract/SKILL.md:32-33`

- [ ] **Step 1: Update Claude's api-contract skill**

Replace:
```
## 通知流程
- Codex 新增接口后 → Claude 通过 /ask gemini 通知前端
- Gemini 发现需要新接口 → Claude 通过 /ask codex 委派后端实现
```
with:
```
## 通知流程
- Codex 新增接口后 → Claude 通过文件消息系统通知 Gemini（写入 `.ccb/inbox/gemini/`）
- Gemini 发现需要新接口 → Claude 通过文件消息系统委派 Codex（写入 `.ccb/inbox/codex/`）
```

- [ ] **Step 2: Update Codex's api-contract skill**

Same replacement as Step 1.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/api-contract/SKILL.md .codex/skills/api-contract/SKILL.md
git commit -m "docs: update api-contract skills to file-based messaging"
```

---

### Task 7: End-to-end verification

**Files:**
- Reference: all modified files

- [ ] **Step 1: Grep for orphan `ask` command references**

```bash
grep -rE "ask codex|ask gemini|ask claude|ccb-ping|pend codex|pend gemini|pend claude|/ask " AGENTS.md GEMINI.md docs/ccb-protocol.md .claude/skills/ .codex/skills/api-contract/ .gemini/skills/
```

Expected: zero matches. (Historical specs/plans in `docs/superpowers/` intentionally retain old references — not scanned here.)

- [ ] **Step 2: Test write + notify to Codex**

Write a test message and send notification:

```bash
mkdir -p .ccb/inbox/codex
cat > .ccb/inbox/codex/001-notify.md << 'MSGEOF'
---
from: claude
type: notify
ts: 2026-04-02T02:00
---

CCB file messaging test. Reply with: "Read .ccb/inbox/claude/001-report.md — test report" after writing a report file to .ccb/inbox/claude/.
MSGEOF

echo "Read .ccb/inbox/codex/001-notify.md and execute the task inside" | wezterm cli send-text --pane-id 1 --no-paste
printf '\r' | wezterm cli send-text --pane-id 1 --no-paste
```

- [ ] **Step 3: Test write + notify to Gemini**

Same as Step 2 but target pane 2 and `.ccb/inbox/gemini/`.

- [ ] **Step 4: Check if replies arrive**

Wait for Codex/Gemini to respond. Check:
```bash
ls .ccb/inbox/claude/
```

If report files appear → full round-trip verified.

- [ ] **Step 5: Clean up test messages**

```bash
rm .ccb/inbox/codex/001-notify.md .ccb/inbox/gemini/001-notify.md .ccb/inbox/claude/*.md 2>/dev/null
```

- [ ] **Step 6: Update project_status.md**

In `docs/project_status.md`, replace the existing 待办 item 1:
```
1. 建立 Git worktree 隔离工作流（M3 遗留问题，M4 起强制执行）
```
Keep it, and add a new completed item in **最新完成** section:
```
**CCB 通信升级**：文件消息系统已实施，替代不稳定的 `ask` 命令。所有 agent 通信走 `.ccb/inbox/` 文件 + 短通知。
```

- [ ] **Step 7: Final commit**

```bash
git add docs/project_status.md
git commit -m "docs: update project status — CCB file messaging system complete"
```

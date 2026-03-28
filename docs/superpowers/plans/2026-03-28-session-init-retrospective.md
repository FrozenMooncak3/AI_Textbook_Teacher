# Session Init + Skill Chaining + Retrospective Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce user-facing skills to 3, automate context restoration via session-init, enforce skill execution order via chain declarations, and add a periodic retrospective mechanism.

**Architecture:** Two new skills (session-init, retrospective) + chain declaration annotations added to 6 existing skills + CLAUDE.md/using-superpowers updates to route through session-init. One file (pre-compact-check.sh) is outside Claude's boundary and requires Codex dispatch.

**Tech Stack:** Markdown skill files, bash (hook script)

**Spec:** `docs/superpowers/specs/2026-03-28-session-init-retrospective-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `.claude/skills/session-init/SKILL.md` | Context loader + chain router + session brief |
| Create | `.claude/skills/retrospective/SKILL.md` | Periodic review: gather data, analyze patterns, produce report |
| Update | `CLAUDE.md` | Replace 4-file read list with session-init directive |
| Update | `.claude/skills/using-superpowers/SKILL.md` | Simplify trigger table to 3 user-facing skills + add session-init trigger |
| Update | `.claude/skills/brainstorming/SKILL.md` | Add chain continuation note |
| Update | `.claude/skills/writing-plans/SKILL.md` | Add prerequisite check (spec exists?) |
| Update | `.claude/skills/executing-plans/SKILL.md` | Add prerequisite check (plan exists?) + chain continuation |
| Update | `.claude/skills/verification-before-completion/SKILL.md` | Add chain continuation to claudemd-check |
| Update | `.claude/skills/structured-dispatch/SKILL.md` | Add dispatch chain declaration |
| Update | `.claude/skills/requesting-code-review/SKILL.md` | Add chain continuation to claudemd-check |
| Dispatch | `scripts/hooks/pre-compact-check.sh` | Add session-init reminder line (Codex task) |

---

### Task 1: Create session-init Skill

**Files:**
- Create: `.claude/skills/session-init/SKILL.md`

- [ ] **Step 1: Create the session-init skill file**

Write `.claude/skills/session-init/SKILL.md` with the following content:

```markdown
---
name: session-init
description: Context loader + chain router. Auto-invoked at session start and after compact. Loads project state, assesses position, briefs user, injects chain routing.
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill.
</SUBAGENT-STOP>

# Session Init

Restore full project context at session start or after compact. Brief the user. Inject chain routing so the AI knows what comes next.

## Step 1: Load Context (parallel reads)

Read ALL of these in parallel:

| Source | What to extract |
|--------|----------------|
| `docs/project_status.md` | Current milestone, next step, blockers |
| `docs/decisions.md` | Closed decisions (don't re-discuss) |
| `docs/journal/INDEX.md` | Open/in-progress items, parked ideas |
| `docs/ccb-protocol.md` | Collaboration rules |
| MEMORY.md | Already in context (auto-loaded) — note user preferences and feedback |

Also run:

| Command | What to extract |
|---------|----------------|
| `git log -10 --oneline` | Recent work |
| `git status` | Uncommitted changes, unpushed commits |

## Step 2: Assess Position

Check for these signals to determine where the user left off:

| Signal | Meaning |
|--------|---------|
| Uncommitted changes exist | Work in progress, may need to commit |
| Unpushed commits exist | Completed work not yet pushed |
| Spec file exists in `docs/superpowers/specs/` without matching plan in `docs/superpowers/plans/` | Design done, needs implementation plan |
| Plan file exists with unchecked `- [ ]` items | Execution in progress |
| journal INDEX has `open` items | Unresolved issues need attention |
| project_status mentions "准备进入" or "未开始" for next milestone | Ready to start next milestone |

## Step 3: Brief User

Output a concise status in Chinese:

```
当前状态：[milestone] — [one-line summary]
上次做到：[what was last completed]
未完成：[open items, if any]
建议下一步：[recommendation]
```

Then ask: "要做什么？" and wait for the user's instruction.

## Step 4: Chain Routing (internal)

After the user gives an instruction, match it to one of these chains:

**Design Chain** — user wants to explore an idea, build something new, or brainstorm:
1. brainstorming
2. writing-plans
3. _(user decides: dispatch or execute)_

**Execution Chain** — user wants to execute a plan (Claude's own tasks: docs, skills, config):
1. executing-plans
2. verification-before-completion
3. claudemd-check

**Dispatch Chain** — user wants to send a task to Codex or Gemini:
1. structured-dispatch
2. _(wait for agent completion)_
3. requesting-code-review
4. claudemd-check

**Closeout Chain** — user wants to review and wrap up:
1. requesting-code-review
2. claudemd-check

If the user's instruction doesn't match any chain, handle it normally — chains are guides, not constraints.

## Does NOT

- Auto-execute any skill (only loads context and advises)
- Make decisions for the user
- Read files outside the defined source list
- Replace the user's explicit instructions with chain suggestions
```

- [ ] **Step 2: Verify file created correctly**

Run: `cat .claude/skills/session-init/SKILL.md | head -5`
Expected: YAML frontmatter with `name: session-init`

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/session-init/SKILL.md
git commit -m "feat: create session-init skill (context loader + chain router)"
```

---

### Task 2: Create retrospective Skill

**Files:**
- Create: `.claude/skills/retrospective/SKILL.md`

- [ ] **Step 1: Create the retrospective skill file**

Write `.claude/skills/retrospective/SKILL.md` with the following content:

```markdown
---
name: retrospective
description: "Use when the user says 'let's review how things are going' or invokes /retrospective. Analyzes journal, memory, git history for patterns and suggests improvements. Manual trigger only."
---

# Retrospective

Periodic review of AI collaboration patterns. Finds repeated friction, stale memories, missing memories, parked items, and workflow gaps. Produces actionable suggestions — executes nothing without user approval.

**Trigger:** User runs `/retrospective`. Manual only.

**Suggested cadence:** After each milestone completion, or weekly, or when collaboration feels off.

## Process

### 1. Gather Data (parallel reads)

Read ALL of these in parallel:

| Source | What to look for |
|--------|-----------------|
| MEMORY.md + linked memory files | Current memory entries (follow index links to read each file) |
| `docs/journal/` (all entries, not just INDEX) | Decisions, insights, parked ideas, resolved items |
| `git log -50 --oneline` (or since last retrospective) | Recent work patterns |
| `docs/project_status.md` | Current state, milestone progress |
| `docs/decisions.md` | Closed decisions for context |

### 2. Analyze for Patterns

Look for:

| Pattern | How to detect |
|---------|--------------|
| **Repeated friction** | Same type of issue in multiple journal entries |
| **Stale memories** | Memory records that contradict current project state |
| **Missing memories** | Important decisions/preferences in journals but not in memory |
| **Parked too long** | Journal entries parked >2 weeks, may need re-evaluation |
| **Workflow gaps** | Steps consistently skipped or causing confusion |

### 3. Produce Report

Three sections:

**a) New feedback memories (draft)**

For each discovered pattern, draft a memory entry. Format:

```
Memory: [title]
Type: feedback / project / reference
Content: [what to remember]
Why: [evidence from data]
```

Show all drafts to user. Save ONLY what user approves.

**b) Skill improvement suggestions**

```
Skill: [name]
Issue: [what's wrong]
Suggested change: [specific edit]
Evidence: [what triggered this suggestion]
```

**c) Journal housekeeping**

- Parked items to re-evaluate or archive
- Resolved items that can be cleaned up
- Open items that need attention

### 4. Execute Approved Changes

User reviews report and says what to do. Execute ONLY what's approved:
- Save approved memory entries
- Apply approved skill edits
- Clean up approved journal items

## Does NOT

- Auto-generate new skills
- Auto-modify existing skills or memory (user approval required for everything)
- Evaluate the user's behavior or decisions
- Run automatically (manual trigger only)
- Auto-retry or loop — present findings once, user decides
```

- [ ] **Step 2: Verify file created correctly**

Run: `cat .claude/skills/retrospective/SKILL.md | head -5`
Expected: YAML frontmatter with `name: retrospective`

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/retrospective/SKILL.md
git commit -m "feat: create retrospective skill (periodic review mechanism)"
```

---

### Task 3: Update using-superpowers — Simplify to 3 User-Facing Skills + Session-Init Trigger

**Files:**
- Modify: `.claude/skills/using-superpowers/SKILL.md`

- [ ] **Step 1: Add session-init trigger directive**

At the very top of the file (after the YAML frontmatter and before the `<SUBAGENT-STOP>` tag), add:

```markdown
<SESSION-START>
Before responding to the user's first message in a new session, you MUST invoke the session-init skill via the Skill tool. This loads project context, assesses where the user left off, and injects chain routing. After compact, re-invoke session-init to restore context.
</SESSION-START>
```

- [ ] **Step 2: Replace the trigger table section**

The current skill has no explicit trigger table — its guidance is embedded in the flow diagram and red flags table. Add a new section after `## Skill Types` and before `## User Instructions`:

```markdown
## User-Facing Skills (the only 3 the user needs to know)

| Skill | When to use | Command |
|-------|------------|---------|
| brainstorming | "I have an idea / I want to build X" | `/brainstorming` |
| retrospective | "Let's review how things are going" | `/retrospective` |
| claudemd-check | "Check compliance" (also auto-triggered before completion claims) | `/claudemd-check` |

All other skills are **internal** — triggered automatically by skill chains or prerequisites. The user never needs to invoke them directly. If a user asks "what skills do I have?", list only these 3.

Note: Claude Code's system-reminder will still list all installed skills. This table defines the *recommended workflow* — users can still manually invoke internal skills if they know what they're doing.
```

- [ ] **Step 3: Verify changes**

Run: `grep -n "SESSION-START\|User-Facing Skills" .claude/skills/using-superpowers/SKILL.md`
Expected: Both strings appear in the file

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/using-superpowers/SKILL.md
git commit -m "feat: add session-init trigger + simplify to 3 user-facing skills"
```

---

### Task 4: Update CLAUDE.md — Replace 4-File Read List with Session-Init Directive

**Files:**
- Modify: `CLAUDE.md:8-11` (the "每次会话开始时" section)

- [ ] **Step 1: Replace the 4-file list**

Change the "每次会话开始时" section from:

```markdown
## 每次会话开始时
1. 读 `docs/project_status.md` — 当前状态与下一步
2. 读 `docs/decisions.md` — 已关闭的决策（不重新讨论）
3. 读 `docs/journal/INDEX.md` — 会话日志索引（跟踪未解决事项和想法停车场）
4. 读 `docs/ccb-protocol.md` — CCB 多模型协作操作规范
```

To:

```markdown
## 每次会话开始时
调用 session-init skill（通过 Skill 工具）。它会自动完成：
- 读取项目状态、决策日志、会话日志、CCB 协议
- 检查 git 状态和未完成工作
- 向用户汇报当前位置和建议下一步
- 注入 skill chain 路由

如果 session-init 不可用（如 skill 文件缺失），手动读取以下文件作为 fallback：
1. `docs/project_status.md` — 当前状态与下一步
2. `docs/decisions.md` — 已关闭的决策（不重新讨论）
3. `docs/journal/INDEX.md` — 会话日志索引
4. `docs/ccb-protocol.md` — CCB 多模型协作操作规范
```

- [ ] **Step 2: Verify change**

Run: `grep -A2 "每次会话开始时" CLAUDE.md`
Expected: "调用 session-init skill" as first line after heading

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "feat: replace manual file reads with session-init skill directive"
```

---

### Task 5: Add Chain Declarations to 6 Existing Skills

**Files:**
- Modify: `.claude/skills/brainstorming/SKILL.md`
- Modify: `.claude/skills/writing-plans/SKILL.md`
- Modify: `.claude/skills/executing-plans/SKILL.md`
- Modify: `.claude/skills/verification-before-completion/SKILL.md`
- Modify: `.claude/skills/structured-dispatch/SKILL.md`
- Modify: `.claude/skills/requesting-code-review/SKILL.md`

Each skill gets a chain annotation at the end of the file. The format is standardized:

- [ ] **Step 1: Add chain continuation to brainstorming**

Append to the end of `.claude/skills/brainstorming/SKILL.md`:

```markdown

---

## Chain Position

This skill is the **entry point** of the **Design Chain**:
1. **brainstorming** ← you are here
2. writing-plans
3. _(user decides: dispatch or execute)_

**Next step:** After user approves the spec, invoke `writing-plans` automatically. This is already specified in the checklist above — this note reinforces the chain.
```

- [ ] **Step 2: Add prerequisite + chain note to writing-plans**

Append to the end of `.claude/skills/writing-plans/SKILL.md`:

```markdown

---

## Prerequisites Check

Before executing this skill, verify:
- [ ] A spec file exists in `docs/superpowers/specs/` for the current work
- If no spec exists, STOP and tell the user: "Implementation plans require a design spec first. Run /brainstorming to start the design process."

## Chain Position

This skill is **step 2** of the **Design Chain**:
1. brainstorming
2. **writing-plans** ← you are here
3. _(user decides: dispatch or execute)_

**Next step:** The chain ends here. Present the user with execution options (subagent-driven or inline). The user decides whether to dispatch to Codex/Gemini or execute directly.
```

- [ ] **Step 3: Add prerequisite + chain continuation to executing-plans**

Append to the end of `.claude/skills/executing-plans/SKILL.md`:

```markdown

---

## Prerequisites Check

Before executing this skill, verify:
- [ ] A plan file exists in `docs/superpowers/plans/` for the current work
- If no plan exists, STOP and tell the user: "Execution requires an implementation plan. Run /brainstorming to start the design process, which will lead to a plan."

## Chain Position

This skill is **step 1** of the **Execution Chain**:
1. **executing-plans** ← you are here
2. verification-before-completion
3. claudemd-check

**Next step:** After all tasks complete, invoke `verification-before-completion` automatically.
```

- [ ] **Step 4: Add chain continuation to verification-before-completion**

Append to the end of `.claude/skills/verification-before-completion/SKILL.md`:

```markdown

---

## Chain Position

This skill is **step 2** of the **Execution Chain**:
1. executing-plans
2. **verification-before-completion** ← you are here
3. claudemd-check

**Next step:** After verification passes, invoke `claudemd-check` automatically.
If verification fails, STOP. Report failures to the user. Do NOT proceed to claudemd-check until issues are resolved. The user decides whether to fix and retry or abandon.
```

- [ ] **Step 5: Add dispatch chain declaration to structured-dispatch**

Append to the end of `.claude/skills/structured-dispatch/SKILL.md`:

```markdown

---

## Chain Position

This skill is **step 1** of the **Dispatch Chain**:
1. **structured-dispatch** ← you are here
2. _(wait for Codex/Gemini to complete)_
3. requesting-code-review
4. claudemd-check

**Next step:** After dispatching, wait for the agent to complete. Once done, invoke `requesting-code-review` to review their work.
```

- [ ] **Step 6: Add chain continuation to requesting-code-review**

Append to the end of `.claude/skills/requesting-code-review/SKILL.md`:

```markdown

---

## Chain Position

This skill appears in multiple chains:

**Dispatch Chain** (step 3):
1. structured-dispatch
2. _(wait for agent)_
3. **requesting-code-review** ← you are here
4. claudemd-check

**Closeout Chain** (step 1):
1. **requesting-code-review** ← you are here
2. claudemd-check

**Next step:** After review is complete and issues are addressed, invoke `claudemd-check` automatically.
```

- [ ] **Step 7: Verify all 6 files have chain annotations**

Run: `grep -l "Chain Position" .claude/skills/*/SKILL.md`
Expected: 6 files listed (brainstorming, writing-plans, executing-plans, verification-before-completion, structured-dispatch, requesting-code-review)

- [ ] **Step 8: Commit**

```bash
git add .claude/skills/brainstorming/SKILL.md .claude/skills/writing-plans/SKILL.md .claude/skills/executing-plans/SKILL.md .claude/skills/verification-before-completion/SKILL.md .claude/skills/structured-dispatch/SKILL.md .claude/skills/requesting-code-review/SKILL.md
git commit -m "feat: add chain position declarations to 6 existing skills"
```

---

### Task 6: Dispatch Codex — Update pre-compact-check.sh

**Files:**
- Modify: `scripts/hooks/pre-compact-check.sh` (Codex's file boundary)

This file is outside Claude's file boundary (`scripts/**`). Dispatch to Codex.

- [ ] **Step 1: Prepare dispatch using structured-dispatch skill**

Dispatch context:

```
[DISPATCH TO: Codex]

## Context
Third brainstorming implementation — session-init + skill chaining + retrospective.
Spec: `docs/superpowers/specs/2026-03-28-session-init-retrospective-design.md` (Section 5.1, post-compact trigger)
All other tasks in this plan are complete. This is the final task.

## Task
Add one line to `scripts/hooks/pre-compact-check.sh` output that reminds the AI to re-run session-init after compact.

In the script, after the existing checks (uncommitted, unpushed, boundary, status/changelog), add a line to the OUTPUT that says:
"After compact, re-run session-init skill to restore context."

This line should ALWAYS appear (not conditional), because it's a reminder that's useful after every compact.

Add it just before the reset stop counter section (line 44: `echo "0" > ".claude/.stop-count"`).

The specific code to add after line 43 (`fi` closing the status/changelog check) and before line 45 (`echo "0"`):

```bash
# 6. Remind to re-run session-init after compact
OUTPUT="${OUTPUT}After compact, re-run session-init skill to restore context.\n"
```

## Files
- **Modify**: `scripts/hooks/pre-compact-check.sh:43-45` (add 2 lines between existing check and stop counter reset)
- **Reference**: `docs/superpowers/specs/2026-03-28-session-init-retrospective-design.md` (Section 5.1)

## Acceptance Criteria
- [ ] `scripts/hooks/pre-compact-check.sh` contains the session-init reminder line
- [ ] The reminder is unconditional (always appears in output)
- [ ] Existing functionality unchanged (all 5 existing checks still work)
- [ ] Script still exits 0

## Tier
**Light** — code is pre-written, just insert 2 lines.

## Suggested Skills
`coding-standards`

## Post-Completion
Claude will review the change, then run claudemd-check to close out.
```

- [ ] **Step 2: Wait for Codex to complete**

- [ ] **Step 3: Review Codex's change**

Run: `git diff HEAD scripts/hooks/pre-compact-check.sh`
Verify: session-init reminder line exists, existing checks unchanged, exits 0.

- [ ] **Step 4: Commit if not already committed by Codex**

---

### Task 7: Update Status Files + Final Verification

**Files:**
- Modify: `docs/project_status.md`
- Modify: `docs/changelog.md`
- Modify: `docs/journal/INDEX.md`
- Modify: `docs/journal/2026-03-28-skill-automation.md`

- [ ] **Step 1: Update project_status.md**

Change the "下一步" line from:
```
**下一步**：第三次 brainstorming spec 已完成（session-init + skill chaining + retrospective），等用户 review spec 后进入 writing-plans 写实施计划，然后再进 M1
```

To:
```
**下一步**：第三次 brainstorming 实施完成（session-init + skill chaining + retrospective），准备进入 M1
```

Add to history table:
```
| 2026-03-28 | **第三次 brainstorming 实施完成**：session-init skill + retrospective skill + 6 skill chain 声明 + CLAUDE.md/using-superpowers 更新 |
```

- [ ] **Step 2: Update changelog.md**

Add entry for today's work.

- [ ] **Step 3: Update journal INDEX**

Move the in_progress entry to resolved:
```
- [decision:resolved] 第三次 brainstorming：session-init + retrospective + chain declarations 已实施 → [2026-03-28-skill-automation.md](./2026-03-28-skill-automation.md)
```

- [ ] **Step 4: Update journal entry**

Update the "当前状态" in `2026-03-28-skill-automation.md` to reflect completion.

- [ ] **Step 5: Commit**

```bash
git add docs/project_status.md docs/changelog.md docs/journal/INDEX.md docs/journal/2026-03-28-skill-automation.md
git commit -m "docs: update status files for session-init + retrospective completion"
```

- [ ] **Step 6: Run claudemd-check**

Invoke `/claudemd-check` to verify compliance.

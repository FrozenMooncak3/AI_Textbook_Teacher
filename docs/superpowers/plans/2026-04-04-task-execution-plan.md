# Task Execution Skill Implementation Plan

> **Execution:** Claude executes this plan inline (all files are within Claude's write boundary: `.claude/skills/**`, `docs/**`, `.gitignore`). No dispatch to Codex/Gemini needed.

**Goal:** Create a unified execution skill that orchestrates the full lifecycle of dispatching tasks to Codex/Gemini, including state tracking, review decisions, retry limits, and completion checklists.

**Architecture:** A single SKILL.md that inlines structured-dispatch and requesting-code-review as sub-procedures, driven by a task-ledger.json state file. Existing skills are updated for compatibility (review levels, severity taxonomy, chain positions).

**Spec:** `docs/superpowers/specs/2026-04-04-task-execution-design.md`

---

### Task 1: Create task-execution SKILL.md

**Files:**
- Create: `.claude/skills/task-execution/SKILL.md`

The main skill file. Structure:

```
---
name: task-execution
description: Unified execution engine — orchestrates dispatch, review, retry, and completion for multi-task plans via CCB.
---

# Task Execution

[trigger conditions, prerequisites]

## Phase 0: Initialize
[load plan, init/restore ledger, output progress summary, auto-detect completion via git log]

## Phase 1: Dispatch (per task)
[estimate review level, inline structured-dispatch sub-procedure, update ledger]

## Phase 2: Wait for Completion
[wait for user notification or git-log detection on session recovery]

## Phase 3: Review
[check actual diff scope, upgrade review level if needed, run review at determined level]
[inline requesting-code-review sub-procedure for each level: Full/Spot Check/Auto-Pass]

## Phase 4: Decide
[quality gate: Blocking/Advisory/Informational → Pass/Recycle/Escalate]
[circuit breaker: classify failure type, enforce retry limit]
[transition checklist: verify all steps before state change]

## Phase 5: Closeout
[all tasks done → progress summary → trigger verification chain]

## Reference Tables
[state machine, review level rules, circuit breaker rules, quality gate, transition checklists, ledger schema]
```

Key content requirements for each section:

**Phase 0 — Initialize:**
- Read plan file path from user or detect from project_status.md
- If `.ccb/task-ledger.json` exists → restore progress, find first non-done task
- If not → create ledger, initialize all tasks as `ready`
- Recovery: if current task is `dispatched`, run `git log --oneline --author=<assignee_email>` (filter by assigned agent's git identity) to check for new commits since last known commit. If found → suggest entering review
- Output formatted progress summary table

**Phase 1 — Dispatch (sub-procedure from structured-dispatch):**
- Estimate review level using decision rules:
  - Full: >2 files, new API/component, touches interface contracts
  - Spot Check: 1-2 files, known pattern
  - Auto-Pass: rename/format/copy
- Write review_level to ledger
- Check architecture.md interface contracts relevant to task
- Fill dispatch template (Context, Task, Files, Acceptance Criteria, Suggested Skills, Post-Completion)
- Model tier: always highest (Codex: gpt-5.4 high / Gemini: gemini-2.5-pro). No tier field needed.
- Show Chinese translation to user
- User approves → write to `.ccb/inbox/<target>/<NNN>-dispatch.md` + send wezterm notification
- Update ledger state → `dispatched`

**Phase 2 — Wait:**
- End turn. Claude cannot proceed until user says agent is done or session resumes.
- On session resume: Phase 0 recovery handles auto-detection.

**Phase 3 — Review (sub-procedure from requesting-code-review):**
- First: check actual diff (`git diff --stat <base>..<head>`)
- If actual scope > estimated → upgrade review_level (only up, never down)
- Then execute review at determined level:
  - **Full Review:** dispatch code-reviewer subagent (Agent tool) with updated template (Blocking/Advisory/Informational severity). Then Claude does quality pass: read diff, check against spec acceptance criteria.
  - **Spot Check:** Claude reads diff directly. Check: spec compliance, no regressions, no interface contract violations. No subagent.
  - **Auto-Pass:** Run `npm run build` (or equivalent). If passes → auto-approve. No human review.
- Classify each finding as Blocking / Advisory / Informational
- Record advisory_count and blocking_issues in ledger

**Phase 4 — Decide:**
- **No Blocking → Pass:**
  - Run transition checklist (→ done):
    - [ ] changelog updated (skip for Auto-Pass)
    - [ ] ledger updated with commits
    - [ ] If last task: project_status.md updated, architecture.md checked
  - Update state → `done`
  - Proceed to next task (back to Phase 1)
- **Blocking found → classify failure type:**
  - `spec_mismatch` (agent misunderstood requirements) → update state → `escalated`, present options to user
  - `implementation_error` (code is wrong) + retry_count < 2 → retry_count += 1, dispatch fix listing specific Blocking issues, update state → `dispatched`, back to Phase 2
  - `implementation_error` + retry_count >= 2 → update state → `escalated`
  - `infra_error` (dispatch encoding garbled, environment issue) → fix infrastructure problem, do NOT increment retry_count, re-dispatch with corrected content, state stays `dispatched`
- **Escalated → present options:**
  1. Modify spec and re-dispatch (retry_count resets to 0, state → `ready`)
  2. Switch agent
  3. Split task
  4. Skip (state → `skipped`)

**Phase 5 — Closeout:**
- Output milestone progress summary from ledger
- List any accumulated Advisory items (suggest cleanup task if >5)
- Prompt: trigger verification → claudemd-check → milestone-audit

**Reference tables:** copy directly from spec Sections 3.2-3.6, formatted as quick-reference.

- [ ] **Step 1:** Create directory `.claude/skills/task-execution/`
- [ ] **Step 2:** Write SKILL.md with all phases and reference tables
- [ ] **Step 3:** Verify SKILL.md is self-contained (no dangling references)
- [ ] **Step 4:** Commit

---

### Task 2: Update requesting-code-review

**Files:**
- Modify: `.claude/skills/requesting-code-review/SKILL.md`
- Modify: `.claude/skills/requesting-code-review/code-reviewer.md`

Changes to SKILL.md:
1. Add "Review Level" section after "When to Request Review":
   - Full Review: dispatch subagent + Claude quality pass (current behavior)
   - Spot Check: Claude reads diff directly, no subagent
   - Auto-Pass: build verification only
   - Note: level is determined by task-execution, not by this skill
2. Rewrite chain position section: remove old Dispatch Chain and Closeout Chain references. Replace with: "This skill is now inlined as a sub-procedure by task-execution. When task-execution is active, this skill's review flow is triggered as Phase 3 of the task loop. The review level (Full/Spot Check/Auto-Pass) is determined by task-execution."

Changes to code-reviewer.md:
1. Replace severity taxonomy in Output Format:
   - `Critical (Must Fix)` → `Blocking (Must Fix)`
   - `Important (Should Fix)` → `Advisory (Should Fix)`
   - `Minor (Nice to Have)` → `Informational (Note)`
2. Update the Example Output section to match new taxonomy
3. Update Critical Rules section references

- [ ] **Step 1:** Update SKILL.md — add review levels, update chain position
- [ ] **Step 2:** Update code-reviewer.md — replace severity taxonomy + example
- [ ] **Step 3:** Commit

---

### Task 3: Update session-init chain declarations

**Files:**
- Modify: `.claude/skills/session-init/SKILL.md`

Changes:
1. In Step 4 Rule 5 (Chain Routing), update **Dispatch Chain**:
   - Before: `structured-dispatch → 等待完成 → requesting-code-review → claudemd-check`
   - After: `task-execution (manages dispatch + review + retry internally) → verification → claudemd-check`
2. In Step 4 Rule 3 (Skill 自动触发), update trigger table:
   - Before: "派发任务给 Codex/Gemini → structured-dispatch"
   - After: "执行计划中的任务 → task-execution"
   - Before: "用户告知 Codex/Gemini 完成任务 → requesting-code-review"
   - After: "用户告知 agent 完成 → task-execution (进入 review phase)"
3. In Step 5 (Skill 使用手册), add task-execution to core skills table:
   - `task-execution | 计划执行引擎（dispatch→review→retry→close 全自动） | 有计划要执行时自动 / 用户说"执行"时`
4. Update executing-plans entry: mark as "本项目不使用（Claude 不写业务代码）"

- [ ] **Step 1:** Update chain routing rules
- [ ] **Step 2:** Update auto-trigger table
- [ ] **Step 3:** Update skill handbook
- [ ] **Step 4:** Commit

---

### Task 4: Update structured-dispatch chain position

**Files:**
- Modify: `.claude/skills/structured-dispatch/SKILL.md`

Changes:
1. Update Chain Position section at bottom:
   - Add note: "This skill is now inlined as a sub-procedure by task-execution. When task-execution is active, this skill's flow is followed as Phase 1 of the task loop. When used standalone (outside task-execution), the chain below applies."
2. Remove Tier section from dispatch template (or replace with note: "Model tier: always highest. See CCB protocol Section 3 for reference only.")

- [ ] **Step 1:** Update chain position + tier note
- [ ] **Step 2:** Commit

---

### Task 5: Update .gitignore

**Files:**
- Modify: `.gitignore`

Add after the existing CCB section:
```
# CCB task ledger (runtime progress, not committed)
.ccb/task-ledger.json
```

- [ ] **Step 1:** Add gitignore entry
- [ ] **Step 2:** Commit

---

### Task 6: Final verification

- [ ] **Step 1:** Read all modified files, verify no dangling references
- [ ] **Step 2:** Verify task-execution SKILL.md can stand alone (all sub-procedures are inlined, not just referenced)
- [ ] **Step 3:** Verify severity taxonomy is consistent across all skill files (Blocking/Advisory/Informational everywhere)
- [ ] **Step 4:** Run `git log --oneline -5` to confirm all commits landed
- [ ] **Step 5:** Update `docs/project_status.md` — note task-execution skill completed

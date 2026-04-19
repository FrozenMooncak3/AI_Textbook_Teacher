---
name: task-execution
description: Unified execution engine — orchestrates dispatch, review, retry, and completion for multi-task plans via CCB. Use when executing implementation plans with tasks assigned to Codex/Gemini.
---

# Task Execution

Orchestrate the full lifecycle of a multi-task implementation plan: dispatch each task to Codex/Gemini, track state, review results, handle retries, enforce completion checklists.

## When to Use

- User says "execute plan" / "run plan" / "start execution"
- A writing-plans output exists and user wants to begin implementation
- Session resumes and `.ccb/task-ledger.json` exists with unfinished tasks

## Prerequisites

- A plan file exists in `docs/superpowers/plans/`
- CCB environment is running (Codex/Gemini panes available)
- `docs/architecture.md` is up to date (run milestone-audit if unsure)

---

## Execution Mode

Two modes. Pick the one the user asked for.

| Mode | Trigger | Dispatch approval | Review summary output | Escalation to user |
|------|---------|-------------------|----------------------|--------------------|
| **Interactive** (default) | User says "execute plan" without qualifier | Required (Step 1.4) | Required (Step 3.4) | Normal |
| **Autonomous** | User says "全自动" / "autonomous" / "不用问我" / equivalent | **Skipped** (Step 1.4) | **Still required** (Step 3.4) | Normal |

### Autonomous does NOT relax these hard rules

Autonomous mode only removes the dispatch approval gate. Everything else stays:

- **Full Review MUST run subagent pass** — never skip, never "eyeball it because we're going fast"
- **Review summary output (Step 3.4) is mandatory** — autonomous ≠ silent
- **Blocking issues still trigger recycle** — don't self-downgrade blocking to advisory to keep moving
- **retry_count / escalation still applies** — after 2 failed retries OR any `spec_mismatch`, STOP and escalate to user
- **Transition checklist still enforced** — ledger / changelog / project_status must be updated before state flips to `done`

If user says "autonomous" but you feel a task is risky enough to want approval anyway, ask once. Autonomous is user convenience, not a skill bypass.

### Mode transitions

- User can interrupt autonomous at any time ("暂停" / "wait") → current task finishes its current phase, then pause before next phase
- Interactive can upgrade to autonomous mid-plan ("后面的不用问了") → apply from next task
- Autonomous cannot downgrade to interactive silently — acknowledge the switch

---

## Phase 0: Initialize

```
1. Identify plan file:
   - User provides path, OR
   - Read docs/project_status.md to find current milestone's plan

2. Read plan file, extract task list

3. Check .ccb/task-ledger.json:
   - EXISTS → restore progress (see "Session Recovery" below)
   - NOT EXISTS → create ledger, all tasks state="ready"

4. Output progress summary (see "Progress Display" below)

5. Proceed to Phase 1 for first ready task
```

### Session Recovery

When the skill loads and `task-ledger.json` already exists:

1. Read ledger, find first task where state is NOT `done` or `skipped`
2. If that task's state is `dispatched`:
   - Read `assignee` from ledger
   - Run: `git log --oneline --after="<last_known_commit_date>" | head -10`
   - If new commits exist from the assigned agent → output:
     "检测到新提交，建议进入 review。确认？"
   - User confirms → update state to `in_review`, proceed to Phase 3
   - No new commits → output: "任务仍在执行中，等待完成"
3. If state is `in_review` → resume Phase 3 (re-run review from scratch)
4. If state is `escalated` → present escalation options again
5. Output progress summary

### Progress Display

```
═══ 执行进度 ═══
计划：[plan file name]
里程碑：[milestone]

  T1 [assignee] ✅ done     — [title]
  T2 [assignee] ✅ done     — [title]
  T3 [assignee] 🔄 dispatched — [title]  ← 当前
  T4 [assignee] ⬜ ready    — [title]
  ...

Advisory 累计：N 条
═══════════════
```

---

## Phase 1: Dispatch

For the current task (first `ready` task in ledger):

### Step 1.1: Determine Review Level

Apply these rules in order (first match wins):

| Rule | Review Level |
|------|-------------|
| Task touches interface contracts in architecture.md | **Full** |
| Task creates new API endpoint or component | **Full** |
| Task is expected to modify >2 files | **Full** |
| Task modifies 1-2 files with known pattern | **Spot Check** |
| Task is rename / format / copy / text change | **Auto-Pass** |

Write the determined `review_level` to ledger.

This is an **estimate** based on the task spec. After the agent completes, the actual diff may trigger an upgrade (see Phase 3).

### Step 1.2: Pre-Dispatch Checks

Read `docs/architecture.md` Section "接口契约". Identify:
1. Cross-module dependencies relevant to this task
2. Any `⚠️` markers the agent might encounter
3. Include these in the dispatch Context section

### Step 1.3: Write Dispatch

Fill the dispatch template:

```markdown
---
from: claude
type: dispatch
ts: [timestamp]
---

**[DISPATCH TO: Codex / Gemini]**

## Context
[Why this task exists. Link to plan file. Prior completed tasks if any.]
[Interface contract dependencies from Step 1.2]

## Task
[Clear, imperative instructions. One task per dispatch.]

## Files
- **Create**: [exact paths]
- **Modify**: [exact paths with line ranges if relevant]
- **Reference**: [files to read, do NOT modify]

## Acceptance Criteria
- [ ] [Testable criterion 1]
- [ ] [Testable criterion 2]

## Suggested Skills
[coding-standards, test-driven-development, etc.]

## Post-Completion
After completing this task:
1. Commit and push to master
2. Write a completion report to .ccb/inbox/claude/<NNN>-report.md
```

**Model tier:** Always use highest (Codex: gpt-5.4 high / Gemini: gemini-2.5-pro). Do not include a Tier field.

**Gemini doc guard:** If the task involves modifying docs/ files, add explicit instruction: "Edit only the relevant section. Do NOT rewrite the entire file."

### Step 1.4: User Approval

**Interactive mode:** Show Chinese translation of the dispatch (Context + Task + Acceptance Criteria — skip inline code) to user. Wait for approval before proceeding to Step 1.5.

**Autonomous mode:** Skip this step. Proceed directly to Step 1.5. You still write a one-line dispatch announcement to the user ("已派发 T[N] 到 [target]: [one-line task summary]") when Step 1.5 finishes — that's in 1.5, not here.

### Step 1.5: Send

1. Determine next sequence number: `ls .ccb/inbox/<target>/` → max NNN + 1 (start from 001 if empty)
2. Write dispatch to `.ccb/inbox/<target>/<NNN>-dispatch.md`
3. Send notification:
   ```bash
   echo "Read .ccb/inbox/<target>/<NNN>-dispatch.md and execute the task inside" | wezterm cli send-text --pane-id <pane> --no-paste
   printf '\r' | wezterm cli send-text --pane-id <pane> --no-paste
   ```
   Pane IDs: Claude=0, Codex=1, Gemini=2

4. Update ledger:
   - `state` → `dispatched`
   - `dispatch_file` → path written
5. Confirm to user: "已派发 T[N] 到 [target]"

---

## Phase 2: Wait for Completion

End turn. Cannot proceed until:
- User says the agent is done, OR
- Session resumes and Phase 0 recovery detects new commits

When completion is confirmed:
1. Record commit hash(es) in ledger `commits` field
2. Record report file path in ledger `report_file` field (if agent wrote one)
3. Update state → `in_review`
4. Proceed to Phase 3

---

## Phase 3: Review

### Step 3.1: Check Actual Scope

Run `git diff --stat <base_commit>..<head_commit>` to see what the agent actually changed.

**Review level upgrade rule:** If the actual diff shows more files or broader scope than estimated:
- Estimated Spot Check but agent changed >2 files → upgrade to **Full**
- Estimated Spot Check but agent touched interface contracts → upgrade to **Full**
- Estimated Auto-Pass but agent changed logic (not just format) → upgrade to **Spot Check**

Only upgrade, never downgrade. Update ledger `review_level` if upgraded.

### Step 3.2: Execute Review

**Full Review:**

1. **Subagent spec compliance pass.** Dispatch code-reviewer Agent with:
   - What was implemented: task description from plan
   - Requirements: acceptance criteria from dispatch
   - Git range: base..head commits
   - Instruction: classify issues as Blocking / Advisory / Informational
   - **语言要求（硬约束）**：subagent prompt 最后一段必须显式要求"用中文书写所有 finding 描述和 summary"，只保留以下英文：severity 分类名（Blocking / Advisory / Informational）、verdict 枚举（PASS / RETRY / ESCALATE）、文件路径、命令、SDK / API 名称、错误原文

2. **Claude quality pass.** Read the diff yourself. Check:
   - Does implementation match the design intent (not just the letter of the spec)?
   - Any interaction quality or UX issues?
   - Any product invariant violations? (see CLAUDE.md)
   - Any interface contract inconsistencies with architecture.md?

3. Merge findings from both passes. Deduplicate.

**Spot Check:**

Claude reads the diff directly. Check:
- Spec compliance (acceptance criteria met?)
- No regressions (existing tests still pass?)
- No interface contract violations
- No obvious bugs

No subagent dispatched.

**Auto-Pass:**

Run build verification: `npm run build` (or equivalent).
- Build passes → auto-approve, skip human review
- Build fails → escalate to Spot Check

### Step 3.2.5: Review 终止硬 check（系统进化机制 M10）

Review phase 在声明 `passed` / `verdict: pass` 前**必须**运行下列 `required_pass` 列表并全部返回 exit 0。目的：避免 review 基于 Claude 主观判断就 "pass"，survey §D Finding 3.1 显示 LLM 自评 ECE 77%（Expected Calibration Error）。

```yaml
review_termination_criteria:
  required_pass:
    - command: "npm run build"
      expect_exit: 0
    - command: "npm test"
      expect_exit: 0
    - command: "npm run lint"
      expect_exit: 0
  optional_signals:
    - "manual_visual_check"
    - "smoke_test_passed"
```

**硬规则**：
- Claude 必须实际调用这些命令并报告 exit code（不得"估计应该过了"）
- 任一 `required_pass` 未达 → review **不能声明 passed**，必须回到 Phase 4 Path B（Recycle）或 Path C（Escalate）
- Claude 主观判断是**补充信号**（指出 build 过但逻辑错），不能**替代**硬 check
- 命令失败时：把 stderr 最后 500 字符写入 ledger `review_summary.notes`，便于下轮 debug

**例外处理**：任务纯文档改动（无构建 / 测试影响）时，reviewer 必须在 Review 开始时**明文声明**"本任务无构建/测试硬 check，仅走人工 review"——例外必须可见且记录到 `review_summary.notes`，不得静默跳过。

**触发条件**：`review_level` 为 `Full` 或 `Spot Check` 时必走。`Auto-Pass` 已包含 `npm run build` 硬 check，本段不重复。

### Step 3.3: Classify Findings

For each finding, assign one severity:

| Severity | Definition | Impact |
|----------|-----------|--------|
| **Blocking** | Violates spec, breaks existing functionality, violates product invariant | Triggers Recycle |
| **Advisory** | Code quality, naming, minor inefficiency — correct but improvable | Record, don't block |
| **Informational** | Observation, suggestion, alternative approach | Note, no action |

Update ledger: `blocking_issues` array, `advisory_count` increment.

### Step 3.4: Output Review Summary (MANDATORY)

This step is required in BOTH interactive and autonomous modes. Autonomous does not mean silent.

Output this block to the user verbatim (fill in the bracketed parts):

```
═══ T[N] Review ═══
级别：[Full / Spot Check / Auto-Pass]  （从 [X] 升级）   ← only if upgraded
变更：[N 文件, +X -Y]
文件：[逗号分隔文件列表]

Subagent（仅 Full）：
  • [finding 1 — 已分类]
  • [finding 2 — 已分类]
  • [如无问题：「干净 — N/N 条验收标准 ✅」]

Claude 质量复核：
  • [finding 1 — 已分类]
  • [如同意 subagent：「同意 subagent，无新增发现」]
  • [如降级 subagent 任一 finding：「降级 X：理由……」]

Blocking：[N] | Advisory：[N] | Informational：[N]
裁决：PASS / RETRY（第 X/3 次）/ ESCALATE
════════════════════
```

**Rules:**
1. Output BEFORE updating ledger state to `done` or recycling — user must see the verdict first
2. If you downgrade a subagent finding, explicitly log the reason (prevents silent quality erosion)
3. Write the full summary (subagent + Claude findings + verdict) into ledger `review_summary` field (see schema). This is how session recovery / future audits see what happened.
4. If `review_level` was upgraded in Step 3.1, note it on the `Level:` line
5. **语言要求（硬约束）**：所有 finding / notes / verdict 说明一律用中文；模板标签、`subagent_findings` / `claude_findings` / `notes` 字段内容全中文。仅以下可保留英文：severity 分类名（Blocking / Advisory / Informational）、verdict 枚举（pass / retry / escalate）、文件路径、命令、SDK / API 名称、错误原文、commit hash。违反此条 = skill 违规。

Also write the same summary content into the ledger entry (see updated schema below).

---

## Phase 4: Decide

### Path A: Pass (no Blocking issues)

Step 3.4 already output the review summary with `裁决: PASS`. Don't repeat a "T[N] ✅ 完成" line — that's redundant noise.

1. Run transition checklist (all must be checked):
   - [ ] Review passed (no Blocking)
   - [ ] Changelog updated (skip for Auto-Pass level)
   - [ ] Ledger updated with commits + `review_summary`
   - [ ] If **last task**: project_status.md updated + architecture.md verified

2. If any checklist item is not done → do it now, then check it off
3. Update state → `done`
4. Check: is there a next `ready` task? → proceed to Phase 1
5. All tasks done? → proceed to Phase 5

### Path B: Recycle (Blocking issues found)

1. **Classify failure type:**

   | Type | Signal | Action |
   |------|--------|--------|
   | `implementation_error` | Code is wrong, missing file, logic bug | Can retry |
   | `spec_mismatch` | Agent misunderstood requirements, wrong approach | Escalate immediately |
   | `infra_error` | Dispatch encoding garbled, environment issue | Fix infra, don't count retry |

2. **If `spec_mismatch`** → update state → `escalated`, go to Path C

3. **If `infra_error`** → fix the infrastructure issue (e.g., re-encode dispatch), re-dispatch with corrected content. Do NOT increment retry_count. State stays `dispatched`. Back to Phase 2.

4. **If `implementation_error`:**
   - Check retry_count. If >= 3 → update state → `escalated`, go to Path C
   - Otherwise:
     - Increment `retry_count` (BEFORE dispatching fix)
     - **Mirror to persistent counter**（M11 硬 cap）：`.ccb/counters/task-retries-${task_uuid}.count` 同步写入当前 retry_count。若文件不存在则用任务 id（T[N]_<timestamp>）作为 uuid。在 Phase 1 Step 1.5 dispatch 时若 `task_uuid` 不存在则生成：`task_uuid="T${N}-$(date +%s)"`，记入 ledger
     - Write fix dispatch listing specific Blocking issues:
       ```
       ## Fix Required (Attempt [retry_count+1] of 3)
       
       The following Blocking issues were found in your implementation:
       1. [Issue description + file:line + how to fix]
       2. ...
       
       Fix these issues and re-commit. Do not change anything else.
       ```
     - Update state → `dispatched`
     - Back to Phase 2

### Path C: Escalated

Present options to user:

```
═══ 任务 T[N] 需要人工决策 ═══

失败类型：[spec_mismatch / retry_limit_reached]
重试次数：[N] / 2
Blocking 问题：
  1. [issue]
  2. [issue]

选项：
  1. 修改 spec 后重新派发（retry_count 重置）
  2. 换 agent 重新派发
  3. 拆分任务
  4. 跳过（标记 skipped）
═══════════════════════════
```

Wait for user decision. Execute accordingly:
- Option 1: update state → `ready`, retry_count = 0, back to Phase 1
- Option 2: change assignee in ledger, update state → `ready`, retry_count = 0
- Option 3: user defines sub-tasks, add to ledger, current task → `skipped`
- Option 4: update state → `skipped`

---

## Retry 硬 cap（系统进化机制 M11）

**目的**：避免 $47k 无限循环案例（survey §D Finding 1.3：LangChain "infinite CodeAct loop" on ambiguous task）。

**双层计数**：
1. **Ledger 内 `retry_count`**：会话内可见、用于 Step 3.4 review summary 显示（如 "Retry #2 of 3"）
2. **持久化 counter** `.ccb/counters/task-retries-${task_uuid}.count`：跨 session 存活；即使 session /compact 或 crash 重启，counter 不丢

**流程**（Phase 4 Path B Step 4 触发，这里是整体规约）：

1. Dispatch 前（Phase 1 Step 1.5）：生成并记录 `task_uuid = "T${N}-$(date +%s)"` 到 ledger
2. 每次 retry 前读 `.ccb/counters/task-retries-${task_uuid}.count`（不存在则 0）
3. COUNT+1 写回文件 + ledger `retry_count`
4. **if COUNT >= 3**：surface to user
   ```
   🛑 Retry cap hit (3/3) for task ${task_uuid}.
   Manual diagnosis required. 对应 dispatch: <dispatch_file>。
   禁止继续 retry，必须走 systematic-debugging 或放弃任务（skipped）。
   ```
   → 走 Path C（escalated）
5. COUNT < 3 → 允许 retry，回到 Phase 2

**生命周期**：任务完成（done）/ 跳过（skipped）/ 升级（escalated 并由用户走 systematic-debugging）后，counter 文件保留 24h 供 retrospective 2.0 挖矿，超过由 `memory-cleanup` skill 清理。

**硬规则**：
- 不接受"只差一点再试一次"说辞——survey $47k 案例明确警告
- Kill switch：`AI_SYSTEM_EVOLUTION_DISABLE=1` 不影响本机制（cap 是 dispatch 层硬约束，不走 hook）

---

## Phase 5: Closeout

When all tasks are `done` or `skipped`:

```
═══ 执行完成 ═══

完成：[N] / [total] 任务
跳过：[M] 任务
Advisory 累计：[K] 条

下一步：
  → verification-before-completion
  → claudemd-check
  → milestone-audit（如果是里程碑收尾）
═══════════════
```

If advisory_count > 5, suggest: "建议安排一个 cleanup task 处理累积的 Advisory 问题"

---

## Task Ledger Schema

File: `.ccb/task-ledger.json` (runtime, not committed to git)

```json
{
  "milestone": "M6",
  "plan_file": "docs/superpowers/plans/2026-04-05-m6-plan.md",
  "created_at": "2026-04-05T10:00:00",
  "tasks": [
    {
      "id": "T1",
      "title": "Task description",
      "assignee": "gemini",
      "state": "ready",
      "review_level": null,
      "retry_count": 0,
      "failure_type": null,
      "dispatch_file": null,
      "report_file": null,
      "commits": [],
      "advisory_count": 0,
      "blocking_issues": [],
      "review_summary": null,
      "checklist": {
        "changelog": false,
        "ledger_updated": false
      }
    }
  ]
}
```

### `review_summary` field

Populated in Step 3.4 when a review completes. Null until then. Schema:

```json
"review_summary": {
  "level_used": "full",
  "diff_stat": "3 文件, +529 -0",
  "subagent_findings": [
    "Advisory: 某某函数命名不一致 — [理由]",
    "Informational: ……"
  ],
  "claude_findings": [
    "同意 subagent,无新增 Blocking",
    "降级 subagent 'X' 从 Blocking 到 Advisory,理由 [解释]"
  ],
  "verdict": "pass",
  "notes": "简短自由文本,例如「Retry #1 — 修掉 cluster dedup」"
}
```

**字段语言约束**：`subagent_findings` / `claude_findings` / `notes` 一律中文；`level_used` / `verdict` 用英文枚举（full / spot_check / auto_pass / pass / retry / escalate）；`diff_stat` 可中英混写（数字 + 单位）。

On retry, overwrite the previous review_summary (old one becomes the retry's reason, captured in `notes`).

Purpose: allows session recovery / future audit to see what was reviewed and what decisions were made. Without this, "T3 是怎么 review 的" is unanswerable once the conversation scrolls away.

Valid states: `ready`, `dispatched`, `in_review`, `done`, `escalated`, `skipped`

Valid assignees: `codex`, `gemini`

Valid failure types: `implementation_error`, `spec_mismatch`, `infra_error`, `null`

---

## Quick Reference

### State Machine

```
ready → dispatched → in_review → done
                         │
                    [Blocking?]
                         │
                  ┌──────┴──────┐
            impl_error      spec_mismatch
            & retry < 3    or retry >= 3
                  │              │
            retry++          ESCALATED
            re-dispatch          │
                  │         [human decides]
                  ↓         reset/switch/split/skip
             dispatched

any state → skipped (human only)
```

### Review Level Decision

```
interface contracts touched?  → Full
new API/component?            → Full
>2 files expected?            → Full
1-2 files, known pattern?     → Spot Check
rename/format/text only?      → Auto-Pass
```

### Circuit Breaker

```
implementation_error + retry < 3   → Recycle (retry++)
implementation_error + retry >= 3  → Escalate (M11 hard cap)
spec_mismatch                      → Escalate immediately
infra_error                        → Fix infra, no retry count
```

Persistent counter: `.ccb/counters/task-retries-${task_uuid}.count` mirrors ledger retry_count, survives session crash/compact.

### Quality Gate

```
Blocking    = violates spec / breaks function / breaks invariant → Recycle
Advisory    = quality issue, correct but improvable              → Record, don't block
Informational = observation, suggestion                          → Note only
```

### Transition Checklist

```
→ dispatched:  dispatch file written + ledger updated
→ in_review:   report received or user confirmed + commits recorded
→ done:        review passed + Step 3.4 output done + ledger review_summary written + changelog updated
→ done (last): above + project_status updated + architecture.md checked
```

### Execution Mode

```
Interactive (default):  每个 dispatch 等批准 + 每个 review 输出汇报
Autonomous (用户说全自动): 跳过 dispatch 批准 + 依然输出 review 汇报

Autonomous 不能松的:
  Full Review 必须跑 subagent
  Review summary 必须输出 (Step 3.4)
  Blocking 依然 recycle,不能私自 downgrade
  Spec mismatch / retry >= 3 依然 escalate 找用户（M11）
```

---

## Chain Position

This skill is the **core** of the **Execution Chain**:
1. **task-execution** <-- you are here
2. verification-before-completion
3. claudemd-check

It subsumes the old Dispatch Chain (structured-dispatch -> wait -> requesting-code-review -> claudemd-check) into a single automated flow.

**Internally calls:**
- structured-dispatch flow (Phase 1, as inlined sub-procedure)
- requesting-code-review flow (Phase 3, as inlined sub-procedure)

**Next step:** After all tasks complete, invoke `verification-before-completion`.

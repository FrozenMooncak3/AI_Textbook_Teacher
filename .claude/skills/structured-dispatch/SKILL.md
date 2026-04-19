---
name: structured-dispatch
description: Use when preparing to dispatch a task to Codex or Gemini via CCB protocol. Provides a standard template for consistent context quality.
---

# Structured Dispatch

When dispatching tasks to Codex or Gemini, use this template to ensure the receiving agent has complete context.

## Workflow

1. Discuss requirements with user in Chinese
2. Fill in the template below in English
3. Show Chinese translation to user for approval (per CCB protocol Section 2)
4. User approves -> write English dispatch to `.ccb/inbox/<target>/<NNN>-dispatch.md`, then send short wezterm notification

## Pre-Dispatch: Check Interface Contracts

Before filling the template, read `docs/architecture.md` Section "接口契约" and identify:
1. Any cross-module dependencies relevant to this task (e.g. "提取→学习" if the task touches KP data)
2. Any `⚠️` markers that this task might encounter or need to work around
3. Include these dependencies in the **Context** section of the dispatch so the agent knows the interface assumptions

This is critical — milestone interface breakage is our #1 source of bugs.

## Dispatch Template

Fill in all sections. If a section is not applicable, write "N/A" with a reason.

---

**[DISPATCH TO: Codex / Gemini]**

## Context
Why this task exists. Link to relevant spec, plan, or issue.
What happened before this task (prior completed tasks, if any).

## Task
What to do. Clear, imperative instructions. One task per dispatch.

## Files
- **Create**: files to create (with exact paths)
- **Modify**: files to change (with exact paths and line ranges if relevant)
- **Reference**: files to read for context (do NOT modify these)

## Acceptance Criteria
Checklist of what "done" looks like. Each item must be testable.
- [ ] Criterion 1
- [ ] Criterion 2

## Tier
Recommended model tier: **Light** / **Standard** / **Heavy**

(Per CCB protocol Section 3:
- Light: code is pre-written in plan, just transcribe
- Standard: clear requirements, routine implementation
- Heavy: bug diagnosis, new API design, cross-module refactor)

## Suggested Skills
Which installed skills the agent should use.
Example: `coding-standards`, `test-driven-development`, `systematic-debugging`

## Post-Completion
What Claude will do after this task is done (review, next task, etc.).

---

## Reminders

- One task per dispatch. If the work has multiple independent parts, send separate dispatches.
- Include enough context that the agent can work without asking questions.
- Reference the plan file if one exists — the agent can read it.
- Do NOT dispatch while the agent is actively working on another task.
- If the task involves modifying docs/ files (changelog.md, project_status.md, etc.), include explicit instruction: **"Edit only the relevant section. Do NOT rewrite the entire file."** Gemini has a pattern of overwriting entire files when it struggles with partial edits.

## ⚠️ Fresh Session per Task（2026-04-19 起，M14）

**每次新任务派发必须使用 fresh session（新开 Codex/Gemini 实例，不续接旧 context）**。

派发前先在对应 pane 发送 `/new` 或 `/clear` 命令清空 context，然后发送 "Read .ccb/inbox/..." 指令。若当前实例尚有未结任务（retry / review），不算新任务，可续接。

**理由**：
- obra "fresh subagent per task" 范式（survey §D Finding 1.4）—— context 污染是多步任务失败的根源
- Cognition "context 污染影响 review 判断"（survey §D Finding 3.3）
- Anthropic Skills 2.0 evals 显示 5/6 模型在长 session 里 skill 漂移（survey §D Finding 2.2）

**例外**：
- 同一任务的 retry（非新任务）允许续接同 session，保留上下文让 agent 更快定位问题
- 但 M11 3 次 retry cap 触发后必须换 fresh session 并走 systematic-debugging

**操作**（Send Procedure 之前）：
```bash
# 派新任务前先清 pane（二选一）
echo "/new" | wezterm cli send-text --pane-id <target_pane> --no-paste
# 或
echo "/clear" | wezterm cli send-text --pane-id <target_pane> --no-paste
printf '\r' | wezterm cli send-text --pane-id <target_pane> --no-paste
# 等 2 秒让 session 重置，再发 dispatch 通知
```

---

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

---

## Chain Position

This skill is now inlined as a sub-procedure by **task-execution**. When task-execution is active, this skill's dispatch flow is followed as Phase 1 of the task loop.

When used standalone (outside task-execution), wait for the agent to complete, then invoke `requesting-code-review`.

## Model Tier

Always use highest tier (Codex: gpt-5.4 high / Gemini: gemini-2.5-pro). The Tier field in the dispatch template is no longer needed. See CCB protocol Section 3 for reference only.

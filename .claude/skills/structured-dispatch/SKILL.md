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
4. User approves -> send English dispatch via CCB `ask codex/gemini "..."` command

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

---

## Chain Position

This skill is **step 1** of the **Dispatch Chain**:
1. **structured-dispatch** ← you are here
2. _(wait for Codex/Gemini to complete)_
3. requesting-code-review
4. claudemd-check

**Next step:** After dispatching, wait for the agent to complete. Once done, invoke `requesting-code-review` to review their work.

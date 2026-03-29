---
name: executing-plans
description: Execute implementation plans task-by-task with two-stage review (spec compliance + code quality) after each task.
---

# Executing Plans

Load plan, review critically, execute tasks with fresh subagents, two-stage review after each task.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

## The Process

### Step 1: Load and Review Plan

1. Read plan file
2. Extract all tasks with full text and context
3. Review critically - identify any questions or concerns
4. If concerns: Raise them with your human partner before starting
5. If no concerns: Create task list and proceed

### Step 2: Execute Tasks

For each task:

1. Mark as in_progress
2. Dispatch fresh implementer subagent with full task text + context (see `./implementer-prompt.md`)
3. Handle implementer status (see below)
4. If DONE: proceed to two-stage review
5. Run spec compliance review (see `./spec-reviewer-prompt.md`)
6. If spec issues: implementer fixes, re-review until approved
7. Run code quality review (see `./code-quality-reviewer-prompt.md`)
8. If quality issues: implementer fixes, re-review until approved
9. Mark as completed

### Step 3: Complete Development

After all tasks complete:
- Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- **REQUIRED SUB-SKILL:** Use finishing-a-development-branch
- Follow that skill to verify tests, present options, execute choice

## Handling Implementer Status

Implementer subagents report one of four statuses:

**DONE:** Proceed to spec compliance review.

**DONE_WITH_CONCERNS:** The implementer completed the work but flagged doubts. Read the concerns before proceeding. If the concerns are about correctness or scope, address them before review. If they're observations (e.g., "this file is getting large"), note them and proceed to review.

**NEEDS_CONTEXT:** The implementer needs information that wasn't provided. Provide the missing context and re-dispatch.

**BLOCKED:** The implementer cannot complete the task. Assess the blocker:
1. If it's a context problem, provide more context and re-dispatch with the same model
2. If the task requires more reasoning, re-dispatch with a more capable model
3. If the task is too large, break it into smaller pieces
4. If the plan itself is wrong, escalate to the human

**Never** ignore an escalation or force the same model to retry without changes.

## Model Selection

Use the least powerful model that can handle each role:

- **Mechanical tasks** (isolated functions, clear specs, 1-2 files): fast, cheap model
- **Integration tasks** (multi-file coordination, pattern matching): standard model
- **Architecture/design/review tasks**: most capable model

**Signals:**
- Touches 1-2 files with a complete spec -> cheap model
- Touches multiple files with integration concerns -> standard model
- Requires design judgment or broad codebase understanding -> most capable model

## Two-Stage Review

**Stage 1: Spec Compliance** (see `./spec-reviewer-prompt.md`)
- Does the code match the spec/plan requirements?
- Nothing missing, nothing extra?
- If issues found: implementer fixes, re-review

**Stage 2: Code Quality** (see `./code-quality-reviewer-prompt.md`)
- Is the implementation well-built?
- Clean code, good tests, no issues?
- If issues found: implementer fixes, re-review

**Order matters:** Always spec compliance FIRST, then code quality. Don't start quality review before spec is approved.

## Prompt Templates

- `./implementer-prompt.md` - Dispatch implementer subagent
- `./spec-reviewer-prompt.md` - Dispatch spec compliance reviewer
- `./code-quality-reviewer-prompt.md` - Dispatch code quality reviewer

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## Red Flags

**Never:**
- Start implementation on main/master branch without explicit user consent
- Skip reviews (spec compliance OR code quality)
- Proceed with unfixed issues
- Start code quality review before spec compliance is approved
- Make subagent read plan file (provide full text instead)
- Ignore subagent questions
- Let implementer self-review replace actual review (both are needed)

## Integration

**Required workflow skills:**
- **writing-plans** - Creates the plan this skill executes
- **using-git-worktrees** - Set up isolated workspace before starting
- **finishing-a-development-branch** - Complete development after all tasks

## Chain Position

This skill is **step 1** of the **Execution Chain**:
1. **executing-plans** <- you are here
2. verification-before-completion
3. claudemd-check

**Next step:** After all tasks complete, invoke `verification-before-completion` automatically.

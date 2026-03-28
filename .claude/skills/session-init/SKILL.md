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
2. _(wait for Codex/Gemini to complete)_
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

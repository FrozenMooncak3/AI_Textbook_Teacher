# Session Init + Skill Chaining + Retrospective Design

> Third brainstorming output (2026-03-28).
> Prerequisites: First brainstorming (Codex/Gemini skills) + Second brainstorming (hooks + structured-dispatch) completed.
> Research base: `docs/superpowers/specs/2026-03-28-repo-research-findings.md` (H7, H9, H10)

---

## 1. Problem Statement

Current state:
- **~25 skills** exist but the user cannot remember them — most rely on AI self-discipline or manual invocation
- **Context loading is scattered** — CLAUDE.md lists 4 files to read at session start, but MEMORY.md, journal entries, and git history are separate; no single mechanism assembles the full picture
- **Skill chaining is informal** — brainstorming says "invoke writing-plans next" in prose, but nothing prevents skipping steps or losing the thread after compact
- **No retrospective mechanism** — patterns in AI collaboration are never extracted; the same friction repeats across sessions

Goal: Reduce the number of skills the user must remember to **3**, automate context restoration, enforce skill execution order, and provide a periodic review mechanism.

---

## 2. Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| H9 + H7 combined | session-init skill handles both context loading and chain routing | They solve the same problem: "AI should know where it is and what comes next" |
| H10 scope | Manual skill, not automated | User decided: running reflection every session wastes tokens; weekly/milestone cadence is better |
| Enforcement level | Prompt-level with product checks, not system-level | Claude Code has no native skill dependency system; checking for artifacts (spec file exists?) is the most reliable proxy |
| Skill visibility | Split into "user-facing" (3) vs "internal" (rest) | User can't remember ~25 skills; only entry points need to be memorable |
| Retrospective output | Suggestions only, no auto-modification | Too risky to let AI auto-edit skills or memory without user approval |

---

## 3. User-Facing vs Internal Skills

After this change, skills are categorized:

**User-facing (user needs to know these):**

| Skill | When to use | Command |
|-------|------------|---------|
| brainstorming | "I have an idea / I want to build X" | `/brainstorming` |
| retrospective | "Let's review how things are going" | `/retrospective` |
| claudemd-check | "Check compliance" (also auto-triggered) | `/claudemd-check` |

**Internal (auto-triggered by skill chains, user never invokes directly):**

Everything else — writing-plans, executing-plans, verification-before-completion, structured-dispatch, requesting-code-review, journal, session-init, using-superpowers, coding-standards, api-design, etc.

**Change required:** Update `using-superpowers` trigger table to only list the 3 user-facing skills. Internal skills are referenced by the chain system, not by the user.

**Note on system-reminder visibility:** Claude Code's system-reminder messages will continue to list all installed skills regardless of this change. The user-facing/internal split is about the *recommended workflow* — the trigger table in using-superpowers guides AI behavior, but does not hide skills from the system. Users can still manually invoke internal skills if needed.

---

## 4. Architecture

```
Session start / Post-compact
        │
        ▼
  session-init skill
  ┌─────────────────────────────┐
  │ 1. Load all context sources │
  │ 2. Assess current position  │
  │ 3. Inject chain routing     │
  └─────────────────────────────┘
        │
        ▼
  AI briefs user: "Here's where we are. What do you want to do?"
        │
        ▼
  User gives instruction
        │
        ├─ "I have an idea" ──→ Design Chain
        ├─ "Start building"  ──→ Execution Chain
        ├─ "Send to Codex"   ──→ Dispatch Chain
        ├─ "Let's review"    ──→ Retrospective (standalone)
        └─ Other             ──→ AI handles normally

Chain definitions:
  Design:    brainstorming → writing-plans → [user decides: dispatch or execute]
  Execution: executing-plans → verification-before-completion → claudemd-check
             (for Claude's own tasks: docs, skills, config — NOT code)
  Dispatch:  structured-dispatch → [wait for Codex/Gemini] → requesting-code-review → claudemd-check
             (for code tasks: Claude dispatches, agents execute)
  Closeout:  requesting-code-review → claudemd-check
```

---

## 5. Component Details

### 5.1 session-init Skill

**Location:** `.claude/skills/session-init/SKILL.md`

**Trigger:** Invoked via two mechanisms:

1. **Session start:** `using-superpowers` SKILL.md contains the directive: "Before responding to the user's first message, you MUST invoke the session-init skill via the Skill tool." This is a behavioral instruction, not a system-level hook — it relies on using-superpowers being loaded at session start (which CLAUDE.md already enforces).

2. **Post-compact:** The `pre-compact-check.sh` hook (already deployed) injects its output into the compressed context. Add one line to its output: "After compact, re-run session-init to restore context." This serves as a reminder in the post-compact context window. Additionally, CLAUDE.md's "每次会话开始时" section will be updated to say "invoke session-init" instead of listing 4 individual files, so even if the hook reminder is lost, CLAUDE.md itself triggers the behavior.

In both cases, the mechanism is prompt-level. There is no PostCompact hook event in Claude Code.

**Step 1 — Load context (parallel reads):**

| Source | What to extract |
|--------|----------------|
| `docs/project_status.md` | Current milestone, next step, blockers |
| `docs/decisions.md` | Closed decisions (don't re-discuss) |
| `docs/journal/INDEX.md` | Open/in-progress items, parked ideas |
| `docs/ccb-protocol.md` | Collaboration rules |
| MEMORY.md (auto-loaded) | User preferences, feedback, references |
| `git log -10 --oneline` | Recent work |
| `git status` | Uncommitted changes, unpushed commits |

**Step 2 — Assess position:**

Check for signals that indicate where the user left off:

| Signal | Meaning |
|--------|---------|
| Uncommitted changes exist | Work in progress, may need to commit |
| Unpushed commits exist | Completed work not yet pushed |
| Spec file exists without matching plan | Design done, needs implementation plan |
| Plan file exists with unchecked items | Execution in progress |
| journal has `open` items | Unresolved issues need attention |
| project_status mentions "准备进入 MX" | Ready to start next milestone |

**Step 3 — Output brief to user:**

Format (Chinese, concise):

```
当前状态：[milestone] — [one-line summary]
上次做到：[what was last completed]
未完成：[open items, if any]
建议下一步：[recommendation]
```

**Step 4 — Inject chain routing (internal, not shown to user):**

Load the skill chain definitions into AI context so that when the user gives an instruction, the AI knows which chain to enter.

**Does NOT:**
- Auto-execute any skill
- Make decisions for the user
- Read files outside the defined source list

### 5.2 Skill Chain Declarations

**Chain definitions are hardcoded in session-init** for reliability. No comment convention or dynamic parsing — chains should be stable and deliberate. If a new chain is needed, update session-init directly.

```
CHAINS:
  design:
    - brainstorming
    - writing-plans
    # ends here — user decides when to dispatch

  execution:
    - executing-plans
    - verification-before-completion
    - claudemd-check

  dispatch:
    - structured-dispatch
    # wait for Codex/Gemini completion
    - requesting-code-review
    - claudemd-check

  closeout:
    - requesting-code-review
    - claudemd-check
```

**Enforcement mechanism per skill:**

Each chain-member skill adds a guard at the top of its instructions:

```markdown
## Prerequisites Check
Before executing this skill, verify:
- [ ] [artifact] exists (e.g., spec file in docs/superpowers/specs/)
If prerequisites are not met, STOP and tell the user:
"This step requires [X] first. Run /brainstorming to start the design process."
```

**Auto-continuation:**

Each chain-member skill adds at the end:

```markdown
## Next Step
This skill is part of the [chain name] chain.
Next: invoke [next-skill] automatically.
If the chain should stop here (user decision point), ask the user before continuing.
```

### 5.2.1 Chain Failure Handling

When a mid-chain step fails or its output does not satisfy the next step's prerequisites:

1. **Chain pauses** — do not silently skip to the next step or loop indefinitely
2. **Report to user** — tell the user what failed and why (e.g., "verification found issues: [list]. Fix these before proceeding to claudemd-check.")
3. **User decides** — user can fix and retry the current step, skip ahead (explicit override), or abandon the chain
4. **No auto-retry** — chains never loop back automatically; the user is always in control of retry decisions

### 5.3 Retrospective Skill

**Location:** `.claude/skills/retrospective/SKILL.md`

**Trigger:** User runs `/retrospective`. Manual only.

**Suggested cadence:** After each milestone completion, or weekly, or when collaboration feels off.

**Process:**

1. **Gather data** — Read all sources in parallel:
   - MEMORY.md (auto-loaded into context; no explicit read needed) + follow index entries in MEMORY.md to read individual memory files by their linked paths
   - docs/journal/ (all entries, not just INDEX)
   - git log (last 50 commits or since last retrospective, whichever is less)
   - docs/project_status.md
   - docs/decisions.md

2. **Analyze for patterns** — Look for:
   - **Repeated friction:** Same type of issue appearing in multiple journal entries
   - **Stale memories:** Memory records that contradict current project state
   - **Missing memories:** Important decisions or preferences observed in journals but not captured in memory
   - **Parked items:** Journal entries parked too long (>2 weeks), may need re-evaluation
   - **Workflow gaps:** Steps that consistently get skipped or cause confusion

3. **Produce report** — Three sections:

   **a) New feedback memories (draft)**
   For each discovered pattern, draft a memory entry. Show to user for approval before saving.

   **b) Skill improvement suggestions**
   Concrete changes to specific skill prompts. Format:
   ```
   Skill: [name]
   Issue: [what's wrong]
   Suggested change: [specific edit]
   ```

   **c) Journal housekeeping**
   - Parked items to re-evaluate or archive
   - Resolved items that can be cleaned up
   - Open items that need attention

4. **Execute approved changes** — User reviews report, says what to do. AI executes only what's approved.

**Does NOT:**
- Auto-generate new skills
- Auto-modify existing skills or memory
- Evaluate the user's behavior or decisions
- Run automatically (manual trigger only)

---

## 6. Changes to Existing Files

| File | Change |
|------|--------|
| `CLAUDE.md` | Replace "每次会话开始时" 4-file list with "invoke session-init skill" directive |
| `.claude/skills/using-superpowers/SKILL.md` | Simplify trigger table to 3 user-facing skills; add "on session start, invoke session-init" instruction |
| `.claude/skills/brainstorming/SKILL.md` | Add chain declaration comment + auto-continuation to writing-plans |
| `.claude/skills/writing-plans/SKILL.md` | Add prerequisite check (spec exists?) + chain end note (user decides dispatch) |
| `.claude/skills/executing-plans/SKILL.md` | Add prerequisite check (plan exists?) + auto-continuation to verification |
| `.claude/skills/verification-before-completion/SKILL.md` | Add auto-continuation to claudemd-check |
| `.claude/skills/structured-dispatch/SKILL.md` | Add chain declaration for dispatch chain |
| `.claude/skills/requesting-code-review/SKILL.md` | Add auto-continuation to claudemd-check |
| `.claude/skills/claudemd-check/SKILL.md` | Chain terminal — no changes needed |
| `scripts/hooks/pre-compact-check.sh` | Add "re-run session-init after compact" reminder to output (dispatch to Codex — outside Claude's file boundary) |

---

## 7. File Inventory

| Action | File | Description |
|--------|------|-------------|
| Create | `.claude/skills/session-init/SKILL.md` | H9+H7: context loader + chain router |
| Create | `.claude/skills/retrospective/SKILL.md` | H10: periodic review skill |
| Update | `CLAUDE.md` | Replace 4-file read list with session-init directive |
| Update | `.claude/skills/using-superpowers/SKILL.md` | Simplify to 3 user-facing skills + session-init trigger |
| Update | `.claude/skills/brainstorming/SKILL.md` | Add chain continuation |
| Update | `.claude/skills/writing-plans/SKILL.md` | Add prerequisite + chain note |
| Update | `.claude/skills/executing-plans/SKILL.md` | Add prerequisite + chain continuation |
| Update | `.claude/skills/verification-before-completion/SKILL.md` | Add chain continuation |
| Update | `.claude/skills/structured-dispatch/SKILL.md` | Add chain declaration |
| Update | `.claude/skills/requesting-code-review/SKILL.md` | Add chain continuation |
| Update | `scripts/hooks/pre-compact-check.sh` | Add session-init reminder line (dispatch to Codex) |

---

## 8. Constraints and Limitations

1. **Skill chaining is prompt-level, not system-level** — Claude Code has no native dependency enforcement; a sufficiently confused AI can still skip steps. The prerequisite checks (artifact existence) are the best available proxy.
2. **session-init adds ~1000 tokens to every session start** — Acceptable trade-off for reliable context restoration.
3. **Retrospective quality depends on data richness** — If journal and memory are sparse, retrospective output will be thin. This improves over time.
4. **Chain definitions are hardcoded in session-init** — If a new chain is needed, session-init must be updated. This is intentional: chains should be stable and deliberate, not dynamically generated.
5. **using-superpowers simplification is a one-way change** — Internal skills become invisible to the user. If a user needs to manually invoke an internal skill, they still can (Claude Code doesn't hide them), but the trigger table won't list them.
6. **CLAUDE.md's "每次会话开始时" becomes a pointer** — After this change, CLAUDE.md no longer lists 4 individual files; it says "invoke session-init." The 4 files are still read, but session-init handles it. This avoids double-reading.
7. **Post-compact trigger is best-effort** — Pre-compact hook injects a reminder, but if the compressed context drops it, CLAUDE.md's directive serves as fallback. There is no guaranteed post-compact hook in Claude Code.
8. **System-reminder lists all skills regardless** — Claude Code's system-reminder cannot be filtered. The 3-skill simplification is a workflow guide, not a visibility control.

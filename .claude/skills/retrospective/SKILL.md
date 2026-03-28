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

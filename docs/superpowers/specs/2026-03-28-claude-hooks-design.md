---
date: 2026-03-28
topic: Claude Hooks自动化设计
type: spec
status: resolved
keywords: [hooks, automation, quality-check, structured-dispatch]
---

# Claude Skill Automation + Hook System Design

> Second brainstorming output (2026-03-28).
> Prerequisite: First brainstorming (Codex/Gemini skill installation) completed — commit `fafede3`.
> Research base: `docs/superpowers/specs/2026-03-28-repo-research-findings.md`

---

## 1. Problem Statement

Current state:
- **23 Claude skills** exist but rely on AI "self-discipline" to trigger — no enforcement mechanism
- **claudemd-check** is manually invoked by the user between task cycles; easy to forget
- **No hooks** configured — `.claude/settings.json` does not exist
- **Task dispatch** to Codex/Gemini has no standard format — context quality varies
- **No guardrails** against file boundary violations, leftover console.log, or type errors

Goal: Add a hook + skill system that **automates mechanical checks** and **enforces project rules** without requiring user intervention.

---

## 2. Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Hook approach | Hybrid (inline + scripts) | Simple hooks inline, complex ones in scripts — revised to scripts for all since stdin JSON parsing is needed |
| H1 + H2 | Combined into one PostToolUse script | Both parse the same stdin (edited file path), no need for two hooks |
| H5 + H6 | Combined into one Stop script | Both are counter-based ("count → threshold → act") |
| H4 (dispatch) | Skill, not hook | Dispatch is a communication template, not an interception point |
| claudemd-check | Keep as manual skill + add lightweight auto-check via Stop hook | Full check needs AI reasoning (can't be a pure shell script); mechanical parts can be automated |
| Compact handling | PreCompact hook runs mechanical checks | Ensures state is clean before context compression |
| H3 scope change | File boundary guard (broader than original "config protection") | Original research proposed H3 as "config-protection" (block invariant edits). Redesigned as general file-boundary enforcement because: (a) invariant content lives in CLAUDE.md which Claude CAN edit per file boundary rules, so content-level blocking is wrong; (b) file-boundary violations are more common and dangerous; (c) product invariants are already checked by claudemd-check skill at the AI reasoning level |
| Hook scope | Claude Code only | Codex CLI and Gemini CLI have no hook system; their behavior is guided by installed skills |

---

## 3. Architecture

```
.claude/settings.json (hooks configuration)
├── PreToolUse
│   └── H3: file-boundary-guard.sh → blocks out-of-boundary edits
├── PostToolUse
│   └── H1+H2: post-edit-check.sh → typecheck + console.log detection
├── Stop
│   └── H5+H6: stop-counter.sh → periodic lite-check + compact reminder
└── PreCompact
    └── H7: pre-compact-check.sh → mechanical compliance check

.claude/skills/
├── claudemd-check/SKILL.md (updated: add full 禁止事项 check)
└── structured-dispatch/SKILL.md (new: H4 dispatch template)

scripts/hooks/
├── post-edit-check.sh      (H1+H2)
├── file-boundary-guard.sh  (H3)
├── stop-counter.sh         (H5+H6)
└── pre-compact-check.sh    (H7)
```

### 3.1 settings.json Full Schema

> Note: `.claude/settings.json` is the project-level config (committed to git). `.claude/settings.local.json` is the user-level override (not committed, manages permissions). Claude Code merges both at runtime. Hooks go in `settings.json`; permissions stay in `settings.local.json`.

> Note: `.claude/settings.json` is outside Claude's file boundary (`.claude/skills/**` is allowed, but `.claude/settings.json` is not). Creation requires explicit user authorization.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "command": "bash scripts/hooks/file-boundary-guard.sh"
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "command": "bash scripts/hooks/post-edit-check.sh"
      }
    ],
    "Stop": [
      {
        "command": "bash scripts/hooks/stop-counter.sh"
      }
    ],
    "PreCompact": [
      {
        "command": "bash scripts/hooks/pre-compact-check.sh"
      }
    ]
  }
}
```

### 3.2 Hook stdin JSON Schema

All hooks receive a JSON object on stdin. The relevant fields per tool:

```json
// Edit tool
{"tool_name": "Edit", "tool_input": {"file_path": "/absolute/path/to/file", "old_string": "...", "new_string": "..."}}

// Write tool
{"tool_name": "Write", "tool_input": {"file_path": "/absolute/path/to/file", "content": "..."}}

// Bash tool
{"tool_name": "Bash", "tool_input": {"command": "..."}}

// Stop event
{"stop_reason": "end_turn"}
```

Scripts extract `file_path` via: `echo "$INPUT" | node -e "process.stdin.resume(); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(JSON.parse(d).tool_input.file_path))"`

(Using `node` instead of `jq` since Node.js is guaranteed to be available in this project.)

---

## 4. Component Details

### 4.1 H1+H2: Post-Edit Quality Check

- **Event**: PostToolUse
- **Matcher**: Edit, Write
- **Script**: `scripts/hooks/post-edit-check.sh`
- **Behavior**:
  1. Read stdin JSON, extract `file_path`
  2. If file is `.ts` / `.tsx`: run `npx tsc --noEmit`, output first 20 lines of errors (if any)
  3. If file is under `src/`: grep for `console.log`, `console.warn`, `console.error` — output warning with line numbers (if any)
  4. Both pass → silent (no output)
- **Exit code**: Always 0 (PostToolUse hooks are informational, not blocking)

### 4.2 H3: File Boundary Guard

- **Event**: PreToolUse
- **Matcher**: Edit, Write
- **Script**: `scripts/hooks/file-boundary-guard.sh`
- **Whitelist** (from CLAUDE.md "Claude 的文件边界"):
  - `docs/**`
  - `.claude/skills/**`
  - `CLAUDE.md`
  - `AGENTS.md`
  - `GEMINI.md`
- **Behavior**:
  1. Read stdin JSON, extract `file_path`
  2. Check if path matches whitelist
  3. Match → exit 0 (allow)
  4. No match → exit 1 + output "File boundary violation: {path} is outside Claude's writable scope"
- **Edge case**: When the user explicitly authorizes out-of-boundary writes in conversation, the hook will still block. User must approve the blocked tool call at the permission prompt. This is acceptable — it's a double-confirmation rather than a silent bypass.

### 4.3 H5+H6: Stop Counter

- **Event**: Stop
- **Script**: `scripts/hooks/stop-counter.sh`
- **State file**: `.claude/.stop-count`
- **Behavior**:
  1. Read counter from state file (default 0), increment, write back
  2. Every 10 stops: run lightweight compliance check
     - `git status`: any uncommitted changes? any unpushed commits?
     - Output findings (if any)
  3. Every 50 stops: output compact suggestion
     - "Context may be getting large. Consider running /compact to preserve performance."
  4. Below thresholds → silent
- **Lightweight check scope**: Only mechanical checks (git status, file list). No AI reasoning, no content analysis.

### 4.4 H7: Pre-Compact Check

- **Event**: PreCompact
- **Script**: `scripts/hooks/pre-compact-check.sh`
- **Behavior**:
  1. Check `git status`: uncommitted files? unpushed commits?
  2. Check recent modified files (from `git diff --name-only`): any outside Claude's file boundary?
  3. Check `docs/project_status.md` and `docs/changelog.md`: modified in this session? (compare against last commit timestamp)
  4. Output summary of findings
  5. Reset stop counter (`.claude/.stop-count` → 0)
- **Does NOT block compact** — output is informational. It gets injected into the compressed context so post-compact Claude can see the state.

### 4.5 H4: Structured Dispatch Skill

- **Location**: `.claude/skills/structured-dispatch/SKILL.md`
- **Trigger**: Claude invokes manually when preparing to dispatch to Codex/Gemini
- **Template**:

```markdown
## Context
Why this task exists. Link to relevant spec/plan/issue.

## Task
What to do. Clear, imperative instructions.

## Files
- **Modify**: files to change
- **Reference**: files to read for context (do not modify)

## Acceptance Criteria
Checklist of what "done" looks like. Testable conditions.

## Tier
Recommended model tier: Light / Standard / Heavy (per CCB protocol Section 3)

## Suggested Skills
Which installed skills the agent should use (e.g., coding-standards, test-driven-development)
```

- **Workflow**:
  1. Claude discusses requirements with user in Chinese
  2. Claude generates dispatch using template in English
  3. Claude shows Chinese translation to user for approval
  4. User approves → dispatch sent
  5. This workflow aligns with CCB protocol Section 2 ("派发前必须给用户看中文翻译")

### 4.6 claudemd-check Skill Update

- **Location**: `.claude/skills/claudemd-check/SKILL.md` (existing, update in place)
- **Change**: Add Step 8 — full 禁止事项 check

**New step inserted before the output section:**

> **8. 检查：禁止事项**
> 找到「禁止事项」部分，逐条回顾本次改动是否违反：
> 1. 禁止引入多用户 / 登录 / 注册系统
> 2. 禁止添加 MVP 范围外的功能
> 3. 禁止未经确认就修改产品不变量
> 4. 禁止在未更新 project_status.md 和 changelog.md 的情况下声称任务完成
>
> （第 4 条原本在步骤 3 中，现在移到此处统一管理）

**Updated output format:**

```
CLAUDE.md 自检完成
✓/✗ 会话初始化：N/N 文件已读
✓/✗ 禁止事项：未违反 / 违反第 X 条
✓/✗ 状态文件：已更新 / 需更新
✓/✗ Git：已 commit + 已 push / 有遗漏
✓/✗ 文件边界：未越界 / 已授权越界 / 违规
✓/✗ 产品不变量：未违反 / 违反第 X 条
✓/✗ 技术红线：未违反 / 违反 X
⚠/✓ 沟通协议：本次无技术汇报，跳过 / 已遵守

结果：全部通过 / N 项需修复
```

---

## 5. File Inventory

| Action | File | Description |
|--------|------|-------------|
| Create | `.claude/settings.json` | Hook configuration (PreToolUse, PostToolUse, Stop, PreCompact) |
| Create | `scripts/hooks/post-edit-check.sh` | H1+H2: typecheck + console.log detection |
| Create | `scripts/hooks/file-boundary-guard.sh` | H3: file boundary enforcement |
| Create | `scripts/hooks/stop-counter.sh` | H5+H6: periodic lite-check + compact reminder |
| Create | `scripts/hooks/pre-compact-check.sh` | H7: pre-compact compliance check |
| Create | `.claude/skills/structured-dispatch/SKILL.md` | H4: dispatch template skill |
| Update | `.claude/skills/claudemd-check/SKILL.md` | Add 禁止事项 full check |
| Runtime | `.claude/.stop-count` | Stop counter state (gitignored) |

---

## 6. Constraints and Limitations

1. **Hooks are Claude Code only** — Codex/Gemini behavior relies on their installed skills, not hooks
2. **H3 is stateless** — cannot detect in-conversation authorization for boundary exceptions; user approves at the permission prompt
3. **Stop counter resets on session restart** — counter is per-session, not persistent across sessions
4. **PreCompact cannot block** — output is advisory; compact proceeds regardless
5. **H1 typecheck runs project-wide** — `tsc --noEmit` checks the whole project, not just the edited file. This is by design (a change in one file can break another), but may be slow on large codebases
6. **scripts/hooks/ is a new directory under scripts/** — per CLAUDE.md file boundaries, Claude should not write to `scripts/**`. Implementation must be dispatched to Codex or done with user authorization.

# Claude Hooks + Skill Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Claude Code hook system that automates mechanical quality checks (typecheck, console.log, file boundary, compliance) and a structured dispatch skill for CCB coordination.

**Architecture:** 4 bash hook scripts + `.claude/settings.json` wiring + 1 new skill + 1 skill update. Hooks parse stdin JSON via Node.js. All scripts are Windows/Git Bash compatible.

**Tech Stack:** Bash (Git Bash on Windows), Node.js, TypeScript compiler (`tsc`), Git CLI

**Spec:** `docs/superpowers/specs/2026-03-28-claude-hooks-design.md`

**File boundary note:** `scripts/hooks/` and `.claude/settings.json` are outside Claude's writable boundary. Either dispatch Tasks 1-6 to Codex, or execute with explicit user authorization. Tasks 7-8 are within Claude's boundary.

---

## File Structure

| Action | File | Purpose |
|--------|------|---------|
| Create | `scripts/hooks/file-boundary-guard.sh` | H3: Block out-of-boundary edits (PreToolUse) |
| Create | `scripts/hooks/post-edit-check.sh` | H1+H2: Typecheck + console.log detection (PostToolUse) |
| Create | `scripts/hooks/stop-counter.sh` | H5+H6: Periodic compliance + compact reminder (Stop) |
| Create | `scripts/hooks/pre-compact-check.sh` | H7: Pre-compact compliance check (PreCompact) |
| Create | `.claude/settings.json` | Hook event-to-script wiring |
| Create | `.claude/skills/structured-dispatch/SKILL.md` | H4: Dispatch template for CCB |
| Modify | `.claude/skills/claudemd-check/SKILL.md` | Add full 禁止事项 check |
| Modify | `.gitignore` | Exclude `.claude/.stop-count` |

---

### Task 1: Foundation

**Files:**
- Create: `scripts/hooks/` (directory)
- Modify: `.gitignore`

- [ ] **Step 1: Create hooks directory**

```bash
mkdir -p scripts/hooks
```

- [ ] **Step 2: Add .gitignore entry for stop-counter state file**

Append to `.gitignore`:

```
# Claude Code hook runtime state
.claude/.stop-count
```

- [ ] **Step 3: Verify**

```bash
ls scripts/hooks/ && grep "stop-count" .gitignore
```

Expected: directory exists, grep shows the entry.

---

### Task 2: H3 — File Boundary Guard (PreToolUse)

The most critical hook. Blocks Claude from editing files outside the allowed boundary defined in CLAUDE.md.

**Files:**
- Create: `scripts/hooks/file-boundary-guard.sh`

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
# H3: File Boundary Guard
# Event: PreToolUse | Matcher: Edit|Write
# Blocks edits to files outside Claude's writable boundary.
# Exit 0 = allow, exit 1 = block (with message on stdout).

# Read full JSON from stdin
INPUT=$(cat)

# Extract file_path via Node.js (guaranteed available in this project)
FILE_PATH=$(echo "$INPUT" | node -e "
  let d='';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try { console.log(JSON.parse(d).tool_input.file_path || ''); }
    catch { console.log(''); }
  });
")

# If path is empty or unreadable, allow (don't break on unexpected input)
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Normalize backslashes to forward slashes (Windows compatibility)
FILE_PATH=$(echo "$FILE_PATH" | tr '\\' '/')

# --- Compute relative path (3-layer approach for Windows/MSYS compat) ---
PROJECT_ROOT=$(pwd | tr '\\' '/')
REL_PATH="${FILE_PATH#$PROJECT_ROOT/}"

# Layer 2: MSYS path format conversion (/d/... -> d:/...)
if [ "$REL_PATH" = "$FILE_PATH" ]; then
  ALT_ROOT=$(echo "$PROJECT_ROOT" | sed 's|^/\([a-zA-Z]\)/|\1:/|')
  REL_PATH="${FILE_PATH#$ALT_ROOT/}"
fi

# --- Whitelist check ---
# Layer A: precise check using relative path
case "$REL_PATH" in
  docs/*|.claude/skills/*|CLAUDE.md|AGENTS.md|GEMINI.md) exit 0 ;;
esac

# Layer B: suffix fallback if relative path extraction failed
if [ "$REL_PATH" = "$FILE_PATH" ]; then
  case "$FILE_PATH" in
    */docs/*|*/.claude/skills/*|*/CLAUDE.md|*/AGENTS.md|*/GEMINI.md) exit 0 ;;
  esac
fi

# --- Not in whitelist: block ---
# Use REL_PATH for message if we got it, otherwise use full path
DISPLAY_PATH="$REL_PATH"
if [ "$DISPLAY_PATH" = "$FILE_PATH" ]; then
  DISPLAY_PATH="$FILE_PATH"
fi

echo "File boundary violation: $DISPLAY_PATH is outside Claude's writable scope."
echo "Allowed: docs/**, .claude/skills/**, CLAUDE.md, AGENTS.md, GEMINI.md"
exit 1
```

- [ ] **Step 2: Make executable**

```bash
chmod +x scripts/hooks/file-boundary-guard.sh
```

- [ ] **Step 3: Verify — allowed path (docs/)**

```bash
WIN_PWD=$(pwd | sed 's|^/\([a-zA-Z]\)/|\1:/|' | tr '\\' '/')
echo "{\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"${WIN_PWD}/docs/project_status.md\"}}" | bash scripts/hooks/file-boundary-guard.sh
echo "Exit code: $?"
```

Expected: exit 0, no output.

- [ ] **Step 4: Verify — blocked path (src/)**

```bash
WIN_PWD=$(pwd | sed 's|^/\([a-zA-Z]\)/|\1:/|' | tr '\\' '/')
echo "{\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"${WIN_PWD}/src/lib/claude.ts\"}}" | bash scripts/hooks/file-boundary-guard.sh
echo "Exit code: $?"
```

Expected: exit 1, output contains "File boundary violation".

- [ ] **Step 5: Verify — CLAUDE.md (allowed, exact match)**

```bash
WIN_PWD=$(pwd | sed 's|^/\([a-zA-Z]\)/|\1:/|' | tr '\\' '/')
echo "{\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"${WIN_PWD}/CLAUDE.md\"}}" | bash scripts/hooks/file-boundary-guard.sh
echo "Exit code: $?"
```

Expected: exit 0, no output.

- [ ] **Step 6: Verify — .claude/skills/ (allowed)**

```bash
WIN_PWD=$(pwd | sed 's|^/\([a-zA-Z]\)/|\1:/|' | tr '\\' '/')
echo "{\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"${WIN_PWD}/.claude/skills/test/SKILL.md\"}}" | bash scripts/hooks/file-boundary-guard.sh
echo "Exit code: $?"
```

Expected: exit 0, no output.

- [ ] **Step 7: Verify — MSYS-style path (allowed)**

```bash
echo "{\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"$(pwd)/docs/test.md\"}}" | bash scripts/hooks/file-boundary-guard.sh
echo "Exit code: $?"
```

Expected: exit 0, no output.

- [ ] **Step 8: Commit**

```bash
git add scripts/hooks/file-boundary-guard.sh
git commit -m "feat: add H3 file boundary guard hook script"
```

---

### Task 3: H1+H2 — Post-Edit Quality Check (PostToolUse)

Runs `tsc --noEmit` after `.ts/.tsx` edits and detects `console.log` in `src/` files.

**Files:**
- Create: `scripts/hooks/post-edit-check.sh`

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
# H1+H2: Post-Edit Quality Check
# Event: PostToolUse | Matcher: Edit|Write
# H1: TypeScript typecheck after .ts/.tsx edits
# H2: console.log detection in src/ files
# Exit 0 always (PostToolUse is informational, not blocking).

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | node -e "
  let d='';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try { console.log(JSON.parse(d).tool_input.file_path || ''); }
    catch { console.log(''); }
  });
")

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Normalize for consistent pattern matching
FILE_PATH=$(echo "$FILE_PATH" | tr '\\' '/')
OUTPUT=""

# --- H1: TypeScript typecheck (only for .ts/.tsx files) ---
case "$FILE_PATH" in
  *.ts|*.tsx)
    # 15-second timeout via Node.js (portable — Windows 'timeout' is a different command)
    TSC_OUTPUT=$(node -e "
      const { execSync } = require('child_process');
      try {
        const out = execSync('npx tsc --noEmit', {
          timeout: 15000, encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        process.stdout.write(out);
      } catch (e) {
        if (e.killed) { console.log('TSC_TIMEOUT'); process.exit(124); }
        process.stdout.write((e.stdout || '') + (e.stderr || ''));
        process.exit(1);
      }
    " 2>&1 | head -20)
    TSC_EXIT=${PIPESTATUS[0]}
    if [ "$TSC_EXIT" -eq 124 ]; then
      OUTPUT="${OUTPUT}TypeScript check timed out (>15s). Run manually: npx tsc --noEmit\n"
    elif [ "$TSC_EXIT" -ne 0 ]; then
      OUTPUT="${OUTPUT}TypeScript errors:\n${TSC_OUTPUT}\n\n"
    fi
    ;;
esac

# --- H2: console.log detection (only for files under src/) ---
case "$FILE_PATH" in
  */src/*)
    # Normalize path for grep (handle both Windows and MSYS formats)
    GREP_PATH="$FILE_PATH"
    CONSOLE_HITS=$(grep -n 'console\.\(log\|warn\|error\)' "$GREP_PATH" 2>/dev/null)
    if [ -n "$CONSOLE_HITS" ]; then
      OUTPUT="${OUTPUT}console.log detected in production code (technical red line):\n${CONSOLE_HITS}\n"
    fi
    ;;
esac

if [ -n "$OUTPUT" ]; then
  printf '%b' "$OUTPUT"
fi

exit 0
```

- [ ] **Step 2: Make executable**

```bash
chmod +x scripts/hooks/post-edit-check.sh
```

- [ ] **Step 3: Verify H1 — typecheck triggers on .ts file**

```bash
WIN_PWD=$(pwd | sed 's|^/\([a-zA-Z]\)/|\1:/|' | tr '\\' '/')
echo "{\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"${WIN_PWD}/src/lib/claude.ts\"}}" | bash scripts/hooks/post-edit-check.sh
echo "Exit code: $?"
```

Expected: exit 0. Output may contain TypeScript errors if any exist (informational).

- [ ] **Step 4: Verify H1 — no typecheck on non-TS file**

```bash
WIN_PWD=$(pwd | sed 's|^/\([a-zA-Z]\)/|\1:/|' | tr '\\' '/')
echo "{\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"${WIN_PWD}/docs/status.md\"}}" | bash scripts/hooks/post-edit-check.sh
echo "Exit code: $?"
```

Expected: exit 0, no output (Markdown file, no typecheck or console.log check).

- [ ] **Step 5: Verify H2 — console.log detection**

Create a temporary test file in `src/`, check detection, then clean up:

```bash
echo 'console.log("test")' > src/test-console-hook.ts
WIN_PWD=$(pwd | sed 's|^/\([a-zA-Z]\)/|\1:/|' | tr '\\' '/')
echo "{\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"${WIN_PWD}/src/test-console-hook.ts\"}}" | bash scripts/hooks/post-edit-check.sh
rm -f src/test-console-hook.ts
```

Expected: output contains "console.log detected".

- [ ] **Step 6: Commit**

```bash
git add scripts/hooks/post-edit-check.sh
git commit -m "feat: add H1+H2 post-edit quality check hook script"
```

---

### Task 4: H5+H6 — Stop Counter (Stop)

Increments a counter on each Stop event. Every 10 stops: lightweight git compliance check. Every 50 stops: suggest compact.

**Files:**
- Create: `scripts/hooks/stop-counter.sh`
- Runtime: `.claude/.stop-count` (auto-created, gitignored)

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
# H5+H6: Stop Counter
# Event: Stop
# Every 10 stops: lightweight git compliance check
# Every 50 stops: suggest /compact
# State file: .claude/.stop-count (gitignored, resets on session restart)

COUNTER_FILE=".claude/.stop-count"

# Initialize if missing
if [ ! -f "$COUNTER_FILE" ]; then
  mkdir -p "$(dirname "$COUNTER_FILE")"
  echo "0" > "$COUNTER_FILE"
fi

# Read, increment, write back
COUNT=$(cat "$COUNTER_FILE" 2>/dev/null || echo "0")
COUNT=$((COUNT + 1))
echo "$COUNT" > "$COUNTER_FILE"

OUTPUT=""

# Every 10 stops: lightweight compliance check
if [ $((COUNT % 10)) -eq 0 ]; then
  UNCOMMITTED=$(git status --porcelain 2>/dev/null | head -5)
  UNPUSHED=$(git log origin/master..HEAD --oneline 2>/dev/null)

  if [ -n "$UNCOMMITTED" ]; then
    OUTPUT="${OUTPUT}Uncommitted changes:\n${UNCOMMITTED}\n\n"
  fi
  if [ -n "$UNPUSHED" ]; then
    OUTPUT="${OUTPUT}Unpushed commits:\n${UNPUSHED}\n\n"
  fi
fi

# Every 50 stops: compact suggestion
if [ $((COUNT % 50)) -eq 0 ]; then
  OUTPUT="${OUTPUT}Context may be getting large (${COUNT} turns). Consider running /compact.\n"
fi

if [ -n "$OUTPUT" ]; then
  printf '%b' "$OUTPUT"
fi

exit 0
```

- [ ] **Step 2: Make executable**

```bash
chmod +x scripts/hooks/stop-counter.sh
```

- [ ] **Step 3: Verify — counter increments**

```bash
rm -f .claude/.stop-count
echo '{"stop_reason":"end_turn"}' | bash scripts/hooks/stop-counter.sh
cat .claude/.stop-count
```

Expected: `1`

- [ ] **Step 4: Verify — 10th stop triggers compliance check**

```bash
echo "9" > .claude/.stop-count
echo '{"stop_reason":"end_turn"}' | bash scripts/hooks/stop-counter.sh
```

Expected: counter becomes 10, output shows git status info (may be empty if repo is clean).

- [ ] **Step 5: Verify — 50th stop triggers compact suggestion**

```bash
echo "49" > .claude/.stop-count
echo '{"stop_reason":"end_turn"}' | bash scripts/hooks/stop-counter.sh
```

Expected: output contains "Consider running /compact".

- [ ] **Step 6: Clean up test state + commit**

```bash
rm -f .claude/.stop-count
git add scripts/hooks/stop-counter.sh
git commit -m "feat: add H5+H6 stop counter hook script"
```

---

### Task 5: H7 — Pre-Compact Check (PreCompact)

Runs mechanical compliance checks before context compression. Output is injected into compressed context.

**Files:**
- Create: `scripts/hooks/pre-compact-check.sh`

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
# H7: Pre-Compact Compliance Check
# Event: PreCompact
# Checks git state and status file updates before context compression.
# Output is advisory (does NOT block compact).
# Resets stop counter.

OUTPUT=""

# 1. Uncommitted changes
UNCOMMITTED=$(git status --porcelain 2>/dev/null | head -10)
if [ -n "$UNCOMMITTED" ]; then
  OUTPUT="${OUTPUT}Uncommitted changes:\n${UNCOMMITTED}\n\n"
fi

# 2. Unpushed commits
UNPUSHED=$(git log origin/master..HEAD --oneline 2>/dev/null)
if [ -n "$UNPUSHED" ]; then
  OUTPUT="${OUTPUT}Unpushed commits:\n${UNPUSHED}\n\n"
fi

# 3. Check if any modified files are outside Claude's file boundary
MODIFIED_FILES=$(git diff --name-only 2>/dev/null; git diff --cached --name-only 2>/dev/null)
BOUNDARY_VIOLATIONS=""
while IFS= read -r file; do
  [ -z "$file" ] && continue
  case "$file" in
    docs/*|.claude/skills/*|CLAUDE.md|AGENTS.md|GEMINI.md) ;;  # allowed
    *) BOUNDARY_VIOLATIONS="${BOUNDARY_VIOLATIONS}  ${file}\n" ;;
  esac
done <<< "$MODIFIED_FILES"

if [ -n "$BOUNDARY_VIOLATIONS" ]; then
  OUTPUT="${OUTPUT}Files modified outside Claude's boundary:\n${BOUNDARY_VIOLATIONS}\n"
fi

# 4. Check if status/changelog files were modified
STATUS_MOD=$(echo "$MODIFIED_FILES" | grep -c "docs/project_status.md")
CHANGELOG_MOD=$(echo "$MODIFIED_FILES" | grep -c "docs/changelog.md")
if [ "$STATUS_MOD" -eq 0 ] && [ "$CHANGELOG_MOD" -eq 0 ]; then
  OUTPUT="${OUTPUT}Neither project_status.md nor changelog.md modified in current changes.\n\n"
fi

# 5. Reset stop counter
echo "0" > ".claude/.stop-count" 2>/dev/null

if [ -n "$OUTPUT" ]; then
  printf 'Pre-compact compliance check:\n%b' "$OUTPUT"
fi

exit 0
```

- [ ] **Step 2: Make executable**

```bash
chmod +x scripts/hooks/pre-compact-check.sh
```

- [ ] **Step 3: Verify — shows uncommitted changes**

```bash
bash scripts/hooks/pre-compact-check.sh
```

Expected: output lists uncommitted files (from current git status). Check that stop counter was reset.

- [ ] **Step 4: Commit**

```bash
git add scripts/hooks/pre-compact-check.sh
git commit -m "feat: add H7 pre-compact compliance check hook script"
```

---

### Task 6: Wire Hooks — `.claude/settings.json`

Creates the project-level settings file that registers all 4 hook scripts with Claude Code.

**Files:**
- Create: `.claude/settings.json`

**Important:** This file is separate from `.claude/settings.local.json` (which holds user permissions and is NOT committed). `settings.json` is project-level and committed to git. Claude Code merges both at runtime.

- [ ] **Step 1: Write settings.json**

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

- [ ] **Step 2: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8')); console.log('Valid JSON')"
```

Expected: "Valid JSON"

- [ ] **Step 3: Verify bash resolves correctly on this system**

```bash
which bash && bash --version | head -1
```

Expected: bash path shown (e.g., `/usr/bin/bash` on Git Bash) and version 4+.

- [ ] **Step 4: Commit**

```bash
git add .claude/settings.json
git commit -m "feat: add Claude Code hooks configuration"
```

---

### Task 7: H4 — Structured Dispatch Skill

A skill Claude invokes when preparing task dispatches to Codex/Gemini. Provides a standard template that ensures consistent context quality.

**Files:**
- Create: `.claude/skills/structured-dispatch/SKILL.md`

- [ ] **Step 1: Write the skill file**

```markdown
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
4. User approves -> send English dispatch

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
```

- [ ] **Step 2: Verify file exists and frontmatter is valid**

```bash
head -4 .claude/skills/structured-dispatch/SKILL.md
```

Expected: shows frontmatter with name and description.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/structured-dispatch/SKILL.md
git commit -m "feat: add H4 structured dispatch skill for CCB coordination"
```

---

### Task 8: Update claudemd-check Skill

Add a dedicated "禁止事项" check step and update the output format.

**Files:**
- Modify: `.claude/skills/claudemd-check/SKILL.md`

**Changes:**
1. Step 3: remove the 禁止事项 reference, simplify to pure status file check
2. New step 8: full 禁止事项 check (all 4 items)
3. Existing step 8 (沟通协议) becomes step 9
4. Output format: add 禁止事项 line

- [ ] **Step 1: Update the skill file**

Replace the full content of `.claude/skills/claudemd-check/SKILL.md` with:

```markdown
---
name: claudemd-check
description: CLAUDE.md 合规自检。自动触发：每次声称任务完成、准备 commit、或即将结束会话时，必须先跑此检查。手动触发：用户输入 /claudemd-check 时执行。
---

# CLAUDE.md 合规自检

动态读取 CLAUDE.md 作为唯一真相源，不硬编码任何规则。CLAUDE.md 变了，检查自动跟着变。

## 执行步骤

1. **读 CLAUDE.md**（使用 Read 工具）

2. **检查：会话初始化**
   找到「每次会话开始时」部分，提取所有必读文件。检查本次会话是否已读过每一个。未读的立即读取。

3. **检查：任务完成更新**
   读 `docs/project_status.md` 和 `docs/changelog.md`，确认最后一条记录覆盖了本次工作。

4. **检查：Git 状态**
   运行 `git status` 和 `git log origin/master..HEAD --oneline`。
   - 有属于本次工作的未 commit 文件 -> 修复
   - 有未 push 的 commit -> 立即 push

5. **检查：文件边界**
   找到「Claude 的文件边界」部分，提取可写和不可写的路径。回顾本次会话中自己写入或修改的文件列表，确认没有越界。用户明确授权越界的除外。

6. **检查：产品不变量**
   找到「产品不变量」部分，逐条回顾本次改动是否违反。

7. **检查：技术红线**
   找到「技术红线」部分，逐条回顾本次改动是否触碰。

8. **检查：禁止事项**
   找到「禁止事项」部分，逐条回顾本次改动是否违反：
   1. 禁止引入多用户 / 登录 / 注册系统
   2. 禁止添加 MVP 范围外的功能（社区、个性化推荐、游戏化等）
   3. 禁止未经确认就修改产品不变量
   4. 禁止在未更新 `docs/project_status.md` 和 `docs/changelog.md` 的情况下声称任务完成

9. **检查：沟通协议**（仅在本次涉及技术选项汇报时）
   找到「沟通协议」部分，检查是否遵守了汇报格式。

## 输出格式

```
CLAUDE.md 自检完成
V/X 会话初始化：N/N 文件已读
V/X 禁止事项：未违反 / 违反第 X 条
V/X 状态文件：已更新 / 需更新
V/X Git：已 commit + 已 push / 有遗漏
V/X 文件边界：未越界 / 已授权越界 / 违规
V/X 产品不变量：未违反 / 违反第 X 条
V/X 技术红线：未违反 / 违反 X
!/V 沟通协议：本次无技术汇报，跳过 / 已遵守

结果：全部通过 / N 项需修复
```

如果有未通过项，先修复，再重新运行检查，直到全部通过。
```

Note: The output format uses `V/X` and `!/V` as placeholders. The actual skill execution will use Unicode checkmarks (`✓/✗` and `⚠/✓`). They are written as ASCII here to avoid encoding issues in the plan.

- [ ] **Step 2: Verify the diff is correct**

Key changes to confirm:
- Step 3 no longer mentions 禁止事项; it only checks status file updates
- New step 8 covers all 4 禁止事项 items
- Old step 8 (沟通协议) is now step 9
- Output format has a new "禁止事项" line (2nd line after header)

```bash
git diff .claude/skills/claudemd-check/SKILL.md
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/claudemd-check/SKILL.md
git commit -m "feat: update claudemd-check with dedicated 禁止事项 check"
```

---

### Task 9: Integration Verification

Verify all hooks are wired correctly and work together in Claude Code.

- [ ] **Step 1: Verify all files exist**

```bash
ls -la scripts/hooks/file-boundary-guard.sh scripts/hooks/post-edit-check.sh scripts/hooks/stop-counter.sh scripts/hooks/pre-compact-check.sh .claude/settings.json .claude/skills/structured-dispatch/SKILL.md .claude/skills/claudemd-check/SKILL.md
```

Expected: all 7 files listed.

- [ ] **Step 2: Verify all scripts are executable**

```bash
test -x scripts/hooks/file-boundary-guard.sh && echo "boundary: OK"
test -x scripts/hooks/post-edit-check.sh && echo "post-edit: OK"
test -x scripts/hooks/stop-counter.sh && echo "stop-counter: OK"
test -x scripts/hooks/pre-compact-check.sh && echo "pre-compact: OK"
```

Expected: all 4 show "OK".

- [ ] **Step 3: Verify settings.json is valid and references all scripts**

```bash
node -e "
  const cfg = JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'));
  const hooks = cfg.hooks;
  console.log('PreToolUse:', hooks.PreToolUse?.length || 0, 'hooks');
  console.log('PostToolUse:', hooks.PostToolUse?.length || 0, 'hooks');
  console.log('Stop:', hooks.Stop?.length || 0, 'hooks');
  console.log('PreCompact:', hooks.PreCompact?.length || 0, 'hooks');
"
```

Expected: 1 hook per event type.

- [ ] **Step 4: Run all hook scripts with mock input to verify no crashes**

```bash
echo '{"tool_name":"Edit","tool_input":{"file_path":"test"}}' | bash scripts/hooks/file-boundary-guard.sh > /dev/null 2>&1; echo "H3: exit $?"
echo '{"tool_name":"Edit","tool_input":{"file_path":"test.md"}}' | bash scripts/hooks/post-edit-check.sh > /dev/null 2>&1; echo "H1+H2: exit $?"
echo '{"stop_reason":"end_turn"}' | bash scripts/hooks/stop-counter.sh > /dev/null 2>&1; echo "H5+H6: exit $?"
bash scripts/hooks/pre-compact-check.sh > /dev/null 2>&1; echo "H7: exit $?"
rm -f .claude/.stop-count
```

Expected: all scripts run without crashing. H3 may exit 1 (blocked) or 0 depending on path format — both are valid for this smoke test.

- [ ] **Step 5: Final commit (foundation + gitignore)**

```bash
git add .gitignore
git add -A scripts/hooks/
git status
git commit -m "feat: Claude Code hooks + skill automation system

- H3: file boundary guard (PreToolUse)
- H1+H2: typecheck + console.log detection (PostToolUse)
- H5+H6: stop counter + compact reminder (Stop)
- H7: pre-compact compliance check (PreCompact)
- H4: structured dispatch skill (new)
- claudemd-check: added 禁止事项 full check
- .claude/settings.json: hook wiring"
```

Note: if individual tasks were already committed in Steps 2-8, this final commit only picks up `.gitignore` and any uncommitted changes. Adjust `git add` accordingly.

- [ ] **Step 6: Push**

```bash
git push origin master
```

---

## Execution Notes

### File Boundary Strategy

Tasks 1-6 involve files outside Claude's writable boundary (`scripts/hooks/`, `.claude/settings.json`, `.gitignore`). Two options:

1. **User authorization**: User grants Claude one-time permission to write these files. Simplest since all code is pre-written in this plan.
2. **Codex dispatch**: Bundle Tasks 1-6 into a single Codex dispatch. Use the structured-dispatch skill (Task 7) template. Recommended tier: **Light** (code is fully specified).

Tasks 7-8 are within Claude's boundary (`.claude/skills/`) and can be executed directly.

### Windows Compatibility

- All scripts use `#!/usr/bin/env bash` and are designed for Git Bash on Windows
- Path handling uses a 3-layer approach: direct match -> MSYS conversion -> suffix fallback
- `node` is used for JSON parsing instead of `jq` (guaranteed available in this Node.js project)
- `node execSync({ timeout })` is used instead of GNU `timeout` (Windows `timeout.exe` is a different command)
- `printf '%b'` is used instead of `echo -e` for portable escape sequence handling

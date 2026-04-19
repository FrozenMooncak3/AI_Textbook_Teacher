# System Evolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地 10 个系统进化机制（T1 8 低成本 + T2 Retrospective 2.0 + M10），覆盖 survey 5 维短板，每机制独立 commit + git revert 分钟级回滚。

**Architecture:** Claude Code hooks（PostToolUse Bash matcher + UserPromptSubmit）写事件到 `.ccb/counters/` 与 `docs/journal/`；skill frontmatter 增加 fallback 字段；CLAUDE.md/session-rules 强化触发语 + kill switch 条款；task-execution skill 加 retry 硬 cap 和 review 外化硬 check；retrospective skill 升级为 2.0 增加 skill-audit + 挖矿两段。

**Tech Stack:** Bash（`set -euo pipefail` + `trap ERR`）、`jq`、Claude Code hooks v2025、Markdown skill 文件

**Spec:** `docs/superpowers/specs/2026-04-19-system-evolution-design.md`

---

## File Structure Map

**新增文件**：
- `scripts/hooks/post-tool-failure-capture.sh` — M2 hook 脚本
- `scripts/hooks/user-correction-counter.sh` — M3/M4 hook 脚本
- `docs/memory-audit-log.md` — M6 append-only 审计
- `.ccb/counters/.gitignore` — 忽略 counter 文件

**修改文件**：
- `.claude/settings.json` — 注册新 hook
- `CLAUDE.md` — M1 强触发语 + M6 memory audit 契约 + 技术红线加 kill switch
- `.claude/skills/session-rules/SKILL.md` — 规则 3 量化 + 规则 6 fallback + kill switch meta
- `.claude/skills/task-execution/SKILL.md` — M11 retries + M10 review 硬 check
- `.claude/skills/structured-dispatch/SKILL.md` — M14 fresh session
- `.claude/skills/retrospective/SKILL.md` — 升级 2.0（5 段 + 自动触发）
- `.claude/skills/session-init/SKILL.md` — Step 2 扫 `.ccb/counters/`
- `docs/ccb-protocol.md` — M14 fresh session 条款
- 3-5 skill frontmatter（debug-ocr / database-migrations / using-git-worktrees / research-before-decision）— M5 fallback

**元文件**（实施收尾）：`docs/project_status.md` · `docs/superpowers/INDEX.md` · `docs/changelog.md`

---

## Task 1: M2 PostToolUse Bash 失败捕获 hook

**Files:**
- Create: `scripts/hooks/post-tool-failure-capture.sh`
- Create: `.ccb/counters/.gitignore`
- Modify: `.claude/settings.json`

- [ ] **Step 1.1: 创建 `.ccb/counters/.gitignore`**

```gitignore
# 所有 counter 状态文件不进 repo
*.count
*.log
hook-errors.log
tool-failures.log
user-corrections-*.count
task-retries-*.count
# 保留目录本身
!.gitignore
```

- [ ] **Step 1.2: 创建 `scripts/hooks/post-tool-failure-capture.sh`**

```bash
#!/usr/bin/env bash
# Kill switch
[ "${AI_SYSTEM_EVOLUTION_DISABLE:-0}" = "1" ] && exit 0

set -euo pipefail
trap 'echo "[hook-error] post-tool-failure-capture $(date -Iseconds)" >> .ccb/counters/hook-errors.log; exit 0' ERR

# Read stdin JSON from Claude Code
INPUT=$(cat)
EXIT_CODE=$(echo "$INPUT" | jq -r '.tool_response.exit_code // 0')

# Skip normal results
[ "$EXIT_CODE" = "0" ] && exit 0

# Parse fields
TOOL=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""' | head -c 100)
STDERR=$(echo "$INPUT" | jq -r '.tool_response.stderr // ""' | head -c 200)
TS=$(date -Iseconds)

# Always append to counter log
mkdir -p .ccb/counters
echo "{\"ts\":\"$TS\",\"tool\":\"$TOOL\",\"exit_code\":$EXIT_CODE,\"cmd_head\":$(jq -Rs . <<< "$CMD"),\"stderr_head\":$(jq -Rs . <<< "$STDERR")}" >> .ccb/counters/tool-failures.log

# Whitelist check: only "real workflow commands" upgrade to journal
if echo "$CMD" | grep -qE '^(codex:|gemini:|npm |pnpm |yarn |git |node |bash scripts/|docker )'; then
  DATE=$(date +%Y-%m-%d)
  JOURNAL="docs/journal/${DATE}-auto-tool-failures.md"
  if [ ! -f "$JOURNAL" ]; then
    cat > "$JOURNAL" <<EOF
# Auto Tool Failures — ${DATE}

> 由 post-tool-failure-capture hook 自动生成。type: issue, status: open。

EOF
  fi
  cat >> "$JOURNAL" <<EOF

## $TS — $TOOL failed (exit $EXIT_CODE)
- **cmd**: \`$CMD\`
- **stderr**: \`$STDERR\`
- **status**: open

EOF
fi

# Inject additionalContext to Claude
jq -n --arg ctx "Bash failed (exit $EXIT_CODE): $STDERR. Consider diagnosing before retrying." \
  '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $ctx}}'
```

- [ ] **Step 1.3: chmod +x**

Run: `chmod +x scripts/hooks/post-tool-failure-capture.sh`

- [ ] **Step 1.4: 注册到 `.claude/settings.json`**

在 PostToolUse 数组追加 `{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "bash scripts/hooks/post-tool-failure-capture.sh" }] }`。保留原有 `Edit|Write` matcher。

- [ ] **Step 1.5: Smoke test**

Run: `echo '{"session_id":"test","transcript_path":"/tmp/t","tool_name":"Bash","tool_input":{"command":"npm install fakepkg"},"tool_response":{"exit_code":1,"stdout":"","stderr":"npm ERR! fake"}}' | bash scripts/hooks/post-tool-failure-capture.sh`
Expected: stdout 输出 `hookSpecificOutput` JSON；`.ccb/counters/tool-failures.log` 追加一行；`docs/journal/<today>-auto-tool-failures.md` 创建并含条目。

- [ ] **Step 1.6: Commit**

```bash
git add scripts/hooks/post-tool-failure-capture.sh .ccb/counters/.gitignore .claude/settings.json
git commit -m "feat(hooks): M2 PostToolUse Bash failure capture → journal + counter log

[revert-path: git revert <hash>]"
```

---

## Task 2: M3/M4 UserPromptSubmit 纠错词计数 hook + session-rules 规则 3 量化

**Files:**
- Create: `scripts/hooks/user-correction-counter.sh`
- Modify: `.claude/settings.json`
- Modify: `.claude/skills/session-rules/SKILL.md`

- [ ] **Step 2.1: 创建 `scripts/hooks/user-correction-counter.sh`**

```bash
#!/usr/bin/env bash
# Kill switch
[ "${AI_SYSTEM_EVOLUTION_DISABLE:-0}" = "1" ] && exit 0

set -euo pipefail
trap 'echo "[hook-error] user-correction-counter $(date -Iseconds)" >> .ccb/counters/hook-errors.log; exit 0' ERR

INPUT=$(cat)

# session_id fallback chain
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // ""')
[ -z "$SESSION_ID" ] && SESSION_ID="${CLAUDE_SESSION_ID:-}"
[ -z "$SESSION_ID" ] && [ -f .ccb/session-marker ] && SESSION_ID=$(head -n1 .ccb/session-marker 2>/dev/null || echo "")
[ -z "$SESSION_ID" ] && SESSION_ID="fallback-$(echo "$PWD$$" | md5sum | cut -c1-8)"

PROMPT=$(echo "$INPUT" | jq -r '.prompt // ""')

# Narrow keyword list — removed 不是/别/停 (high false-positive words)
# Chinese: 不对 重来 错了 重新 不行 搞错 弄错
# English (word-boundary): wrong redo "no that's" "that's wrong" stop
if echo "$PROMPT" | grep -qE '不对|重来|错了|重新|不行|搞错|弄错' || \
   echo "$PROMPT" | grep -qiE '\bwrong\b|\bredo\b|\bno that'"'"'?s\b|\bthat'"'"'?s wrong\b|\bstop\b'; then
  mkdir -p .ccb/counters
  COUNT_FILE=".ccb/counters/user-corrections-${SESSION_ID}.count"
  COUNT=$(cat "$COUNT_FILE" 2>/dev/null || echo 0)
  COUNT=$((COUNT + 1))
  echo "$COUNT" > "$COUNT_FILE"

  if [ "$COUNT" -ge 3 ]; then
    jq -n '{hookSpecificOutput: {hookEventName: "UserPromptSubmit", additionalContext: "🛑 本 session 已检测到用户 3 次纠错。按 Anthropic best-practices 建议 /clear 或明确回到 Phase 1 根因诊断。"}}'
  elif [ "$COUNT" -eq 2 ]; then
    jq -n '{hookSpecificOutput: {hookEventName: "UserPromptSubmit", additionalContext: "⚠️ 本 session 已检测到用户 2 次纠错。触发 session-rules 规则 3：若同一问题再次失败，必须走 systematic-debugging，不得继续尝试修复。"}}'
  fi
fi

exit 0
```

- [ ] **Step 2.2: chmod +x**

Run: `chmod +x scripts/hooks/user-correction-counter.sh`

- [ ] **Step 2.3: 注册到 `.claude/settings.json`**

新增 `UserPromptSubmit` 数组（若不存在）或追加：`{ "matcher": ".*", "hooks": [{ "type": "command", "command": "bash scripts/hooks/user-correction-counter.sh" }] }`

- [ ] **Step 2.4: 升级 session-rules 规则 3**

Modify `.claude/skills/session-rules/SKILL.md` 规则 3 行 "同一问题修复失败 ≥2 次 systematic-debugging"：
- 加一句："（由 `.ccb/counters/user-corrections-<session>.count` 硬计数。≥2 时 hook 已 inject additionalContext，Claude 必须响应，不得忽略；≥3 必须 `/clear` 或明确重启诊断流程。）"

- [ ] **Step 2.5: Smoke test**

Run: `echo '{"session_id":"test","prompt":"不对，重来"}' | bash scripts/hooks/user-correction-counter.sh`
Expected: `.ccb/counters/user-corrections-test.count` 文件存在，值为 1；stdout 无输出（1 次不触发提示）。
再跑两次 → 第 2 次 stdout 返回 `⚠️` 提示，第 3 次返回 `🛑`。

假阳测试：`echo '{"session_id":"test2","prompt":"不是今天做"}' | bash scripts/hooks/user-correction-counter.sh` → 不应触发计数（"不是" 不在关键词列表）。

- [ ] **Step 2.6: Commit**

```bash
git add scripts/hooks/user-correction-counter.sh .claude/settings.json .claude/skills/session-rules/SKILL.md
git commit -m "feat(hooks): M3/M4 UserPromptSubmit 纠错词计数 + session-rules 规则 3 量化

[revert-path: git revert <hash>]"
```

---

## Task 3: M1 1% 强触发语（CLAUDE.md + session-rules）

**Files:**
- Modify: `CLAUDE.md` § Skill 使用
- Modify: `.claude/skills/session-rules/SKILL.md`

- [ ] **Step 3.1: CLAUDE.md § Skill 使用 增补"1% 强触发语"**

在 `## Skill 使用` 段末追加：
```
**1% 强触发语契约**：所有 session-rules Chain Routing 条件触发的 skill（brainstorming / verification-before-completion / claudemd-check / systematic-debugging / research-before-decision）——即使只有 1% 可能需要调用，也必须走对应 skill 的触发流程。违规是优先级高于"保持简洁"的硬错误。
```

- [ ] **Step 3.2: session-rules 规则 3 强触发语替换**

Modify `.claude/skills/session-rules/SKILL.md`：
- 规则 3 的 "同一问题修复失败 ≥2 次 → systematic-debugging" 前加 "**绝对必须**"
- 加一行："即使当前尝试看起来'只差一点'，1% 可能需要根因诊断 = 100% 必须走诊断流程。"

- [ ] **Step 3.3: Commit**

```bash
git add CLAUDE.md .claude/skills/session-rules/SKILL.md
git commit -m "feat(skills): M1 1% 强触发语契约写入 CLAUDE.md + session-rules

[revert-path: git revert <hash>]"
```

---

## Task 4: M5 fallback_for_toolsets（skill frontmatter + session-rules 规则 6）

**Files:**
- Modify: `.claude/skills/debug-ocr/SKILL.md`（frontmatter）
- Modify: `.claude/skills/database-migrations/SKILL.md`（frontmatter）
- Modify: `.claude/skills/using-git-worktrees/SKILL.md`（frontmatter）
- Modify: `.claude/skills/research-before-decision/SKILL.md`（frontmatter）
- Modify: `.claude/skills/session-rules/SKILL.md`（加规则 6）

- [ ] **Step 4.1: debug-ocr frontmatter 加字段**

```yaml
fallback_for_toolsets:
  - preferred: ["Bash"]
    fallback: "If Bash is unavailable, use Read to tail last 100 lines of the OCR server log file manually at the path noted in CLAUDE.md deployment section."
```

- [ ] **Step 4.2: database-migrations frontmatter 加字段**

```yaml
fallback_for_toolsets:
  - preferred: ["Bash"]
    fallback: "If Bash is unavailable (e.g., local shell restricted), write SQL changes to docs/migration-<date>.sql and dispatch to Codex with AGENTS.md."
```

- [ ] **Step 4.3: using-git-worktrees frontmatter 加字段**

```yaml
fallback_for_toolsets:
  - preferred: ["Bash"]
    fallback: "If Bash is unavailable, skip worktree creation and work on main branch — document the risk in the plan."
```

- [ ] **Step 4.4: research-before-decision frontmatter 加字段**

```yaml
fallback_for_toolsets:
  - preferred: ["Agent"]
    fallback: "If sub-agent dispatch fails, fall back to WebSearch + WebFetch from main loop (slower, less parallelism, but functional)."
```

- [ ] **Step 4.5: session-rules 加规则 6**

Modify `.claude/skills/session-rules/SKILL.md`，在 "规则 5: Chain Routing" 后插入：
```
## 规则 6: Fallback for Toolsets

加载任何 skill 时，若发现 SKILL.md frontmatter 含 `fallback_for_toolsets` 字段且当前 session 中 preferred 列表任一工具不可用 → 必须优先读并执行 fallback 文本，禁止因单个工具缺失直接放弃 skill。
```

- [ ] **Step 4.6: Commit**

```bash
git add .claude/skills/debug-ocr/SKILL.md .claude/skills/database-migrations/SKILL.md .claude/skills/using-git-worktrees/SKILL.md .claude/skills/research-before-decision/SKILL.md .claude/skills/session-rules/SKILL.md
git commit -m "feat(skills): M5 fallback_for_toolsets frontmatter + session-rules 规则 6

[revert-path: git revert <hash>]"
```

---

## Task 5: M6 memory audit log + CLAUDE.md 契约

**Files:**
- Create: `docs/memory-audit-log.md`
- Modify: `CLAUDE.md`（新增 memory audit 契约段）

- [ ] **Step 5.1: 创建 memory audit log**

Create `docs/memory-audit-log.md`：
```markdown
# Memory Audit Log

> append-only 审计日志。每次 Claude 对 auto-memory（`C:\Users\Administrator\.claude\projects\D------Users-Sean-ai-textbook-teacher\memory\*`）增/改/删必须在此追加一行。
> 格式：`YYYY-MM-DD HH:MM | op:<add|edit|delete> | file:<name>.md | reason:<短描述>`

---

## 2026-04-19

2026-04-19 <HH:MM> | op:init | file:- | reason:M6 memory audit log 初始化（spec 2026-04-19-system-evolution-design §2.4）
```

实施时把 `<HH:MM>` 替换为真实时间。

- [ ] **Step 5.2: CLAUDE.md 新增"memory audit 契约"段**

在 `## 禁止事项` 段后新增 `## memory audit 契约`：
```
- 所有对 `C:\Users\Administrator\.claude\projects\D------Users-Sean-ai-textbook-teacher\memory\**` 的增/改/删**必须**在 `docs/memory-audit-log.md` 追加一行 `YYYY-MM-DD HH:MM | op:<add|edit|delete> | file:<name>.md | reason:<短描述>`
- memory 路径在用户主目录跨 repo，无法 git 托管；降级方案是在项目内维护审计日志
- retrospective 2.0 会对比 `git log` memory 目录改动次数 vs 审计日志行数差，发现漏记
```

- [ ] **Step 5.3: Commit**

```bash
git add docs/memory-audit-log.md CLAUDE.md
git commit -m "feat(memory): M6 memory audit log + CLAUDE.md 契约

[revert-path: git revert <hash>]"
```

---

## Task 6: M11 task-execution max retries=3

**Files:**
- Modify: `.claude/skills/task-execution/SKILL.md`

- [ ] **Step 6.1: 读现有 task-execution skill**

Read `.claude/skills/task-execution/SKILL.md` 找到 retry 相关段落。

- [ ] **Step 6.2: 加 retry_count 状态 + 硬 cap**

在 skill 的 retry 段落加入：
```
## Retry 硬 cap

每次 dispatch 前生成 `task_uuid = "$(date +%s)-$(head -c 4 /dev/urandom | xxd -p)"`（或使用 skill state scratchpad 给出的 id）。

Retry 计数持久化到 `.ccb/counters/task-retries-${task_uuid}.count`：
1. 第 N 次 retry 前读文件当前值 COUNT（不存在则 0）
2. COUNT+1 写回
3. **if COUNT >= 3**：surface to user "Retry cap hit (3/3) for task ${task_uuid}. Manual diagnosis required. 对应 dispatch: <id>。禁止继续 retry，必须走 systematic-debugging 或放弃任务。"
4. COUNT < 3 → 允许 retry

**生命周期**：task 完成/放弃后计数器文件保留 24h（retrospective 2.0 会扫），超过由 memory-cleanup skill 或手动清理。

**硬规则**：不接受"只差一点再试一次"——survey $47k 无限循环案例警告。
```

- [ ] **Step 6.3: Commit**

```bash
git add .claude/skills/task-execution/SKILL.md
git commit -m "feat(skills): M11 task-execution max retries=3 硬 cap

[revert-path: git revert <hash>]"
```

---

## Task 7: M14 Codex/Gemini fresh session per task

**Files:**
- Modify: `.claude/skills/structured-dispatch/SKILL.md`
- Modify: `docs/ccb-protocol.md`

- [ ] **Step 7.1: structured-dispatch 模板加 fresh session 条款**

Modify `.claude/skills/structured-dispatch/SKILL.md`，在模板 Step 顶部或结尾加：
```
⚠️ **Fresh session per task**：每次派发必须使用**新开 session**（新开 Codex/Gemini 实例，不续接旧 context）。理由：
- obra "fresh subagent per task" 范式（survey §D Finding 1.4）
- Cognition "context 污染影响 review 判断"（survey §D Finding 3.3）

**例外**：同一任务的 retry（非新任务）允许续接同 session；但 3 次 cap（M11）触发后必须换 session。
```

- [ ] **Step 7.2: ccb-protocol.md 加对应条款**

Modify `docs/ccb-protocol.md` 在 Dispatch 规范段加一节：
```
## Fresh Session 约定（2026-04-19 起）

每次新任务派发必须打开新 Codex/Gemini 实例，不续接旧 session context。Retry 允许续接，但连续 3 次后必须换 session 并走 systematic-debugging。
```

- [ ] **Step 7.3: Commit**

```bash
git add .claude/skills/structured-dispatch/SKILL.md docs/ccb-protocol.md
git commit -m "feat(ccb): M14 fresh session per task 约定

[revert-path: git revert <hash>]"
```

---

## Task 8: CLAUDE.md kill switch 条款 + session-init 扫计数器

**Files:**
- Modify: `CLAUDE.md`（技术红线段加 kill switch）
- Modify: `.claude/skills/session-rules/SKILL.md`（meta 引用）
- Modify: `.claude/skills/session-init/SKILL.md`（Step 2 扫计数器）

- [ ] **Step 8.1: CLAUDE.md 技术红线段加 kill switch**

Modify `CLAUDE.md` `## 技术红线` 段末追加：
```
- **系统进化 hook 总开关**：若新 hook（post-tool-failure-capture / user-correction-counter / 任何 `scripts/hooks/*` 带 `AI_SYSTEM_EVOLUTION_DISABLE` 检查的）出现异常（误报 / 失败阻塞），通过设置环境变量 `AI_SYSTEM_EVOLUTION_DISABLE=1` 一键禁用所有新机制。Windows 当前 shell：`export AI_SYSTEM_EVOLUTION_DISABLE=1`；永久：写入 `~/.bashrc` 或 `.env`。
```

- [ ] **Step 8.2: session-rules 加 meta 行**

Modify `.claude/skills/session-rules/SKILL.md` 末尾（行为契约前）：
```
> 新 hook 机制总开关见 CLAUDE.md "技术红线" 段 kill switch 条款（`AI_SYSTEM_EVOLUTION_DISABLE=1`）。
```

- [ ] **Step 8.3: session-init Step 2 加扫计数器**

Modify `.claude/skills/session-init/SKILL.md` Step 2 并行操作列表，加一项：
```
- `ls .ccb/counters/ 2>/dev/null`：若 `tool-failures.log` 有未归档条目 或 `user-corrections-*.count` 值 ≥3 → 在仪表盘加 `⚠️ 未处理事件: N` 行
```

- [ ] **Step 8.4: Commit**

```bash
git add CLAUDE.md .claude/skills/session-rules/SKILL.md .claude/skills/session-init/SKILL.md
git commit -m "feat(meta): kill switch 文档化 + session-init 扫计数器

[revert-path: git revert <hash>]"
```

---

## Task 9: Retrospective 2.0 升级（T2）

**Files:**
- Modify: `.claude/skills/retrospective/SKILL.md`

- [ ] **Step 9.1: 读现有 retrospective skill 全文**

Read `.claude/skills/retrospective/SKILL.md`，保留原 3 段（memory drafts / skill improvements / journal housekeeping）和手动触发路径。

- [ ] **Step 9.2: 新增"段 4 — Skill Audit（M9）"**

在原 3 段后插入：
```
## Section 4: Skill Audit（系统进化机制 M9）

**目的**：发现 skill 描述/触发/行为漂移，避开自评 ECE 77% 陷阱。

**执行方式**：派 `general-purpose` sub-agent（独立 critic）

**输入分阶段演进**：
- **阶段 1（首次启用到 30 天）**：仅提供 23 个 skill 的 SKILL.md 全文 + `git log --oneline -- .claude/skills/` 近 30 天 → 纯静态审计
  - 问题："SKILL.md 描述是否自洽、触发条件是否清晰、与 session-rules Chain Routing 是否对齐"
- **阶段 2（30 天后数据积累）**：加入 `.ccb/counters/tool-failures.log`、`.ccb/counters/user-corrections-*.count`、`.ccb/counters/task-retries-*.count`、近期自动 journal 条目 → 间接信号挖掘
- **阶段 3（可选，T3 之后）**：新增 `PreToolUse matcher "Task"` hook 记录 sub-agent 调用 + skill load 事件

**产出**：每 skill 一个 verdict（healthy / drifting / unused / needs-data）+ 建议改动清单

**执行仍需用户批准**：sub-agent 出清单 → 用户逐条 y/n → 通过的再实际改动
```

- [ ] **Step 9.3: 新增"段 5 — Skill 挖矿（M15）"**

```
## Section 5: Skill 挖矿（系统进化机制 M15）

**目的**：扫 journal 找重复 pattern，提议新 skill。

**执行方式**：派 sub-agent（同段 4）

**输入**：`docs/journal/` 近 30 天所有文件

**任务**："找出 ≥3 次重复的 pattern（调试方法 / 决策套路 / 工作流 fragment），判断是否值得升格为 skill"

**产出**：候选 skill 名 + 1 段说明 + 3 条 journal 证据。**仅提议，不自动生成**（survey 明确警告 Hermes 自动生成 skill）

**用户决策**：逐条 y/n。批准的进下一轮 writing-skills（手动）流程。
```

- [ ] **Step 9.4: 新增"自动触发路径"段**

在手动触发入口旁加：
```
## 自动触发路径（2.0 新增）

**触发条件**（二选一或并存）：
- 里程碑结束：`project_status.md` 某里程碑状态变 `resolved` 时，SessionStart 或 PostToolUse hook 检测到并 inject `"建议跑 /retrospective"` 提示（不强制）
- Commit 阈值：自上次 retrospective 跑完后累积 ≥30 commits 时同理 inject 提示

**不强制执行**：仅 inject 提示给 Claude 或用户；仍走手动 `/retrospective` 入口。

**实施阶段二选一**：本 spec 不要求两个都做；根据 hook 实现复杂度选择（里程碑钩子优先，因语义更明确）。
```

- [ ] **Step 9.5: Commit**

```bash
git add .claude/skills/retrospective/SKILL.md
git commit -m "feat(skills): Retrospective 2.0 — 加 skill-audit / 挖矿 / 自动触发

合并 survey M7+M9+M15 三机制为单 skill 升级，避免 skill 爆炸。

[revert-path: git revert <hash>]"
```

---

## Task 10: M10 Review loop 终止外化（T2）

**Files:**
- Modify: `.claude/skills/task-execution/SKILL.md` review phase 段

- [ ] **Step 10.1: 加 review termination criteria**

在 task-execution SKILL.md review phase 段加：
```
## Review 终止硬 check（系统进化机制 M10）

Review phase 在声明 `passed` 前**必须**运行下列 required_pass 列表并全部返回 exit 0：

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
- Claude 必须实际调用这些命令并报告 exit code
- 任一 required_pass 未达 → review **不能声明 passed**，必须回到 retry 或 surface to user
- Claude 主观判断作为**补充信号**（指出 build 过但逻辑错），不能**替代**硬 check

**例外处理**：若任务纯文档改动无构建/测试，reviewer 必须在 review 开始时**明文声明**"本任务无构建/测试硬 check，仅走人工 review"——例外必须可见。
```

- [ ] **Step 10.2: Commit**

```bash
git add .claude/skills/task-execution/SKILL.md
git commit -m "feat(skills): M10 review loop 终止外化到 build/test/lint 硬 check

[revert-path: git revert <hash>]"
```

---

## Task 11: 收尾（INDEX / project_status / changelog）

**Files:**
- Modify: `docs/superpowers/INDEX.md`
- Modify: `docs/project_status.md`
- Modify: `docs/changelog.md`

- [ ] **Step 11.1: INDEX 把本 plan 从 in_progress 移到 resolved**

Modify `docs/superpowers/INDEX.md` Plans 段 → 添加条目 + 把设计 spec 从 in_progress 移到 resolved。

- [ ] **Step 11.2: project_status.md 最近关键决策追加落地条目**

```
- 2026-04-19 元系统进化 10 机制落地（T1 8 + T2 2）：PostToolUse Bash 失败捕获 / UserPromptSubmit 纠错词计数 / 1% 强触发语 / fallback_for_toolsets / memory audit / max retries=3 / fresh session / kill switch / Retrospective 2.0 / Review 外化。commits: <8-10 个 hash>。`AI_SYSTEM_EVOLUTION_DISABLE=1` 一键关闭。
```

- [ ] **Step 11.3: changelog.md 追加**

按现有格式追加 "2026-04-19 System Evolution T1+T2" 条目，列 10 机制。

- [ ] **Step 11.4: Commit**

```bash
git add docs/superpowers/INDEX.md docs/project_status.md docs/changelog.md
git commit -m "docs(status): 系统进化 10 机制落地收尾 — INDEX + project_status + changelog"
```

---

## 验收清单（全 Task 完成后逐项 tick）

- [ ] `scripts/hooks/post-tool-failure-capture.sh` 存在且 executable；mock stdin 测试 exit 0 + 追加日志
- [ ] `scripts/hooks/user-correction-counter.sh` 存在且 executable；mock "不对" 2 次返回 ⚠️，3 次返回 🛑；mock "不是今天" 不触发
- [ ] `.ccb/counters/.gitignore` 存在
- [ ] `.claude/settings.json` 含两个新 hook 注册
- [ ] `docs/memory-audit-log.md` 存在并有 init 行
- [ ] `CLAUDE.md` 含 1% 强触发语 + memory audit 契约 + kill switch 条款
- [ ] `session-rules/SKILL.md` 规则 3 量化 + 规则 6 fallback + meta kill switch 引用
- [ ] `task-execution/SKILL.md` 含 retry_count 持久化路径 + review 硬 check
- [ ] `structured-dispatch/SKILL.md` + `ccb-protocol.md` 含 fresh session 条款
- [ ] 3-4 skill frontmatter 含 `fallback_for_toolsets`
- [ ] `retrospective/SKILL.md` 含段 4 + 段 5 + 自动触发路径
- [ ] `session-init/SKILL.md` Step 2 含扫 `.ccb/counters/`
- [ ] `docs/superpowers/INDEX.md` · `project_status.md` · `changelog.md` 全部更新

## Kill Switch 验证

Run: `export AI_SYSTEM_EVOLUTION_DISABLE=1 && echo '{"tool_name":"Bash","tool_response":{"exit_code":1}}' | bash scripts/hooks/post-tool-failure-capture.sh`
Expected: exit 0，无任何 log 写入，stdout 为空。

## Rollback

每机制独立 commit。出问题：`git revert <single-commit-hash>`，分钟级恢复。总开关：`AI_SYSTEM_EVOLUTION_DISABLE=1`。

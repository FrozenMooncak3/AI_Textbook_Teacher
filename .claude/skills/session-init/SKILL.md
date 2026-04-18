---
name: session-init
description: CEO 仪表盘 + git 状态 + INDEX 扫描。Session 首次启动时调用；compact/resume 后通过 .ccb/session-marker 跳过重读，仅刷新仪表盘。
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill.
</SUBAGENT-STOP>

# Session Init

启动项目上下文，输出 CEO 仪表盘，注入 session-wide 运行规则。

---

## Step 0: Compact/Resume Detection

```bash
test -f .ccb/session-marker && echo "RESUME" || echo "FRESH"
```

- 如果输出 `RESUME`：跳过 Step 1-2 完整重读，只跑 git status + 输出"恢复"型仪表盘（一行：`📊 已从 compact/resume 恢复，最近 commit: <git log -1 --oneline>`），然后 exit。
- 如果输出 `FRESH`：继续 Step 1。

---

## Step 1: Load Context (parallel reads)

Read ALL of these in parallel:

| Source | What to extract |
|--------|----------------|
| `docs/project_status.md` | Current milestone, next step, blockers |
| `docs/journal/INDEX.md` | Open / in_progress / parked 项的 1 行摘要 + keywords |
| `docs/research/INDEX.md` | 调研知识库索引 |
| `docs/superpowers/INDEX.md` | Specs / plans 索引 |
| `docs/architecture.md` `## 0. 摘要卡` | 表名 + 接口契约 + ⚠️ 约束（不读 §1-N） |
| MEMORY.md | Already in context (auto-loaded) — note user preferences and feedback |

Also run:

| Command | What to extract |
|---------|----------------|
| `git log -10 --oneline` | Recent work |
| `git log -1 --format=%ci` | Last commit timestamp (for detail level) |
| `git status` | Uncommitted changes, unpushed commits |
| `ls .ccb/inbox/claude/ 2>/dev/null` | Unread messages from Codex/Gemini (completion reports, questions) |
| `ls .codex-report.md .gemini-report.md 2>/dev/null` | Fallback reports (wezterm notification failed) |
| `ls docs/superpowers/specs/*-brainstorm-state.md 2>/dev/null` | WIP brainstorm state files — if any exist, read FIRST before rebuilding context from conversation summary |

---

## Step 2: Assess Position

Check for these signals:

| Signal | Meaning |
|--------|---------|
| Uncommitted changes exist | Work in progress, may need to commit |
| Unpushed commits exist | Completed work not yet pushed |
| Spec file exists without matching plan | Design done, needs implementation plan |
| Plan file has unchecked `- [ ]` items | Execution in progress |
| journal INDEX has `open` items | Unresolved issues need attention |
| project_status mentions "未开始" for next milestone | Ready to start next milestone |
| Files in `.ccb/inbox/claude/` | Unread messages — check for completion reports or blockers |
| `.codex-report.md` or `.gemini-report.md` exists | Fallback report — wezterm notification failed, read and process |
| `*-brainstorm-state.md` in specs/ | WIP brainstorm in progress — read the WIP file FIRST for full decision history (summary will drop sub-decision rationale); also check MEMORY.md for a matching pointer |

**停车场深度扫描**：逐条读取 journal INDEX 中每个 parked 项的**完整 journal 文件**（不只看标题），按以下三个维度检查：

| 维度 | 检查方法 | 示例 |
|------|---------|------|
| **触发条件到期** | parked 项写了"XX 时做"→ 检查该条件是否已满足或过期 | "M2 开始时装 skill"→ M2 已完成 → 已过期，必须拉出 |
| **基础设施影响** | 该项是否影响 CCB 派发、开发工具链、测试流程等横切关注点 | 文件消息发送失败 → 影响所有后续派发 → 必须拉出 |
| **功能关联** | 该项是否与当前/即将开始的里程碑功能直接相关 | 测试 Dashboard → 和 M3 考官相关但非核心 → 可继续停着 |

命中前两个维度的项必须在仪表盘中标出并给出"立即处理"建议，不能以"继续停着"敷衍。第三个维度按关联强度判断纳入 vs 继续停。

---

## Step 3: CEO 仪表盘

**详略**：距上次 commit ≤1 天 且 commit 数 ≤3 走精简版（跳过"近期完成"，停车场只列相关项），否则完整版。

```
═══ 项目仪表盘 ═══

📊 项目进度
  当前：[里程碑] — [状态]
  已完成：M0 ✓ M1 ✓ ...
  下一个：[里程碑]

⚡ 需要你决策
  1. [描述] — 推荐：[X]，理由：[一句话]
  （无则显示"无"）

🅿️ 停车场扫描
  🚨 需要立即处理（触发条件到期 / 基础设施影响）：
    - [想法名] — 原因：[为什么]，建议：[行动]
  📋 与当前里程碑相关：
    - [想法名] — 建议：纳入 [MX] / 继续停着
  其他停着的：N 条

⚠️ 风险/阻塞
  - [描述]（无则"无"）

✅ 近期完成（精简版跳过）
  - [git log 摘要，最多 3 条]

═══════════════════
```

输出仪表盘后，运行 `mkdir -p .ccb && touch .ccb/session-marker`（后续 compact/resume 经 Step 0 跳过；用户删 marker 即强制重载），然后问"要做什么？" 等用户指令。

---

## 行为契约

- **主动执行**运行规则，不等用户提醒
- **主动判断**想法分流，不问用户"该放哪"
- **不替代用户做产品决策** — 需要决策的事列在仪表盘"需要你决策"板块，等用户拍板
- **不在 Codex/Gemini 工作时打断它们** — 查进度只通过 git/文件，不碰它们的 session

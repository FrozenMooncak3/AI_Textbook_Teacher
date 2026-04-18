---
name: session-init
description: CEO 仪表盘 + git 状态 + 停车场扫描。Fresh session 调用；compact/resume 后通过 .ccb/session-marker 跳过重读，仅刷新仪表盘。project_status.md 已由 SessionStart hook 注入到 context，无需重读。
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill.
</SUBAGENT-STOP>

# Session Init

SessionStart hook 已把 `docs/project_status.md` 注入 system prompt。本 skill 负责：git 状态、停车场扫描、仪表盘汇报。

---

## Step 1: Resume / Fresh 判断

```bash
test -f .ccb/session-marker && echo "RESUME" || echo "FRESH"
```

- `RESUME`：只跑 `git status` + `git log -1 --oneline`，输出一行恢复型仪表盘（`📊 已从 compact/resume 恢复，最近 commit: <摘要>`），exit。
- `FRESH`：继续 Step 2。

---

## Step 2: 收集当前状态

并行跑：
- `git log -10 --oneline`、`git log -1 --format=%ci`、`git status`
- `ls .ccb/inbox/claude/ 2>/dev/null`（未读消息）
- `ls .codex-report.md .gemini-report.md 2>/dev/null`（fallback 报告）
- `ls docs/superpowers/specs/*-brainstorm-state.md 2>/dev/null`（WIP brainstorm，若存在先读）

---

## Step 3: 停车场扫描

读 `docs/journal/INDEX.md` 的 parked 段，按三维度判断：
- **触发条件到期**（"M2 开始时做"→ M2 已完成 → 必须拉出）
- **基础设施影响**（影响 CCB 派发 / 工具链 / 测试 → 必须拉出）
- **功能关联**（与当前里程碑关联强度 → 纳入 vs 继续停）

命中前两维的必须列入"立即处理"并给行动建议。

---

## Step 4: 输出仪表盘

**详略**：距上次 commit ≤1 天且 commit 数 ≤3 → 精简版（跳过"近期完成"，停车场只列相关项）；否则完整版。

```
═══ 项目仪表盘 ═══
📊 项目进度：当前 [里程碑 + 状态] / 下一步 [X]
⚡ 需要你决策：1. [描述] — 推荐：[X]（无则"无"）
🅿️ 停车场扫描：
  🚨 立即处理：- [项] 原因 / 建议
  📋 相关：- [项] 建议
  其他停着的：N 条
⚠️ 风险/阻塞：- [X]（无则"无"）
✅ 近期完成（精简版跳过）
═══════════════════
```

输出后：`mkdir -p .ccb && touch .ccb/session-marker`。

> Marker 生命周期由 `.claude/settings.json` 的 SessionStart hook 管理（`startup|clear` 时 rm，`compact|resume` 保留）。

然后问"要做什么？"。

---

## 行为契约

- 不重读 `docs/project_status.md`（已由 hook 注入）
- 不主动读 `docs/journal/INDEX.md` 以外的 INDEX（research / superpowers 索引按需读）
- 主动判断想法分流，不问"该放哪"
- 不替代用户做产品决策 — 列在"需要你决策"等拍板

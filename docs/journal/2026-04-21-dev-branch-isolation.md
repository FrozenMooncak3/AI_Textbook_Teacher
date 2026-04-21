# 里程碑开发必须先切隔离分支/版本

**日期**: 2026-04-21
**分类**: 工程流程
**Tier**: T1（下个里程碑 M5 开始前必做）
**状态**: parked

## 触发事件

M4.5 session 跑到 Task 7 之后闪退。恢复时发现：
- master 分支 = 生产分支（Vercel 自动部署）
- T1-T7 的每个 commit 都已 push 到 master → 生产环境在跟着同步
- T7（upload page 重写）commit `8e497a8` 已上线，但 Task 8 `/books/[bookId]/preparing` 页还没建 → **生产环境点 PDF 上传后跳 404**

用户发现后问"现在我们改是在开发版本改的吗"——明显是负面信号。

## 当前规则（session-rules 规则 4）

> 当前阶段直接在 master 上开发（单人 + CCB 串行派发，出问题 git revert 即可）。Worktree/分支隔离为**可选**，不强制。

这条规则在 M4 / 云部署 / 元系统进化等多个里程碑上一直 work，但 M4.5 因 session 闪退暴露了半成品中间态直达生产的风险。

## 要做的事

**M5 开始前**（brainstorming 启动 / writing-plans 之前）必须决策：
1. 是否把 session-rules 规则 4 从"可选"升级为"里程碑级必须 worktree"
2. 如果升级，更新 `.claude/skills/session-rules/SKILL.md` 规则 4 文案
3. 如果不升级，保留现状但在 CLAUDE.md 补一条"里程碑中途不得 force push master / 必须一次性推完再切换里程碑"

**不要等到 M5 开始 brainstorm 时才想这件事**——`using-git-worktrees` skill 已经在 session-rules 规则 3 表里列为"里程碑开始触发"，但因规则 4 说可选，一直跳过。这次要把它拍成 T1 硬规。

## 反对意见（诚实记录）

- 单人单机 + CCB 串行派发的确降低了冲突概率
- Worktree 每个里程碑多一步切换成本
- M4 / 云部署都没踩这个坑

**但是**：session 闪退是不可控事件，master=prod 的模型在恢复期会暴露未完成中间态。闪退概率低 ≠ 后果可接受。

## 要避免的反模式

- 不要在 M5 brainstorm 时又用"M4 没事"为由跳过这条
- 不要把本条当成 MVP 后再议——session 闪退下周还可能发生

## Refs

- 事件上下文：M4.5 session crash 2026-04-21
- 相关 skill：`using-git-worktrees`, `session-rules` 规则 4
- CLAUDE.md 部署段：master → Vercel auto-deploy

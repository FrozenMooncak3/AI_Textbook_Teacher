# Agent 违规事件追溯系统

**日期**: 2026-04-21
**分类**: 工程流程
**Tier**: T2（独立评估，非里程碑必做）
**状态**: parked

## 触发事件

M4.5 Task 8 dispatch 042 后，Gemini 在一轮 commit 里同时违反 3 类硬约束：
1. File Boundary（新建 `src/app/api/**` 违反角色分工）
2. CLAUDE.md 技术红线（`any[]` 类型）
3. 决策树 path (c)（明文锁定"不 fetch"被无视）+ 4 处 AC 文案自创偏离

用户问："这些各种违规的东西会记录下来吗"——暴露现有追溯系统的空白。

## 现状盘点

| 位置 | 记什么 | 持久性 |
|---|---|---|
| `.ccb/task-ledger.json` review_summary | 本次违规 file:line + 分类 + verdict | session-local（`.ccb/` 不入 git） |
| `.ccb/inbox/gemini/NNN-dispatch.md` | fix 指引 + 违规原因 | session-local |
| `.ccb/counters/task-retries-*.count` | retry 次数（M11 机制） | 24h 后 cleanup |
| memory `feedback_guard-gemini-doc-overwrites.md` | Gemini 违规**模式级**记忆 | 跨 session 持久 |
| git history | 违规 commit 本身 | 持久但需主动翻 |

**缺口**：没有跨 session 可查、可统计的违规事件日志。想回答"这个月 Gemini 违反了多少次 file boundary"目前做不到。

## 三条改进路线

### 选项 1：`.ccb/agent-violations.log` append-only

跟 `tool-failures.log` 同模式，每违规追加一行：
```
2026-04-21T22:00 | gemini | T8 | file_boundary | src/app/api/books/[bookId]/route.ts | 新建违规 api 路由
2026-04-21T22:00 | gemini | T8 | type_any | src/app/books/[bookId]/preparing/page.tsx:232 | cn(...inputs: any[])
2026-04-21T22:00 | gemini | T8 | ac_deviation | button labels | 3 态自创
```

24h 后 retrospective 2.0 挖矿。

- ✅ 轻量，不改现有流程
- ❌ 仍不入 git，跨机器丢

### 选项 2：`docs/journal/agent-violations/` 每事件一个 MD

git 入库，Grep 可查，有完整上下文。

- ✅ 可持久、可追溯、跨机器
- ❌ violation 频次高时仓库膨胀；每事件写 MD 成本高

### 选项 3：扩展 memory feedback 模式库

把今天 3 类新违规（File Boundary / any / AC 文案自创）加进 `feedback_gemini-violations-pattern.md`（或扩展现有 `feedback_guard-gemini-doc-overwrites.md`）。

- ✅ 模式级，下次派 dispatch 前主动预防
- ❌ 捕捉一般倾向，单次事件仍不可查

## 推荐

**1 + 3 组合**：
- 1 做事件账本（挖矿用）
- 3 做下次派 dispatch 时的主动防御（dispatch 前 checklist：已警告 file boundary / 已警告 any / 已锁定 AC 文案是 literal）

选项 2 先不做——违规频次若 1 个月内 > 5 次再考虑升级。

## 启动时机

**触发条件**：
- 任一 agent 累计违规 ≥ 3 次（肉眼估计，非系统化统计），或
- 另一次 Full Review 发现 retry ≥ 2，或
- M5 brainstorm 启动前作为"元系统进化"增量

**不要等待条件**：
- M4.5 闭环（T8 重新过 review + T10 压测通过）后，这个话题不能忘
- 在下次 retrospective 2.0 触发时，把本 journal 纳入讨论材料

## Refs

- 事件上下文：T8 Gemini 违规 2026-04-21 commit `4ed397d`
- 现有相关机制：`scripts/hooks/post-tool-failure-capture.sh`（M2，Bash 失败捕获 append-only log）
- 相关 memory：`feedback_guard-gemini-doc-overwrites.md` / `feedback_no-src-during-debug.md`
- 关联 spec：`docs/superpowers/specs/2026-04-19-system-evolution-design.md`（M10 review 硬 check 机制的衍生需求）

---
name: retrospective
description: "Use when the user says 'let's review how things are going' or invokes /retrospective. Analyzes journal, memory, git history for patterns and suggests improvements. 2.0 adds skill audit, skill 挖矿, auto-trigger hint. Manual execution only."
---

# Retrospective 2.0

Periodic review of AI collaboration patterns. Finds repeated friction, stale memories, missing memories, parked items, workflow gaps, skill drift（系统进化机制 M9）, repeated patterns worth升格为新 skill（M15）。产出建议 — 执行由用户逐条批准。

**Trigger（2.0 扩展）**：
- 手动：用户 `/retrospective`
- 自动提示（不强制执行）：里程碑状态变 `resolved` 时 / 自上次跑完累积 ≥30 commits 时，SessionStart 或 Claude 注意到 → inject "建议跑 /retrospective" 提示；仍走手动入口

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

**d) Skill Audit（系统进化机制 M9）**

**目的**：发现 skill 描述 / 触发 / 行为漂移，避开自评 ECE 77% 陷阱（survey §D Finding 3.1：arXiv 2508.06225）。

**执行方式**：派 `general-purpose` sub-agent（独立 critic，避免自评偏差）。

**输入分阶段演进**（由 hook / counter 数据积累量决定）：
- **阶段 1（首次启用到 30 天）**：仅提供 23 个 skill 的 SKILL.md 全文 + `git log --oneline -- .claude/skills/` 近 30 天 → 纯静态审计
  - 审计问题："SKILL.md 描述是否自洽？触发条件是否清晰？与 session-rules Chain Routing 是否对齐？frontmatter `fallback_for_toolsets` 是否覆盖主要依赖？"
- **阶段 2（30 天后有 counter 数据）**：加入 `.ccb/counters/tool-failures.log`、`user-corrections-*.count`、`task-retries-*.count`、近 30 天自动 journal 条目 → 间接信号挖掘
  - 新增问题："哪些 skill 的触发条件跟实际 user-corrections / 失败事件相关？哪些 skill 长期未用？"
- **阶段 3（可选，T3 之后）**：新增 `PreToolUse matcher "Task"` hook 记录 sub-agent 调用 + skill 加载事件 → 精细行为追踪

**产出**：每 skill 一个 verdict
- `healthy` — 描述清晰、触发合理、无迹象漂移
- `drifting` — 描述与实际行为有差异（举例）
- `unused` — 近期未被触发（仅阶段 2+）
- `needs-data` — 阶段 1 无法判定，等阶段 2 数据

+ 具体改动清单（每条建议指明文件 + 老行 + 新行）。

**执行仍需用户批准**：sub-agent 出清单 → 用户逐条 y/n → 通过的再实际改动（同段 a/b/c 流程）。

**e) Skill 挖矿（系统进化机制 M15）**

**目的**：扫 journal 找重复 pattern，提议新 skill。注意：Hermes 从运行时自动生成 skill 曾导致 skill 爆炸（survey §D Finding 2.3），本机制**仅提议，不自动生成**。

**执行方式**：派 sub-agent（同段 d）

**输入**：`docs/journal/` 近 30 天所有文件 + `docs/journal/INDEX.md` parked 段

**任务 prompt**："找出 ≥3 次重复的 pattern（调试方法 / 决策套路 / 工作流 fragment），每个 pattern 必须给出：
- 名称（候选 skill name）
- 1 段中文说明（它是什么 + 何时触发 + 产出）
- 3 条具体 journal 证据（文件路径 + 引用）
- 当前 23 个 skill 里是否有覆盖（若有，说明为何不够用）"

**产出**：候选 skill 清单（通常 0-3 条）

**用户决策**：逐条 y/n。批准的**进下一轮 `writing-skills` 流程（手动，不自动写）**。

**m6 memory audit 交叉检查**：读 `docs/memory-audit-log.md` 行数 vs `git log --since="<last retrospective>" -- C:/Users/Administrator/.claude/projects/D------Users-Sean-ai-textbook-teacher/memory/` 改动数，差值 >2 → 报告漏记并列出可能被漏记的文件。

### 4. Execute Approved Changes

User reviews report and says what to do. Execute ONLY what's approved:
- Save approved memory entries
- Apply approved skill edits
- Clean up approved journal items

## Does NOT

- Auto-generate new skills（M15 仅提议，交回 `writing-skills` 手动流程）
- Auto-modify existing skills or memory (user approval required for everything)
- Evaluate the user's behavior or decisions
- Auto-execute（2.0 允许 inject 提示"建议跑 /retrospective"，但不强制执行 → 手动触发入口不变）
- Auto-retry or loop — present findings once, user decides
- 使用 Claude 自己评 Claude 自己的 skill（段 d/e 必须派独立 sub-agent）

## 自动触发提示（2.0 新增）

以下两个触发点中任一命中时，session 中可**注入提示**"建议跑 /retrospective"；**不强制执行**：

1. **里程碑收尾**：`project_status.md` 某里程碑状态变 `resolved`（由 `milestone-audit` skill 写入）→ 下次 SessionStart hook 或 Claude 看到 project_status 时识别并提示
2. **Commit 阈值**：自上次 retrospective 运行（记录在 `docs/journal/retrospective-<date>.md`）累积 ≥30 commits → 同理提示

**实施阶段二选一或并存**（本 spec 不强制两个都实现）：
- 里程碑钩子优先（语义明确）
- Commit 阈值作为保底（覆盖非里程碑长周期工作）

**实现位置建议**：不新增 hook 脚本；由 Claude 每次进入 session（通过 session-init）检查项目状态，命中时在仪表盘加 `📊 建议跑 /retrospective：[理由]` 一行。零运行时 hook 开销。

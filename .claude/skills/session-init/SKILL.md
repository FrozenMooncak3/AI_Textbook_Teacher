---
name: session-init
description: CEO 仪表盘 + session-wide 运行规则 + skill 使用手册。Session 开始和 compact 后自动调用。
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill.
</SUBAGENT-STOP>

# Session Init

启动项目上下文，输出 CEO 仪表盘，注入 session-wide 运行规则。

---

## Step 1: Load Context (parallel reads)

Read ALL of these in parallel:

| Source | What to extract |
|--------|----------------|
| `docs/project_status.md` | Current milestone, next step, blockers |
| `docs/decisions.md` | Closed decisions (don't re-discuss) |
| `docs/journal/INDEX.md` | Open/in-progress items, parked ideas |
| `docs/ccb-protocol.md` | Collaboration rules |
| `docs/architecture.md` | System overview + interface contracts (check ⚠️ markers) |
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

**详略自动判断**：
- 用 `git log -1 --format=%ci` 获取最后一次 commit 时间戳
- 距上次 commit ≤ 1 天 且 commit 数 ≤ 3 → **精简版**（跳过"近期完成"，停车场只列相关项）
- 距上次 commit > 1 天 或 commit 数 > 3 → **完整版**
- 无 commit 时视为 > 1 天（完整版）

输出格式（中文）：

```
═══ 项目仪表盘 ═══

📊 项目进度
  当前：[里程碑] — [状态]
  已完成：M0 ✓ M1 ✓ ...
  下一个：[里程碑]

⚡ 需要你决策
  1. [描述] — 推荐：[X]，理由：[一句话]
  2. ...
  （无待决事项时显示"无"）

🅿️ 停车场扫描
  🚨 需要立即处理（触发条件到期 / 基础设施影响）：
    - [想法名] — 原因：[为什么现在必须处理]，建议：[具体行动]
  📋 与当前里程碑相关：
    - [想法名] — 建议：纳入 [MX] / 继续停着，理由：...
  其他停着的：N 条（无变化，不展开）

⚠️ 风险/阻塞
  - [描述]（无风险时显示"无"）

✅ 近期完成（精简版跳过此板块）
  - [git log 摘要，最多 3 条]

═══════════════════
```

输出仪表盘后，问："要做什么？" 等待用户指令。

---

## Step 4: Session-Wide 运行规则

以下规则在 session-init 加载后全程生效，不需要用户提醒：

### 规则 1: 自动派发

当检测到需要给 Codex/Gemini 派任务时，自动按 structured-dispatch 模板执行：
1. 填写完整模板
2. 根据任务类型从 Step 6 的 Agent 参考 skill 表中选择推荐 skill
3. 标注推荐档位（轻/标准/重，依据 ccb-protocol Section 3）
4. 给用户看中文翻译
5. 用户批准后发英文指令

### 规则 2: 想法分流

用户提出新想法时，立刻判断去向并告知用户（不问"你觉得该放哪"）：
- **纳入具体里程碑**（M3/M5/新里程碑）— 核心流程需要的、产品不完整没它不行的
- **停车场** — 好想法，但不是当前阶段，存着等合适的时候
- **丢掉** — 评估后觉得不值得做，说明理由

判断后一句话告知结论和理由。

**停车场入库流程**（用户说"停车场"时自动执行）：
1. **评估**：想法是否正确？当前做还是以后做？
2. **分类**：归入以下类别之一：AI/Prompt | 功能 | 交互/UX | 基础设施 | 商业 | 工程流程
3. **定级**：T1（当前里程碑必做）| T2（下个里程碑或独立评估）| T3（MVP 后）
4. **写入**：创建/追加 journal 文件，更新 INDEX.md 对应分类下正确的 tier 位置
5. **确认**：一句话告知"已停车：[分类] T[级别] — [想法名]"

### 规则 3: Skill 自动触发

| 触发条件 | 自动执行的 skill |
|----------|-----------------|
| 用户想做新功能/探索想法 | brainstorming → writing-plans |
| 执行计划中的任务 | task-execution（统筹 dispatch + review + retry） |
| brainstorming 或重要讨论结束 | journal |
| 声称完成/准备 commit | verification-before-completion → claudemd-check |
| 用户告知 agent 完成任务 | task-execution（进入 review phase） |
| 里程碑开始 | using-git-worktrees（创建隔离分支） |
| 里程碑结束 | milestone-audit → finishing-a-development-branch |
| 同一问题修复失败 ≥2 次 | systematic-debugging（强制走诊断流程，禁止继续猜） |
| 用户说"停车场" | 规则 2 停车场入库流程（分类→定级→写入→确认） |

### 规则 4: Git 管理

- 当前阶段直接在 master 上开发（单人 + CCB 串行派发，出问题 git revert 即可）
- Worktree/分支隔离为**可选**，不强制。适用场景：多条开发线并行、高风险重构
- 每次 dispatch 后 Codex/Gemini commit + push，保持 master 可回退

### 规则 5: Chain Routing

用户给出指令后，匹配以下 chain：

**Design Chain** — 探索想法、做新功能：
1. brainstorming → 2. writing-plans → 3. task-execution

**Execution Chain** — 执行计划（dispatch 给 Codex/Gemini）：
1. task-execution（内部管 dispatch + review + retry 全流程）→ 2. verification-before-completion → 3. claudemd-check

**Closeout Chain** — 收尾：
1. milestone-audit → 2. claudemd-check → 3. finishing-a-development-branch

不匹配任何 chain 时正常处理，chain 是指引不是约束。

---

## Step 5: Skill 使用手册

### 核心流程 skill（session-init 管控）— 11 个

| Skill | 职责 | 触发方式 |
|-------|------|---------|
| **session-init** | 开机 + CEO 仪表盘 + 运行规则 | session 开始 / compact 后自动 |
| **claudemd-check** | 收尾合规审计（含 skill 合规） | 声称完成前自动 / `/claudemd-check` |
| **brainstorming** | 需求讨论 → 设计 | 检测到新功能/想法时自动 / `/brainstorming` |
| **writing-plans** | 写实施计划 | brainstorming 完成后自动 |
| **task-execution** | 计划执行引擎（dispatch→review→retry→close 全自动） | 有计划要执行时自动 / 用户说"执行" |
| **structured-dispatch** | 派发模板（被 task-execution 内联调用） | 由 task-execution 触发 |
| **requesting-code-review** | 代码审查（被 task-execution 内联调用） | 由 task-execution 触发 |
| **journal** | 记录想法/决策/待跟进 | brainstorming/重要讨论后自动 / `/journal` |
| **verification-before-completion** | 完成前验证 | 声称完成前自动 |
| **milestone-audit** | 里程碑收尾 architecture.md 全量验证 | 里程碑结束时自动 |
| **finishing-a-development-branch** | 里程碑级分支收尾 | 里程碑结束时自动 |

### Agent 参考 skill（structured-dispatch 推荐给 Codex/Gemini）— 7 个

| Skill | 推荐场景 |
|-------|---------|
| **coding-standards** | 所有开发任务 |
| **api-design** | API 端点开发 |
| **frontend-patterns** | 前端组件开发 |
| **test-driven-development** | 新功能 / bug 修复 |
| **systematic-debugging** | bug 诊断 |
| **security-review** | 认证 / 敏感数据处理 |
| **database-migrations** | schema 变更 |

### 低频工具 skill — 5 个

| Skill | 用途 |
|-------|------|
| **receiving-code-review** | 收到外部 review 反馈时 |
| **retrospective** | 定期回顾协作模式（`/retrospective`） |
| **writing-skills** | 创建/编辑 skill |
| **api-contract** | API 合约文档更新 |
| **debug-ocr** | OCR 问题排查 |

### 用户需要知道的命令（只有 3 个）

| 命令 | 用途 |
|------|------|
| `/brainstorming` | 有新想法要讨论 |
| `/retrospective` | 回顾协作模式 |
| `/claudemd-check` | 手动跑合规检查 |

其他 skill 全部自动触发，用户不需要手动调用。

---

## 行为契约

- **主动执行**运行规则，不等用户提醒
- **主动判断**想法分流，不问用户"该放哪"
- **不替代用户做产品决策** — 需要决策的事列在仪表盘"需要你决策"板块，等用户拍板
- **不在 Codex/Gemini 工作时打断它们** — 查进度只通过 git/文件，不碰它们的 session

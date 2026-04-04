# Task Execution Skill 设计

> 统一执行引擎——把 dispatch、review、状态跟踪、重试决策、完成清单整合为一个 skill。

---

## 1. 问题陈述

M5.5 内部审计发现 5 个系统性问题：

| # | 问题 | 证据 |
|---|------|------|
| 1 | 该不该 review 全凭感觉 | 7 个任务只有 1 个做了正式 review；风险最高的 T4 反而没 review |
| 2 | review-fix 循环无上限 | T1 修了 3 轮，其中 2 轮是 dispatch 编码问题而非实现错误 |
| 3 | 任务状态全在脑子里 | T7（Codex）没有 report、changelog、review，commit 是唯一证据 |
| 4 | 人工通知是瓶颈 | 用户必须手动告知"Codex 做完了"，Claude 才能介入 |
| 5 | 完成步骤容易漏 | T7 没更新 changelog，也没跑任何收尾检查 |

**根因：** 有好的单点工具（structured-dispatch、requesting-code-review、verification-before-completion），但没有统筹 skill 把它们串成流水线。

---

## 2. 设计目标

1. 一个 skill 管理从"计划已写好"到"所有任务完成"的全过程
2. 每个任务有明确的状态机，状态变更有记录
3. review 级别基于规则决策，不凭感觉
4. review-fix 循环有上限，超限自动 escalate
5. 状态转换绑定强制清单，不能跳过
6. 与现有 skill 生态兼容（调用而非替代 structured-dispatch 和 requesting-code-review）

---

## 3. 核心设计

### 3.1 Task Ledger（进度文件）

新增 `.ccb/task-ledger.json`，与计划文件分离。计划文件描述"要做什么"（稳定），ledger 描述"做到哪了"（频繁更新）。

```json
{
  "milestone": "M6",
  "plan_file": "docs/superpowers/plans/2026-04-05-m6-plan.md",
  "tasks": [
    {
      "id": "T1",
      "title": "Sidebar navigation",
      "assignee": "gemini",
      "state": "done",
      "review_level": "full",
      "retry_count": 1,
      "failure_type": null,
      "dispatch_file": ".ccb/inbox/gemini/001-dispatch.md",
      "report_file": ".ccb/inbox/claude/001-report.md",
      "commits": ["abc1234"],
      "advisory_count": 0,
      "blocking_issues": [],
      "checklist": {
        "changelog": true,
        "ledger_updated": true
      }
    }
  ]
}
```

**设计决策：** JSON 而非 Markdown，因为需要被 skill 机械化读写。人类可读性通过 skill 输出到终端的格式化摘要解决。

### 3.2 任务状态机

```
READY ──→ DISPATCHED ──→ IN_REVIEW ──→ DONE
                              │
                     [Blocking found]
                              │
                    ┌─────────┴─────────┐
                    │                   │
              implementation_error  spec_mismatch
              & retry < 2          or retry >= 2
                    │                   │
              retry_count++         ESCALATED
              re-dispatch               │
                    │              [人工决策]
                    ↓              重置/换人/拆分/跳过
               DISPATCHED
                              
任何状态 ──→ SKIPPED（仅人工触发）
```

| 状态 | 含义 | 进入条件 |
|------|------|---------|
| `ready` | 依赖已满足，可以派发 | 计划加载时初始化；前置任务 done |
| `dispatched` | 已写入 inbox，已发通知 | structured-dispatch 完成，或 fix re-dispatch |
| `in_review` | worker 报告完成，Claude 正在审查 | 收到 report / 用户通知 / 恢复时 git 检测到新 commit |
| `done` | review 通过，转换清单已完成 | review 判定 Pass + 清单全勾 |
| `escalated` | retry 上限或理解偏差，等待人工决策 | retry_count >= 2 或 failure_type = spec_mismatch |
| `skipped` | 人工决定不做了 | 用户指令（可从任何状态进入） |

**注意：** `recycling` 不是持久化状态。Recycle 决策是一个即时动作：increment retry_count → re-dispatch → ledger 直接写回 `dispatched`。这确保 session compact 后恢复时，看到的是 `dispatched`（明确下一步：等完成），而非 `recycling`（歧义：是在修还是在等？）。

**状态转换规则（完整）：**
- `ready` → `dispatched`：dispatch 文件已写入 inbox
- `dispatched` → `in_review`：收到 report 或用户通知，或恢复时 git 检测到新 commit
- `in_review` → `done`：review 判定 Pass 且转换清单全勾
- `in_review` → `dispatched`：review 判定 Recycle，retry_count += 1（在 dispatch fix 之前递增），重新派发
- `in_review` → `escalated`：retry_count >= 2，或 failure_type 为 `spec_mismatch`
- `escalated` → `ready`：人工决策"修改 spec 后重做"（retry_count 重置为 0）
- `escalated` → `skipped`：人工决策"不做了"
- **任何状态** → `skipped`：仅人工触发（包括 ready/dispatched/in_review/escalated）

### 3.3 Review 级别决策

review 不是"做或不做"，是三级：

| 级别 | 条件 | 动作 |
|------|------|------|
| **Full Review** | 改动 >2 文件，或触及 architecture.md 接口契约，或新增 API/组件 | subagent 审 spec 合规 + Claude 审品质（双层） |
| **Spot Check** | 改动 1-2 文件，已有 pattern 的实现 | Claude 直接读 diff，不派 subagent |
| **Auto-Pass** | 纯机械操作：重命名、文案修改、格式调整 | 只验证 build 通过 |

**决策规则（可编码）：**
```
if task touches interface contracts in architecture.md → Full
if task creates new API endpoint or component → Full
if task modifies >2 files → Full
if task modifies 1-2 files with known pattern → Spot Check
if task is rename/format/copy → Auto-Pass
```

review 级别在 dispatch 时基于 task spec 预估并写入 ledger。agent 完成后，检查实际 diff：如果实际改动范围超过预估（如预估 Spot Check 但实际改了 >2 文件或触及接口契约），**自动升级**到 Full Review。只能升不能降。

### 3.4 Circuit Breaker（重试上限）

**失败分类（review 时判定）：**

| 类型 | 定义 | 动作 |
|------|------|------|
| `implementation_error` | 代码写错、逻辑不对、漏改文件 | Recycle（可重试） |
| `spec_mismatch` | 对需求理解有偏差、架构方向错误 | 立即 Escalate（重试不会收敛） |
| `infra_error` | dispatch 编码乱码、环境问题 | 修基础设施，不计入 retry_count |

**重试规则：**
- `implementation_error`：最多重试 2 次（共 3 次尝试）。第 3 次仍 Blocking → Escalate
- `spec_mismatch`：0 次重试，直接 Escalate
- `infra_error`：修复后正常继续，retry_count 不变

**Escalate 后：** 人工决策，选项为：
1. 修改 spec 后重新 dispatch（retry_count 重置）
2. 换 agent 重新 dispatch
3. 拆分任务
4. 跳过（标记 skipped）

**模型档位：** 统一使用最高档（Codex: gpt-5.4 high / Gemini: gemini-2.5-pro）。不做档位选择，不做自动降档。CCB protocol Section 3 的三档规则在本 skill 中不适用。

### 3.5 质量门（Review 判定）

review 产出分三层：

| 层级 | 标签 | 定义 | 影响 |
|------|------|------|------|
| **Blocking** | 必须修 | 违反 spec、破坏现有功能、违反产品不变量 | 触发 Recycle |
| **Advisory** | 建议修 | 代码质量、命名、小效率问题——正确但可改进 | 记录，不阻塞，攒够一批统一处理 |
| **Informational** | 备注 | 观察、建议、替代方案 | 写入 review notes，不行动 |

**判定逻辑：**
- 有任何 Blocking → Recycle（除非触发 circuit breaker）
- 只有 Advisory + Informational → Pass
- Advisory 累计 >5 条 → 建议安排一个 cleanup task（不阻塞当前）

### 3.6 转换清单

每个状态转换绑定必须完成的步骤。skill 在更新 ledger 状态之前检查清单：

| 转换 | 清单 |
|------|------|
| → `dispatched` | dispatch 文件已写入 inbox；ledger 已更新 |
| → `in_review` | report 已收到或用户已确认完成；commit hash 已记录 |
| → `done` | review 通过；changelog 已更新（非 Auto-Pass 级别）；ledger 已更新 |
| 最后一个任务 → `done` | 以上 + project_status.md 已更新；architecture.md 已检查 |

清单未全勾 → 状态不变，skill 提示"还差 X 步"。

---

## 4. Skill 工作流

### 4.1 启动

```
用户指令："执行 M6 计划" / skill 自动触发
    ↓
1. 读计划文件
2. 如果 task-ledger.json 不存在 → 初始化（所有任务 state=ready）
3. 如果已存在 → 恢复进度（找到第一个非 done/skipped 的任务）
4. 输出当前进度摘要
```

**断点续跑：** skill 重新加载时（compact 后、新 session），从 ledger 恢复，不需要从头开始。

**恢复时自动检测完成：** 如果当前任务 state=`dispatched`，skill 自动执行：
1. 读 ledger 获取 assignee 和已知最后 commit
2. `git log --oneline --author=<assignee_email>` 检查是否有新 commit
3. 有新 commit → 输出 "检测到 [assignee] 有新提交 [hash]，建议进入 review"，用户确认后转 `in_review`
4. 无新 commit → 输出 "任务仍在执行中，等待完成"

这提供了一个轻量级的完成检测机制，不需要修改 agent 指令文件，不需要用户手动通知。

### 4.2 单任务循环

```
for task in plan.tasks:
    if task.state == 'done' or 'skipped': continue
    
    # Phase 1: 派发
    estimate review_level from task spec (Section 3.3 rules)
    write to ledger: review_level
    follow structured-dispatch sub-procedure:
        - check architecture.md interface contracts
        - fill dispatch template
        - show Chinese translation to user for approval
        - user approves → write to inbox + send notification
    update state → dispatched
    
    # Phase 2: 等待
    wait for: user notification
    (或 session 恢复时：git log 检测 agent 新 commit → 建议进入 review)
    update state → in_review
    
    # Phase 3: 审查
    check actual diff scope → upgrade review_level if needed
    follow requesting-code-review sub-procedure (at determined level):
        - Full: dispatch subagent + Claude quality review
        - Spot Check: Claude reads diff directly
        - Auto-Pass: verify build only
    classify findings → Blocking / Advisory / Informational
    
    # Phase 4: 判定
    if no Blocking:
        run transition checklist (Section 3.6)
        update state → done
        → next task
    else:
        classify failure type (implementation_error / spec_mismatch)
        if spec_mismatch → update state → escalated, wait for human
        if retry_count >= 2 → update state → escalated, wait for human
        else:
            retry_count += 1 (increment BEFORE dispatch)
            dispatch fix with specific Blocking issues listed
            update state → dispatched (直接，不经过中间状态)
            → back to Phase 2
```

**"调用" skill 的机制说明：** Claude Code 的 skill 是指令文档，不是可调用的函数。task-execution 的 SKILL.md 将 structured-dispatch 和 requesting-code-review 的核心流程**内联为子步骤**（引用它们的 SKILL.md）。Claude 在执行 task-execution 时，按顺序读取并遵循这些子步骤的指令。用户审批 dispatch 仍然保留（CCB 协议 Section 2 要求）。

### 4.3 收尾

```
all tasks done:
    输出里程碑进度摘要
    提示触发收尾链：verification → claudemd-check → milestone-audit
```

---

## 5. 与现有 Skill 的关系

| 现有 Skill | 变化 |
|-----------|------|
| `structured-dispatch` | **保留为参考文档**。task-execution 内联其核心流程（interface contract check → template → user approval → send）作为 Phase 1 子步骤 |
| `requesting-code-review` | **保留并增强**。增加 review level 参数：Full（现有流程）/ Spot Check（Claude 直接读 diff，不派 subagent）/ Auto-Pass（只验证 build）。统一 severity 术语为 Blocking/Advisory/Informational（替代原 Critical/Important/Minor） |
| `executing-plans` | **不再使用**。本项目 Claude 不写业务代码（文件边界：只写 docs/skills/指令文件）。所有代码任务均 dispatch 给 Codex/Gemini。executing-plans 的 subagent 自执行模式不适用于本项目 |
| `verification-before-completion` | **保留**，在收尾链中。task-execution 完成后触发 |
| `session-init` | **更新 chain 声明**：Dispatch Chain 简化为 task-execution → verification → claudemd-check |

### 新文件

| 文件 | 用途 |
|------|------|
| `.claude/skills/task-execution/SKILL.md` | skill 主体 |
| `.ccb/task-ledger.json` | 运行时进度文件（不提交 git） |

---

## 6. 暂不实现（明确排除）

| 项目 | 理由 |
|------|------|
| Push-with-ack 全自动完成检测 | 轻量级替代方案已纳入：session 恢复时自动 git log 检测。完整的 push-with-ack（agent 写 ack 文件回 inbox）需要修改所有 agent 指令文件，后续迭代加入 |
| 并行任务调度 | 当前 CCB 串行派发已验证可靠。并行引入竞态风险，等有需求再加 |
| task-ledger 可视化 Dashboard | 当前终端输出摘要够用。Web Dashboard 是锦上添花 |

---

## 7. 成功标准

1. 下个里程碑的每个任务都有明确状态记录（ledger），不再出现"隐形任务"
2. review 级别在 dispatch 前确定，有规则可查，不凭感觉
3. review-fix 循环最多 2 轮自动收敛或 escalate，不再无限循环
4. 完成清单强制执行，changelog/project_status 不再漏更新
5. structured-dispatch 和 requesting-code-review 的手动串联被 task-execution 的自动循环替代

---

## 8. 调研来源

| 方向 | 借鉴 | 来源 |
|------|------|------|
| Circuit Breaker | 重试上限 + 失败分类 | Azure Architecture Center, GitLab CI retry config |
| Quality Gate | 三层严重度（Blocking/Advisory/Informational） | SonarQube Quality Gates |
| Stage-Gate | Pass/Recycle/Kill 三级决策 | Cooper Phase-Gate Model |
| Task Ledger | 计划与进度分离 | Microsoft Magentic-One (task ledger / progress ledger) |
| State Machine | 任务生命周期状态 | LangGraph checkpointing, GitLab CI pipeline states |
| Handoff | Push-with-ack（暂存，未来迭代） | OpenAI Agents SDK |

# Session-Init 升级 + Skill 治理 设计文稿

> 日期：2026-03-29
> 状态：待实施

---

## 1. 背景与问题

### 1.1 用户需求

项目负责人以 CEO/高管视角参与决策，不记忆细节，需要每次 session 自动获得：
- 项目全局状态的结构化报告
- 需要决策的事项及推荐方案
- 停车场中与当前工作相关的想法提醒

### 1.2 当前问题

- session-init 输出是技术状态摘要，不是决策导向的高管报告
- 停车场 parked 项不做交叉分析，导致相关想法被遗漏（M2 期间 "UI/UX Pro Max Skill" 被遗忘）
- 用户提出想法时，分流判断不稳定，有时需要用户提醒
- structured-dispatch 需要手动触发，用户不想每次提醒
- claudemd-check 不审计 skill 使用合规
- 26 个项目 skill 存在冗余和归类混乱（另有 `simplify` 等平台内置 skill，不在项目管控范围内）

---

## 2. 设计方案

### 2.1 CEO 仪表盘（session-init 输出格式）

每次 session 开始输出 5 个固定板块：

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
  与当前里程碑相关：
    - [想法名] — 建议：纳入 [MX] / 继续停着，理由：...
  其他停着的：N 条（无变化，不展开）

⚠️ 风险/阻塞
  - [描述]（无风险时显示"无"）

✅ 近期完成
  - [git log 摘要，最多 3 条]

═══════════════════
```

**详略自动判断**：
- 距上次 session ≤ 1 天 且 变化 ≤ 3 commits → 精简版（跳过"近期完成"，停车场只列相关项）
- 距上次 session > 1 天 或 变化 > 3 commits → 完整版

**判断依据**：用 `git log -1 --format=%ci` 获取最后一次 commit 的时间戳，与当前日期比较。无 commit 时视为 > 1 天（完整版）。

### 2.2 Session-Wide 运行规则

session-init 启动后注入以下规则，整个 session 期间生效，不需要用户提醒：

#### 规则 1：自动派发

当检测到需要给 Codex/Gemini 派任务时，自动按 structured-dispatch 模板执行：
1. 填写完整模板
2. 根据任务类型自动选择推荐 skill 给 agent
3. 标注推荐档位（轻/标准/重）
4. 给用户看中文翻译
5. 用户批准后发英文指令

#### 规则 2：想法分流

用户提出新想法时，立刻判断去向并告知用户（不问"你觉得该放哪"）：
- **纳入具体里程碑**（M3/M5/新里程碑）— 核心流程需要的、产品不完整没它不行的
- **停车场** — 好想法，但不是当前阶段，存着等合适的时候
- **丢掉** — 评估后觉得不值得做，说明理由

#### 规则 3：Skill 自动触发

| 触发条件 | 自动执行的 skill |
|----------|-----------------|
| 用户想做新功能/探索想法 | brainstorming → writing-plans |
| 派发任务给 Codex/Gemini | structured-dispatch |
| brainstorming 或重要讨论结束 | journal |
| 声称完成/准备 commit | verification-before-completion → claudemd-check |
| 用户告知 Codex/Gemini 完成任务 | requesting-code-review → claudemd-check |
| 里程碑开始 | using-git-worktrees（创建隔离分支） |
| 里程碑结束 | finishing-a-development-branch（分支收尾） |

#### 规则 4：里程碑级 Git 隔离

- 里程碑开始 → 强制创建 worktree/分支，所有开发在隔离分支上进行
- 过程中 → structured-dispatch 每次派发指定目标分支，不允许直接在 master 上改
- 里程碑结束 → 强制走分支收尾流程（review → merge/PR）
- claudemd-check 审计：进行中的里程碑是否在隔离分支上

**例外**：Claude 文件边界内的纯文档改动（`docs/**`、`CLAUDE.md` 等）可直接在 master 上 commit，不要求 worktree。代码相关的里程碑工作必须隔离。

**异常处理**：worktree 创建失败时（磁盘空间、git 状态异常），停下来报告给用户，不得降级到 master 上直接开发。

#### 规则 5：Chain Routing（已有，保留不变）

设计链、执行链、派发链、收尾链的路由逻辑不变。

### 2.3 claudemd-check 扩展

现有 9 个执行步骤不变（步骤 1 读 CLAUDE.md + 步骤 2-9 共 8 项检查），新增步骤 10：

```
10. 检查：Skill 合规
    读 session-init 的运行规则，回顾本次 session 实际发生的事件，
    逐条检查是否遵守。只审计实际发生的事，未发生的跳过。
```

输出格式新增：

```
✓/✗ Skill 合规：
  - 派发任务：走了完整流程 / 未派发，跳过
  - 想法分流：已分流 N 条 / 无新想法，跳过
  - brainstorming 后记录：已写 journal / 未 brainstorm，跳过
  - 完成前验证：已执行 / 本次未声称完成，跳过
  - Git 隔离：在隔离分支上 / 无进行中里程碑，跳过
```

**检查依据**：session-init 的运行规则，不硬编码。规则变了，审计自动跟着变。

### 2.4 Skill 清理与归类

#### 删除（2 个）

| Skill | 理由 |
|-------|------|
| using-superpowers | 功能合进 session-init 运行规则 |
| dispatching-parallel-agents | CCB 模式下不使用 subagent 并行 |

#### 合并（2 → 1）

executing-plans + subagent-driven-development → 统一为 `executing-plans`。

**合并细节**：从 subagent-driven-development 移植以下内容到 executing-plans：
- 两阶段 review 流程（spec compliance review → code quality review）
- implementer 状态处理（DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED）
- 不移植 subagent dispatch 指令和 prompt 模板引用（CCB 模式下用 structured-dispatch 替代）

#### 最终归类

**核心流程 skill（session-init 管控）— 10 个**

| Skill | 职责 |
|-------|------|
| session-init | 开机 + CEO 仪表盘 + 注入运行规则 |
| claudemd-check | 收尾合规审计（含 skill 合规） |
| brainstorming | 需求讨论 → 设计 |
| writing-plans | 写实施计划 |
| structured-dispatch | 派发任务给 Codex/Gemini |
| requesting-code-review | 审查 agent 提交的代码 |
| journal | 记录想法/决策/待跟进 |
| verification-before-completion | 完成前验证 |
| using-git-worktrees | 里程碑级 Git 隔离 |
| finishing-a-development-branch | 里程碑级分支收尾 |

**Agent 参考 skill（structured-dispatch 推荐）— 7 个**

| Skill | 推荐场景 |
|-------|---------|
| coding-standards | 所有开发任务 |
| api-design | API 端点开发 |
| frontend-patterns | 前端组件开发 |
| test-driven-development | 新功能/bug 修复 |
| systematic-debugging | bug 诊断 |
| security-review | 认证/敏感数据处理 |
| database-migrations | schema 变更 |

**低频工具 skill — 5 个**

| Skill | 用途 |
|-------|------|
| receiving-code-review | 收到外部 review 反馈时 |
| retrospective | 定期回顾协作模式 |
| writing-skills | 创建/编辑 skill |
| api-contract | API 合约文档更新 |
| debug-ocr | OCR 问题排查 |

**总计：22 个项目 skill**（从 26 精简）

> 注：`simplify` 等平台内置 skill 不在项目管控范围内，不计入总数。

---

## 3. 信息系统职责表（供用户参考）

| 载体 | 存什么 | 类比 |
|------|--------|------|
| CLAUDE.md | 身份、边界、硬规则 | 身份证 + 公司章程 |
| session-init | 开机流程、运行规则、skill 使用手册 | 操作系统 |
| memory/ | 用户偏好、反馈、外部资源指针 | 长期记忆 |
| journal/ | 想法、决策推理、待跟进 | 工作笔记 |
| decisions.md | 已关闭的决策 | 判例法 |
| project_status.md | 项目当前快照 | 仪表盘数据源 |
| changelog.md | 变更历史 | 变更日志 |

---

## 4. 改动范围

按以下顺序执行（有依赖关系）：

| 顺序 | 文件 | 操作 |
|------|------|------|
| 1 | `.claude/skills/executing-plans/SKILL.md` | 合并 subagent-driven-development 的两阶段 review 和状态处理 |
| 2 | `.claude/skills/session-init/SKILL.md` | 重写：CEO 仪表盘 + 运行规则。移除旧的 "Does NOT" 部分，替换为新的行为契约（Section 2.2） |
| 3 | `.claude/skills/claudemd-check/SKILL.md` | 扩展：新增步骤 10 skill 合规审计 |
| 4 | `CLAUDE.md` | 将 "Skill 使用" 部分的 `using-superpowers/SKILL.md` 引用替换为 `session-init/SKILL.md` |
| 5 | `.claude/skills/using-superpowers/` | 删除整个目录 |
| 5 | `.claude/skills/dispatching-parallel-agents/` | 删除整个目录 |
| 5 | `.claude/skills/subagent-driven-development/` | 删除整个目录（内容已合并进 executing-plans） |

---

## 5. 不变的部分

- journal skill 不变
- structured-dispatch 模板不变（只是触发方式从手动变自动）
- 底层数据系统（project_status、decisions、changelog）不变
- CCB 协作协议不变
- CLAUDE.md 的身份/边界/硬规则部分不变

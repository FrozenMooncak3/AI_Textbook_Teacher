---
date: 2026-03-21
topic: CCB+Skill体系架构重构设计
type: spec
status: resolved
keywords: [CCB, skill, architecture, migration, three-tier]
---

# 架构重构设计：从多 Agent 迁移到 CCB + Skill 体系

> 日期：2026-03-21
> 状态：已确认
> 背景：项目从单 Agent → 多 Agent（Master + Agent1 + Agent2）→ CCB（Claude + Codex + Gemini）

---

## 1. 核心理念

**三层分离**：

| 层 | 职责 | 变更频率 |
|----|------|---------|
| 身份层 | 谁是谁，管什么文件 | 几乎不变 |
| 规则层 | 什么不能做（产品不变量、技术红线） | 很少变 |
| 技能层 | 怎么做事（skill 文件） | 经常变、可插拔 |

**Prompt/Skill 分离**：指令文件（CLAUDE.md / AGENTS.md / GEMINI.md）= 操作系统（薄、稳定），`.claude/skills/` = 应用程序（厚、可插拔）。

---

## 2. 文件结构

```
项目根目录/
├── CLAUDE.md                  ← Claude 读（身份 + 规则 + CCB 角色表 + 沟通协议）
├── AGENTS.md                  ← Codex 读（新建：身份 + 规则 + 文件边界）
├── GEMINI.md                  ← Gemini 读（新建：身份 + 规则 + 文件边界）
│
├── .claude/skills/            ← 三个模型共享的 skill 仓库
│   ├── [14 个 Superpowers]    ← 工作流引擎
│   ├── [5 个 ECC]             ← 技术模式
│   ├── debug-ocr/             ← 自定义：排查 OCR 问题
│   └── api-contract/          ← 自定义：更新接口契约
│
├── .agents/                   ← 协调状态文件
│   ├── PLAN.md                ← 继续使用，Claude 维护
│   ├── API_CONTRACT.md        ← 继续使用，Codex 维护
│   ├── MASTER_IDENTITY.md     ← 旧文件，冻结保留
│   ├── AGENT1_IDENTITY.md     ← 旧文件，冻结保留
│   ├── AGENT2_IDENTITY.md     ← 旧文件，冻结保留
│   ├── MASTER_LOG.md          ← 旧文件，冻结保留
│   ├── AGENT1_LOG.md          ← 旧文件，冻结保留
│   └── AGENT2_LOG.md          ← 旧文件，冻结保留
│
├── .ccb/                      ← CCB 运行时（不动）
│
└── docs/
    ├── project_status.md      ← Claude 维护
    ├── changelog.md           ← 三个模型共享，唯一的日志
    ├── decisions.md           ← Claude 维护
    └── superpowers/specs/     ← 设计文档存放处
```

---

## 3. 三个指令文件

### 共同骨架

三个文件使用统一结构，只是内容不同：

```
身份声明 → 技术栈（只列相关的）→ 产品不变量 → 技术红线 → 文件边界 → 工作流程 → Skill 使用
```

### CLAUDE.md（~60 行）

- **身份**：PM + 架构师，不写业务代码
- **文件边界**：可写 docs/**、.agents/PLAN.md、.agents/API_CONTRACT.md；不写 src/**
- **CCB 角色表**：列出三个模型的职责和边界
- **沟通协议**：与项目负责人的汇报格式（只有 Claude 需要）
- **Skill 入口**：`using-superpowers` 自动路由
- **删除的内容**：工作协议、commit 规范、数据库表结构、调试说明（移到 skill 或 AGENTS.md）

### AGENTS.md（Codex，新建）

- **身份**：后端开发
- **技术栈**：Next.js API Routes、SQLite + better-sqlite3、Python + PaddleOCR、Claude API
- **文件边界**：可写 src/lib/**、src/app/api/**、scripts/**；禁止碰前端和文档
- **数据库表结构**：从 CLAUDE.md 移入（7 张表 + Phase 2 新增表）
- **工作流程**：读 PLAN → 读 API_CONTRACT → 干活 → 追加 changelog
- **Skill 入口**：`using-superpowers` 自动路由

### GEMINI.md（Gemini，新建）

- **身份**：前端开发
- **技术栈**：React 19 + Next.js 15 App Router、Tailwind CSS、pdf.js
- **文件边界**：可写 src/app/**/*.tsx、src/app/globals.css；禁止碰后端和文档
- **工作流程**：读 PLAN → 读 API_CONTRACT → 干活 → 追加 changelog
- **Skill 入口**：`using-superpowers` 自动路由

### 关键设计决策

- **产品不变量和技术红线在三个文件里都复制一份**——CCB 上下文隔离，每个模型必须独立看到硬规则
- **技术栈只列和自己相关的部分**
- **工作流程极简（4 步）**——具体"怎么做"交给 skill

---

## 4. Skill 体系

### Superpowers（14 个，工作流引擎）

| Skill | 主要用户 | 用途 |
|-------|---------|------|
| using-superpowers | 三个都用 | 自动路由器 |
| brainstorming | Claude | 设计前头脑风暴 |
| writing-plans | Claude | 设计转实施计划 |
| executing-plans | 三个都用 | 按计划逐步执行 |
| dispatching-parallel-agents | Claude | Claude 内部并行子 Agent |
| subagent-driven-development | Claude | 子 Agent 驱动开发 |
| requesting-code-review | Claude | 请求代码审查 |
| receiving-code-review | Codex/Gemini | 处理审查反馈 |
| test-driven-development | Codex | TDD 流程 |
| systematic-debugging | Codex/Gemini | 系统化调试 |
| verification-before-completion | 三个都用 | 完成前验证 |
| using-git-worktrees | Codex/Gemini | 隔离开发 |
| finishing-a-development-branch | Codex/Gemini | 分支合并策略 |
| writing-skills | Claude | 创建新 skill |

### ECC（5 个，技术模式）

| Skill | 主要用户 | 用途 |
|-------|---------|------|
| api-design | Codex | REST API 设计规范 |
| database-migrations | Codex | 数据库改表流程 |
| frontend-patterns | Gemini | React/Next.js 模式 |
| security-review | Claude | 安全审查 |
| coding-standards | 三个都用 | 代码规范 |

### 自定义（2 个，待创建）

| Skill | 主要用户 | 用途 |
|-------|---------|------|
| debug-ocr | Codex | PaddleOCR / ocr_server.py 排查流程 |
| api-contract | Codex/Gemini | 更新 API_CONTRACT.md 的规范 |

### Superpowers vs CCB 共存

- CCB `/ask`：Claude → Codex/Gemini（跨模型委派）
- Superpowers `dispatching-parallel-agents`：Claude → Claude 子 Agent（同模型内并行）
- 两者不冲突，共存

---

## 5. CCB 通信模式

### 日常工作流

1. Claude 读 PLAN.md，决定当前迭代任务
2. Claude `/ask codex "..."` 委派后端任务，附带需要参考的文件
3. Claude `/ask gemini "..."` 委派前端任务
4. Codex/Gemini 各自读自己的指令文件 + PLAN + API_CONTRACT + 匹配 skill → 干活 → 提交 → 追加 changelog
5. Claude `/pend` 取结果
6. Claude `/review` 审查代码
7. Claude 更新 PLAN.md + project_status.md

### 规则

- **只有 Claude 更新 PLAN.md**
- **changelog.md 是唯一共享日志**，格式：`[日期] [Claude/Codex/Gemini] 做了什么`
- **API_CONTRACT.md 由 Codex 主导更新**，Gemini 只读

---

## 6. 旧文件处理

| 旧文件 | 处理 |
|--------|------|
| `.agents/PLAN.md` | 继续使用 |
| `.agents/API_CONTRACT.md` | 继续使用 |
| `.agents/MASTER_IDENTITY.md` | 冻结保留，内容融入 CLAUDE.md |
| `.agents/AGENT1_IDENTITY.md` | 冻结保留，内容融入 AGENTS.md |
| `.agents/AGENT2_IDENTITY.md` | 冻结保留，内容融入 GEMINI.md |
| `.agents/MASTER_LOG.md` | 冻结保留，停止更新 |
| `.agents/AGENT1_LOG.md` | 冻结保留，停止更新 |
| `.agents/AGENT2_LOG.md` | 冻结保留，停止更新 |

---

## 7. CLAUDE.md 瘦身清单

| 当前章节 | 去向 |
|---------|------|
| 项目是什么 | 保留 |
| 每次对话必须读 | 精简保留：Claude 每次会话开始仍需读 project_status.md 和 decisions.md |
| 技术栈 | 保留，只列 Claude 相关 |
| 数据库表结构 | 移到 AGENTS.md |
| 调试 | 移到 debug-ocr skill + AGENTS.md |
| 产品不变量 | 保留，三个文件都复制 |
| 已关闭的决策 | 精简为"详见 docs/decisions.md" |
| 技术红线 | 保留，三个文件都复制 |
| 工作协议 | 删除（交给 skill） |
| 禁止事项 | 保留，并入规则层 |
| 沟通协议 | 保留（只有 Claude 需要） |
| GitHub / Commit 规范 | 删除（交给 coding-standards skill） |

瘦身效果：~154 行 → ~60 行

---

## 8. GitHub 同步

**仓库**：`https://github.com/FrozenMooncak3/AI_Textbook_Teacher.git`，分支 `master`

### 迁移完成后需要 push 的变更

| 变更 | 说明 |
|------|------|
| 新增 `AGENTS.md` | Codex 指令文件 |
| 新增 `GEMINI.md` | Gemini 指令文件 |
| 修改 `CLAUDE.md` | 瘦身后的版本 |
| 新增 `docs/superpowers/specs/` | 设计文档 |
| 新增 `.claude/skills/debug-ocr/` | 自定义 skill |
| 新增 `.claude/skills/api-contract/` | 自定义 skill |

### 不 push 的内容

- `.ccb/` — 运行时会话文件，加入 `.gitignore`
- `data/app.db` — 已在 `.gitignore`
- `.env.local` — 已在 `.gitignore`

### 实施顺序

1. 本地改文件（写 CLAUDE.md、AGENTS.md、GEMINI.md、创建自定义 skill、更新 .gitignore）
2. Claude 用 verification-before-completion skill 审查所有变更
3. 审查通过 → git commit + git push
4. GitHub 上的结构自动同步

本地是唯一 truth source，不需要在 GitHub 上单独操作。

### .gitignore 需要补充

```
# CCB 运行时
.ccb/.*-session
```

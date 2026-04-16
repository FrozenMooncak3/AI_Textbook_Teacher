---
name: skill-catalog
description: 23 个 skill 的完整使用手册（核心流程 11 个 + Agent 参考 7 个 + 低频工具 5 个 + 用户命令 3 个）。Claude 不知道某 skill 干什么时按需查阅。
---

# Skill 使用手册

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

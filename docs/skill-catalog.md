# Skill 使用手册

> 项目 skill 参考索引。Claude 不知道某 skill 干什么时按需读本文件（Read docs/skill-catalog.md）。
> 本文件原为 `.claude/skills/skill-catalog/SKILL.md`，2026-04-19 Retrospective 2.0 降级为 docs（踩 2026-04-18 bloat §5 "文档 skill 化"陷阱）。

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

### Agent 参考 skill（structured-dispatch 推荐给 Codex/Gemini）— 6 个

Claude 不启动这些 skill，仅在 dispatch 的 "Suggested Skills" 字段推荐给 agent。

| Skill | 推荐场景 |
|-------|---------|
| **coding-standards** | 所有开发任务 |
| **api-design** | API 端点开发 |
| **frontend-patterns** | 前端组件开发 |
| **test-driven-development** | 新功能 / bug 修复 |
| **security-review** | 认证 / 敏感数据处理 |
| **database-migrations** | schema 变更 |

### 低频工具 skill — 4 个

| Skill | 用途 |
|-------|------|
| **receiving-code-review** | 收到外部 review 反馈时 |
| **retrospective** | 定期回顾协作模式（`/retrospective`） |
| **writing-skills** | 创建/编辑 skill |
| **debug-ocr** | OCR 问题排查 |

### 诊断与协作 skill — 3 个

| Skill | 用途 |
|-------|------|
| **systematic-debugging** | bug 诊断（规则 3：同一问题失败 ≥2 次强制触发） |
| **memory-cleanup** | 季度归档陈旧 journal/decisions（Q3/Q4 手动调用） |
| **using-git-worktrees** | 里程碑级分支隔离（可选，规则 4） |

### 用户需要知道的命令（只有 3 个）

| 命令 | 用途 |
|------|------|
| `/brainstorming` | 有新想法要讨论 |
| `/retrospective` | 回顾协作模式 |
| `/claudemd-check` | 手动跑合规检查 |

其他 skill 全部自动触发，用户不需要手动调用。

### Research skill — 1 个

| Skill | 用途 |
|-------|------|
| **research-before-decision** | 🔴 档决策前的权威源调研（被 brainstorming 自动触发） |

---

## 已废弃（2026-04-19 retrospective 2.0 清理）

以下 skill 已被删除或降级，不应出现在新 dispatch 的 Suggested Skills 中：

- ~~skill-catalog~~ → 本文件（`docs/skill-catalog.md`）
- ~~ccb-protocol-reference~~ → `docs/ccb-protocol-quickref.md`
- ~~executing-plans~~ → 被 `task-execution` 完全取代
- ~~api-contract~~（Claude 端）→ Codex 端保留 `.codex/skills/api-contract/`
- ~~frontend-design~~ → 孤儿 skill，Component Library 完成后架空，已由 brainstorming/structured-dispatch 覆盖

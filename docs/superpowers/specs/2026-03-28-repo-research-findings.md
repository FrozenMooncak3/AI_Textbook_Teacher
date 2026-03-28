# 外部仓库调研总结（2026-03-28）

> 调研目的：从三个开源 Claude Code 项目中提取可用于本项目的模式和实践。
> 本文档为后续三次 brainstorming 的共享上下文，compact 后读此文件恢复调研结果。

---

## 调研的仓库

| 仓库 | 定位 | Stars |
|------|------|-------|
| [claude-hud](https://github.com/jarrodwatts/claude-hud) | Claude Code 终端 HUD 插件（状态栏显示模型/token/agent/todo） | - |
| [everything-claude-code (ECC)](https://github.com/affaan-m/everything-claude-code) | Claude Code 性能优化元工具包（125 skill + 28 subagent + 60 命令 + hooks） | 50K+ |
| [impeccable](https://github.com/pbakaus/impeccable) | 跨 AI harness 设计 skill 分发系统（1 核心 skill + 20 命令 → 10 个 provider） | - |

---

## 一、Codex / Gemini Skill 格式规范

### 目录结构

| 工具 | Skill 目录 | Fallback |
|------|-----------|----------|
| Claude Code | `.claude/skills/{name}/SKILL.md` | - |
| Codex CLI | `.codex/skills/{name}/SKILL.md` | `.agents/skills/` |
| Gemini CLI | `.gemini/skills/{name}/SKILL.md` | `.agents/skills/` |

### Frontmatter 支持

| 字段 | Claude Code | Codex CLI | Gemini CLI |
|------|:-----------:|:---------:|:----------:|
| `name` | Yes | Yes | Yes |
| `description` | Yes | Yes | Yes |
| `user-invocable` | Yes | No | No |
| `argument-hint` | Yes | Yes | No |
| `allowed-tools` | Yes | No | No |
| `license` | Yes | No | Ignored |
| `model` / `effort` / `agent` | Yes | No | No |

### 格式差异

| 差异点 | Claude Code | Codex CLI | Gemini CLI |
|--------|------------|-----------|------------|
| 命令前缀 | `/` | `$` | `/` |
| 配置引用 | CLAUDE.md | AGENTS.md | GEMINI.md |
| 模型名 | Claude | GPT | Gemini |
| 运行时变量 | `$ARGUMENTS`, `${CLAUDE_SKILL_DIR}` 等 | 不支持 | 不支持 |

### 写 Codex/Gemini skill 的规则

1. Frontmatter 只用 `name` + `description`（最大兼容性）
2. Body 是纯 Markdown，不用运行时变量
3. 命令交叉引用：Claude/Gemini 用 `/`，Codex 用 `$`
4. `.agents/skills/` 可作为通用 fallback（Gemini、Copilot、OpenCode 都能读）

---

## 二、我们项目的 Skill 现状

### 当前状态

- `.claude/skills/`：23 个 skill（已安装）
- `.codex/skills/`：**空 / 不存在**
- `.gemini/skills/`：**空 / 不存在**

### 23 个 Claude Code Skill 清单及角色适用性

| Skill | 类型 | Claude (PM) | Codex (后端) | Gemini (前端) |
|-------|------|:-----------:|:------------:|:-------------:|
| using-superpowers | 元规则 | Yes | Yes | Yes |
| brainstorming | 流程 | Yes | - | - |
| writing-plans | 流程 | Yes | - | - |
| executing-plans | 流程 | Yes | - | - |
| dispatching-parallel-agents | 流程 | Yes | - | - |
| subagent-driven-development | 流程 | Yes | - | - |
| journal | 记录 | Yes | - | - |
| claudemd-check | 合规 | Yes | - | - |
| writing-skills | 元工具 | Yes | - | - |
| using-git-worktrees | 工具 | Yes | - | - |
| finishing-a-development-branch | 流程 | Yes | - | - |
| requesting-code-review | 质量 | Yes | - | - |
| receiving-code-review | 质量 | Yes | - | - |
| coding-standards | 编码 | - | **Yes** | **Yes** |
| api-design | 编码 | - | **Yes** | - |
| api-contract | 编码 | - | **Yes** | - |
| database-migrations | 编码 | - | **Yes** | - |
| frontend-patterns | 编码 | - | - | **Yes** |
| security-review | 质量 | - | **Yes** | **Yes** |
| systematic-debugging | 质量 | - | **Yes** | **Yes** |
| test-driven-development | 质量 | - | **Yes** | **Yes** |
| verification-before-completion | 质量 | - | **Yes** | **Yes** |
| debug-ocr | 专项 | - | **Yes** | - |

### 待安装 Skill 分配

**Codex 应获得（9 个）：**
coding-standards, api-design, api-contract, database-migrations, security-review, systematic-debugging, test-driven-development, verification-before-completion, debug-ocr

**Gemini 应获得（6 个）：**
coding-standards, frontend-patterns, security-review, systematic-debugging, test-driven-development, verification-before-completion

---

## 三、Hook 体系（来自 ECC）

### Claude Code Hook 能力

| 事件 | 触发时机 | 用途 |
|------|---------|------|
| PreToolUse | 工具调用前 | 阻止危险操作、config 保护 |
| PostToolUse | 工具调用后 | 自动 typecheck、console.log 检测、格式化 |
| Stop | 每次回复后 | 验证检查、session 持久化、cost tracking |
| SessionStart | 会话开始 | 加载上下文、检测环境 |
| PreCompact | compact 前 | 保存状态 |

### 推荐引入的 Hook（H1-H5）

| 编号 | Hook | 类型 | 作用 |
|------|------|------|------|
| H1 | post-edit-typecheck | PostToolUse | 编辑 .ts/.tsx 后自动 `tsc --noEmit` |
| H2 | post-edit-console-warn | PostToolUse | 编辑后检测 console.log |
| H3 | config-protection | PreToolUse | 阻止修改产品不变量 / CLAUDE.md 核心规则 |
| H4 | structured-handoff | 派发模板 | Claude → Codex/Gemini 任务用标准格式 |
| H5 | suggest-compact | PostToolUse | 每 ~50 次工具调用建议 compact |

**注意：Hook 只对 Claude Code 有效。Codex CLI 和 Gemini CLI 没有 hook 系统。**

---

## 四、其他有价值的发现（H6-H8+）

| 编号 | 来源 | 发现 | 适用性 |
|------|------|------|--------|
| H6 | impeccable | Skill reference 子目录（`reference/` 放领域知识） | 把教学法、题型设计等知识模块化 |
| H7 | impeccable | 跨 skill 调用链 + 强制前置 | skill A 执行前必须先加载 skill B |
| H8 | claude-hud | GitHub Action 集成 Claude（PR 里 @claude 触发 review） | CCB code review 自动化 |
| H9 | ECC | Session 持久化（save/load session state） | 长 session 跨 compact 保存上下文 |
| H10 | ECC | Instinct 持续学习系统（观察 → 提取模式 → 进化为 skill） | 长期优化 AI 行为 |
| H11 | ECC | 结构化 handoff 文档（Context/Findings/Files/Questions/Recommendations） | Claude → Codex/Gemini 派发标准化 |
| H12 | claude-hud | `allowed-tools` frontmatter 限制 skill 工具权限 | 约束 skill 行为边界 |
| H13 | ECC | Profile-based hook 控制（minimal/standard/strict） | 按场景切换 hook 强度 |
| H14 | impeccable | 持久化项目上下文（`.impeccable.md` 模式） | 类似我们的 project_status.md |

---

## 五、三次 Brainstorming 规划

| 次序 | Topic | 范围 | 依赖 |
|------|-------|------|------|
| **第 1 次**（本次） | 给 Codex/Gemini 装 skill | 确定 skill 清单 → 格式转换 → 写文件 | 无 |
| **第 2 次** | Claude skill 自动化 + hook 体系 | H1-H5 + Claude 自身 skill 触发机制 | 第 1 次完成 |
| **第 3 次** | 其他改进 | H6-H14 按优先级落地 | 第 2 次完成 |

---

## 六、参考链接

- Agent Skills Spec: https://agentskills.io/specification
- ECC 安装文档: 仓库 README + `scripts/sync-ecc-to-codex.sh`
- impeccable 构建系统: `scripts/lib/transformers/` + `HARNESSES.md`

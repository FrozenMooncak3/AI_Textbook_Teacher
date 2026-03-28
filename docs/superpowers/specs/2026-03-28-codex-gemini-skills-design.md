# Design Spec: 给 Codex/Gemini 安装 Skill

> 日期：2026-03-28
> 关联调研：`docs/superpowers/specs/2026-03-28-repo-research-findings.md`
> 状态：待 review

---

## 1. 问题

Codex CLI 和 Gemini CLI 的 skill 目录为空。虽然 AGENTS.md 和 GEMINI.md 提到"使用 skill"，但实际上没有任何 skill 文件可供调用。导致：
- Codex/Gemini 无法使用 skill 指导开发
- 产品不变量和编码规范只能靠 .md 文件中的文字指令，执行不如 skill 可靠
- Claude（PM）无法验证 Codex/Gemini 是否遵循了 skill 规则

## 2. 方案

从现有 23 个 Claude Code skill 中，选出适合 Codex/Gemini 角色的 skill，转换格式后安装到各自的 skill 目录。

## 3. 目录结构

```
.codex/
  skills/
    using-superpowers/SKILL.md
    coding-standards/SKILL.md
    api-design/SKILL.md
    api-contract/SKILL.md
    database-migrations/SKILL.md
    security-review/SKILL.md
    systematic-debugging/SKILL.md
    test-driven-development/SKILL.md
    verification-before-completion/SKILL.md
    debug-ocr/SKILL.md

.gemini/
  skills/
    using-superpowers/SKILL.md
    coding-standards/SKILL.md
    frontend-patterns/SKILL.md
    security-review/SKILL.md
    systematic-debugging/SKILL.md
    test-driven-development/SKILL.md
    verification-before-completion/SKILL.md
```

Codex 10 个，Gemini 7 个。

## 4. Skill 分配逻辑

| Skill | Codex (后端) | Gemini (前端) | 理由 |
|-------|:------------:|:-------------:|------|
| using-superpowers | Yes | Yes | 元规则，让 agent 主动查 skill |
| coding-standards | Yes | Yes | 通用编码标准，两者都需要 |
| api-design | Yes | - | REST API 设计是后端职责 |
| api-contract | Yes | - | API 合约文档是后端职责 |
| database-migrations | Yes | - | 数据库是后端职责 |
| security-review | Yes | Yes | 安全是所有人的职责 |
| systematic-debugging | Yes | Yes | 调试方法论，两者都需要 |
| test-driven-development | Yes | Yes | TDD，两者都需要 |
| verification-before-completion | Yes | Yes | 完成前验证，两者都需要 |
| debug-ocr | Yes | - | OCR 排查是后端/Python 职责 |
| frontend-patterns | - | Yes | 前端模式是前端职责 |

## 5. 格式转换规则

### 5.1 Frontmatter

所有 skill 统一简化为：

```yaml
---
name: {skill-name}
description: {one-line description}
---
```

去掉所有其他字段，包括但不限于：`user-invocable`、`argument-hint`、`allowed-tools`、`license`、`origin`、`globs`、`alwaysApply`、`compatibility`、`metadata`。源 skill 的 frontmatter 格式不统一（有些用 `name`/`description`/`origin`，有些用 `description`/`globs`/`alwaysApply`），统一简化为只保留 `name` + `description`。

### 5.2 Body 文本替换

| 替换项 | Codex 版 | Gemini 版 |
|--------|---------|-----------|
| `/skill-name` 命令引用 | `$skill-name` | 不变（`/`） |
| `CLAUDE.md` 配置引用 | `AGENTS.md` | `GEMINI.md` |
| `Claude` 模型名引用 | `GPT` | `Gemini` |
| `Skill` tool 引用（如"invoke the Skill tool to load X"） | 改为 "activate the $skill-name skill" | 改为 "activate the /skill-name skill"（Gemini CLI 通过 `/` 调用 skill，不需要特殊 tool） |
| `$ARGUMENTS` 等运行时变量 | 删除 | 删除 |
| `AskUserQuestion` tool | "ask the user directly" | "ask the user directly" |

### 5.3 不改的部分

- 所有业务逻辑、规则、代码示例——原封不动
- 产品不变量引用——保留
- 中文 skill（api-contract、debug-ocr）——语言不变
- 与我们项目无关的内容（如 Prisma/Drizzle 在 database-migrations 里）——不删，保持和 Claude 版一致

## 6. using-superpowers 特殊处理

原版 using-superpowers 包含 Claude Code 特有概念（`Skill` tool、instruction priority hierarchy、红旗检查等）。Codex/Gemini 版需要**重写**为精简版：

### 核心保留
- **核心规则**：任何动作前先查 skill 是否适用
- **Trigger table**：关键词 → skill 映射表
- **红旗检查**："这只是个简单问题" = 停下来查 skill

### 删除 / 改写
- Claude Code `Skill` tool 机制 → 改为各自的 skill 调用方式
- Instruction priority hierarchy → 简化为"skill 优先于默认行为"
- 对其他 tool 平台的引用 → 删除

### Codex 版 Trigger Table

| 触发条件 | 调用 skill |
|----------|-----------|
| 写 API route | $api-design, $api-contract |
| 改 database/schema/migration | $database-migrations |
| 修 bug / 排错 | $systematic-debugging |
| 写新功能 | $test-driven-development |
| 声称完成 / 准备 commit | $verification-before-completion |
| OCR / PaddleOCR / 截图问题 | $debug-ocr |
| 任何代码编写 | $coding-standards |
| 涉及 auth / input / secrets | $security-review |

### Gemini 版 Trigger Table

| 触发条件 | 调用 skill |
|----------|-----------|
| 写 React 组件 / 页面 | /frontend-patterns |
| 修 bug / 排错 | /systematic-debugging |
| 写新功能 | /test-driven-development |
| 声称完成 / 准备 commit | /verification-before-completion |
| 任何代码编写 | /coding-standards |
| 涉及 auth / input / secrets | /security-review |

## 7. 指令文件更新

### AGENTS.md 追加

在文件末尾（Workflow 段落之后）追加：

```markdown
## Skill 使用
每次 session 开始，先读 `.codex/skills/using-superpowers/SKILL.md` 并遵守其规则。
可用 skill 列表：coding-standards, api-design, api-contract, database-migrations,
security-review, systematic-debugging, test-driven-development,
verification-before-completion, debug-ocr
```

### GEMINI.md 修正

将现有的 Skill 使用段落（指向 `.claude/skills/`，路径错误）替换为：

```markdown
## Skill 使用
每次 session 开始，先读 `.gemini/skills/using-superpowers/SKILL.md` 并遵守其规则。
可用 skill 列表：coding-standards, frontend-patterns, security-review,
systematic-debugging, test-driven-development, verification-before-completion
```

## 8. 执行计划

| 步骤 | 内容 | 文件数 |
|------|------|--------|
| 1 | 创建 `.codex/skills/` 和 `.gemini/skills/` 目录结构 | - |
| 2 | 机械转换 10 个 domain skill（读 Claude 版 → 改 frontmatter + 替换 → 写 Codex/Gemini 版） | ~15 文件 |
| 3 | 重写 using-superpowers Codex 版 | 1 文件 |
| 4 | 重写 using-superpowers Gemini 版 | 1 文件 |
| 5 | 更新 AGENTS.md | 1 文件修改 |
| 6 | 修正 GEMINI.md | 1 文件修改 |
| 7 | 验证：检查所有文件存在且格式正确 | - |

**执行模型：** Sonnet + 标准 effort（机械转换任务，不需要 Opus）

## 9. 验证方式

安装后通过以下方式验证 skill 是否生效：
1. **Codex**：派发一个简单的 API 开发任务，观察它是否主动引用 skill
2. **Gemini**：派发一个简单的前端组件任务，观察它是否主动引用 skill
3. 如果不生效（即"信任 + 验证"方案失败——装了 skill 但 agent 不主动用），后续 brainstorming 第二次讨论替代方案（如 hook 强制检查、嵌入式指令等）

## 10. 可逆性

**容易反悔。** 所有改动都是新增文件 + 两个 .md 的小修改。回退只需 `rm -rf .codex/skills .gemini/skills` + git checkout AGENTS.md GEMINI.md。

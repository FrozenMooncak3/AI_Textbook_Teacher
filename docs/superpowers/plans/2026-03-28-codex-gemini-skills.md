---
date: 2026-03-28
topic: Codex/Gemini Skill安装
type: plan
status: resolved
keywords: [codex, gemini, skill, CCB, installation]
---

# Codex/Gemini Skill 安装 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 Codex CLI 安装 10 个 skill，给 Gemini CLI 安装 7 个 skill，让它们能主动使用 skill 指导开发。

**Architecture:** 从现有 `.claude/skills/` 读取源 skill → 简化 frontmatter → 文本替换 → 写到 `.codex/skills/` 和 `.gemini/skills/`。using-superpowers 需要重写（不是机械转换）。

**Tech Stack:** 纯 Markdown 文件操作，无代码依赖。

**Spec:** `docs/superpowers/specs/2026-03-28-codex-gemini-skills-design.md`

---

## 转换规则速查（所有 Task 通用）

### Frontmatter 规则
- 只保留 `name` + `description`
- 去掉 `origin`、`globs`、`alwaysApply`、`user-invocable` 等所有其他字段
- 如果源文件没有 `name` 字段（api-contract、debug-ocr），用目录名作为 `name`

### Codex 文本替换
| 查找 | 替换为 |
|------|--------|
| `CLAUDE.md`（作为配置文件引用时） | `AGENTS.md` |
| `/skill-name`（作为 skill 调用时） | `$skill-name` |

### Gemini 文本替换
| 查找 | 替换为 |
|------|--------|
| `CLAUDE.md`（作为配置文件引用时） | `GEMINI.md` |

### 不替换
- Body 里的业务内容、代码示例、规则原文——原封不动
- 大部分 skill 里没有 Claude/CLAUDE.md/Skill tool 引用，所以大部分 skill 只需改 frontmatter

---

### Task 1: 创建目录结构

**Files:**
- Create: `.codex/skills/` (10 个子目录)
- Create: `.gemini/skills/` (7 个子目录)

- [ ] **Step 1: 创建 Codex skill 目录**

```bash
mkdir -p .codex/skills/using-superpowers
mkdir -p .codex/skills/coding-standards
mkdir -p .codex/skills/api-design
mkdir -p .codex/skills/api-contract
mkdir -p .codex/skills/database-migrations
mkdir -p .codex/skills/security-review
mkdir -p .codex/skills/systematic-debugging
mkdir -p .codex/skills/test-driven-development
mkdir -p .codex/skills/verification-before-completion
mkdir -p .codex/skills/debug-ocr
```

- [ ] **Step 2: 创建 Gemini skill 目录**

```bash
mkdir -p .gemini/skills/using-superpowers
mkdir -p .gemini/skills/coding-standards
mkdir -p .gemini/skills/frontend-patterns
mkdir -p .gemini/skills/security-review
mkdir -p .gemini/skills/systematic-debugging
mkdir -p .gemini/skills/test-driven-development
mkdir -p .gemini/skills/verification-before-completion
```

- [ ] **Step 3: 验证目录存在**

```bash
ls .codex/skills/ | wc -l  # 期望: 10
ls .gemini/skills/ | wc -l  # 期望: 7
```

---

### Task 2: 重写 using-superpowers — Codex 版

**Files:**
- Create: `.codex/skills/using-superpowers/SKILL.md`
- Reference: `.claude/skills/using-superpowers/SKILL.md`

这个 skill 不是机械转换，需要重写。保留核心规则和红旗检查，去掉 Claude Code 特有概念。

- [ ] **Step 1: 写 Codex 版 using-superpowers**

写入 `.codex/skills/using-superpowers/SKILL.md`，内容如下：

```markdown
---
name: using-superpowers
description: 每次 session 开始必读——建立 skill 使用规则，任何动作前先查 skill
---

# Using Skills

## 核心规则

**任何动作前，先查是否有 skill 适用。** 哪怕只有 1% 的可能性，也必须先激活 skill 再行动。

这不是建议，是规则。不可协商，不可跳过。

## 优先级

1. **用户指令**（AGENTS.md、直接请求）— 最高优先
2. **Skill 规则** — 覆盖默认行为
3. **默认行为** — 最低优先

如果 AGENTS.md 说"不用 TDD"而 skill 说"必须 TDD"，听 AGENTS.md。

## Trigger Table

收到任务后，对照此表激活 skill：

| 触发条件 | 激活 skill |
|----------|-----------|
| 写 API route | $api-design, $api-contract |
| 改 database / schema / migration | $database-migrations |
| 修 bug / 排错 / 意外行为 | $systematic-debugging |
| 写新功能（任何） | $test-driven-development |
| 声称完成 / 准备 commit / 提交代码 | $verification-before-completion |
| OCR / PaddleOCR / 截图相关问题 | $debug-ocr |
| 任何代码编写 | $coding-standards |
| 涉及 auth / input validation / secrets / API 安全 | $security-review |

**多个条件同时满足时，全部激活。** 例如"写一个新的 API route"→ 激活 $api-design + $api-contract + $test-driven-development + $coding-standards。

## 红旗检查

这些想法意味着你在找借口跳过 skill，停下来：

| 想法 | 现实 |
|------|------|
| "这只是个简单任务" | 简单任务也有 skill。查表。 |
| "我先看看代码" | Skill 告诉你怎么看。先查 skill。 |
| "这不需要正式的 skill" | 如果 skill 存在，用它。 |
| "我记得这个 skill 的内容" | Skill 会更新。读当前版本。 |
| "先做完这一步再说" | 动作前查 skill，不是动作后。 |

## Skill 类型

**刚性 skill**（TDD、debugging）：严格遵循，不可变通。
**柔性 skill**（patterns）：原则不变，细节可调。

Skill 本身会说明自己是哪种。
```

- [ ] **Step 2: 验证文件**

```bash
head -5 .codex/skills/using-superpowers/SKILL.md
# 期望看到: ---\nname: using-superpowers\ndescription: ...
```

---

### Task 3: 重写 using-superpowers — Gemini 版

**Files:**
- Create: `.gemini/skills/using-superpowers/SKILL.md`
- Reference: `.claude/skills/using-superpowers/SKILL.md`

- [ ] **Step 1: 写 Gemini 版 using-superpowers**

写入 `.gemini/skills/using-superpowers/SKILL.md`，内容如下：

```markdown
---
name: using-superpowers
description: 每次 session 开始必读——建立 skill 使用规则，任何动作前先查 skill
---

# Using Skills

## 核心规则

**任何动作前，先查是否有 skill 适用。** 哪怕只有 1% 的可能性，也必须先激活 skill 再行动。

这不是建议，是规则。不可协商，不可跳过。

## 优先级

1. **用户指令**（GEMINI.md、直接请求）— 最高优先
2. **Skill 规则** — 覆盖默认行为
3. **默认行为** — 最低优先

如果 GEMINI.md 说"不用 TDD"而 skill 说"必须 TDD"，听 GEMINI.md。

## Trigger Table

收到任务后，对照此表激活 skill：

| 触发条件 | 激活 skill |
|----------|-----------|
| 写 React 组件 / 页面 / 布局 | /frontend-patterns |
| 修 bug / 排错 / 意外行为 | /systematic-debugging |
| 写新功能（任何） | /test-driven-development |
| 声称完成 / 准备 commit / 提交代码 | /verification-before-completion |
| 任何代码编写 | /coding-standards |
| 涉及 auth / input validation / secrets / 安全 | /security-review |

**多个条件同时满足时，全部激活。** 例如"写一个新的 React 页面"→ 激活 /frontend-patterns + /test-driven-development + /coding-standards。

## 红旗检查

这些想法意味着你在找借口跳过 skill，停下来：

| 想法 | 现实 |
|------|------|
| "这只是个简单任务" | 简单任务也有 skill。查表。 |
| "我先看看代码" | Skill 告诉你怎么看。先查 skill。 |
| "这不需要正式的 skill" | 如果 skill 存在，用它。 |
| "我记得这个 skill 的内容" | Skill 会更新。读当前版本。 |
| "先做完这一步再说" | 动作前查 skill，不是动作后。 |

## Skill 类型

**刚性 skill**（TDD、debugging）：严格遵循，不可变通。
**柔性 skill**（patterns）：原则不变，细节可调。

Skill 本身会说明自己是哪种。
```

- [ ] **Step 2: 验证文件**

```bash
head -5 .gemini/skills/using-superpowers/SKILL.md
# 期望看到: ---\nname: using-superpowers\ndescription: ...
```

---

### Task 4: 转换共享 skill — Codex 版（5 个）

**Files:**
- Source: `.claude/skills/{name}/SKILL.md`（5 个）
- Create: `.codex/skills/{name}/SKILL.md`（5 个）

共享 skill 列表：coding-standards, security-review, systematic-debugging, test-driven-development, verification-before-completion

这 5 个 skill 的 body 里没有 `/skill-name` 或 `CLAUDE.md` 引用（已核查），所以只需改 frontmatter。

- [ ] **Step 1: 逐个转换**

对每个 skill 执行：
1. 读 `.claude/skills/{name}/SKILL.md`
2. 替换 frontmatter 为只保留 `name` + `description`（去掉 `origin` 等）
3. Body 原封不动复制
4. 写到 `.codex/skills/{name}/SKILL.md`

**Frontmatter 映射：**

| Skill | Source frontmatter | Target frontmatter |
|-------|-------------------|-------------------|
| coding-standards | name, description, origin | name, description |
| security-review | name, description, origin | name, description |
| systematic-debugging | name, description | name, description |
| test-driven-development | name, description | name, description |
| verification-before-completion | name, description | name, description |

- [ ] **Step 2: 验证 5 个文件存在且 frontmatter 正确**

```bash
for skill in coding-standards security-review systematic-debugging test-driven-development verification-before-completion; do
  echo "=== $skill ===" && head -4 ".codex/skills/$skill/SKILL.md"
done
# 每个都应该显示 ---\nname: xxx\ndescription: xxx\n---
```

---

### Task 5: 转换共享 skill — Gemini 版（5 个）

**Files:**
- Source: `.claude/skills/{name}/SKILL.md`（5 个）
- Create: `.gemini/skills/{name}/SKILL.md`（5 个）

和 Task 4 完全相同的操作，目标改为 `.gemini/skills/`。

- [ ] **Step 1: 逐个转换**

同 Task 4 的步骤，写到 `.gemini/skills/{name}/SKILL.md`。

- [ ] **Step 2: 验证 5 个文件存在且 frontmatter 正确**

```bash
for skill in coding-standards security-review systematic-debugging test-driven-development verification-before-completion; do
  echo "=== $skill ===" && head -4 ".gemini/skills/$skill/SKILL.md"
done
```

---

### Task 6: 转换 Codex 专属 skill（4 个）

**Files:**
- Source: `.claude/skills/{name}/SKILL.md`（4 个）
- Create: `.codex/skills/{name}/SKILL.md`（4 个）

Codex-only skill 列表：api-design, api-contract, database-migrations, debug-ocr

- [ ] **Step 1: 逐个转换**

**特别注意 frontmatter 差异：**

| Skill | Source frontmatter | Target frontmatter |
|-------|-------------------|-------------------|
| api-design | name, description, origin | name, description |
| api-contract | description, globs, alwaysApply（**无 name**） | name: api-contract, description |
| database-migrations | name, description, origin | name, description |
| debug-ocr | description, globs, alwaysApply（**无 name**） | name: debug-ocr, description |

api-contract 和 debug-ocr 需要**添加** `name` 字段（用目录名）。

Body 部分：这 4 个 skill 均为通用技术内容或中文项目特定内容，没有 Claude-specific 引用，body 原封不动复制。

- [ ] **Step 2: 验证 4 个文件**

```bash
for skill in api-design api-contract database-migrations debug-ocr; do
  echo "=== $skill ===" && head -5 ".codex/skills/$skill/SKILL.md"
done
# api-contract 和 debug-ocr 应该有 name 字段
```

---

### Task 7: 转换 Gemini 专属 skill（1 个）

**Files:**
- Source: `.claude/skills/frontend-patterns/SKILL.md`
- Create: `.gemini/skills/frontend-patterns/SKILL.md`

- [ ] **Step 1: 转换 frontend-patterns**

1. 读源文件
2. Frontmatter: `name`, `description`, `origin` → 只保留 `name`, `description`
3. Body 原封不动
4. 写到 `.gemini/skills/frontend-patterns/SKILL.md`

- [ ] **Step 2: 验证**

```bash
head -4 .gemini/skills/frontend-patterns/SKILL.md
# 期望: ---\nname: frontend-patterns\ndescription: ...\n---
```

---

### Task 8: 更新 AGENTS.md

**Files:**
- Modify: `AGENTS.md`（约第 8-10 行的 Skill 段落）

- [ ] **Step 1: 修改 Skill 段落**

将 AGENTS.md 中现有的 Skill 段落（第 8-10 行）：

```markdown
## Skill

每次会话开始，先读 `.claude/skills/using-superpowers/SKILL.md` 并遵守其规则。
```

替换为：

```markdown
## Skill 使用

每次 session 开始，先读 `.codex/skills/using-superpowers/SKILL.md` 并遵守其规则。

可用 skill 列表：coding-standards, api-design, api-contract, database-migrations, security-review, systematic-debugging, test-driven-development, verification-before-completion, debug-ocr
```

- [ ] **Step 2: 验证修改**

```bash
grep -A 4 "## Skill" AGENTS.md
# 期望看到 .codex/skills/ 路径和 9 个 skill 列表
```

---

### Task 9: 修正 GEMINI.md

**Files:**
- Modify: `GEMINI.md`（约第 62-64 行的 Skill 使用段落）

- [ ] **Step 1: 修改 Skill 使用段落**

将 GEMINI.md 中现有的 Skill 使用段落（第 62-64 行）：

```markdown
## Skill 使用

每次会话开始时，先读 `.claude/skills/using-superpowers/SKILL.md` 并遵守其中的规则。
```

替换为：

```markdown
## Skill 使用

每次 session 开始，先读 `.gemini/skills/using-superpowers/SKILL.md` 并遵守其规则。

可用 skill 列表：coding-standards, frontend-patterns, security-review, systematic-debugging, test-driven-development, verification-before-completion
```

- [ ] **Step 2: 验证修改**

```bash
grep -A 4 "## Skill" GEMINI.md
# 期望看到 .gemini/skills/ 路径和 6 个 skill 列表
```

---

### Task 10: 最终验证 + Commit

**Files:** 所有新建和修改的文件

- [ ] **Step 1: 文件数量验证**

```bash
echo "Codex skills:" && ls .codex/skills/ | wc -l  # 期望: 10
echo "Gemini skills:" && ls .gemini/skills/ | wc -l  # 期望: 7
echo "Total SKILL.md files:" && find .codex/skills .gemini/skills -name "SKILL.md" | wc -l  # 期望: 17
```

- [ ] **Step 2: Frontmatter 格式验证**

```bash
# 检查所有 SKILL.md 都有 name 和 description
for f in $(find .codex/skills .gemini/skills -name "SKILL.md"); do
  echo "=== $f ==="
  head -5 "$f"
  echo ""
done
```

- [ ] **Step 3: AGENTS.md 和 GEMINI.md 路径验证**

```bash
grep ".codex/skills" AGENTS.md  # 应该有 .codex 路径
grep ".claude/skills" AGENTS.md  # 不应该有 .claude 路径（旧的）
grep ".gemini/skills" GEMINI.md  # 应该有 .gemini 路径
grep ".claude/skills" GEMINI.md  # 不应该有 .claude 路径（旧的）
```

- [ ] **Step 4: Commit**

```bash
git add .codex/skills/ .gemini/skills/ AGENTS.md GEMINI.md
git commit -m "feat: install skills for Codex CLI (10) and Gemini CLI (7)

- Add .codex/skills/ with 10 skills for backend development
- Add .gemini/skills/ with 7 skills for frontend development
- Rewrite using-superpowers for both with trigger tables
- Fix AGENTS.md and GEMINI.md to point to correct skill paths"
```

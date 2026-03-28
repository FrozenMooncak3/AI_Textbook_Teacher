# 会话日志系统设计

**日期**：2026-03-21
**状态**：已审核
**参与者**：项目负责人 + Claude（PM/架构师）

---

## 1. 问题

对话中产生的 insight（决策推理、被否决方案、用户想法）在 context compact 或新 session 后丢失。设计文稿只记录 WHAT，不记录 WHY 和 ALTERNATIVES。新 session 读设计文稿无法还原讨论时的思考脉络。

## 2. 方案

一个 Skill + 一个目录，形成项目级记忆系统。

### 2.1 目录结构

```
docs/journal/
├── INDEX.md                          ← 按状态分区的索引
├── 2026-03-21-mvp-redesign.md        ← 日志文件（按对话主题命名）
├── 2026-03-21-doc-cleanup.md
└── ...
```

### 2.2 日志文件格式

```markdown
---
date: YYYY-MM-DD
topic: 对话主题的简短描述
tags: [标签1, 标签2]
---

## 决策 + 为什么
（关键决策及其推理链、被否决的方案及原因）

## 用户 insight
（用户提出的重要想法、观察、判断）

## 待跟进
- [type:status] 描述
```

**追加规则**：同一天、同一文件名 slug 的对话追加到已有文件。追加时在文件末尾加 `---` 分隔线和新的 `## Session 2` 标题块，保留原有内容不动。判断"同主题"的依据是文件名 slug 精确匹配（如 `2026-03-21-mvp-redesign.md`），不做模糊匹配。

### 2.3 条目分类

**类型（type）——这条记录是什么：**

| 类型 | 说明 |
|------|------|
| `insight` | 认知、推理过程、发现 |
| `idea` | 产品或技术想法，也许未来做 |
| `issue` | 已识别的问题，需要解决 |
| `decision` | 决策的完整推理链 |

**状态（status）——它在哪个阶段：**

| 状态 | 说明 |
|------|------|
| `open` | 需要关注，还没处理 |
| `in_progress` | 正在解决 |
| `parked` | 停车，以后再说 |
| `resolved` | 已解决 / 已落地 |

### 2.4 INDEX.md 格式

```markdown
# Journal Index

## open（需要关注）
- [issue] 描述 → [file.md](./file.md)

## in_progress（解决中）
- [issue] 描述 → [file.md](./file.md)

## parked（停车场）
- [idea] 描述 → [file.md](./file.md)

## resolved（已解决）
- [decision] 描述 → [file.md](./file.md)
```

**INDEX.md 瘦身规则**：`resolved` 分区仅保留最近 30 天的条目。超过 30 天的 resolved 条目从 INDEX.md 移除（日志文件本身保留不删）。每次 session 开始扫描时顺手清理过期条目。

### 2.5 Skill

位置：`.claude/skills/journal/SKILL.md`

触发时机（写在 frontmatter description 中）：
1. 用户说"记一下"、"写日志"、调用 `/journal`
2. brainstorming 或重要讨论结束后
3. 用户在 compact 前主动触发（Claude 无法检测 compact 时机，由用户说"写日志"触发）
4. session 开始时扫描 INDEX.md

Skill body 完整内容见实现阶段产出的 `.claude/skills/journal/SKILL.md`。

### 2.6 CLAUDE.md 变更

**启动读取列表**改为：
```markdown
1. 读 `docs/project_status.md` — 当前状态与下一步
2. 读 `docs/decisions.md` — 已关闭的决策（不重新讨论）
3. 读 `docs/journal/INDEX.md` — 会话日志索引（跟踪未解决事项和想法停车场）
```

**"想法停车场处理流程"整段替换为**：
```markdown
## 想法与日志处理
当用户在开发过程中提出新想法或重要 insight 时：
1. **先评估**：这个想法是否正确？适合当前阶段还是未来？
2. **当前阶段**：纳入当前计划
3. **未来做 / 需要记住**：通过 journal skill 写入 `docs/journal/`，标注类型和状态
4. 不得跳过评估直接执行，也不得不记录就忽略
```

**协调文件**加一行：
```
- `docs/journal/` — 会话日志（想法、决策推理、待跟进）
```

**Claude 文件边界**更新：
```markdown
- **可写**：`docs/**`、`.claude/skills/**`、`CLAUDE.md`、`AGENTS.md`、`GEMINI.md`
```
（增加 `.claude/skills/**`，因为 skill 是流程文档，不是业务代码，属于 PM/架构师职责）

删除对 `docs/ideas_backlog.md` 的所有引用。

### 2.7 迁移

`docs/ideas_backlog.md` 条目迁移映射：

| ideas_backlog 分类 | → journal type:status |
|---|---|
| 待评估 | `idea:open` |
| 已评估 - 未来做 | `idea:parked` |
| 已纳入计划 | `idea:in_progress` |
| 已否决 | `idea:resolved`（备注"已否决"） |

迁移完成后删除 `docs/ideas_backlog.md`。

### 2.8 Codex / Gemini 交互

Journal 是 Claude（PM）的工具，Codex 和 Gemini **不读不写** journal 文件。它们的信息来源仍然是 `docs/project_status.md` + 实现计划文件。AGENTS.md 和 GEMINI.md 无需变更。

---

## 3. 不做

- 不做自动化 hook（Claude 无法检测 compact 时机，由用户手动触发或 brainstorming skill 自动触发）
- 不做日志文件的全文搜索工具（用 grep 够了）
- 不做复杂的文件归档系统（INDEX.md 30 天瘦身 + 日志文件永久保留，够用）

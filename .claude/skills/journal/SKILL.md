---
name: journal
description: |
  会话日志系统——记录对话中的决策推理、用户 insight、被否决方案、待跟进事项。
  Use when: (1) 用户说"记一下"/"写日志"/调用 /journal,
  (2) brainstorming 或重要讨论结束后,
  (3) compact 前用户主动触发,
  (4) session 开始时扫描 docs/journal/INDEX.md 检查过期条目。
  目录：docs/journal/，索引：docs/journal/INDEX.md。
---

# 会话日志 Skill

记录对话中产生的 insight、决策推理、被否决方案和待跟进事项，防止 compact 或新 session 后丢失。

## 目录

- `docs/journal/INDEX.md` — 按状态分区的索引（每次 session 开始读）
- `docs/journal/YYYY-MM-DD-<topic>.md` — 日志文件

## 触发后的操作

### 写日志（用户说"记一下"/"写日志"，或 brainstorming 结束后）

1. **判断文件**：今天是否已有同 slug 的日志文件？
   - 有 → 追加（末尾加 `---` 分隔线 + `## Session N` 标题块）
   - 无 → 新建文件，slug 用对话主题的英文短语（如 `mvp-redesign`、`doc-cleanup`）

2. **写入内容**，按以下结构：

```markdown
---
date: YYYY-MM-DD
topic: 对话主题简述
tags: [标签1, 标签2]
---

## 决策 + 为什么
- 选了什么方案，为什么
- 否决了什么方案，为什么

## 用户 insight
- 用户说的重要判断、观察、想法（尽量保留原话）

## 待跟进
- [type:status] 描述
```

3. **更新 INDEX.md**：将日志中的条目添加到对应状态分区。

### 条目分类

**类型（type）：**
| 类型 | 用途 |
|------|------|
| `insight` | 认知、推理、发现 |
| `idea` | 产品/技术想法，也许未来做 |
| `issue` | 已识别的问题，需要解决 |
| `decision` | 决策 + 完整推理链 |

**状态（status）：**
| 状态 | 用途 |
|------|------|
| `open` | 需要关注，还没处理 |
| `in_progress` | 正在解决 |
| `parked` | 停车，以后再说 |
| `resolved` | 已解决 / 已落地 |

### Session 开始时扫描 INDEX.md

1. 读 `docs/journal/INDEX.md`
2. 检查 `open` 和 `in_progress` 条目是否有状态变化（已解决的移到 `resolved`）
3. 清理 `resolved` 分区中超过 30 天的条目（从 INDEX.md 移除，日志文件保留）

### INDEX.md 格式

```markdown
# Journal Index

## open（需要关注）
- [type] 描述 → [YYYY-MM-DD-topic.md](./YYYY-MM-DD-topic.md)

## in_progress（解决中）
- [type] 描述 → [YYYY-MM-DD-topic.md](./YYYY-MM-DD-topic.md)

## parked（停车场）
- [type] 描述 → [YYYY-MM-DD-topic.md](./YYYY-MM-DD-topic.md)

## resolved（已解决）
- [type] 描述 → [YYYY-MM-DD-topic.md](./YYYY-MM-DD-topic.md)
```

## 边界

- Journal 是 Claude（PM）的工具，Codex 和 Gemini 不读不写
- 日志文件只记录 insight 和上下文，不记录实现细节（实现细节在计划文件和代码里）
- 不替代 `docs/decisions.md`（decisions.md 是已关闭决策的权威列表，journal 记录决策的推理过程）

---
name: memory-cleanup
description: 周期性清理陈旧 journal / decisions / 老 spec，搬到 docs/archive/YYYY-QN/，合并摘要写回 INDEX 指针。用户每季度或感觉文档膨胀时手动调用 /memory-cleanup。**搬不删**，git 可找回。
---

# Memory Cleanup

> 反误删 3 层保护：每次扫描 ≤10 条候选 / 用户逐条 y/n 确认（默认 no）/ 搬不删（git 追踪可找回）

## 流程

### Step 1: 扫描候选

**唯一权威源是 frontmatter `date` 字段**——文件 mtime 在 fresh clone 后会全部重置，会把老文件误判为新。mtime 只能粗筛。

```bash
# mtime 仅作粗筛 hint
find docs/journal -name "*.md" -mtime +180 2>/dev/null | head -20
```

具体识别算法（**以 frontmatter date 为准**）：
- `status: resolved` 且 frontmatter `date` 距今 > 6 个月 → 候选
- `status: parked` 且 `urgency: normal` 且 frontmatter `date` 距今 > 12 个月 → 候选
- 不动 `status: open / in_progress`
- 不动 `urgency: infra-affecting / trigger-date:*` 项

### Step 2: 给用户清单

输出格式（每次最多 10 条）：

```
候选清单（搬到 docs/archive/2026-Q2/）：

1. [resolved 240天前] docs/journal/2026-03-22-m0-verification.md — M0 最终验证通过
   keywords: [m0, verification, foundation]
   y/n? [n]: _

2. ...
```

### Step 3: 用户逐条 y/n（默认 no）

只处理 y 的项。

### Step 4: 搬运（不删）

```bash
mkdir -p docs/archive/YYYY-QN
git mv <原路径> docs/archive/YYYY-QN/
```

### Step 5: 合并摘要

在 `docs/archive/YYYY-QN-summary.md` 追加：

```markdown
## <原文件名>
- date: ...
- topic: ...
- 摘要: <从原文 1 段提炼>
- 原 link: <archive 后的相对路径>
```

### Step 6: 更新 INDEX

把原 INDEX 中该条改为指向 archive：
```
- [archived] <原描述> → [archive](archive/YYYY-QN/<file>.md)
```

### Step 7: Commit

```bash
git add -A
git commit -m "chore(memory-cleanup): archive N stale entries from <category>"
```

---

## 反误删契约

- 一次 ≤ 10 条候选
- 用户逐条 y/n，默认 no
- 搬不删，git 历史保留
- 如果用户 30 天内 revert，无任何信息丢失

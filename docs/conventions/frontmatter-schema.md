# Frontmatter Schema for docs/

> 适用于 docs/journal/*.md、docs/research/*.md、docs/superpowers/specs|plans/*.md
> 强制字段缺失 → claudemd-check 报错

## 必填字段

| 字段 | 类型 | 取值 | 用途 |
|------|------|------|------|
| `date` | YYYY-MM-DD | ISO 日期 | 时间排序 |
| `topic` | string | 中文一句话 | INDEX 一行展示 |
| `type` | enum | `journal` \| `research` \| `spec` \| `plan` \| `decision` | 路由到对应 INDEX |
| `status` | enum | `open` \| `in_progress` \| `parked` \| `resolved` | memory-cleanup 候选判定 |
| `keywords` | array[string] | 3-5 个，中英混排 OK | brainstorming INDEX 相关性匹配 |

## 可选字段（仅 parked 状态）

| 字段 | 取值 | 用途 |
|------|------|------|
| `urgency` | `infra-affecting` \| `trigger-date:YYYY-MM-DD` \| `normal` | session-init 停车场扫描决定是否拉出 |

## 完整示例

```yaml
---
date: 2026-04-15
topic: Session-init token 优化设计
type: spec
status: in_progress
keywords: [session-init, token, index, frontmatter, memory-cleanup]
---
```

## Parked 示例

```yaml
---
date: 2026-04-11
topic: 测试 Dashboard 想法
type: journal
status: parked
keywords: [testing, dashboard, analytics]
urgency: normal
---
```

## 规则

- `date` 从文件名 `YYYY-MM-DD-*` 前缀提取
- `topic` 一句话中文摘要，不超 30 字
- `keywords` 3-5 个，优先覆盖：技术栈名、功能域、里程碑名
- `status` 对照 project_status.md / journal INDEX.md 当前分类判断
- research 文件落盘即 `resolved`，除非用户标 in_progress
- journal parked 项的 `urgency`：T1 级（当前里程碑必做 / 横切影响）→ `infra-affecting`；有明确触发日期 → `trigger-date:YYYY-MM-DD`；其他 → `normal`

---
date: 2026-04-12
topic: 深度调研派发Agent Skill设计
type: journal
status: parked
keywords: [调研, agent, 可信来源, 质量保证, skill]
urgency: normal
---

# 深度调研派发 Agent Skill

**类型**: idea
**状态**: parked
**日期**: 2026-04-12
**分类**: 工程流程
**Tier**: T2

## 想法

设计一个专门的 skill，用于派发深度调研任务给 agent。目标是保证调研质量，而非在网上随便搜到什么就放进结果。

## 需要解决的问题

1. Agent 调研时如何筛选可信来源（学术 vs 博客）
2. 如何要求 agent 提供量化证据和交叉验证
3. 调研结果的格式模板（来源分级、证据强度标注）
4. 多个调研方向的并行派发策略

## 临时方案

当前 session 手动制定了调研质量标准（来源分级 + 4条硬规则），直接写入 agent prompt。未来应产品化为 skill。

## 处置

parked T2，当前 session 手动处理，后续独立评估是否值得做成正式 skill。

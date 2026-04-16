---
date: 2026-04-03
topic: 里程碑审计Skill设计与自动化
type: journal
status: resolved
keywords: [milestone-audit, skill, 接口契约, 自动化审计]
---

# Milestone Audit Skill

**类型**: idea
**状态**: parked
**日期**: 2026-04-03

## 想法

创建独立 skill `milestone-audit`，在每次里程碑结束时审计接口契约。

当前 architecture.md 的维护靠"记得更新"，但 M3→M4 审计发现 6 个断裂点证明这不够可靠。需要结构化的审计流程。

## 设计草案

- **触发**：里程碑任务全部完成后、closeout 前
- **流程**：
  1. 读 git diff（里程碑分支 vs master）看本轮改了哪些接口
  2. 读当前 architecture.md 接口契约
  3. 逐条对比：哪些契约被改变？有没有新跨模块依赖？
  4. 检查 ⚠️ 标记：已修复的摘掉，新产生的标上
  5. 输出审计报告 + 更新 architecture.md
  6. 为下个里程碑 brainstorming 标注接口风险点
- **chain 位置**：review 之后、closeout 之前

## 处置

parked。下次里程碑收尾时优先考虑实施，当前 structured-dispatch 和 requesting-code-review 已补了轻量检查作为临时方案。

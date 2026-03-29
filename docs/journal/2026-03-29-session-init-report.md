# Session Init 全局报告 Skill/Hook

**类型**: idea
**状态**: parked
**日期**: 2026-03-29

## 想法

每次 session-init 时自动产出一个综合报告，覆盖：
- **Memory**：用户偏好、反馈记忆摘要
- **Journal**：open / in_progress / parked 各项，特别是与当前里程碑相关的 parked 项
- **项目状态**：当前里程碑进度、下一步
- **Claude 见解**：基于以上信息给出建议（比如"停车场有条目与当前工作相关，建议处理"）

## 背景

M2 期间 session-init 读了 journal INDEX 但没有主动检查 parked 项与当前里程碑的匹配关系，导致"安装 UI/UX Pro Max Skill 给 Gemini"这条 parked idea 被完全遗漏。需要一个系统化机制防止再次发生。

## 实现方向

可能是增强 session-init skill，也可能是独立的 hook 或 skill。需要 brainstorm 确定最佳形式。

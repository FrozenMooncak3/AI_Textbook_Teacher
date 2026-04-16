---
date: 2026-03-28
topic: Skill自动化brainstorming首轮完成
type: journal
status: resolved
keywords: [skills, CCB, brainstorming, Codex, Gemini]
---

## 决策 + 为什么

- **选方案 A**：从我们现有 Claude skill 转换，不从 ECC 搬。理由：我们的 skill 已为本项目定制（含产品不变量），单一来源维护简单
- **目录分离**：`.codex/skills/` 和 `.gemini/skills/` 各自独立，不用 `.agents/skills/` 通用 fallback。理由：两者命令前缀不同（$ vs /），需要分开文件
- **加 using-superpowers**：两者各自有 trigger table 版本，这是让 agent 主动用 skill 的关键
- **信任 + 验证（B 方案）**：装好 skill 后，观察 agent 是否主动使用；不生效再考虑 hook 强制检查

## 用户 insight

- "真正用 skill 和 prompt 是两种效果" — skill 不是 prompt 的替代，必须实际安装才能发挥作用
- "调研不能白跑" — 三个仓库的发现不止 skill 问题，还有 hook 体系等，要分三次 brainstorming 落地
- 关于 model 节省：Opus max 用于设计/规划，Sonnet medium 用于机械执行

## 完成内容（第一次 brainstorming）

- Codex CLI：安装 10 个 skill（.codex/skills/）
- Gemini CLI：安装 7 个 skill（.gemini/skills/）
- AGENTS.md + GEMINI.md 路径修正
- Commit: `fafede3`
- 调研文档：`docs/superpowers/specs/2026-03-28-repo-research-findings.md`

## 第三次 brainstorming（2026-03-28 第二轮会话）

### 评估结果

| ID | 内容 | 决定 | 理由 |
|----|------|------|------|
| H6 | Skill reference 子目录 | **砍** | 领域知识已在 prompt 模板和 spec 里，reference 是重复真相源 |
| H7 | 跨 skill 调用链 + 强制前置 | **做** | 融入 session-init，防跳步 + 自动串联 |
| H8 | GitHub Action review | **砍** | 当前不走 PR 流程，已有 CCB review 机制 |
| H9 | Session 持久化 | **做（改进版）** | 不另建系统，做"上下文加载器"串联现有机制 |
| H10 | Instinct 持续学习 | **做（轻量版）** | 降级为手动 retrospective skill，不自动跑 |
| H11 | 结构化 handoff | **已完成** | structured-dispatch skill |
| H12 | allowed-tools 限制 | **砍** | 现有 hook 尚未充分验证，不加复杂度 |
| H13 | Profile-based hook | **砍** | 同上 |
| H14 | 持久化项目上下文 | **已有** | project_status.md |

### 用户 insight

- "Skill 太多了，记不住" — 需要减少用户面对的 skill 数量，只留 3 个入口级
- H10 不要每次会话自动反思，太耗 token，做成手动 skill 定期跑
- H9 现有机制不缺，缺的是"把它们串到一起的东西"

### 设计产出

- Spec: `docs/superpowers/specs/2026-03-28-session-init-retrospective-design.md`
- 三个组件：session-init（H9+H7）、skill chain 声明（H7）、retrospective（H10）
- 用户面向 skill 精简为 3 个：brainstorming、retrospective、claudemd-check

### 当前状态

- **已完成**：spec review 通过 → writing-plans 完成 → subagent-driven 执行完毕
- 全部 7 个任务完成：2 个 skill 创建 + 8 个文件更新 + 1 个 hook 更新

## 待跟进

- [issue:resolved] 重启后验证 Codex/Gemini 能否看到 skill list — 已确认可见（2026-03-28）
- [decision:resolved] 第二次 brainstorming：Claude hook 自动化 — 已实施，commit 09aaaef
- [decision:resolved] 第三次 brainstorming：全部实施完成（2026-03-28）

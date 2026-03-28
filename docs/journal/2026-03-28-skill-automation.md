---
date: 2026-03-28
topic: Skill 自动化三次 brainstorming — 第一次完成
tags: [skills, codex, gemini, ccb, brainstorming]
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

## 待跟进

- [issue:open] 重启后验证 Codex/Gemini 能否看到 skill list；如不生效排查路径或格式问题
- [decision:open] 第二次 brainstorming：Claude 自己的 skill 自动化 + hook 体系（H1-H5）
- [decision:parked] 第三次 brainstorming：其他改进（H6-H14，含 GitHub Action、session 持久化、instinct 系统等）

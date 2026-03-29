# Wezterm 报告自动提交问题

**类型**: idea
**状态**: parked
**日期**: 2026-03-29

## 问题

所有方向的 wezterm send-text 都存在"只粘贴不提交"的问题：
- Codex/Gemini → Claude：报告只粘贴到输入框，不自动提交
- Claude → Codex/Gemini：派发指令有时也只粘贴不发送

即三个角色互相发消息时都可能出现此问题，不仅仅是报告方向。

## 可能的修复方向

- 修改 AGENTS.md 和 GEMINI.md 中的报告发送指令，确保在 send-text 后追加 `printf '\r' | wezterm cli send-text --pane-id 0 --no-paste`
- 或改用写文件 fallback（`.codex-report.md` / `.gemini-report.md`）+ hook 监听

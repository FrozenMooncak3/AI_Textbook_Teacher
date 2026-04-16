---
date: 2026-03-29
topic: Wezterm报告自动提交问题及修复
type: journal
status: resolved
keywords: [wezterm, send-text, no-paste, 自动提交]
---

# Wezterm 报告自动提交问题

**类型**: idea
**状态**: resolved
**日期**: 2026-03-29
**解决日期**: 2026-03-30

## 问题

所有方向的 wezterm send-text 都存在"只粘贴不提交"的问题：
- Codex/Gemini → Claude：报告只粘贴到输入框，不自动提交
- Claude → Codex/Gemini：派发指令有时也只粘贴不发送

即三个角色互相发消息时都可能出现此问题，不仅仅是报告方向。

## 根因

所有方向都使用了 `--no-paste` 发送内容。`--no-paste` 把每个字节当键盘事件，导致内容中的 `\n` 被解释为 Enter 键，报告还没发完就被提前提交。

## 修复

- **内容发送**：去掉 `--no-paste`，走 bracketed paste 协议（换行符保持字面值）
- **提交发送**：保留 `--no-paste`，让 `\r` 成为真正的 Enter 键
- **中间加 `sleep 1`**：确保 paste 处理完再按 Enter

已修改文件：AGENTS.md、GEMINI.md、memory/feedback_wezterm-dispatch-method.md

# CCB 文件消息系统

**类型**: infra
**状态**: resolved（2026-04-02）
**日期**: 2026-04-02

## 背景

CCB `ask` 命令和 `wezterm cli send-text` 对长消息都不可靠。反复在两种方式间切换仍无法解决。

## 决策

完全替代 `ask`，改用"写文件到 `.ccb/inbox/` + 短 wezterm 通知"。

## 关键发现

1. **PowerShell 管道问题**：Codex/Gemini 在 PowerShell 环境，`echo | wezterm cli send-text` 管道不可靠
2. **解决方案**（由 Codex 和 Gemini 研究得出）：使用位置参数 + 嵌入回车
   ```powershell
   wezterm cli send-text --pane-id 0 --no-paste "消息内容`r"
   ```
3. **双向通信已验证**：Claude↔Codex、Claude↔Gemini 全部测试通过

## 实施范围

8 个 task，全部在 Claude 文件边界内，subagent-driven 执行：
- T0: .gitignore + inbox 目录
- T1: ccb-protocol.md 重写
- T2-T3: AGENTS.md、GEMINI.md 更新
- T4-T6: structured-dispatch、session-init、api-contract skills 更新
- T7: 端到端验证

## 文档

- Spec: `docs/superpowers/specs/2026-04-02-ccb-file-messaging-design.md`
- Plan: `docs/superpowers/plans/2026-04-02-ccb-file-messaging.md`

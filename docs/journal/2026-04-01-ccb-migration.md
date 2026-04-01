# CCB 迁移到 Claude Code Bridge v5.2.6+

**类型**: infra
**状态**: in_progress（通信层待验证）
**日期**: 2026-04-01

## 背景

从手动 `wezterm cli send-text` 迁移到 Claude Code Bridge (CCB) 官方工具。
原因：send-text 在 Windows WezTerm 上有时无法提交（Enter 不生效），远程操控会卡住。

## 迁移内容

### 已完成
1. 安装 CCB v5.2.9 (`install.ps1`)
2. Python 3.11 + CCB bin 加入用户 PATH
3. `CCB_WEZTERM_ENTER_METHOD=key` 设为用户级 + WezTerm 环境变量
4. 通信方式从 `wezterm cli send-text` + sleep + Enter 改为 `ask codex/gemini "message"`
5. `.ccb/ccb.config` 项目级配置（codex,gemini）
6. `docs/ccb-protocol.md` 更新（新增 Section 0 + 异步规则）
7. `structured-dispatch` skill 更新
8. Memory + journal 更新
9. AGENTS.md / GEMINI.md 已使用 `ask claude`，无需改动

### 布局回退
CCB 自动布局（`ccb -a -r codex gemini`）在 Windows WezTerm 上不稳定——主 pane 无法启动 Claude，只剩 Codex 和 Gemini。回退到 `.wezterm.lua` 手动三栏布局（验证可用）。

**最终方案**：布局由 `.wezterm.lua` 手动管，通信由 CCB daemon 层管。两件事分开。

### 待验证
- CCB `ask codex/gemini` 通信是否可靠（需要下次派发任务时实测）

## 环境

- Python 3.11.4: `D:/已恢复/Users/Sean/AppData/Local/Programs/Python/Python311/python.exe`
- WezTerm: 20240203-110809-5046fc22（最新 stable）
- `.wezterm.lua` 已备份为 `.wezterm.lua.bak.20260401`

## 需要更新的文档

- `docs/ccb-protocol.md` — 派发流程改为 `ask` 命令
- Memory: wezterm dispatch method、ccb pane layout 等
- `AGENTS.md` / `GEMINI.md` — 完成报告方式可能变化

## CCB 关键命令

| 旧方式 | 新方式 |
|--------|--------|
| `cat file \| wezterm cli send-text --pane-id X` | `ask codex "message"` |
| `printf '\r' \| wezterm cli send-text --pane-id X --no-paste` | (ask 自动提交) |
| `wezterm cli list` 看 spinner | `ccb-ping codex/gemini` |
| 手动 wezterm split-pane | `ccb -a codex gemini` 自动布局 |

# CCB 迁移到 Claude Code Bridge v5.2.6+

**类型**: infra
**状态**: resolved（2026-04-02 验证通过）
**日期**: 2026-04-01（更新 2026-04-02）

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

### 2026-04-02 修复：CCB_WEZTERM_ENTER_METHOD
- 发现 `wezterm cli send-key` 在任何稳定版 WezTerm（含最新 20260331）中都不存在
- CCB README 推荐的 `CCB_WEZTERM_ENTER_METHOD=key` 是错的——只走 send-key 路径不 fallback，Enter 永远发不出
- 修复：环境变量从 `key` 改为 `text`，直接走 `\r` via send-text

### 验证结果（2026-04-02）
- `ccb-ping codex/gemini` ✅
- `ask codex` → Codex 收到并处理 ✅
- `ask gemini` → Gemini 收到并回复 CCB_DONE ✅
- `CCB_WEZTERM_ENTER_METHOD=text` 用户级已生效 ✅
- 注意：当前 shell 需 `export CCB_WEZTERM_ENTER_METHOD=text`（新 WezTerm 窗口自动继承）
- 已知问题：Codex 偶发 UTF-8 流错误（中文路径 `已恢复`），重试后正常

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

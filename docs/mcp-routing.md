# MCP 路由指南

> 本文件**不在**开机读列表里（不加 CLAUDE.md `@import`），平时 0 占用。
> 用户触发"我要用 X"时，Claude 主动读一次本文件并按下表引导。

## 触发规则

当用户说出以下话术之一时，Claude 读本文件并按对应工作区引导：
- "我要用 Stitch" / "我要做设计" → Stitch 工作区
- "我要用 YouTube" / "我要抓字幕" → YouTube 工作区
- "我要用 Gmail" / "我要用 Calendar" / "我要用 Drive" → Claude.ai connectors 模式

## 各工作区位置与启动方式

### Stitch（设计生成）
```
工作区: D:\workspaces\stitch\
启动:
  1. 当前会话用 /clear 或 /compact 保存进度
  2. 打开新终端
  3. cd D:\workspaces\stitch
  4. claude
```
工作区内含预配置 `.mcp.json`，启动后 Stitch 自动可用。

### YouTube（字幕抓取）
```
工作区: D:\workspaces\youtube\
启动:
  1. /clear 或 /compact
  2. cd D:\workspaces\youtube
  3. claude
```

### Gmail / Google Calendar / Google Drive（Claude.ai 内置 connectors）
这三个是 Claude.ai 账号级集成，由全局开关控制。
```
启动：
  1. 退出所有 Claude Code 会话
  2. 编辑 C:\Users\Administrator\.claude.json
     找到 "tengu_claudeai_mcp_connectors": false
     改成 "tengu_claudeai_mcp_connectors": true
  3. 重新启动 claude
  4. 用完后按相反步骤改回 false，省 ~1.8k tokens
```

## 工作区选择原则

- **一次只用一种 MCP** → 去对应工作区
- **同时用多种 MCP（罕见）** → 复制某个工作区的 `.mcp.json`，追加需要的 server 块
- **回主项目前** → Claude 会自动跑 claudemd-check，发现残留 MCP 配置会问是否清理

## 回主项目

任何工作区用完后：
```
1. /clear 退出该会话
2. cd d:\已恢复\Users\Sean\ai-textbook-teacher
3. claude
```
主项目常驻 0 MCP，不受影响。

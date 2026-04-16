---
date: 2026-04-15
topic: claude-mem repo 零件级分析（session-init token 优化调研 D1）
type: research
status: resolved
keywords: [claude-mem, session上下文, 向量库, SQLite, MCP]
triage: 🔴
template: A
budget: 25min
sources: { S: 4, A: 1, B: 0 }
---

# claude-mem 零件级分析

## 1. 它是什么（生活类比）

想象你有个保姆，每天上班时都要把你家从早到晚的每一句话录音、剪辑、打标签，然后把"今天重要的事"贴在冰箱上。第二天新保姆来了，只看冰箱就能接手。claude-mem 就是给 Claude Code 做这件事的插件：它挂接 Claude Code 的生命周期钩子，自动捕获所有工具调用（读了什么文件、改了什么代码），用 AI 压缩成"观察记录"（observations），存进本地 SQLite + Chroma 向量库，下次新会话启动时通过 MCP 搜索工具按需取用。它不是给 CLAUDE.md 瘦身的工具，是给**整个会话历史**做压缩归档的工具。

## 2. 核心机制

源头是 README + architecture docs（见下方引用）。五大组件：

| 组件 | 作用 |
|------|------|
| **5–6 个 Lifecycle Hooks** | `SessionStart` / `UserPromptSubmit` / `PostToolUse` / `Stop` / `SessionEnd` + `PreToolUse(Read)`；通过 `plugin/hooks/hooks.json` 注入 Claude Code |
| **Worker Service** | 本地常驻 Bun HTTP 服务，监听 `localhost:37777`，管理 10 个搜索端点 + Web Viewer UI |
| **SQLite + FTS5** | 存会话、观察、摘要；FTS5 做全文索引 |
| **Chroma 向量库** | 混合检索（语义 + 关键词），需要 Python 的 `uv` 包管理器自动安装 |
| **mem-search Skill + 4 个 MCP 工具** | 三层工作流：`search`（拿 ID 索引，50–100 token/条）→ `timeline`（拿时间上下文）→ `get_observations`（只对筛出的 ID 拉全文，500–1000 token/条）；官方称"~10x token savings" |

这个项目的设计哲学叫 **Progressive Disclosure**（渐进披露）—— 这点和我们的 Route D 多层索引思路高度一致。

## 3. 可借鉴零件（CLAUDE.md 5 问）

### 零件 A：三层工作流（search → timeline → get_observations）

| 5 问 | 答案 |
|------|------|
| **是什么** | 像先翻书的目录、再看章节摘要、最后只翻需要那一页。先拿紧凑索引（只有 ID + 一行描述），决定要看哪条再拿全文。 |
| **现在的代价** | 零金钱成本；约 0.5 天：重写 session-init 让它只读 `INDEX.md`（索引层），在 skill chain 里加一条"读到 trigger keyword 才 hydrate"的规则。 |
| **能力** | 把 "know everything exists" 和 "fully loaded" 分离。启动时 token 预算可以压到 ≤10%；真要细节时再"点进去"。 |
| **关闭的门** | 几乎不关门。如果将来要换更激进的策略（向量检索），这个分层仍然兼容。 |
| **选错代价** | 极低。纯文档约定 + skill 路由，改回来就是把 INDEX 合并回原文件。 |

**结论：强烈借鉴。这是本次调研最值钱的零件。**

---

### 零件 B：Hook 驱动的"自动归档"管道（PostToolUse / Stop → 压缩 → 落盘）

| 5 问 | 答案 |
|------|------|
| **是什么** | 保姆下班前自动写交接日志。claude-mem 在 `Stop` hook 里跑 AI 压缩，把当天会话变成观察记录。 |
| **现在的代价** | 中等。我们要自己写 hook 脚本（Windows 下还要解决 bash → cmd/powershell 兼容），并对接一个本地后台 worker。估计 2–3 天。 |
| **能力** | journal / decisions / parking lot 的更新不再靠人手工提醒，会话结束自动写入。 |
| **关闭的门** | 会让 CCB 多模型协作复杂化（Codex / Gemini 会话是否也要挂钩？如果只挂 Claude 的，记忆会不对称）。增加调试面。 |
| **选错代价** | 中。hook 挂错会在每次会话启动/结束多花 10–60s；卸载只需删 `settings.json` 中几行，但期间写入的数据需要人工清理。 |

**结论：**原理借鉴，实现**不借鉴代码**。claude-mem 的 hook 命令是长串 bash 单行（见 `plugin/hooks/hooks.json`），写死了 `$HOME/.nvm`、`/opt/homebrew`、`curl`、`sleep` —— 在 Windows 11 bash shell 下需要重写一半。且 AGPL-3.0（见第 5 节）意味着**不能复制代码**，只能重新实现思想。

---

### 零件 C：Observation 数据结构 + `<private>` 私有标签

| 5 问 | 答案 |
|------|------|
| **是什么** | 每条归档记录有统一 schema（id、类型：bugfix/feature/decision、timestamp、project、content），并支持 `<private>` 标签跳过存储。 |
| **现在的代价** | 极低。我们 `docs/journal/`、`docs/decisions.md`、`docs/research/` 加个 frontmatter schema（type / status / trigger_keywords / summary_line），就能在 INDEX.md 自动生成紧凑索引。 |
| **能力** | INDEX 可以机器生成，不用手动维护；一致的 schema 也让 cleanup skill 更容易扫描"过期触发器"。 |
| **关闭的门** | 几乎不关门。frontmatter 只是约定。 |
| **选错代价** | 极低。schema 可随时演化。 |

**结论：强烈借鉴（约定层）。**

---

### 零件 D：Web Viewer UI + 10 个搜索端点

| 5 问 | 答案 |
|------|------|
| **是什么** | 本地 37777 端口的实时内存流 Web UI。 |
| **现在的代价** | 高（对我们而言没必要）。要起 Bun 常驻 + Chroma + Python 依赖。 |
| **能力** | 可视化搜索；对调试有价值。 |
| **关闭的门** | 显著。Bun + Chroma + uv 三个新依赖在 Windows 11 上安装体验不稳，且 Chroma/向量 API 若将来换 provider 会牵连很多。 |
| **选错代价** | 高。一旦团队习惯 UI，再退回纯文本索引会有阻力。 |

**结论：不借鉴。**和我们"$0/月、文档为主"的 MVP 定位严重不匹配。

---

### 零件 E：Setup Hook 的"cached dependency checker"（smart-install.js）

| 5 问 | 答案 |
|------|------|
| **是什么** | 每次启动前用一个轻量脚本先"检查依赖是否齐"，齐了就跳过，快；不齐才真正安装。 |
| **现在的代价** | 低。概念直接迁移到我们的 session-init：启动时先 stat 一下 INDEX 哈希，未变就不重读正文。 |
| **能力** | 让 session-init 在"无事发生"时接近 0 成本。 |
| **关闭的门** | 无。 |
| **选错代价** | 极低。 |

**结论：借鉴思想（缓存校验模式）。**

## 4. 整体采纳建议

**强烈不建议整体采纳。** 三条独立的红线：

1. **AGPL-3.0 license**（见第 5 节）— 一旦我们把 claude-mem 作为依赖或复制其代码，根据 AGPL 的网络服务条款，我们的 Next.js 应用整体可能被要求开源（这是 AGPL 专门针对"SaaS 逃逸"补的洞）。对将来做订阅付费的 teaching mode 是**致命红线**。
2. **Windows 11 兼容性差** — hook 命令使用 `$HOME/.nvm`、`/opt/homebrew`、`sleep`、嵌套 `$(...)` 等 Unix bash 构造；setup 依赖 Bun + Python `uv` + Chroma。每一项在 Win11 下都是单独的痛点。
3. **和 CCB 多模型架构冲突** — claude-mem 假设 single-Claude session。Codex / Gemini 的工具调用不会走它的 `PostToolUse` hook，记忆层会和实际工作状态脱节。

**结论：沿用 Route D —— 零件级借鉴 A、C、E，原理级借鉴 B，完全不碰 D。**

## 5. License + Windows + 中国可达性 + CCB 兼容性

| 维度 | 结论 | 证据 |
|------|------|------|
| **License** | ❌ **AGPL-3.0**（最强 copyleft） | `LICENSE` 文件首行 "GNU AFFERO GENERAL PUBLIC LICENSE Version 3"；`package.json` `"license": "AGPL-3.0"` |
| **Windows 11 兼容** | ⚠️ 部分。README 有"Windows Setup Notes"段，但 hook 代码明显 Unix-first（bash here-strings、nvm 路径、homebrew 路径） | 见 `plugin/hooks/hooks.json` |
| **中国可达性** | ✅ GitHub 可访问；❌ `docs.claude-mem.ai` 和 `install.cmem.ai` 依赖域名可达性（CDN 在境外，可能间歇）；❌ 默认模型走 `api.anthropic.com`（直连国内不通，需中转） | 官网链接 README |
| **成本档位** | ✅ 代码本身免费；但运行需要 Anthropic API key（压缩步骤调用 Claude SDK），按用量计费（非 $0/月） | README "compresses it with AI (using Claude's agent-sdk)" |
| **CCB 兼容** | ❌ 为 single-Claude 设计；可选 Gemini CLI 但不支持三模型并行 | README "install --ide gemini-cli" |
| **CLAUDE.md 产品不变量** | ✅ 不会推我们暴露 API key / 用 `any` / 违反不变量 —— 前提是只借**思想**不集成代码 | — |

**AGPL 决定性结论：即使代码再好，也不能 `npm install` 它、不能 `fork` 它、不能复制它的代码片段进我们的 repo。只能读它的文档和架构，自己重新实现。**

## 引用源

### [S] GitHub Repo 元数据（官方 · 2026-04-14 活跃）
- **Claim**: claude-mem 使用 AGPL-3.0 许可证
- **Quote**: `"license": "AGPL-3.0"` — 同时 LICENSE 文件首行 "GNU AFFERO GENERAL PUBLIC LICENSE Version 3, 19 November 2007"
- **URL**: https://github.com/thedotmack/claude-mem/blob/main/LICENSE
- **Tier**: S · 一手源，许可证文件即法律效力文本
- **Project implication**: 绝对不可整体采纳；零件级借鉴只能复用思想，不能复制代码

### [S] 官方 README（2026-04-14 最新 push）
- **Claim**: 核心机制是 5–6 个生命周期 hook + Bun worker + SQLite(FTS5) + Chroma 向量库 + mem-search skill
- **Quote**: "5 Lifecycle Hooks - SessionStart, UserPromptSubmit, PostToolUse, Stop, SessionEnd (6 hook scripts) ... Worker Service - HTTP API on port 37777 ... SQLite Database ... Chroma Vector Database"
- **URL**: https://github.com/thedotmack/claude-mem/blob/main/README.md
- **Tier**: S · 项目自述
- **Project implication**: 架构复杂度远超我们需求；borrow 思想即可

### [S] 官方 README —— 三层搜索工作流
- **Claim**: "search → timeline → get_observations" 三层模式声称 ~10x token 节省
- **Quote**: "Start with `search` to get an index of results ... Use `get_observations` to fetch full details for relevant IDs ... ~10x token savings by filtering before fetching details"
- **URL**: https://github.com/thedotmack/claude-mem/blob/main/README.md#mcp-search-tools
- **Tier**: S
- **Project implication**: 这是 Route D 多层索引 + 按需 hydrate 的现成参考模型，可直接映射为"INDEX.md → 摘要 → 全文"三层

### [S] plugin/hooks/hooks.json（一手代码）
- **Claim**: Hook 命令是长串 bash 单行，写死 Unix 路径（`$HOME/.nvm`、`/opt/homebrew/bin`），Windows 下需要重写
- **Quote**: `export PATH="$HOME/.nvm/versions/node/v$(ls \"$HOME/.nvm/versions/node\" 2>/dev/null | sed 's/^v//' | sort -t. -k1,1n -k2,2n -k3,3n | tail -1)/bin:$HOME/.local/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"`
- **URL**: https://github.com/thedotmack/claude-mem/blob/main/plugin/hooks/hooks.json
- **Tier**: S · 代码直读
- **Project implication**: 整体安装在 Win11 bash 下会部分失败；即便只 borrow hook 模式也要从零写 PowerShell/cmd 兼容版

### [A] GitHub 仓库统计（API · 2026-04-15 实时）
- **Claim**: 仓库非常活跃且有规模 —— 55,812 star、4,485 fork、267 open issues，近一周多次 commit（最后 push 2026-04-14）
- **Quote**: `"stargazers_count": 55812, "forks_count": 4485, "open_issues_count": 267, "pushed_at": "2026-04-14T22:30:32Z"`
- **URL**: https://api.github.com/repos/thedotmack/claude-mem
- **Tier**: A · GitHub API 数字可信，但作者 Alex Newman 暂无其他可验证的 S 级技术输出履历，仓库本身未被 Simon Willison / Martin Fowler 类 S 级人物公开引用
- **Project implication**: 维护活跃 → 文档会持续演进，值得长期关注；但不代表架构适合我们的场景

## 源质量自检（强制）

- **S 源**：4（LICENSE 文件、README 主体、README 搜索工作流段、hooks.json 代码）
- **A 源**：1（GitHub API 统计）
- **B 源**：0
- **URL 可打开性**：
  - ✅ https://github.com/thedotmack/claude-mem/blob/main/LICENSE
  - ✅ https://github.com/thedotmack/claude-mem/blob/main/README.md
  - ✅ https://github.com/thedotmack/claude-mem/blob/main/README.md#mcp-search-tools
  - ✅ https://github.com/thedotmack/claude-mem/blob/main/plugin/hooks/hooks.json
  - ✅ https://api.github.com/repos/thedotmack/claude-mem
- **未查到的项**：没查到 —— 作者 Alex Newman (@thedotmack) 的 S 级技术输出履历（未找到书、papers、大会 keynote 记录），故未能提升为 S 级来源。
- **声明**：**所有数字/引用来自引用源，非训练记忆。** 每一条 claim 都有对应 URL，每个数字（55812 star、4485 fork、267 issue、端口 37777、v12.1.0、Node ≥18）都来自 GitHub API 或仓库文件实时抓取。

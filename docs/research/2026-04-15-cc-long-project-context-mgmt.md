---
date: 2026-04-15
topic: Claude Code 长期项目上下文管理最佳实践（调研D4）
type: research
status: resolved
keywords: [上下文管理, session-init, token优化, 渐进披露, 索引]
triage: 🔴
template: A
budget: 40min
sources: { S: 4, A: 2, B: 2 }
---

## 1. 问题陈述（用户视角）

我们项目 `docs/` 在快速膨胀（journal、decisions、research、specs、plans），每次 session 开头 `session-init` skill 读的东西越来越多，现在已经占 20–30% context，还在上升。我要找出：**真正跑过长期大项目的 Claude Code 高手和 Anthropic 官方，是怎么保持"开局轻 + 信息不丢"的？** 锁定的 Route D（多层索引 + 按需加载 + 清理 skill）有没有前人趟出来的落地套路？

> 生活类比：这是一次"向已经开过大公司的前辈请教怎么不让员工手册膨胀到没人读"。

---

## 2. Patterns found

### Pattern A — Progressive Disclosure（渐进式披露）

**它是什么（类比）**：像员工手册分三层：(1) 目录贴在墙上（每人都看见）→ (2) 章节册子锁在书架上，需要时才拿 → (3) 附录和表格散在档案柜里，用到才翻。手册永远不全部读完，但"哪里有什么"你永远知道。

**Anthropic 官方原话（S 级）**：
> "Claude loads this metadata at startup and includes it in the system prompt. This lightweight approach means you can install many Skills without context penalty; Claude only knows each Skill exists and when to use it."
> —— Anthropic 官方 Skills 文档

三层明码标价（官方表）：
- **Level 1（永远加载）**：~100 tokens/skill，只是 frontmatter `name + description`
- **Level 2（被触发才加载）**：< 5k tokens，SKILL.md 正文
- **Level 3（用时再加载）**：无上限，额外文件 / 脚本

**CC primitive**：Skills（`.claude/skills/<name>/SKILL.md`）。这是 CC 官方为我们这个问题专门设计的原语。

**CLAUDE.md 5 问迷你表**：
| 问题 | 答案 |
|------|------|
| 它是什么 | 信息分三层，开头只看目录，用到才翻章节 |
| 现在的代价 | 重构 session-init，把它拆成"薄壳 + 若干 skills" |
| 带来什么 | 开头 token 只剩索引级；信息规模可以无限长 |
| 关闭什么门 | 如果 skill 描述写不好，Claude 不会触发，知识等于没存在 |
| 选错后果 | 可逆；skill 是文件夹，随时加减 |

---

### Pattern B — Memory Tool + Just-in-Time Retrieval（外部记忆 + 即时取回）

**它是什么（类比）**：像员工不背规章，而是在工位抽屉放活页夹，开工前先瞄一眼"我上次做到哪 / 老板最近说了什么"。context 窗口只保留"现在要做的"。

**Anthropic 官方原话（S 级）**：
> "This is the key primitive for just-in-time context retrieval: rather than loading all relevant information upfront, agents store what they learn in memory and pull it back on demand. This keeps the active context focused on what's currently relevant, critical for long-running workflows."
> —— Anthropic Memory Tool 文档

**CC primitive**：Memory Tool（API 级）、文件系统 `/memories/`、或在 Claude Code 里用 `CLAUDE.md + @` 引用的 docs 子树模拟。Claude Code 本身不直接暴露 memory_20250818 工具，但**同构做法 = 让 `session-init` 只读一个进度/索引文件，正文 skills 按需调**。

**5 问**：
| 问题 | 答案 |
|------|------|
| 它是什么 | 把"项目状态"写进固定几个小文件，开头只读它们 |
| 现在的代价 | 需要一个 skill 或 hook 在 session 结束前更新进度 |
| 带来什么 | session 数量无关；状态不丢，context 只装今天的事 |
| 关闭什么门 | 进度文件如果没人维护，就变成过期信息源（Shrivu 点名的坑） |
| 选错后果 | 可逆；删文件就回到现在 |

---

### Pattern C — Shell Scripts Search on Demand（Jesse Vincent Superpowers 模式）

**它是什么（类比）**：开工手册只留一页"怎么查手册"，真要查规章就现场跑 `grep`。规章本身永远不进 context。

**S 级引用（Simon Willison 引用 Jesse Vincent，2025-10-10）**：
> "The core of it is VERY token light. It pulls in one doc of fewer than 2k tokens … As it needs bits of the process, it runs a shell script to search for them."

据报告，Jesse Vincent 的 Superpowers 插件用这种架构完成一整个 todo app 的规划+实现只用了 ~100k tokens（普通裸聊容易冲到这个水平）。

**CC primitive**：Skills + Bash 工具。Skill 正文只写"用 `grep -r <关键词> docs/journal/` 查历史决策"，不把 journal 正文 import 进去。

**5 问**：
| 问题 | 答案 |
|------|------|
| 它是什么 | 开头只留搜索方法，正文靠 Bash 现查 |
| 现在的代价 | 需要把 journal / decisions / research 的命名和结构标准化（可 grep） |
| 带来什么 | 文档无限增长不影响开局；符合 Route D 的"按需 hydration" |
| 关闭什么门 | 搜索能力差 → Claude 可能漏掉相关条目（需要好的标题和 tag 约定） |
| 选错后果 | 可逆；可以和 Pattern A 并存 |

---

### Pattern D — /clear + /catchup 而不是 /compact（Shrivu Shankar 模式）

**它是什么（类比）**：不要"浓缩对话记录"，要"写完就归档 + 下次重新开机读一页摘要"。

**[A] 引用（Shrivu Shankar, 2025-11-02, blog.sshh.io）**：
> "Avoid compaction as much as possible since automatic compaction is opaque, error-prone, and not well-optimized. Use /clear + /catchup as the default reboot strategy."
> 他的 `/catchup` = 自定义 slash command，读 git diff 最近改动，几秒钟恢复状态。

**CC primitive**：自定义 slash command（在 `.claude/commands/` 或 skill 的 `disable-model-invocation: true` 变体）+ `/clear`。

**5 问**：
| 问题 | 答案 |
|------|------|
| 它是什么 | 主动把 session 切短，每次重启都读一份"最近变化摘要" |
| 现在的代价 | 需要定义"catchup"逻辑（读 git log + 读 project_status.md） |
| 带来什么 | 每个 session 开局都干净；避免 auto-compact 丢失 |
| 关闭什么门 | 用户需要适应"多 session"工作模式，不能一口气跑 6 小时 |
| 选错后果 | 可逆；手动 fallback 就是继续用 /compact |

---

### Pattern E — Subagents for Investigation（委派读库而不是自己读）

**S 级官方原话**：
> "Since context is your fundamental constraint, subagents are one of the most powerful tools available. When Claude researches a codebase it reads lots of files, all of which consume your context. Subagents run in separate context windows and report back summaries."
> —— Anthropic CC 官方 best-practices 文档

**CC primitive**：`Task(...)` 工具 / `.claude/agents/*.md` 定义。主 session 只接收摘要。

**5 问**：
| 问题 | 答案 |
|------|------|
| 它是什么 | "你去查，就告诉我结论"，主对话不装文件原文 |
| 现在的代价 | 学会判断"这段探索适不适合下派" |
| 带来什么 | 一个 subagent 可以读 50 个 journal，最终只花 200 tokens 回报 |
| 关闭什么门 | subagent 的 prompt 写不好 → 回报质量差 |
| 选错后果 | 可逆 |

---

## 3. Anti-patterns（社区负面案例）

### A1. CLAUDE.md 膨胀反噬
**S 级官方警告**：
> "If Claude keeps doing something you don't want despite having a rule against it, the file is probably too long and the rule is getting lost."
> —— Anthropic best-practices

**对比 Shrivu**：他给专业 monorepo 的 CLAUDE.md 卡在 **13 KB**，理由是只写"30% 以上工程师会用到的 tool"。

### A2. `@` import 整个文档
**社区一致结论**：
> "Don't @-File Docs. If you have extensive documentation elsewhere, it's tempting to @-mention those files in your CLAUDE.md. This bloats the context window by embedding the entire file on every run."
> —— [B·社区意见] drona23/claude-token-efficient + CLAUDE.md 指南

`@path` 只解析 5 层递归，而且 **每次 session 都会 inline 进来**。这是最大的 session-init 膨胀源。

### A3. Slash Command / Skill 过载
**[A] Shrivu Shankar**：
> "If you have a long list of complex, custom slash commands, you've created an anti-pattern."

**项目对应**：用户 MEMORY 已有 `feedback_skill-overload.md`。skill 数量本身不花 token（只加载 metadata），但 **描述写得差 / 触发条件模糊** → Claude 不会用 → 等于死代码。

### A4. /compact 黑盒压缩
**[A] Shrivu**："automatic compaction is opaque, error-prone, and not well-optimized."
**对应项目动作**：Route D 的"清理 skill" 应当是**显式人控**（"请确认哪些 journal 可归档"），而不是靠 auto-compact。

### A5. MCP 吃上下文（不是我们要走的路但要知道）
**S 级 Simon Willison**："GitHub's official MCP on its own famously consumes tens of thousands of tokens of context."
→ 在决定是否把某功能做成 MCP server 之前，先看 skill 能不能代替。

---

## 4. S 级推荐（官方 vs 社区共识）

| 维度 | Anthropic 官方 | 社区独立收敛 |
|------|---------------|-----------|
| 开局膨胀控制 | Skills（progressive disclosure, Level 1/2/3）| Jesse Vincent：单个 2k doc + shell 搜索 |
| 持久状态 | Memory Tool + 多 session 结构（progress log / feature checklist）| Shrivu：`/catchup` 读 git diff |
| 会话重启 | `/clear` + 手动 brief | Shrivu：`/clear` > `/compact`（强烈） |
| 探索不污染主 context | Subagents | 一致 |
| CLAUDE.md 控制 | "for each line ask: would removing cause mistakes?" | Shrivu：13 KB 上限、"guardrails not manual" |

**两边都指向同一个结论**：**开局只加载索引和元数据，正文按需调**。这正是 Route D 的设计。

---

## 5. 映射到 Route D

Route D 三根支柱 → CC primitive 对应：

### 支柱 1：多层索引
- **落地**：`docs/journal/INDEX.md`、`docs/decisions.md`（已有）、`docs/research/INDEX.md`（待建）、`docs/superpowers/INDEX.md`（待建）
- **原语**：普通 markdown，在 `session-init` 里只读 INDEX 而不是正文。
- **灵感**：Pattern A Skills frontmatter（"Claude only knows each Skill exists and when to use it"）——把 INDEX 文件当作"skills frontmatter 的放大版"。

### 支柱 2：按需 hydration
两种实现方式叠加：
- **(a) Skill 化**：把每类文档读取写成 skill。例如 `load-decision` skill 描述="when user references a past decision or CLAUDE.md 已关闭决策条目"。触发才读正文。
- **(b) Shell 搜索**：借 Jesse Vincent 模式——skill 正文只教 Claude 用 `grep "关键词" docs/journal/` 现场查，不 `@` 导入。

### 支柱 3：定期清理 skill
- **原语**：写一个 skill（或 slash command），显式人控：扫描 `docs/journal/` 找 6 个月以上无引用条目 → 输出归档建议 → 用户批准。
- **官方背书（Anthropic Memory Tool 文档）**：
  > "Consider clearing out memory files periodically that haven't been accessed in an extended time."
- **不要做成 auto-compact**（A4 反例）。

### 额外收获：对 `session-init` 本身的建议
当前 `session-init` 同时做"CEO 仪表盘 + skill 手册 + 运行规则"——**这违反了 progressive disclosure**。建议拆分：
- `session-init` 只保留"CEO 仪表盘"（当前状态 + 建议下一步）→ 目标 < 2k tokens
- 其余（skill 手册、运行规则、CCB 协议）→ 独立 skill，按触发关键词加载
- 这正是 Jesse Vincent Superpowers 的原型

---

## 6. 项目恒量维度审查

| 恒量 | 本次所有 Pattern 是否合规 |
|------|-----------------------|
| 中国可达性 | ✅ 全部是文件系统 / Claude Code 本地特性，无第三方服务 |
| 成本 $0/月 | ✅ 都是本地操作，不调 API |
| CCB 多模型兼容 | ⚠️ Memory Tool API 仅 Claude；但**文件系统模拟**（`/memories` 目录 + 约定）对 Codex/Gemini 可共享。Route D 选**文件系统同构路线**更稳。 |
| CLAUDE.md 产品不变量 | ✅ 只改 docs/ 和 skills/，不影响产品行为 |

---

## 7. 源质量自审

| # | 来源 | URL | Tier | 信号 | ✅/❌ |
|---|------|-----|------|------|------|
| 1 | Anthropic CC 官方 best-practices | https://code.claude.com/docs/en/best-practices | S | 官方一手、规范文档 | ✅ |
| 2 | Anthropic Skills 官方文档 | https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview | S | 官方一手 | ✅ |
| 3 | Anthropic Memory Tool 官方文档 | https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool | S | 官方一手 | ✅ |
| 4 | Simon Willison "Claude Skills are awesome" (2025-10-16) | https://simonwillison.net/2025/Oct/16/claude-skills/ | S | 博客 >20 年；被官方引用；多次 keynote | ✅ |
| 5 | Simon Willison "Superpowers" (2025-10-10, 二手引用 Jesse Vincent) | https://simonwillison.net/2025/Oct/10/superpowers/ | S（Simon 是 S 级，Jesse Vincent 独立算 A） | 同上 | ✅ |
| 6 | Shrivu Shankar "How I Use Every Claude Code Feature" (2025-11-02) | https://blog.sshh.io/p/how-i-use-every-claude-code-feature | [A] | 署名技术工程师、CC 领域多篇深度文章，未达 3 个 S 信号 | ✅ |
| 7 | drona23/claude-token-efficient GitHub repo | https://github.com/drona23/claude-token-efficient | [B · 社区意见] | 匿名维护者，社区资源 | ✅ |
| 8 | MindStudio "18 Token Management Hacks" | https://www.mindstudio.ai/blog/claude-code-token-management-hacks-3 | [B · 社区意见] | 商业 blog，内容混杂，仅用做交叉验证 | ✅ |

**分布**：S 级 4 / A 级 1 / B 级 2 + 1 引用性二手（共 8 源，符合 5–8 要求）。
**幻觉声明**：所有引用原文均从 WebFetch 真实返回内容复制，未编造。发布日期均来自页面或搜索片段。
**未查到**：Jesse Vincent 的 Superpowers 插件 README 原始仓库链接（只找到 Simon Willison 引用和 Claudepluginhub 二手页）——已 fallback 到 Simon 的 S 级转述。

---

## 8. 对父 Claude 的简报

见 return message。

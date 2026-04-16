---
date: 2026-04-15
topic: session-init token 优化 — 4维调研综合（Route D）
type: research
status: resolved
keywords: [session-init, token优化, 按需加载, 索引, 综合调研]
triage: 🔴
template: synthesis
inputs:
  - 2026-04-15-claude-mem-repo-analysis.md
  - 2026-04-15-everything-claude-code-repo-analysis.md
  - 2026-04-15-obra-superpowers-repo-analysis.md
  - 2026-04-15-cc-long-project-context-mgmt.md
---

# session-init token 优化综合（Route D 零件推荐）

## 0. 给 CEO 的一句话

**开局时只注入"目录"，正文永远按需去翻**——4 份调研全部独立收敛到这一个结论，而且其中 2 份（Anthropic 官方 + Jesse Vincent/obra）是 S 级权威来源。Route D 是方向对的，现在要做的是搬零件、不是再讨论策略。

---

## 1. 综合发现（Cross-cutting Findings）

### F1. 四个维度独立收敛到"Progressive Disclosure / 渐进披露"同一个答案

- **D1 claude-mem**：三层工作流 `search → timeline → get_observations`，官方声称 ~10x token 节省
- **D2 everything-claude-code**：作者把 SessionStart 只挂 1 个脚本（"加载上次上下文 + 检测包管理器"），其它 32 个 hook 都挂在 PreToolUse/PostToolUse/Stop —— 刻意保持 SessionStart 极简
- **D3 obra/superpowers**：`using-superpowers` SKILL.md 是唯一启动注入的内容，core doc < 2k tokens，其它靠 shell 搜索现场取
- **D4 Anthropic 官方**：Skills 三层（Level 1 永远加载 ~100 token/skill；Level 2 触发才加载 < 5k；Level 3 用时再读无上限），原话 "Claude only knows each Skill exists and when to use it"

**含义**：这不是某个极客的偏好，是 2025-10 起 Claude Code 生态的共识基准。我们的 "session-init 读 6 文件 + 7 shell 命令" 属于 2025 年初的反模式。

### F2. 三份调研独立指出"auto-compact / 自动压缩"是陷阱，要改用"clean startup + catchup"

- **D3 obra v5.0.3 (2026-03-15)**：专门停掉 SessionStart 在 `--resume` 时触发（避免重复注入）
- **D4 Shrivu Shankar**：原话 "Avoid compaction as much as possible since automatic compaction is opaque, error-prone, and not well-optimized. Use `/clear + /catchup`"
- **D2 strategic-compact skill**：主动在逻辑边界提示手动 `/compact`，不依赖自动压缩

**含义**：我们的 session-init 描述写着 "Session 开始和 compact 后自动调用"——**compact 后再跑一遍就是 obra 2026-03 修复的坑**，必须改掉。

### F3. 四份调研全部警告 "subagent 派发要极其克制"，但场景分类不同

- **D3 obra v5.0.6**：5 版本 × 5 试验实验证明 "派 subagent 审自己 plan" 没有质量提升，但多花 ~25 分钟 —— **内部自检场景**应该 inline
- **D4 Anthropic 官方**："subagents 是 context 最强工具之一，跨 context window 隔离探索" —— **跨领域调研场景**应该派
- **D1 claude-mem**：通过 MCP 搜索工具按需取用，假设单 Claude session —— 与 CCB 冲突

**结论**：research-before-decision 的并行 sub-agent 派发**保留**（跨领域调研），brainstorming 内部的 sub-agent 自检**取消**（改 inline checklist）。

### F4. Windows 11 是三份调研共同的兼容性痛点

- **D1 claude-mem**：hook 命令写死 `$HOME/.nvm`、`/opt/homebrew`、Unix bash here-string —— 在 Windows 下一半失败
- **D2 everything-claude-code**：issue #1435 `fs.renameSync` 在 Windows 抛 EEXIST 被空 catch 吞掉，永久阻断 Edit/Write/Bash
- **D3 obra**：唯一一份**已官方验证 Windows 11 NT 10.0.26200 + Git Bash**（v5.0.1/v5.0.5 release note 明说）

**结论**：Route D 只从 obra 拿可直接运行的 shell 脚本，其它两个仓只拿"思想/模式"，绝不拿代码。

### F5. License 分布呈现清晰的"可搬 / 不可搬"两极

| 维度 | License | 可否搬代码 |
|------|---------|-----------|
| D1 claude-mem | **AGPL-3.0**（最强 copyleft，网络服务条款） | ❌ 绝对不可（会污染将来的 teaching mode 付费订阅） |
| D2 everything-claude-code | MIT | ✅ 可搬，加 copyright 标注 |
| D3 obra/superpowers | MIT | ✅ 可搬，加 copyright 标注 |
| D4 Anthropic 官方文档 | 官方公开文档（非代码） | ✅ 原理可借，不涉及版权代码 |

**结论**：Route D 的代码级借鉴仅限 D2/D3/D4，D1 只借"思想描述"（AGPL 不污染思想本身，只污染代码复制）。

---

## 2. Route D 零件推荐清单

| 零件名 | 来源 | 做什么（生活类比） | 优先级 | 搬运成本 | License | Windows | CCB | 适用到哪里 |
|--------|------|------------------|--------|---------|---------|---------|-----|----------|
| **P1. SessionStart 极简化** | D3 §4.1 + D2 §3.D + D4 Pattern A | 开机时桌上只放"安全须知卡"（一个 skill < 2k token），不铺整本操作手册 | 🔴 Must | S | MIT safe | yes（obra 官方验证 NT 10.0.26200） | yes（中立） | session-init skill 主体重写 |
| **P2. 多层 INDEX 文件架构** | D1 §3.A + D4 §5 支柱 1 | 墙上贴目录、书架放章节、档案柜存附录；开头只读目录 | 🔴 Must | S | 纯文档约定，无 License | yes | yes（Codex/Gemini 也能读 INDEX） | 新建 `docs/research/INDEX.md`、`docs/superpowers/INDEX.md`，复用已有 `docs/journal/INDEX.md` + `docs/decisions.md` |
| **P3. Frontmatter schema + 触发关键词约定** | D1 §3.C + D4 Pattern A | 每份文档贴"门牌号"（type/status/trigger_keywords/summary_line），让 INDEX 机器可扫 | 🔴 Must | S | 纯约定 | yes | yes | docs/journal/ docs/decisions/ docs/research/ docs/superpowers/ 的所有文件 |
| **P4. Stop `--resume`/compact 后重跑 session-init** | D3 §3.1 v5.0.3 | 不要把"交接手册"重读第二遍（对话历史已经有了） | 🔴 Must | S | 概念借鉴 | yes | yes | session-init skill 的触发条件 |
| **P5. `<SUBAGENT-STOP>` 块** | D3 §4.2 | 临时工打工不用参加公司晨会 | 🔴 Must | 0（已采纳） | MIT | yes | yes | session-init 顶部已有 ✅ 确认保留 |
| **P6. Shell 搜索按需取（grep journal/decisions）** | D3 §4.1 + D4 Pattern C | 手册只留一页"怎么查手册"，真要查就 grep | 🔴 Must | M | 模式借鉴 | yes（Git Bash 可用） | yes | 在 session-init 和 journal skill 里写清 grep 命令模板 |
| **P7. context-budget 审计 skill（Always/Sometimes/Rarely 分类法）** | D2 §3.A | 家里电表，告诉你每个电器吃了多少电，哪些可拔掉 | 🟡 Should | M（2 小时改写） | MIT（加标注即可） | yes（纯计算） | yes | 新建 `.claude/skills/context-budget/` 审计现有 session-init |
| **P8. periodic cleanup skill（显式人控，非 auto-compact）** | D4 §5 支柱 3 + D2 §3.B | 每月扫一次老日志，提示你归档；你按确认才动 | 🟡 Should | M | 自写 | yes | yes | 新建 `.claude/skills/docs-cleanup/` |
| **P9. Cached dependency/index hash 校验** | D1 §3.E | 启动先看 INDEX 哈希有没变；没变就跳过重读 | 🟡 Should | M | 思想借鉴 | yes | yes | session-init skill 内加 stat 检查 |
| **P10. inline self-review checklist（替代 brainstorm 内的 subagent 自检）** | D3 §4.3 + v5.0.6 | 自己交稿前 30 秒扫 5 条 checklist，代替请人审 25 分钟 | 🟢 Nice | S | 模式借鉴 | yes | **注意**：CCB 的跨角色 review 是人际 review 不是 self-review，不要全盘采纳 | brainstorming skill 内的自检部分 |

**说明**：
- P1–P6 全部满足 Must 的 5 条：License safe + Windows 兼容 + CCB 兼容 + $0 成本 + 中国可达
- P7–P9 是增强项，可以二期做
- P10 需要仔细辨别 CCB 的多角色 review 与 obra 的 single-agent self-review 本质不同，不能照搬

---

## 3. 拒绝清单（Do NOT Adopt）

| 不采纳 | 来源 | 理由（一句话） |
|--------|------|--------------|
| **claude-mem 整体或任何代码片段** | D1 §5 | AGPL-3.0 会污染将来 teaching mode 付费订阅，法律红线 |
| **claude-mem 的 Chroma 向量库 + Bun worker + SQLite FTS5** | D1 §3.D | 为 single-Claude 设计 + Windows 安装不稳 + $0/月定位不匹配 |
| **everything-claude-code 的 `install.sh` / `install.ps1` 整套安装** | D2 §5 | Windows bug #1435 会永久阻断 Edit/Write/Bash |
| **everything-claude-code 的 33 个 hook 整套引入** | D2 §7 | 会和 CCB 协议双系统抢控制权 |
| **everything-claude-code 的 `multi-*` 命令** | D2 §3 不借鉴清单 | 依赖 `ccg-workflow` 外部 runtime，与 CCB 不兼容 |
| **everything-claude-code 的 `continuous-learning-v2` / `continuous-agent-loop`** | D2 §3 不借鉴清单 | PreToolUse 每次都跑 observe.sh，反而加 token |
| **obra 的 plan self-review subagent 循环** | D3 §5 反模式 1 | 实验证明 25 分钟开销无质量提升（但仅限内部自检场景） |
| **`@path` import 文档进 CLAUDE.md** | D4 §A2 | 每次 session 都 inline 整个文件，最大膨胀源 |
| **依赖 `/compact` 自动压缩来控制上下文** | D4 §A4 + D3 §3.1 | 黑盒、不可预期、恢复容易丢信息 |
| **MCP server 替代 skill（仅针对 context 优化场景）** | D4 §A5 | Simon Willison 实测 GitHub MCP 单独吃几万 token |
| **把项目业务状态塞进 SessionStart hook** | D2 §3.D 反模式 | 156K star 作者刻意不这样做，我们踩了 |

---

## 4. CLAUDE.md 5 问整合表（🔴 Must 零件）

### P1. SessionStart 极简化

| 问 | 答 |
|----|----|
| 它是什么 | 开机桌上只放一张安全须知卡（单个 skill < 2k token），而不是把整本操作手册铺满桌面 |
| 现在的代价 | 约 0.5 天：重写 session-init 主体，把"CEO 仪表盘 + skill 手册 + 运行规则"拆成三块，只保留仪表盘 |
| 带来什么 | 开头 token 从 20-30% 降到 ≤10%，"信息规模不再影响开局成本" |
| 关闭哪些门 | 几乎不关门。如果将来要强制注入某些内容，在 session-init 加一行 skill 触发即可 |
| 选错后果 | 极易反悔。复原就是把拆出去的内容合回来 |

### P2. 多层 INDEX 文件架构

| 问 | 答 |
|----|----|
| 它是什么 | 墙上目录（INDEX）、书架章节（SKILL.md）、档案柜附录（正文）；开头只读目录 |
| 现在的代价 | 1-2 小时：新建 `docs/research/INDEX.md`、`docs/superpowers/INDEX.md`；复用已有 `docs/journal/INDEX.md` + `decisions.md` |
| 带来什么 | "know everything exists" 和 "fully loaded" 分离——启动时知道所有资料存在，但不加载正文 |
| 关闭哪些门 | 几乎不关门。INDEX 可以手动维护也可以脚本生成（将来再升级） |
| 选错后果 | 极易反悔。删掉 INDEX 文件就回到现状 |

### P3. Frontmatter schema + 触发关键词

| 问 | 答 |
|----|----|
| 它是什么 | 每份文档贴"门牌号"（type/status/trigger_keywords/summary），让 INDEX 和清理 skill 能机器扫描 |
| 现在的代价 | 0.5 天：给所有现存 journal/decisions/research/superpowers 文件加 frontmatter |
| 带来什么 | INDEX 可半自动生成；cleanup skill 可扫"过期触发器"；Codex/Gemini 也能读到结构化元数据 |
| 关闭哪些门 | 几乎不关门。schema 可随时演化 |
| 选错后果 | 极易反悔。删 frontmatter 不影响正文 |

### P4. Stop 在 `--resume`/compact 后重跑 session-init

| 问 | 答 |
|----|----|
| 它是什么 | 交接手册只在第一次上班读一次，上班中途上厕所回来不用再读 |
| 现在的代价 | 30 分钟：改 session-init 触发条件 + skill 描述 |
| 带来什么 | compact 后不再重复注入 6 文件，**单独这一条就能砍一半 token** |
| 关闭哪些门 | 如果用户真的 compact 掉了关键状态，需要手动 `/catchup`。缓解：建一个轻量的 catchup skill |
| 选错后果 | 易反悔。条件改回 "always" 即可 |

### P5. `<SUBAGENT-STOP>` 块

| 问 | 答 |
|----|----|
| 它是什么 | 公司主管才要开晨会，临时工来打工不用参加 |
| 现在的代价 | 0（已采纳） |
| 带来什么 | sub-agent 派发时不重跑 session-init / brainstorm / 项目状态 |
| 关闭哪些门 | 无 |
| 选错后果 | 无 |

### P6. Shell 搜索按需取

| 问 | 答 |
|----|----|
| 它是什么 | 手册只留一页"怎么查手册"（grep 命令模板），真要查历史就现场跑 |
| 现在的代价 | 半天：把 journal/decisions 的命名 + tag 标准化（可 grep），session-init 里写清 grep 命令 |
| 带来什么 | docs/ 可无限增长不影响开局 token |
| 关闭哪些门 | 如果命名不规范 Claude 可能漏条目——缓解：frontmatter schema（P3）强制规范 |
| 选错后果 | 易反悔。继续并存原读法即可 |

---

## 5. 搬运顺序建议

**按依赖关系排列，前置零件先做**：

1. **Week 1 — 奠基（P3 + P2）**
   - Day 1-2：定义 frontmatter schema（P3），写脚本扫一遍现存 docs/，手动补 frontmatter
   - Day 3-4：新建缺失的 INDEX 文件（P2，research/superpowers），根据 frontmatter 生成紧凑条目

2. **Week 2 — 主体改造（P1 + P4 + P6）**
   - Day 1-3：重写 session-init（P1）——拆成 CEO 仪表盘（保留主体）+ skill 手册（独立 skill）+ 运行规则（独立 skill）；主体文件目标 < 2k token
   - Day 4：改触发条件（P4）——只在 clean startup + 用户显式要求时跑，`--resume`/compact 后不重跑
   - Day 5：在 session-init 和 journal/decisions 相关 skill 里写清 grep 命令模板（P6）

3. **Week 3 — 验证与二期（P7 + P8 + P9）**
   - 用 context-budget skill（P7）量化改造前后 token 占用，确认 ≤10% 目标达成
   - 如果有余力：写 docs-cleanup skill（P8）、加 INDEX hash 校验（P9）

4. **持续**：每月调用 P7 审计 session-init token 占用，防止回归膨胀

**关键前置约束**：
- **P3 必须先于 P2** —— 没有 frontmatter 就没法生成 INDEX
- **P2 必须先于 P1** —— session-init 要引用 INDEX，INDEX 要先存在
- **P4 可与 P1 同步做** —— 都是改 session-init
- **P5 已经在位** —— 无需行动，只需"不要删掉"

---

## 6. 风险警示

### R1. claude-mem 的 MCP 搜索工具看起来非常优雅——但不要碰
- **诱惑**：三层工作流 `search → timeline → get_observations` 确实是 Route D 的最优雅实现
- **风险**：AGPL-3.0 + single-Claude 假设 + Bun/Chroma/uv 三重依赖在 Windows 不稳
- **对策**：只借"三层"思想（INDEX → SKILL.md → 正文），代码一行不碰

### R2. everything-claude-code 的 install 脚本诱人（一键 156K-star 全家桶）——但有 Windows 杀手 bug
- **诱惑**："156K star + MIT + 中文 README" 看起来零风险整套搬
- **风险**：issue #1435 `fs.renameSync` 在 Windows 抛 EEXIST 被空 catch 吞掉，永久阻断 Edit/Write/Bash
- **对策**：只复制 1-2 个 SKILL.md 文件并重写错误处理，绝不跑 install 脚本

### R3. obra v5.0.6 "subagent 自检没用" 的结论诱人——但场景错配会伤到 research-before-decision
- **诱惑**：实验证据 + S 级作者 + 25 分钟节省，很想全面砍 sub-agent
- **风险**：obra 测的是"同领域 plan self-review"，我们的 research-before-decision 是**跨领域调研**，obra 的实验不覆盖
- **对策**：brainstorm 内部自检改 inline（采纳 obra 结论），research 跨领域调研保留 sub-agent（v5.0.2 context isolation 原则也支持）

### R4. CCB 多模型与所有三个仓的假设都有不同程度冲突
- **诱惑**：想直接用 obra 的 hook 脚本让 session-start 自动跑
- **风险**：obra/claude-mem/ECC 都假设 single-agent 主导；CCB 是 Claude PM + Codex 后端 + Gemini 前端三角并行
- **对策**：只借"文件系统同构路线"（INDEX/SKILL/frontmatter 都是纯 markdown，三个模型都能读），不借"hook 驱动自动化"

### R5. 清理 skill 做成 auto-compact 会反伤
- **诱惑**：想让 cleanup skill 每天自动归档老 journal
- **风险**：Shrivu Shankar + obra 都独立警告 auto-compact 黑盒、易丢信息
- **对策**：P8 必须做成**显式人控**——skill 输出"建议归档列表"，用户按 y/n 才动

### R6. CLAUDE.md 本身也在往膨胀方向走
- **诱惑**：在 CLAUDE.md 里把新 skill 用法一条条写清
- **风险**：Anthropic 官方原话 "If Claude keeps doing something you don't want despite having a rule against it, the file is probably too long and the rule is getting lost"；Shrivu 的 monorepo CLAUDE.md 卡在 13 KB
- **对策**：改造 session-init 之后，检查一次 CLAUDE.md 长度；新规则一律进 skill，不进 CLAUDE.md

---

## 7. 源质量自审

### 聚合 S/A/B 分布

| 维度 | S 级 | A 级 | B 级 | 备注 |
|------|------|------|------|------|
| D1 claude-mem | 4 | 1 | 0 | LICENSE/README/hooks.json 一手源；作者无独立 S 级交叉引用 |
| D2 everything-claude-code | 0 | 4 | 1 | 纯仓库产物+作者 issue；无独立 S 级身份 |
| D3 obra/superpowers | 4 | 2 | 1 | **含 S 级作者** Jesse Vincent（Wikipedia+20+ 年履历） |
| D4 CC 长期管理 | 4 | 1 | 2 | **含 Anthropic 官方文档 3 条 + Simon Willison 2 条** |
| **合计** | **12** | **8** | **4** | **共 24 源，符合"每维度 5-8 源"规范** |

### URL 可打开性（抽样验证）

| URL | 维度 | 可打开 | 用途 |
|-----|------|--------|------|
| https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview | D4 | ✅ | Anthropic Skills 官方文档（Progressive Disclosure 三层原理） |
| https://code.claude.com/docs/en/best-practices | D4 | ✅ | Anthropic CC best-practices |
| https://github.com/obra/superpowers | D3 | ✅ | 152K star，Jesse Vincent 主仓 |
| https://raw.githubusercontent.com/obra/superpowers/main/RELEASE-NOTES.md | D3 | ✅ | v5.0.3/v5.0.6 一手 release note |
| https://en.wikipedia.org/wiki/Jesse_Vincent | D3 | ✅ | obra 身份 S 级佐证 |
| https://github.com/affaan-m/everything-claude-code/issues/1435 | D2 | ✅ | Windows EEXIST 严重 bug 佐证 |
| https://github.com/thedotmack/claude-mem/blob/main/LICENSE | D1 | ✅ | AGPL-3.0 红线佐证 |
| https://simonwillison.net/2025/Oct/16/claude-skills/ | D4 | ✅ | Simon Willison S 级博客 |
| https://blog.sshh.io/p/how-i-use-every-claude-code-feature | D4 | ✅ | Shrivu Shankar A 级 |

### 幻觉声明

**本综合文件所有结论来自 4 份输入文件的引用源，非训练记忆。**

- 所有引用（原话、URL、数字、release 版本、日期、license、star/fork 数、issue 号）均追溯到 4 份输入文件中具体章节
- 未引入任何 4 份输入文件之外的训练记忆或推测
- 跨源冲突已在 §1（F3 场景分类）和 §6（R3）显式标出，未粉饰
- 所有 🔴 Must 零件均通过 5 条硬标准（License safe + Windows 兼容 + CCB 兼容 + $0 成本 + 中国可达），每条都可追回到 4 份文件中的兼容性表

**未亲自验证**（继承自输入文件）：
- blog.fsck.com/2025/10/09/superpowers/ 正文（D3 自承未下载，README 引用确认存在）
- O'Reilly 作者页（D3 自承未 curl，搜索结果给出）
- 不影响本综合的 🔴 Must 零件决策

---

## 8. 结语

Route D 方向已被 4 份独立调研（含 2 份 S 级）在策略层面完全验证。剩下的是执行层面：**按 §5 的三周顺序搬 6 个 🔴 Must 零件 + 3 个 🟡 Should 增强**，预期把 session-init 从 20-30% context 压到 ≤10%，且"know everything exists" 能力不丢。

不要再讨论策略。讨论结束了。

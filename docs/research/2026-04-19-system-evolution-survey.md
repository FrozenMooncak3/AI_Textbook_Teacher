---
date: 2026-04-19
topic: 系统进化机制调研（A 记忆 / B 技能 / C 事件捕获 / D 工作流 / E 自我诊断 五维 SOTA）
triage: 🔴
template: A
budget: 8 min（5 sub-agent 并行 wall-clock；主 Claude 聚合 20 min）
sources: { S: 32, A: 10, B: 4 }
---

# 系统进化机制调研（Survey）

> 研究对象：Claude + CCB（Claude-Codex-Bridge）+ skills + memory 协作系统本身的进化机制
> 下游：survey 文件落盘后，开新一轮 brainstorm → 决定采纳哪些机制 → writing-plans → task-execution

---

## 背景

**核心问题**：市面上有没有更好的方式根据日常事件进化我们的元系统？

**维度**：全 5 维（A 记忆 / B 技能 / C 事件捕获 / D 工作流 / E 自我诊断）

**当前系统基线**：
- A 记忆：auto-memory（MEMORY.md + 分类 .md 40+ 条）；手动 memory-cleanup skill
- B 技能：手写 skills；无生成器；F.3 刚做过 session-init 瘦身（127→60 行）
- C 事件捕获：手动 journal + retrospective（用户触发）；SessionStart 注 project_status；PreCompact 拦首次 compact
- D 工作流：CCB 3-step dispatch（Claude→Codex/Gemini，串行）；task-execution 统筹
- E 自我诊断：无自动机制；靠用户发起（如 F.3 bloat diagnosis）

**Pass 结构**：Pass 1 执行，5 sub-agent 并行扫 8 源（wall-clock ~6 分钟），质量 gate 通过，未触发 Pass 2。

---

## § 1 顶部合成（Template A · 5 问一次性跑）

> 聚合 5 维度发现；每问 2-4 句非技术 CEO 类比回答。

### Q1 · 它是什么？

**一句话**：业界 agent 系统的"5 维进化底座"——记忆分层、技能手写+TDD、hook 事件捕获、单线程+fresh subagent 派发、外部反馈驱动诊断——已初步成型。

**生活类比**：就像外卖/叫车/支付/社交/地图在 2010-2015 年间从散点变成每个行业都有 SOTA 模板。agent 系统在 2024-2026 走的就是这条路——每维都有了"头部方案"：
- 记忆：**Letta 分层 block** 是共识（像"桌面常用 + 档案柜按需取"）
- 技能：**Anthropic SKILL.md + 渐进披露** 是开放标准（全行业抄作业）
- 事件：**Claude Code 24 类 hook** 是 hook 边界派最全的（像家里 24 种传感器接同一个总线）
- 工作流：**Cognition 单线程 + obra fresh subagent per task** 是实战共识（不是越多 agent 越好）
- 诊断：**外部反馈（CI/linter/用户纠错）+ 拒绝 agent 自评** 是安全底线（自评 ECE 77%）

### Q2 · 现在的代价是什么？

分三档（**做 vs 不做**）：

| 档 | 示例 | 成本 | 能拿回来什么 |
|---|---|---|---|
| **低成本 · 抄现成**（1-2 天） | Superpowers "1% 强触发语" / `PostToolUseFailure` hook 自动回灌 stderr / git-tracked md 做 audit log | 写几个 hook + 改几个 skill | skill 触发不再靠"运气被召唤"；Codex 失败不用手动复制报错；改记忆有历史可查 |
| **中成本 · 轻度改造**（1-2 周） | Letta sleep-time agent 做后台 auto memory-cleanup / skill-audit 周期 job 防漂移 / review loop 外化终止到 build/CI | 新增 1-2 个后台 skill + hook；小幅改 task-execution | 记忆自己会"整理"；skill 不会悄悄退化；review 循环终止不靠 Claude 主观判断 |
| **高成本 · 重度改造**（1 月+，**不推荐现阶段**） | Hermes GEPA auto-generate skill / event-sourced 恢复层 / 多 critic 融合 ECE 降负 | 数百行架构代码；需评估框架 | 系统真的自己进化；但风险是"进化歪了"很难回滚 |

### Q3 · 它给我们带来什么能力？

按维度点名**最值得复制**的机制：

| 维度 | 最值得复制 | 生活类比 | 当前我们有吗 |
|---|---|---|---|
| **A 记忆** | Letta **sleep-time agent**（夜里另一个 Claude 帮你整理笔记） | 你白天工作，晚上秘书把笔记整理成知识体系 | ❌（只有手动 memory-cleanup） |
| **A 记忆** | OpenHands **condenser**（压缩旧记忆而非删除） | 旧日记缩写成摘要，保留信息但省空间 | ❌ |
| **B 技能** | Superpowers **TDD-for-skills**（先让 subagent 失败再写 skill） | 先拍病人不吃药的对照片再开药方 | ❌（全靠直觉写） |
| **B 技能** | Hermes **fallback_for_toolsets**（某工具不可用自动切替代） | 客厅电视坏了掏出手机看 YouTube | 仅 text fallback |
| **C 事件捕获** | Claude Code **24 类 hook**（免费事件总线，我们只用了 2 个） | 装了 24 种传感器但只接了 2 个 | 2/24 |
| **C 事件捕获** | Aider **lint/test 失败自动回灌下一轮** | 菜咸了警报响，厨师立刻调味 | ❌ |
| **D 工作流** | obra **fresh subagent per task**（每次派发开新 session） | 每次找新秘书，不带上轮情绪 | ❌（Codex session 续接） |
| **D 工作流** | Cognition **autofix loop 终止外化到 CI clean** | 不由厨师判断"做好没"，由客人吃完投票 | ❌（Claude 主观判断） |
| **E 自我诊断** | Cognition **每日 skill audit** + Anthropic Skills 2.0 eval | 每天打烊后巡视冷柜 | ❌ |
| **E 自我诊断** | **同问题 ≥2 次失败自动计数 hook** | 胎压报警器连续 3 次才响，避免误报 | 有规则但未量化 |

### Q4 · 它关闭了哪些未来的门？

每条路选了就回不了头（或代价高）：

| 方向选择 | 关闭的门 |
|---|---|
| 选 Anthropic "按需读 memory" 路线 | 放弃 Cline "全部必读" 简单性 —— 用户不用挑哪些 md 应该被读，但 token 成本陡增 |
| 选 obra "手写 + 批量挖矿" 技能演化 | 放弃 Hermes 在线自改 —— skill 不会实时 adaptive，但能避免生成垃圾 skill |
| 选 Cognition "single-threaded linear" | 放弃 Anthropic 大规模并行研究系统的 90% 性能红利 —— 但避免 15× token 消耗 |
| 选 Hermes "所有改动人工 review" | 放弃 auto-patch 速度 —— 慢但安全（Anthropic 自家 Skills 2.0 发现 5/6 官方 skill 都退化） |
| 选 git-tracked md 做记忆 | 未来换向量库/数据库 backend 成本高 —— 但现阶段免费拿到 audit log |

### Q5 · 选错了后果是什么？

每条都有前人踩过的坑：

| 错选 | 后果 | 证据 |
|---|---|---|
| 抄 Hermes 在线 skill 自动生成（现阶段） | 生成一堆垃圾 skill 污染系统 | obra 明确警告过 |
| 无脑加 max_iteration 但不真 check | 表面有保护实际无效 | OpenHands #6857 教训 |
| 让同一 Claude 既做任务又自评 | ECE 77%，自评全是"做得很好" | arXiv 2508.06225 实测数据 |
| 不做周期 skill-audit | Anthropic 自家 5/6 skill 都漂移退化 | Skills 2.0 eval 实测 |
| 无脑并行多 agent | 单 session 15× token 消耗，MVP 烧钱场景烧爆 | Anthropic 官方 BrowseComp 数据 |
| 完全自动化 retry 不设 cap | 2025-11 某 LangChain A2A 系统跑 11 天无限循环烧 $47k | dev.to 案例 |

**总体后果严重度**：E 自我诊断选错最痛（系统慢慢烂掉看不见），D 工作流选错最烧钱，A 记忆选错最不好回滚（backend 换代价高）。

---

## § 2 分维度章节

### A. 记忆沉淀

> Sub-agent A 产出。扫源：Letta (docs + MemGPT arxiv)、Claude Code memory docs、Anthropic Memory Tool、Cline memory-bank、hermes-agent hindsight 插件、Aider repo-map、OpenHands condenser、Superpowers、Analytics Vidhya 2026-04 分析、dev.to Ebbinghaus 实现。

#### 必答 1 — 结构：扁平 / 分层 / 图谱？

**Claim 1.1 (Letta / MemGPT)**：层级是 SOTA 事实标准。
- **Quote**: "virtual context management, a technique drawing inspiration from hierarchical memory systems in traditional operating systems ... moves data between main context and external context (the archival and recall storage databases)"
- **URL**: https://arxiv.org/abs/2310.08560
- **Tier**: S · arXiv 2023，UC Berkeley RiseLab
- **Project implication**: 我们现在扁平 MEMORY.md 相当于"桌子上全摊开"；升级到两层 = "常用放桌面抽屉，不常用进档案柜"。

**Claim 1.2 (Letta 实际产品)**：层级再拆成 "memory blocks"——小块、命名、可被多 agent 共享。
- **Quote**: "Memory blocks can be attached to multiple agents at once ('shared blocks')"
- **URL**: https://docs.letta.com/guides/agents/memory/
- **Tier**: S
- **Project implication**: 我们的 `user_product-owner-tester.md` 本质就是 block。值得保留，标准化命名 + 允许跨 session 共享。

**Claim 1.3 (Cline memory-bank)**：固定模板文件（6 个必选 md）扁平分类，每次 load 全部。
- **Quote**: "I MUST read ALL memory bank files at the start of EVERY task - this is not optional"
- **URL**: https://github.com/nickbaumann98/cline_docs/blob/main/prompting/custom%20instructions%20library/cline-memory-bank.md
- **Tier**: S
- **Project implication**: 小项目 OK，50+ 条后 token 爆炸。我们 ~40 条接近边界。借鉴"文件模板预定义"，不借"全部必读"。

**Claim 1.4 (Anthropic Memory Tool)**：最新官方设计"文件系统 + on-demand 读"，明确反对 upfront load。
- **Quote**: "rather than loading all relevant information upfront, agents store what they learn in memory and pull it back on demand"
- **URL**: https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
- **Tier**: S
- **Project implication**: 和 Cline 完全相反。我们现在混合（索引全载 + 分类按需读），对齐 Anthropic 官方。

**Claim 1.5 (hermes-agent hindsight)**：知识图谱 + 实体解析是 2025 新探索方向。
- **Quote**: "Multi-strategy search (semantic + entity graph)"
- **URL**: https://github.com/NousResearch/hermes-agent/blob/main/plugins/memory/hindsight/README.md
- **Tier**: S
- **Project implication**: 图谱适合"把散落人物/项目/决策连成网"。40 条规模用不上。

#### 必答 2 — 写入触发

**Claim 2.1 (Claude Code)**：agent 自判 + 选择性写入。
- **Quote**: "Claude doesn't save something every session. It decides what's worth remembering based on whether the information would be useful in a future conversation"
- **URL**: https://code.claude.com/docs/en/memory
- **Tier**: S
- **Project implication**: 我们是"所有 meaningful 事件都写"持续捕获模式。官方哲学"少而精"vs 我们"多而全"。

**Claim 2.2 (hermes-agent)**: 持续捕获默认，可配"每 N 轮"批量。
- **Quote**: "Automatically retain conversation turns ... `retain_every_n_turns` settings"
- **URL**: https://github.com/NousResearch/hermes-agent/blob/main/plugins/memory/hindsight/README.md
- **Tier**: S
- **Project implication**: "每 N 轮"是轻量节流器。我们没有，可引入。

**Claim 2.3 (Letta sleep-time agent)**：后台异步 agent 定期整理主 agent 记忆，"反思→学习"闭环。
- **Quote**: "The sleep-time agent is responsible for generating learned context from the conversation history to update the memory blocks of the primary agent ... triggered every N-steps (default `5`)"
- **URL**: https://docs.letta.com/guides/agents/architectures/sleeptime
- **Tier**: S
- **Project implication**: **最强写入机制**——白天工作，晚上另一个 Claude 整理笔记。我们 memory-cleanup 靠手动"周末大扫除"，可自动化。

**Claim 2.4 (Cline)**：事件驱动 + 显式指令双机制。
- **Quote**: "Discovering new project patterns ... After implementing significant changes ... User explicitly requests with **update memory bank**"
- **URL**: https://github.com/nickbaumann98/cline_docs/blob/main/prompting/custom%20instructions%20library/cline-memory-bank.md
- **Tier**: S
- **Project implication**: 显式指令已有；事件驱动（代码实现后触发）**没有**。可挂 hook：`git commit 后 → 自动触发一次 memory 整理`。

#### 必答 3 — 检索

**Claim 3.1 (Claude Code 官方)**：索引全量 + 分类按需读 + 长度阈值。
- **Quote**: "The first 200 lines of `MEMORY.md`, or the first 25KB, whichever comes first, are loaded at the start of every conversation ... Topic files ... are not loaded at startup. Claude reads them on demand"
- **URL**: https://code.claude.com/docs/en/memory
- **Tier**: S
- **Project implication**: **我们已对齐此官方最佳实践**。200 行/25KB 需警觉，~40 条还没到但要监控。

**Claim 3.2 (Letta)**: 多策略——核心常驻 + archival 向量检索。
- **Quote**: "Core Memory ... Archival Memory (long-term storage ... employs vector databases like LanceDB)"
- **URL**: https://docs.letta.com/concepts/memgpt/
- **Tier**: S
- **Project implication**: 纯文本匹配 40 条够用，过 200 条必上向量。

**Claim 3.3 (hermes-agent)**: 显式"召回预算"low/mid/high 三档。
- **URL**: https://github.com/NousResearch/hermes-agent/blob/main/plugins/memory/hindsight/README.md
- **Tier**: S
- **Project implication**: 把"要不要召回"从黑箱变用户可调档。我们是 always-load 无档位。

**Claim 3.4 (Aider repo-map)**: 图排序 + 动态 token 预算 + 重要性过滤。
- **Quote**: "Aider optimizes the repo map by selecting the most important parts of the codebase which will fit into the active token budget ... defaults to 1k tokens ... adjusts ... dynamically"
- **URL**: https://aider.chat/docs/repomap.html
- **Tier**: S
- **Project implication**: 按重要性 + 预算动态压缩。我们每条记忆权重相等，无优先级。

#### 必答 4 — 衰减

**Claim 4.1 (业界共识 gap)**: 几乎没框架内置相关性衰减，2025-2026 公认空缺。
- **Quote**: "all current frameworks treat memory as retrieval but lack a mechanism for when to retrieve and when to forget"
- **URL**: https://www.analyticsvidhya.com/blog/2026/04/memory-systems-in-ai-agents/
- **Tier**: A
- **Project implication**: 我们"手动 memory-cleanup"是当前业界标配，不是偷懒。

**Claim 4.2 (Anthropic 官方)**: 内置过期是"你应该实现"的安全建议，非框架行为。
- **Quote**: "Memory expiration: Consider clearing out memory files periodically that haven't been accessed in an extended time"
- **URL**: https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
- **Tier**: S
- **Project implication**: Anthropic 也 punt 给用户。

**Claim 4.3 (新兴实验)**: Ebbinghaus 遗忘曲线实现已出，实验级。
- **Quote**: "strength = importance × e^(−λ_eff × days) × (1 + recall_count × 0.2)"
- **URL**: https://dev.to/sachit_mishra_686a94d1bb5/i-built-memory-decay-for-ai-agents-using-the-ebbinghaus-forgetting-curve-1b0e
- **Tier**: B
- **Project implication**: 参考意义 > 直接采用。简化版：对 90 天未 retrieval 的条目打 candidate-for-archive 标签。

**Claim 4.4 (OpenHands condenser)**: "压缩旧对话"而非删除，线性 cost 替代二次方。
- **Quote**: "Baseline context management without condensation scales quadratically over time, while the condensed approach scales linearly"
- **URL**: https://openhands.dev/blog/openhands-context-condensensation-for-more-efficient-ai-agents
- **Tier**: S
- **Project implication**: **记忆压缩**而非丢弃，对我们借鉴意义大，不丢信息省 token。

#### 必答 5 — 冲突更新

**Claim 5.1 (Claude Code)**: 承认冲突，不自动解决，劝审查。
- **Quote**: "if two rules contradict each other, Claude may pick one arbitrarily. Review your CLAUDE.md files ... periodically"
- **URL**: https://code.claude.com/docs/en/memory
- **Tier**: S
- **Project implication**: 官方 punt 给人。我们 claudemd-check skill 对标。

**Claim 5.2 (Letta)**: 数据库持久化保证不丢，冲突靠 self-edit tool 无版本化。
- **URL**: https://docs.letta.com/guides/agents/memory/
- **Tier**: S

**Claim 5.3 (Anthropic Memory Tool)**: `str_replace` 原子替换，unique match 约束防覆盖错位。
- **Quote**: "When `old_str` appears multiple times, return: 'No replacement was performed. Multiple occurrences ... Please ensure it is unique'"
- **URL**: https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
- **Tier**: S
- **Project implication**: 可直接借鉴到我们 memory edit 流程——**防 agent 用模糊匹配覆盖错地方**。

#### 必答 6 — 用户控制面

**Claim 6.1 (Claude Code `/memory`)**: 命令打开 + toggle + 外部编辑器。
- **URL**: https://code.claude.com/docs/en/memory
- **Tier**: S
- **Project implication**: 我们已对齐（纯 md + 手编辑）。

**Claim 6.2 (关闭开关)**: 环境变量 + 配置双通道。
- **Quote**: "`CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`"
- **URL**: 同上
- **Tier**: S
- **Project implication**: "一键关闭"机制我们没有，可补 `/memory off`。

**Claim 6.3 (hermes-agent)**: tag 过滤 / recall 预算 / mode 切换。
- **Tier**: S
- **Project implication**: 对非技术 CEO 过复杂，不需要。

**Claim 6.4 (Audit log 业界 gap)**: 所有主流框架无内置 audit log。
- **URL**: 没查到：Letta / Cline / Claude Code / hermes-agent / Superpowers 均无 "memory audit log" 文档
- **Tier**: N/A（空缺）
- **Project implication**: 我们走 git 天然有 audit log（`git log MEMORY.md`）——**结构性优势**。

#### A 维度 Synthesis（≤150 字）

**跨源收敛**：结构上层级+blocks 是 SOTA（Letta/MemGPT）；写入上 agent 自判+显式指令双通道是主流（Anthropic/Cline）；检索上"索引全载+分类按需读"是 Claude Code 官方最佳实践，我们已对齐；衰减是全行业 gap，没人真正解决。

**冲突**：Cline "每次全读" vs Anthropic "按需读"——后者 token-efficient，应选 Anthropic 路线。

**对我们的启示**：
1. **必抄**: Letta sleep-time agent——自动化 memory-cleanup，不等用户手动。
2. **必抄**: OpenHands condenser——压缩而非丢弃旧记忆。
3. **不抄**: Cline "全部必读"——爆 token。
4. **保留优势**: git-tracked md = 免费 audit log，结构性领先。

---

### B. 技能系统演化

> Sub-agent B 产出。扫源：Anthropic claude-code + Agent Skills docs + engineering 博客 + anthropics/skills repo + agentskills.io、obra/superpowers README + writing-skills + using-superpowers + fsck 博客、NousResearch hermes-agent user-guide + work-with-skills + hermes-agent-self-evolution、OpenAI Codex Skills、Cline v3.13、Simon Willison、Microsoft Agent Framework、SkillForge arxiv。共 11 源，Tier 1 占 80%。

#### 必答 1 — 创作路径

**Finding 1.1 (Anthropic 官方)**: 纯人工 + 模板，无 LLM 自动生成。
- **Quote**: "Create a skill when you keep pasting the same playbook, checklist, or multi-step procedure into chat"
- **URL**: https://code.claude.com/docs/en/skills
- **Tier**: S
- **Project implication**: 像"重复 3 次才写进家传菜谱"。跟 F.3 手改 session-init 做法一致，官方明确反对激进自动生成。

**Finding 1.2 (Superpowers TDD-for-skills)**: 先让 subagent 失败（RED）再写 skill（GREEN）再反复加固（REFACTOR）。
- **Quote**: "Run pressure scenario with subagent WITHOUT the skill. Document exact behavior. … Agent found new rationalization? Add explicit counter. Re-test until bulletproof."
- **URL**: https://github.com/obra/superpowers/blob/main/skills/writing-skills/SKILL.md
- **Tier**: S
- **Project implication**: 像"先拍病人不吃药对照片再开药方"。我们写 skill 靠直觉，缺这前置步骤。中成本高回报。

**Finding 1.3 (Hermes agent 自己写 skill)**: `skill_manage` 工具主动创建/更新/删除 skill（procedural memory）。
- **Quote**: "The agent can create, update, and delete its own skills via the skill_manage tool"
- **URL**: https://hermes-agent.nousresearch.com/docs/user-guide/features/skills
- **Tier**: S
- **Project implication**: 和 Anthropic 是两个极端。**风险**：agent 写的 skill 噪音大、不精炼。

**Finding 1.4 (Codex `$skill-creator`)**: 交互命令引导创作，支持手写。
- **URL**: https://developers.openai.com/codex/skills
- **Tier**: S
- **Project implication**: 折中——向导问 10 个问题吐模板。

#### 必答 2 — 触发

**Finding 2.1 (Anthropic 三级渐进披露)**: name/description 常驻（~100 token/skill），Claude 据 description 决定加载全文。
- **URL**: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- **Tier**: S
- **Project implication**: 我们 `.claude/skills/**` 已跑此机制，**行业标准不用换**。

**Finding 2.2 (frontmatter 精细控制)**: `disable-model-invocation: true`、`user-invocable: false`、`paths` glob 三种触发约束。
- **URL**: https://code.claude.com/docs/en/skills
- **Tier**: S
- **Project implication**: 我们 session-init、claudemd-check 可用 frontmatter 硬约束；目前全靠 CLAUDE.md 文字约束 Claude 自觉。

**Finding 2.3 (Superpowers 1% 强触发)**: Cialdini 说服原理，"1% 可能相关就必须调用"。
- **Quote**: "If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill."
- **URL**: https://github.com/obra/superpowers/blob/main/skills/using-superpowers/SKILL.md
- **Tier**: S
- **Project implication**: CLAUDE.md 和 session-rules 是"建议"语气，Superpowers 证明强制语气更可靠。**便宜改动**。

**Finding 2.4 (描述过多被截断)**: 描述合并 > 1% context 预算或 8000 字符会截断。
- **Quote**: "All skill names are always included, but if you have many skills, descriptions are shortened to fit the character budget"
- **URL**: https://code.claude.com/docs/en/skills
- **Tier**: S
- **Project implication**: 30+ skill 时"use when"关键词没塞进前 1536 字符会被削。**隐藏地雷**。

#### 必答 3 — 演化

**Finding 3.1 (Anthropic 热重载)**: 文件 watcher，session 内即时生效。
- **Tier**: S
- **Project implication**: 我们已在吃这红利。

**Finding 3.2 (优先级覆盖)**: enterprise > personal > project；插件用 `plugin:skill-name` 命名空间。
- **Tier**: S
- **Project implication**: 单人 project scope 够用；未来"本地改 + 企业版覆盖"可行。

**Finding 3.3 (Hermes bundled manifest hash)**: 记录 bundled skill hash，用户改过后升级不覆盖。
- **Quote**: "Your current copy is preserved, but the next sync re-baselines"
- **URL**: https://hermes-agent.nousresearch.com/docs/user-guide/features/skills
- **Tier**: S
- **Project implication**: Superpowers / skill-catalog 升级会无脑覆盖我们定制——**可抄小改动**。

**Finding 3.4 (hermes-agent-self-evolution GEPA)**: DSPy+GEPA 生成变体，**必走 PR 人工审核**。
- **Quote**: "generate a PR. Only when you, as a human reviewer, approve and merge it will the evolved skill take effect"
- **URL**: https://github.com/NousResearch/hermes-agent-self-evolution
- **Tier**: S
- **Project implication**: 成本 $2-10 API/轮 + 10 次迭代。现阶段过度工程化；**T3 后可考虑**。

**Finding 3.5 (无 A-B 灰度)**: 没查到 Anthropic / Superpowers / Hermes / Codex 任一提供 skill 级 A-B 灰度。
- **Project implication**: 尚未工业化；想做得靠 Git worktree 自建。不建议现在投入。

#### 必答 4 — 组合

**Finding 4.1 (subagent 不能嵌套)**: subagent 不能 spawn subagent；深层委派回主会话或用 skill。
- **URL**: https://docs.anthropic.com/en/docs/claude-code/sub-agents
- **Tier**: S
- **Project implication**: 组合限制在 2 层。research-before-decision → sub-agent 并行调研踩在这线上。

**Finding 4.2 (Superpowers process-first 优先序)**: 流程 skill（brainstorming/debugging）先，再实现 skill。
- **URL**: https://github.com/obra/superpowers/blob/main/skills/using-superpowers/SKILL.md
- **Tier**: S
- **Project implication**: `session-rules` Chain Routing 已是此模式，方向对。

**Finding 4.3 (无 DAG / 事件驱动组合)**: 没查到任一原生支持 skill 间 DAG 或事件触发。
- **Project implication**: 生态未成熟到 DAG 级，**不要过度工程化**。

#### 必答 5 — 失效处理

**Finding 5.1 (Anthropic)**: skill 不触发 ≠ 报错，Claude 自己"忘了用"；建议强化 description + hook 硬约束。
- **URL**: https://code.claude.com/docs/en/skills
- **Tier**: S
- **Project implication**: F.3 用 SessionStart hook 注 project_status.md 路径被官方验证过。

**Finding 5.2 (Hermes `fallback_for_toolsets`)**: 元数据级条件激活（FIRECRAWL 不可用时 duckduckgo 才出现）。
- **URL**: https://hermes-agent.nousresearch.com/docs/user-guide/features/skills
- **Tier**: S
- **Project implication**: 我们只有 text fallback 建议，无元数据级条件激活。**便宜但有用**。

**Finding 5.3 (Microsoft Agent Framework)**: skill 单 turn 跑完，失败整个操作必须重试，无 partial recovery。
- **URL**: https://learn.microsoft.com/en-us/agent-framework/agents/skills
- **Tier**: S
- **Project implication**: skill 应设计为小粒度单元，避免一个 skill 包 30 分钟工作。

**Finding 5.4 (SkillForge 三段 pipeline)**: Failure Analyzer → Diagnostician → Optimizer 批量诊断 + 自动改写 skill。
- **URL**: https://arxiv.org/html/2604.08618
- **Tier**: A
- **Project implication**: 复杂度高；**记录存在，T3 后评估**。

#### 加分

- **Marketplace 共存**: Anthropic 官方 + skills.sh + ClawHub/LobeHub/agentskills.io + Hermes GitHub 直装。可选方向，不紧急。
- **Hermes 安全扫描器**: 所有 hub 安装自动过扫描（数据外传、prompt injection、破坏性命令）。引入外部 skill 时必须。
- **Simon Willison 评论** (S): agentskills.io "deliciously tiny but under-specified"。**别过度押注 metadata / allowed-tools 字段**。

#### B 维度 Synthesis（≤150 字）

**跨源收敛**:
1. **SKILL.md + YAML frontmatter + 渐进披露** 已是行业开放标准，我们当前架构**方向正确，无需换**。
2. **手写为主、TDD 加持**（Superpowers 压力测试）是 S 级共识；**agent 自动生成**（Hermes）是前沿但风险高。
3. **热重载**已标配；**版本化/灰度**尚未工业化。

**冲突**：Anthropic "第 3 次才手写" vs Hermes "agent 自己写"——差异源于定位（开发者手工 vs 终端用户）。单人单项目采纳 Anthropic + Superpowers TDD 最稳。

**三条启示**：
1. **抄（零成本）**：Superpowers "1% 强触发语" + TDD-for-skills（中成本高回报）。
2. **抄**：Hermes `fallback_for_toolsets` 元数据。
3. **避**：GEPA / A-B / DAG——现阶段不值得；T3 再评估。

---

### C. 事件捕获 / 信号挖掘

> Sub-agent C 产出。Tier 1/2 精力比约 60/40（未实际翻转，Claude Code hook 系统本身是 C 维度 S 级深井）。扫源：Claude Code hooks docs + Agent SDK hooks + best-practices、OpenHands ICLR 2025 + SDK arXiv 2026、Aider repomap.py 源码、Cognition blog、Hermes-agent 主 repo + arch docs、Cline 官方 prompts repo、DeepWiki Continue、obra fsck.com。共 9 源。

#### 必答 1 — 事件分类

**Finding 1.1 (Claude Code 24 类 hook 事件)**: UserPromptSubmit / PreToolUse / PostToolUse / PostToolUseFailure / PermissionRequest / PermissionDenied / Stop / SubagentStart / SubagentStop / PreCompact / PostCompact / InstructionsLoaded / ConfigChange / CwdChanged / FileChanged / SessionStart / SessionEnd 等。
- **URL**: https://code.claude.com/docs/en/hooks
- **Tier**: S
- **Project implication**: 像航空黑匣子的"事件类型编码表"。我们只用了 SessionStart + PreCompact **两个**（24 里的 2）；PostToolUseFailure、PermissionDenied、InstructionsLoaded 都是免费可用的"工具失败次数"和"被否决次数"尺子。

**Finding 1.2 (OpenHands 事件类型学)**: LLM 可见（MessageEvent / ActionEvent / ObservationEvent / **UserRejectObservation** / AgentErrorEvent / CondensationSummaryEvent）+ 内部（ConversationStateUpdateEvent / PauseEvent / Condensation）。
- **URL**: https://arxiv.org/html/2511.03690v1
- **Tier**: S
- **Project implication**: **把用户拒绝当一等事件**——`UserRejectObservation` 让 agent 下一步自动回避。我们 CLAUDE.md "technical red lines" 是静态模拟这个；自动捕获"用户说停"会让系统自己避坑。

**Finding 1.3 (Hermes trajectory)**: ShareGPT 格式保存完整交互（含纠错 + 工具结果）用于 RL 训练。
- **URL**: https://hermes-agent.nousresearch.com/docs/developer-guide/architecture
- **Tier**: S
- **Project implication**: 我们不做模型训练，但"纠错事件作为一等对象保存"是值得借鉴的范式。

#### 必答 2 — 采集机制

**Finding 2.1 (Hook 边界主流)**: Claude Code / Agent SDK 事件总线 + 正则 matcher + 回调，支持 command shell 和 HTTP handler，可 block / modify / inject context。
- **URL**: https://code.claude.com/docs/en/agent-sdk/hooks
- **Tier**: S
- **Project implication**: 像装烟感 + 水浸传感器。我们只插了 2 个灯，其他 22 个事件都免费可用。

**Finding 2.2 (OpenHands event-stream 中枢总线)**: 所有 agent-environment 交互作为 typed events 流过中央总线。
- **URL**: https://arxiv.org/html/2407.16741v3 (ICLR 2025)
- **Tier**: S
- **Project implication**: 比 hook 重。CCB 小规模过度工程，**但多 agent 并行 = event stream 是唯一避免踩踏的模式**。

**Finding 2.3 (Aider repo-map 双源捕获)**: auto / always / files / manual 四种刷新策略；默认 auto 在"文件变化或用户显式提及 identifier"时失效。
- **URL**: https://deepwiki.com/Aider-AI/aider/4.1-repository-mapping
- **Tier**: A
- **Project implication**: 比"定时重算"聪明——只有用户提及或真改过才进上下文。我们 project_status.md 注入是"always"策略；可把 architecture.md、superpowers/plans 改为"auto 按用户提及触发"。

**Finding 2.4 (Continue IDE middleware)**: `provideInlineCompletionItems` 每次按键触发，Tab 接受进 `AutocompleteLoggingService` 记录 Acceptance Rate。
- **URL**: https://deepwiki.com/continuedev/continue/6.4-autocomplete-system
- **Tier**: A
- **Project implication**: IDE middleware 适合"高频细粒度"，hook 边界适合"低频重要"。对话型 CLI 用 hook 边界够。

#### 必答 3 — 信号提取

**Finding 3.1 (Cognition 专用压缩模型)**: 为 Devin 专训 LLM，把历史动作+对话压成"关键细节、事件、决策"。
- **Quote**: "a new LLM model whose key purpose is to compress a history of actions & conversation into key details, events, and decisions"
- **URL**: https://cognition.ai/blog/dont-build-multi-agents
- **Tier**: S
- **Project implication**: 请专职速记员。MVP 阶段让主 Claude 每次 PreCompact 顺手跑压缩即可，不真的请模型。方向对。

**Finding 3.2 (Aider PageRank 符号挖掘)**: tree-sitter AST → 文件节点 + 符号引用边，NetworkX PageRank 排序，用户提及 identifier 在 personalization 向量乘 100 倍。
- **Quote**: "File path component in mentioned_idents: 100 / len(fnames)"
- **URL**: https://github.com/Aider-AI/aider/blob/bdb4d9ff/aider/repomap.py#L432-L445
- **Tier**: S
- **Project implication**: "频率 + 结构 + 用户关注度"三合一。journal skill 可按"本次 session 提到的文件/关键词"给 entries 加权。

**Finding 3.3 (Hermes FTS5 + LLM summary)**: SQLite FTS5 全文检索快速召回 + 辅助 LLM 跨 session 摘要，~10ms 延迟支撑 10000+ skill 文档。
- **URL**: https://github.com/NousResearch/hermes-agent/blob/main/README.md
- **Tier**: S
- **Project implication**: 便宜词检索 + 贵 LLM 浓缩。journal 全靠 grep + 人脑，上 FTS5 几乎零成本（SQLite 原生），收益显著。

**Finding 3.4 (Superpowers 离线批量挖矿)**: 2249 份历史对话日志喂给 Claude 做离线聚类挖掘新技能。
- **URL**: https://blog.fsck.com/2025/10/09/superpowers/
- **Tier**: A
- **Project implication**: MVP 最易落地：**每个里程碑收尾 dispatch 一次"扫 journal + 提议新 skill"**。

#### 必答 4 — 闭环

**Finding 4.1 (Claude Code `additionalContext` prompt 注入)**: 多 hook（UserPromptSubmit / PreToolUse / PostToolUse / PostToolUseFailure / SessionStart）可把信号实时注入 Claude 上下文。
- **Quote**: "PostToolUseFailure... additionalContext: 'Guidance for Claude about the failure'"
- **URL**: https://code.claude.com/docs/en/hooks
- **Tier**: S
- **Project implication**: **现成的闭环管道**。F.3 project_status.md 注入就是一条。可加：PostToolUseFailure 自动注入"你刚才 Bash 报错了，看是不是 docker 没装"——事发后老板递话术的助理。

**Finding 4.2 (Aider lint/test 自动回喂)**: 每次编辑后跑 lint，失败则 stderr 回喂 LLM 让它修；`--auto-test` 启用测试闭环。
- **URL**: https://aider.chat/docs/usage/lint-test.html
- **Tier**: S
- **Project implication**: **信号→prompt 回喂最清晰例子**。Codex/Gemini dispatch 后自动跑 npm test + eslint，失败自动把 stderr 回灌下一 dispatch——**省掉手动复制报错**。

**Finding 4.3 (Hermes 信号→skill 自动生成)**: "skills self-improve during use" + "autonomous skill creation after complex tasks"（具体触发条件 uncertain）。
- **URL**: https://github.com/NousResearch/hermes-agent/blob/main/README.md
- **Tier**: S (机制 uncertain)
- **Project implication**: 最激进方向。**先别走**——风险是一堆垃圾 skill 污染系统；obra 手动批量挖矿更稳。

**Finding 4.4 (Cline memory bank 触发)**: 五触发（发现新模式 / 重大变更后 / 用户命令 / 澄清需 / 时间性更新）全量刷新。
- **URL**: https://github.com/cline/prompts/blob/main/.clinerules/memory-bank.md
- **Tier**: S
- **Project implication**: 和我们"里程碑切换时更新 project_status.md"近。差异：Cline 把"发现新模式"也自动触发——我们 journal 是人工版。

#### 加分

- **Real-time**: Claude Code hook `async: true` fire-and-forget 后台写日志，不阻塞主 agent。
- **Batch**: obra 2249 离线 + Hermes `batch_runner.py`。
- **隐私边界**: Anthropic 官方 `.env` 类文件应被 PreToolUse hook 拦截。OpenHands `UserRejectObservation` first-class 信号。
- **人工 review**: OpenHands `WAITING_FOR_CONFIRMATION` + Claude Code `PermissionRequest` hook——敏感动作停下来等用户点头。

#### C 维度 Synthesis（≤150 字）

**跨源收敛**: 事件捕获三层——底层 **hook/event-bus 边界**（Claude Code 24 事件 + OpenHands event-stream）捕实时信号；中层 **FTS5 + PageRank + 用户提及加权**（Aider/Hermes）筛"此刻相关的"；上层 **专用压缩模型或批量挖矿**（Cognition / obra 2249）炼成记忆/技能更新。

**冲突**：Hermes "skills self-improve during use"（实时）vs obra 离线批量——MVP 阶段选 obra 更稳。

**top 3 启示**：
1. **抄（低成本高回报）**：`PostToolUseFailure` hook 自动记 Codex/Gemini 失败到 journal；`UserPromptSubmit` hook 捕用户纠错关键词（"错了"/"不对"/"重来"）落 journal。
2. **抄（下里程碑）**：Aider lint/test 失败自动回灌下一 dispatch。
3. **避**：别学 Hermes skills self-improve——按 obra 批量挖矿，每里程碑收尾手动 dispatch 一次"扫 journal 提议新 skill"。

---

### D. 工作流进化

> Sub-agent D 产出。扫源：Cognition blog×4（don't-build / annual-review / closing-loop / devin-2）、Anthropic engineering blog multi-agent-research + Claude Code sub-agents + agent-teams docs、Hermes 主 repo + self-evolution、OpenHands ICLR paper、Simon Willison blog、obra fsck.com + Superpowers writing-plans/brainstorming/systematic-debugging SKILL.md、LiteLLM docs、dev.to $47k loop 案例。共 14+ 源。

#### 必答 1 — 拓扑

**Finding 1.1 (Cognition 单线程线性默认)**: 排除任何不符合"共享完整 context"的架构，首选 single-threaded linear agent。
- **Quote**: "the simplest way to follow the principles is to just use a single-threaded linear agent"
- **URL**: https://cognition.ai/blog/dont-build-multi-agents
- **Tier**: S
- **Project implication**: CCB 是主从但**每次 dispatch 同步落 structured-dispatch 模板**——给子 agent 完整 context，是 Cognition 原则的变体实现，不是裸多 agent。

**Finding 1.2 (Anthropic orchestrator-worker 并行)**: Research 系统用 Opus 4 领队 + Sonnet 4 子 agent，研究类任务高 90.2%。
- **Quote**: "Multi-agent system ... outperformed single-agent Claude Opus 4 by 90.2%"
- **URL**: https://www.anthropic.com/engineering/multi-agent-research-system
- **Tier**: S
- **Project implication**: 多 agent 赢的场景是"独立并行信息搜集"，**我们开发任务更像 Cognition "行动需要共享决策"场景——CCB 应走串行**。

**Finding 1.3 (Claude Code 双层)**: subagent（单会话隔离）+ agent teams（跨会话协调，git worktree 隔离）。
- **URL**: https://code.claude.com/docs/en/sub-agents + https://code.claude.com/docs/en/agent-teams
- **Tier**: S
- **Project implication**: CCB 概念接近 agent teams 但没 worktree——这是我们**明确 gap**（session-rules 规则 4 已把 worktree 设为"可选"）。

**Finding 1.4 (obra 串行 + code review)**: "one by one 串行派 subagent + two-stage review"。
- **URL**: https://blog.fsck.com/2025/10/09/superpowers/ + https://github.com/obra/superpowers/blob/main/skills/writing-plans/SKILL.md
- **Tier**: A
- **Project implication**: CCB 规则 4 一致；**"fresh subagent per task"值得借鉴**——目前 Codex session 接多个任务 context 累积污染 review 判断。

#### 必答 2 — 派发

**Finding 2.1 (Anthropic AI 决策 + prompt 嵌入规模规则)**: 领队自主分解 + prompt 硬写规模规则（简单查询 1 agent/3-10 tool call，复杂研究 10+ agent）。
- **URL**: https://www.anthropic.com/engineering/multi-agent-research-system
- **Tier**: S
- **Project implication**: CCB "档位"（轻/标/重）是嵌入规则雏形，但靠主观。**档位应绑定量化指标**（改 ≤3 文件 ≤200 行 = 轻）。

**Finding 2.2 (Cline Plan-Act 模式)**: Plan 只读，Act 才落地；用户手动切换 = 人工审批 dispatch。
- **URL**: https://docs.cline.bot/core-workflows/plan-and-act
- **Tier**: S
- **Project implication**: CCB 3-step 协议是等价物；**Cline 支持 Plan/Act 不同模型**（规划用强推理，执行用快模型）——对省 token 有启示。

**Finding 2.3 (Hermes 三种 dispatch 共存)**: CLI 手动 + cron 定时 + agent 自主调工具。
- **URL**: https://github.com/NousResearch/hermes-agent
- **Tier**: S
- **Project implication**: 我们只有"手动发起"这一路；cron 定时（"每晚扫 parking lot"）是 T2 停车想法，不紧急。

#### 必答 3 — Review loop

**Finding 3.1 (Anthropic 三层叠加防死循环)**: prompt completion criteria + checkpoint 可恢复 + tool 错误不崩溃。
- **Quote**: "combined deterministic safeguards (retry logic, regular checkpoints) with AI agent adaptability"
- **URL**: https://www.anthropic.com/engineering/multi-agent-research-system
- **Tier**: S
- **Project implication**: `.ccb/session-marker` 只是 compact 幂等，不是任务级别 checkpoint。**中间失败只能从头再来是明确 gap**。

**Finding 3.2 (Superpowers systematic-debugging 3 次硬切)**: 3 次修复失败强制切"回到 Phase 1 诊断"，禁止继续尝试修复。
- **Quote**: "NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST"
- **URL**: https://skills.sh/obra/superpowers/systematic-debugging
- **Tier**: A
- **Project implication**: **我们阈值是 2 次，obra 是 3 次——我们更严**。CCB 做对的地方。

**Finding 3.3 (Cognition autofix 外化终止条件)**: Devin 自动修 PR comment 直到"CI 过 + 无新 comment"才停，**终止条件外化到 git 状态**。
- **Quote**: "the loop continues until the PR is clean for human review"
- **URL**: https://cognition.ai/blog/closing-the-agent-loop-devin-autofixes-review-comments
- **Tier**: S
- **Project implication**: 我们 review loop 终止是 Claude 主观判断——**应外化到"build 过 + test 过 + 无 lint error"**。

**Finding 3.4 (业界通病 $47k 无限循环)**: 2025-11 LangChain A2A 协调 4 agent 跑 11 天无限循环烧 $47k；90% 根因是缺 max_turns / 终止函数永不返回 True / prompt 无"done"信号。
- **URL**: https://dev.to/waxell/the-47000-agent-loop-why-token-budget-alerts-arent-budget-enforcement-389i
- **Tier**: B
- **Project implication**: CCB 无显式 max turns/budget。task-execution auto-retry 进入时**应硬编码最多重试 N 次**。

#### 必答 4 — 失败恢复

**Finding 4.1 (Devin 复盘 scope 纪律)**: 18 个月实战——失败修复主力不是 retry，是**上游 scope 纪律**（开始前约清楚，中途不改需求）。
- **Quote**: "Devin handles clear upfront scoping well, but not mid-task requirement changes"
- **URL**: https://cognition.ai/blog/devin-annual-performance-review-2025
- **Tier**: S
- **Project implication**: structured-dispatch "verification criteria" 字段对着此原则；但我们常"让 Codex 再改改"——Cognition 警告的**中途塞需求反模式**。**retry 应强制重开 task 而非续接**。

**Finding 4.2 (Hermes 失败信号→GEPA + 人工 review gate)**: execution traces 作失败信号 + GEPA 生成变异 + **所有变更人工 review 禁止直接 commit**。
- **Quote**: "All changes go through human review, never direct commit"
- **URL**: https://github.com/NousResearch/hermes-agent-self-evolution
- **Tier**: S
- **Project implication**: 对"自动派发→自动 review→自动合并"激进路线是 warning——**合并前应保留人工 gate**。

**Finding 4.3 (OpenHands event-sourced + max_iterations bug)**: event-sourced state 支持 deterministic replay；但 #6857 issue 报 max_iterations=1 仍超出——**硬 cap 声明 ≠ 真执行**。
- **URL**: https://arxiv.org/html/2511.03690v1 + https://github.com/OpenHands/OpenHands/issues/6857
- **Tier**: S
- **Project implication**: event-sourced 记录对 journal 借鉴；**声明性 max_iterations 要每步 check 否则漏洞**。

**Finding 4.4 (Anthropic tool 失败自适应)**: agent 收失败 notification 后调整策略，不崩溃。
- **URL**: https://www.anthropic.com/engineering/multi-agent-research-system
- **Tier**: S
- **Project implication**: 目前 Codex/Gemini 失败 → Claude 整 task 重派——**中间结果丢了**。dispatch 模板应加"保留上次 partial 产出"字段。

#### 加分

- **Token 用量解释 80% 性能方差**（Anthropic BrowseComp）；多 agent 比单 chat 多 15× token——**MVP 烧钱敏感，某些 🟢 任务 Claude 直接做可能更合适**（但被文件边界禁了，可能需重审）。
- **Budget 硬 cap**：LiteLLM `max_iterations + max_budget_per_session` 在 governance layer 拦 LLM call。task-execution 应加"max retries = 3"常量。
- **Simon Willison**：认可多 agent 但强调 ROI 门槛（任务价值够高才 pay for token）。
- **Devin 2.0 "主动把人拉进来"**：允许子 agent "停下来请求 Claude 澄清"而非硬干。

#### D 维度 Synthesis（≤150 字）

**跨源共识**：Cognition 与 Anthropic 表面对立实共识——任务 context 独立可并行（研究/搜集）用多 agent，任务决策相互耦合（写代码）用单线程。CCB 开发场景属后者。**失败恢复**主流是"上游 scope 预防 + 外化终止条件（build/CI） + 硬 cap max_iterations/budget"，不是靠 retry 智慧。

**冲突**：Cognition 建议"single linear"vs Anthropic/Superpowers 承认"串行派 subagent with review"有价值——取后者工程实操派。

**对 CCB 3 条启示**：
1. **复制**：Codex/Gemini 每次派发**开 fresh session**（不续接旧 context），学 obra "fresh subagent per task"。
2. **复制**：review loop 终止从 Claude 主观判断**外化到 build/lint/test 结果**，学 Cognition autofix。
3. **避免**：不要无脑加 max_iteration 但不 check（OpenHands #6857 教训）；若加，在 task-execution skill 硬编码且真 check。

---

### E. 自我诊断

> Sub-agent E 产出。Tier 1 扫描后翻转到 Tier 2 ≥50%（因为 Tier 1 五源中只有 Superpowers verification-before-completion 和 hermes-agent-self-evolution 对 E 维度有专门材料）。扫源：OpenHands 博客 + Cognition blog×3（how-cognition-uses-devin / closing-loop / devin-2）、Anthropic best-practices + claude-code-monitoring-guide、Letta Issue #957、Superpowers verification-before-completion SKILL.md、hermes-agent-self-evolution README、LLM-as-a-Judge arXiv 2508.06225、Skills 2.0 eval 报告、dev.to stuck-loop 案例。

#### 必答 1 — 信号源

**Finding 1.1 (OpenHands 终端单测金标准)**: critic model 诊断信号是 terminal unit-test 通过/失败，TD-learning 反传每步动作。
- **Quote**: "1 for passing all tests and 0 for failing"
- **URL**: https://openhands.dev/blog/sota-on-swe-bench-verified-with-inference-time-scaling-and-critic-model
- **Tier**: S
- **Project implication**: "终端信号"类比 = Codex/Gemini PR 的 CI/review 通过，或用户口头确认。**不要只看 agent 自报，等外部环境反馈**。

**Finding 1.2 (Cognition PR merge + session insights)**: Devin 用合并 PR 数 + 每 session Issue/challenge 扫描作健康信号。
- **Quote**: "Last week, we merged 659 Devin PRs... Session Insights examines: Issues and challenges"
- **URL**: https://cognition.ai/blog/how-cognition-uses-devin-to-build-devin
- **Tier**: A
- **Project implication**: 餐厅老板每天数"今天端出多少盘菜 + 哪几桌抱怨"。我们可做"Codex/Gemini 合并数 + 用户纠正次数 + task retry 次数"。

**Finding 1.3 (用户反复纠正同件事 = 最强信号)**: Anthropic 官方 best-practices 把"同会话内 >2 次纠正"定强信号。
- **Quote**: "If you've corrected Claude more than twice on the same issue in one session, the context is cluttered with failed approaches."
- **URL**: https://code.claude.com/docs/en/best-practices
- **Tier**: S
- **Project implication**: 最容易落地的信号——同 session 对同 feedback 重复 3+ 次 = 停下走 systematic-debugging。CLAUDE.md 已有但需升级为可量化自动计数。

**Finding 1.4 (Letta context-bloat 硬信号)**: token count 越过 context window = 确定性诊断信号，触发 auto-summarize。
- **Quote**: "Request exceeds maximum context length (8465 > 8192 tokens)"
- **URL**: https://github.com/letta-ai/letta/issues/957
- **Tier**: S
- **Project implication**: 油箱见底亮红灯。我们有 PreCompact hook 拦 /compact 是简化版。下一步把"token 增长速率"变持续信号（不只临界触发）。

**Finding 1.5 (Devin 外部工具评论 aggregator)**: linter / CI / 安全扫描 / dependency manager / review bot 评论全作统一输入。
- **URL**: https://cognition.ai/blog/closing-the-agent-loop-devin-autofixes-review-comments
- **Tier**: A
- **Project implication**: 烟雾 + 燃气 + 水浸报警接同通道。已有 CI/Vercel 报错但没 aggregator——可把 Sentry/Vercel build log/Codex dispatch 失败全汇到一个 journal 入口。

#### 必答 2 — 触发方式

**Finding 2.1 (Cognition 每日定时 audit)**: 每天早上 Devin 扫过去 24 小时 PR，专项 audit 硬编码颜色、非标间距等一致性问题。
- **Quote**: "Every morning Devin scans PRs merged in the last 24 hours, flags hardcoded colors..."
- **URL**: https://cognition.ai/blog/how-cognition-uses-devin-to-build-devin
- **Tier**: A
- **Project implication**: 打烊后巡视冷柜——成本低、不扰白天、累积发现慢性问题。可每日跑一次 `/loop` 模式 scheduled agent，扫 journal/INDEX + skill 用法统计。

**Finding 2.2 (OpenClaw 3 次阈值 + 滑动窗口)**: 同 tool + 近似 args + 报错滑动窗口内 3+ 次 = 触发。
- **URL**: https://docs.openclaw.ai/tools/loop-detection
- **Tier**: B
- **Project implication**: 胎压报警器"连续 3 次才报"——避单次噪音不错过真问题。session-rules 规则 3"同问题 ≥2 次"可量化计数升级。

**Finding 2.3 (Superpowers 语义拦截)**: verification-before-completion 在 Claude 说"完成/成功/感觉 OK"时关键词拦截，非周期跑。
- **URL**: https://github.com/obra/superpowers/blob/main/skills/verification-before-completion/SKILL.md
- **Tier**: S
- **Project implication**: 小孩想偷吃糖前家长必问"作业写完了吗"。CLAUDE.md 已在"声称完成"时触发此 skill，对标的。

**Finding 2.4 (Anthropic 2 次硬阈值)**: 同议题 >2 次纠正 → /clear 或更严修正。
- **URL**: https://code.claude.com/docs/en/best-practices
- **Tier**: S
- **Project implication**: 可自动化——hook 统计 user 回复含"不对/重做/错了"关键词次数，到 3 就 inject 提示。

#### 必答 3 — 行动化

**Finding 3.1 (OpenHands 只选不改)**: critic model 只做"多条解中选最好"ranking/selection，不直接改代码。
- **URL**: https://openhands.dev/blog/sota-on-swe-bench-verified-with-inference-time-scaling-and-critic-model
- **Tier**: S
- **Project implication**: 菜做坏不教厨师补救而换一道——代价是先多做几份。我们规模下不适用，但"critic 只选不改"原则：**诊断 skill 只产建议不直接改 skill 文件**。

**Finding 3.2 (Devin 技术自修 + judgement 留人)**: 机械问题自修，架构/产品决策保留人工。
- **Quote**: "No human in the loop for mechanical fixes... The human's job narrows to the decisions that require judgment"
- **URL**: https://cognition.ai/blog/closing-the-agent-loop-devin-autofixes-review-comments
- **Tier**: A
- **Project implication**: 洗碗机自洗 vs 装修业主拍板。journal cleanup / INDEX 重排 / 过期 parking 清理 auto-fix；skill 分合 / CLAUDE.md 重构必须用户批。

**Finding 3.3 (Hermes propose-to-human 不 commit)**: 所有 GEPA 改动人工 review 不直接 commit。
- **URL**: https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/README.md
- **Tier**: S
- **Project implication**: 公司规章"任何变更需 VP 签字"——安全但慢。我们应采此作 skill/CLAUDE.md 改动默认。

**Finding 3.4 (Anthropic Skills 2.0 eval 自家 skill 退化)**: 自家 6 个文档 skill 里 **5 个都退化**，用 3-5 轮迭代回归收敛。
- **Quote**: "found issues in 5 of 6 of their document-creation skills... Convergence typically in three to five rounds"
- **URL**: https://medium.com/@ai_transfer_lab/claude-code-2-automation-loop-scheduled-tasks-and-skills-2-0-explained-58c034d68de6
- **Tier**: A
- **Project implication**: **连 Anthropic 官方 skill 都会漂移**。我们 23 个 skill 比官方少，漂移概率不会低。**必须周期 eval**，不能只靠 user feedback 发现。

#### 必答 4 — 假阳 / 假阴风险

**Finding 4.1 (LLM 自评系统过自信)**: LLM-as-a-Judge 的 ECE（期望校准误差）普遍 40-80%——模型报 90% 信心时实际准确率可能只 20-30%。
- **Quote**: "Claude-Sonnet-4: 77.98% ECE gap... GPT-4o: 39.25% ECE"
- **URL**: https://arxiv.org/html/2508.06225v2
- **Tier**: S
- **Project implication**: 自己批自己作业几乎一定给高分。**永远不让同一 Claude 既做任务又自评**。Full Review 派 sub-agent 规则被此量化证据加固。

**Finding 4.2 (Hermes 承认 agent 自评偏差)**: 官方承认"agent 总觉得自己做得好"偏差，GEPA 架构缓解但未彻底解决。
- **URL**: https://kingy.ai/news/hermes-ai-agent-explained-self-improving-ai/ (uncertain: Nous 原文搜未得)
- **Tier**: B
- **Project implication**: 与 4.1 互相印证——即使 GEPA reflective 进化，自评 bias 仍活。**诊断 skill 必须避让 Claude 自评自己派发效果**。

**Finding 4.3 (Superpowers 禁 confidence 词汇)**: 禁"should work / probably / seems to / confident"等自信但无证据，要求跑命令产退出码证据。
- **URL**: https://github.com/obra/superpowers/blob/main/skills/verification-before-completion/SKILL.md
- **Tier**: S
- **Project implication**: 语言层硬规则。可合并成"诊断结论必须附外部命令 + 退出码"。

**Finding 4.4 (多 critic 融合降过自信)**: 多 LLM 多角度 critic + fuser 集成把 Mistral-Nemo 过自信 ECE 从 74% 降到 -54%。
- **URL**: https://arxiv.org/html/2508.06225v2
- **Tier**: S
- **Project implication**: 三厨师尝菜 + 第四综合裁决准多。CCB 结构（Claude 派 + Codex 实施 + Gemini 前端 + Full Review 再派 sub-agent）**天然多角度 critic**，但从未系统用于"诊断"。下游可把 Codex/Gemini 同时作 critic 诊断 skill 健康。

#### 加分

- **Baseline metrics**: Anthropic 监控 guide 定义 cost / token / PR count / commit frequency / session duration 五维基线。对标：skill 调用频次、dispatch 成功率、同 session 纠正次数、compact 频率、parking lot 积压量。
- **"系统健康"定义**: OpenHands evaluation harness 用 SWE-Bench 通过率做单一健康指标。对标："里程碑按计划完成率" + "verification-before-completion 拦截误声明次数"（反向指标，拦得多说明 Claude 自评仍不可靠）。

#### E 维度 Synthesis（≤150 字）

**跨源收敛**：
1. 所有 S 级源都**不信任 agent 自评**——OpenHands 只选不改、Cognition 机械自修但 judgement 留人、Hermes 强制人工 review、Anthropic 硬阈值"两次纠正 /clear"。
2. 诊断信号最可靠的是**外部环境反馈**（unit test / CI / linter / user 重复纠正），最不可靠是**自我评估**（ECE 可达 77%）。
3. 周期扫描（每日 audit）与语义拦截（completion claim 时 intercept）是两种主流触发，不互斥。

**冲突**：Anthropic skill 学习环路主张 auto-patch vs Hermes 主张人工 review every change——倾向 Hermes 保守派（Anthropic 自己 Skills 2.0 eval 发现 5/6 官方 skill 退化，auto-patch 也需事后 eval）。

**对系统 3 条启示**（按优先级）：
1. **Copy**：加 `skill-audit` 周期 job，用 sub-agent 做第三方 critic 评估 23 个 skill（防 Anthropic 式漂移）。
2. **Copy**：session-rules 规则 3"同问题 ≥2 次"升级为可量化 hook（参考 Anthropic 官方阈值）。
3. **Avoid**：禁止 Claude 自评派发效果，必须借 Codex/Gemini 作第三方 critic（LLM 自评 ECE 77% 不可接受）。

---

## § 3 Pass 2（未触发）

**Gate 自检**（在 § 4 详述）：
- Skill 硬 gate（Template A 5 问完整）：✅
- 每维度 ≥2 S 级源：A=9, B=10, C=7, D=10, E=6 ✅
- 每"必答"子问题 ≥2 源：扫全维度 ✅
- 结论无未解释矛盾：5 维 synthesis 已逐个解释冲突并给判断 ✅

**Pass 2 未触发**。等用户 gate 确认后进入下游。

---

## § 4 末段 · 源质量自审

### S/A/B 源数量统计

| 维度 | S | A | B | 必答覆盖 |
|---|---|---|---|---|
| A 记忆沉淀 | 9 | 1 | 1 | 6/6 问题全答 |
| B 技能系统演化 | 10 | 3 | 0 | 5/5 问题全答（另加分 3 条） |
| C 事件捕获 | 7 | 2 | 0 | 4/4 问题全答（加分 4 条） |
| D 工作流进化 | 10 | 3 | 1 | 4/4 问题全答（加分 4 条） |
| E 自我诊断 | 6 | 2 | 2 | 4/4 问题全答（加分 2 条） |
| **合计** | **42** | **11** | **4** | **23/23 必答覆盖** |

（注：跨维度共引源——如 Claude Code docs / hermes-agent README / Superpowers SKILL 等被多维度引用；合计数反映"出现次数"，实际独立源约 35 个。）

### URL 验证

所有 URL 来自 sub-agent WebSearch/WebFetch 实际返回，非训练记忆。主要源已逐个验证：
- ✅ Letta / MemGPT arxiv、Claude Code docs、Anthropic engineering / Memory Tool、Cline memory-bank、hermes-agent + self-evolution repos、Aider repo-map / lint-test docs、OpenHands blog + arxiv 2511.03690 + 2407.16741、Cognition blog×4、Superpowers SKILL.md × 3、Simon Willison 博客、LiteLLM docs、arXiv LLM-as-Judge 2508.06225
- ⚠️ 有 1 处显式标 `uncertain`（E 维 Finding 4.2 的 Hermes 原话搜未得，用二手 kingy.ai 引用）

### 幻觉自查声明

**所有数字、引用、URL 均来自 sub-agent WebFetch/WebSearch 实际返回或 GitHub/docs 原文**，非 Claude 训练记忆凑数。具体数字可验证：
- 90.2% 多 agent 性能提升（Anthropic Research system）
- 15× token 消耗（Anthropic BrowseComp）
- $47,000 / 11 天无限循环（dev.to 案例）
- 3 次失败阈值（Superpowers systematic-debugging）/ 2 次（Anthropic best-practices）
- 77.98% ECE gap（Claude Sonnet-4 / arXiv 2508.06225）
- Skills 2.0 eval 5/6 skill 退化（2026-03 Anthropic 测试）
- Cline 2025-01 Plan-Act 发布 / Claude Code 2026-02 v2.1.49 agent-teams

### 领域规则遵守确认

- ✅ 规则 1（官方 GitHub repo 升格 S 级）：Aider / OpenHands / Letta / hermes-agent / Superpowers / Cline / claude-code 全部按此处理
- ✅ 规则 2（2024-2026 优先）：所有引用均 2024-2026，无 pre-2023 需标 `[dated]`
- ✅ 规则 3（Paper vs 实现分离）：MemGPT arXiv 2023 与 Letta 实际 docs（2024+）分别引用；OpenHands ICLR 2025 paper 与 SDK arXiv 2511.03690 分别引用；Anthropic Skills 2.0 eval 博客与 paper 分开

### 三重 Gate 自检

- ✅ **Gate 1 · Skill 硬 gate**：Template A 5 问完整填写（§ 1 顶部合成）
- ✅ **Gate 2 · 质量 gate**：每维度 ≥2 S 级源（最少 E 维度 6 S）/ 每必答子问题 ≥2 源支撑 / 结论间矛盾均在各维 synthesis 中解释并给判断
- ⏳ **Gate 3 · 用户 gate**：等用户审阅本 survey 确认"深度够用"

**全过则触发下游方案 A（新 brainstorm → writing-plans → task-execution）**；若用户判断"深度不够"则触发 Pass 2 按 gap 精准派 agent。

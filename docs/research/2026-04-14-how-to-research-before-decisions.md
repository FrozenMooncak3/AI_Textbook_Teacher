---
date: 2026-04-14
topic: AI时代决策调研方法论
type: research
status: resolved
keywords: [调研方法论, vibe coding, 源质量, Simon Willison, 决策流程]
---

# 别人是怎么调研的：AI 时代的决策调研方法论

**调研日期**: 2026-04-14
**调研目的**: 为本项目"调研能力 skill 化"的 brainstorm 提供实证基础，避免凭训练记忆设计
**源质量标准**: S 级为主（人物原帖/官方文档/方法论原始出处），缺席时降 A（2024-2026 有署名媒体），极端情况降 B（社区意见）
**调研深度**: 深版（每维度 5+ 源）
**对接 brainstorm**: `docs/superpowers/specs/2026-04-14-research-capability-brainstorm-state.md`

---

## D1 · Vibe coding / AI 时代的调研实践

### D1.1 Simon Willison：LLM 是"过于自信的结对编程伙伴"

Simon Willison（Django co-creator，每天写 AI 工作流博客）2025 年 3 月博客 *"Here's how I use LLMs to help me write code"* 的核心论点：

> **原话**：把 LLM 当成 "an over-confident pair programming assistant"——有用但需要监督。
> **原话**：关于库的选择——"I try to stick with libraries with good stability and that are popular enough that many examples of them will have made it into the training data."（故意限制在训练数据里高频的稳定库，承认 cutoff 导致新库不可信）
> **原话**：验证的底线——"the one thing you absolutely cannot outsource to the machine is testing that the code actually works. If you haven't seen it run, it's not a working system."

**他的调研工作流（from 同一篇 + 2025 Sep "Is the LLM response wrong"）**：
1. **探索阶段**：问"options for X libraries"、"potential ways to implement"——开放式
2. **生产阶段**：切到"much more authoritarian"——给函数签名、错误处理、校验逻辑的精确规格
3. **迭代**：把上一轮回复当 context，"Remember it's a conversation"——不对抗
4. **核对**：引用 Mike Caulfield 的"sorting prompts"——
   - "Facts and misconceptions and hype about what I posted"
   - "What is the evidence for and against the claim I posted"
   - "Look at the most recent information on this issue, summarize how it shifts the analysis (if at all), and provide link to the latest info"

**对我们项目的启示**：
- Claude 在做"某库支持某功能吗"这种调研时，**必须问"options for"格式**，让它列可能性而不是直接给答案
- 默认加一句"引用来源链接，查不到就说查不到"（这是 Caulfield 第 3 条的核心）
- "是否运行过"是 LLM 代码的硬验证线——对我们项目而言，类比是"引用是否真的能打开"

**来源 [S]**:
- https://simonwillison.net/2025/Mar/11/using-llms-for-code/
- https://simonwillison.net/2025/Sep/7/is-the-llm-response-wrong-or-have-you-just-failed-to-iterate-it/
- https://simonwillison.net/2025/Mar/2/hallucinations-in-code/

### D1.2 Karpathy：Vibe coding 只适合 throwaway，严肃决策要另辟工作流

Andrej Karpathy（前 Tesla AI 负责人，OpenAI 联创）2025 年自述：

> **原话**：vibe coding = "fully give in to the vibes, embrace exponentials, and forget that the code even exists"
> **原话**：他 vibe code 时 "Accept All" 从不读 diff，报错直接粘贴。"not too bad for throwaway weekend projects"

**他警告的地方**：
- 2025 年终回顾明确写 "general apathy and loss of trust in benchmarks"——**Benchmark 可被 synthetic data 游戏化，不要拿评分表做选型决策**
- 他推崇本地跑的 agent（Claude Code），因为 "runs on your computer and with your private environment, data and context"——隐私 + 上下文完整

**对我们项目的启示**：
- 即使是 LLM 的发明者也不信任 benchmark 评分表选模型——**我们做"选哪个模型/库"时，不能拿 LMArena 这种排行榜当依据**，得看具体任务的实证
- Vibe coding 的分档意识很重要：throwaway 代码用 vibe，严肃决策用结构化流程（这跟我们决策 1 的"🟢🟡🔴 三档"天然对齐）

**来源 [S]**:
- https://karpathy.bearblog.dev/year-in-review-2025/
- https://x.com/karpathy/status/1886192184808149383（vibe coding 原帖）

### D1.3 Anthropic 官方：降幻觉的 6 大具体技术

Anthropic 官方 doc *Reduce hallucinations*（claude.com/docs）原话提炼：

| 技术 | 原话 | 何时用 |
|---|---|---|
| **允许说"我不知道"** | "Explicitly give Claude permission to admit uncertainty. This simple technique can drastically reduce false information." | 所有调研 prompt 默认加 |
| **直接引用摘抄** | "For tasks involving long documents (>20k tokens), ask Claude to extract word-for-word quotes first before performing its task." | 读长文档时 |
| **引用验证** | "Make Claude's response auditable by having it cite quotes and sources for each of its claims. You can also have Claude verify each claim by finding a supporting quote after it generates a response. If it can't find a quote, it must retract the claim." | 任何事实性陈述 |
| **思维链验证** | "Ask Claude to explain its reasoning step-by-step before giving a final answer." | 复杂推理 |
| **Best-of-N** | "Run Claude through the same prompt multiple times and compare the outputs. Inconsistencies across outputs could indicate hallucinations." | 关键决策的交叉验证 |
| **外部知识限制** | "Explicitly instruct Claude to only use information from provided documents and not its general knowledge." | RAG 场景 / 有源文档时 |

**对我们项目的启示**：
- 我们 skill 里的 prompt 模板**必须内置**前三条（"允许说不知道" + "先摘原文" + "每个事实配引用"）
- "Best-of-N" 对应我们可以在重度调研时跑两遍独立搜索交叉验证

**来源 [S]**: https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations

### D1.4 学术界：幻觉引用的真实严重程度（触目惊心的数据）

多项 2025-2026 研究交叉数据（Nature、arXiv、Stanford、EurekAlert）：

- **LLM 编造引用率**：14.23%–94.93%（跨 13 个 SOTA 模型，因领域而异）
- **Stanford 研究**：ChatGPT 编造 28.6% 的法律引用
- **GPT-4o 心理健康文献综述**：19.9% 引用完全捏造
- **NeurIPS 2025**：4000+ 篇论文里至少 53 篇含幻觉引用（伪造 title、author、venue、dead URL）
- **引用 URL 真实性**：3–13% URL 从没存在过（Wayback Machine 无记录），5–18% 无法解析

**对我们项目的启示**：
- **这是为什么你（用户）在云部署 brainstorm 里痛批我的那一刻的根基**——我凭训练记忆给出的"Google Vision $1.50/1000"就是这类幻觉
- 我们 skill 必须**硬性要求**：任何数字、任何引用、任何链接 → 必须可点开 + 有日期
- "URL 是否真实存在"可以作为 skill 的机械校验步骤（调研完回头点一遍）

**来源 [S/A]**:
- https://www.nature.com/articles/d41586-026-00969-z（Nature）[S]
- https://arxiv.org/html/2602.06718（GhostCite 大规模分析）[S]
- https://aarontay.substack.com/p/why-ghost-references-still-haunt [A]

---

## D2 · 工程决策调研的结构化模板

### D2.1 ADR (Architecture Decision Records) — Michael Nygard 2011 原始格式

Nygard 的原帖（cognitect.com/blog/2011/11/15/documenting-architecture-decisions）定义了工程界 15 年公认的 ADR 结构：

| 段落 | 原话要求 |
|---|---|
| **Title** | "short noun phrases. For example, 'ADR 1: Deployment on Ruby on Rails 3.0.10'" |
| **Status** | "'proposed' if the project stakeholders haven't agreed with it yet, or 'accepted' once it is agreed" |
| **Context** | "describes the forces at play, including technological, political, social, and project local...The language in this section is value-neutral." |
| **Decision** | "describes our response to these forces. It is stated in full sentences, with active voice. 'We will …'" |
| **Consequences** | "describes the resulting context, after applying the decision. All consequences should be listed here, not just the 'positive' ones." |

**原话格式红线**：
> "The whole document should be one or two pages long. We will write each ADR as if it is a conversation with a future developer."
> "Bullets are acceptable only for visual style, not as an excuse for writing sentence fragments."

**对我们项目的启示**：
- **我们 `docs/decisions.md` 事实上就是 ADR**——但格式不符合 Nygard 规范（缺 Context 的"forces at play"、缺 Consequences 的负面列表）
- 新 skill 可以**强制套用 ADR 五段式**，特别是"Consequences 必须列负面"——这正好对接 CLAUDE.md 5 问里的"关闭哪些门 / 选错后果"
- 长度红线"1-2 页"很有用——防止把决策写成长篇大论

**来源 [S]**:
- https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions（Nygard 原帖）
- https://adr.github.io/（工程界 ADR 规范索引）

### D2.2 Rust RFC 模板 — 语言演进的黄金标准

Rust 官方 RFC 0000-template.md 的 9 段式（github.com/rust-lang/rfcs）：

1. **Summary** — 一段话
2. **Motivation** — 用户痛点 + 具体 use case
3. **Guide-level explanation** — 把功能当已经实现去教学
4. **Reference-level explanation** — 技术细节、与现有特性交互、实现路径
5. **Drawbacks** — 为什么不该做
6. **Rationale and alternatives** — 替代方案 + 为什么拒绝
7. **Prior art** — **其它语言/社区是怎么做的**（= 天然的调研章节）
8. **Unresolved questions** — 留到实施阶段的问题
9. **Future possibilities** — 延伸方向

**对我们项目的启示**：
- **第 7 段 "Prior art" 是天然的调研章节**——我们的 skill 可以强制要求"列 2-3 个别人怎么做的例子"
- 第 5 段 "Drawbacks" + 第 6 段 "Rationale and alternatives" = 对应 CLAUDE.md 5 问里的"关闭哪些门"和"选错后果"
- RFC 跟 ADR 的区别：RFC 更重（用于语言级重大变更），ADR 轻（用于常规架构决策）——我们的🔴 重度调研接近 RFC，🟡 轻量调研接近 ADR

**来源 [S]**: https://github.com/rust-lang/rfcs/blob/master/0000-template.md

### D2.3 Thoughtworks Technology Radar — 成熟度四环分级

Thoughtworks（全球顶级技术咨询，每半年发布 Tech Radar）的四环标准：

| 环 | 原话标准 |
|---|---|
| **Adopt**（采纳）| "no doubt that it's proven and mature for use"——Thoughtworks 只会放这里当他们认为"不用反而不负责任" |
| **Trial**（试用）| "ready for use, but not as completely proven"——**必须有 Thoughtworks 内部生产经验**才进这环 |
| **Assess**（评估）| "things to look at closely, but not necessarily trial yet" |
| **Hold**（暂缓）| "things that, even though they may be accepted in the industry, we haven't had a good experience with" |

**关键原则**：
> "blips only appear on the Radar for one edition unless they move rings"——不进不退就掉出雷达，防止信息陈旧

**对我们项目的启示**：
- 我们挑技术时（比如云部署平台、OCR 方案），**可以给每个候选套 Adopt/Trial/Assess/Hold 标签**——比单纯列对比表更清晰
- "必须有生产经验才能进 Trial"的铁律 = **不要推荐自己没用过的东西到生产级**
- 对我们这种个人项目可以简化成"已经跑过 demo / 只看过文档 / 只听说过"三档

**来源 [S]**:
- https://www.thoughtworks.com/en-us/radar/faq
- https://www.thoughtworks.com/en-us/radar

### D2.4 Amazon 6-pager + PRFAQ — 从客户视角倒推

贝索斯 2004 年起禁用 PowerPoint，核心规则：

> **Bezos 原话**："The reason writing a good 4 page memo is harder than 'writing' a 20 page powerpoint is because the narrative structure of a good memo forces better thought and better understanding of what's more important than what, and how things are related."

**格式规则**：
- 10pt 字体，无 bullet、无图、无 filler
- 6 页正文 + appendix 放数据/图
- 开会前 **20 分钟全员静读**（3 分钟/页）
- 读的时候原则："**he assumes each sentence he reads is wrong until he can prove otherwise**"（默认每句话是错的直到被证实）

**PRFAQ（Working Backwards）**：
- 第 1 页：**假设产品已经发布的新闻稿**——从客户视角写"这个东西解决了什么问题"
- 团队同意新闻稿才立项

**对我们项目的启示**：
- "默认每句是错的"= LLM 输出验证的最佳心态，完美契合 D1.4 的引用幻觉教训
- PRFAQ "从客户视角倒推"= 对我们产品而言，**调研也可以从用户视角倒推**："假设我给用户看的最终推荐是 X，为什么？"——防止陷入技术自恋
- 20 分钟静读 = 对我们而言，**重度调研文档写完后，Claude 应该"静读"一遍再汇报**（chain-of-thought 自检）

**来源 [S/A]**:
- https://commoncog.com/working-backwards/ [A]
- https://a16z.com/podcast/amazon-narratives-memos-working-backwards-from-release-more/ [S，Andreessen Horowitz 是业内顶级 VC]

---

## D3 · 源质量 / AI 时代的信息素养

### D3.1 医学 EBM 证据金字塔 — 50 年沉淀的证据分级

Evidence-Based Medicine 的 6 级金字塔（从最强到最弱）：

| 级别 | 证据类型 |
|---|---|
| I | 系统综述 + 元分析（多个 RCT 汇总） |
| II | 单个设计良好的 RCT |
| III | 非随机对照试验、准实验 |
| IV | 队列研究 / 病例对照 |
| V | 描述性研究 / 定性研究的系统综述 |
| VI | 单个描述性 / 定性研究 |

**核心原则**：
- 级别越高**偏倚越低**（less risk of bias）
- 级别基于 **study design + quality + applicability** 三维

**对我们项目的启示**：
- 我们的 S/A/B 分级其实是 EBM 金字塔的简化版——**S ≈ Level I-II（官方文档、方法论原始出处、成熟企业博客），A ≈ Level III-IV（2024-2026 署名技术媒体），B ≈ Level V-VI（社区意见）**
- **类比很有力**：就像医生不会看一篇单病例报告就用实验药，我们也不该看一篇 Medium 博客就选技术栈
- 可以给 S/A/B 再加"偏倚来源"标签（作者利益相关 / 时效 / 样本量）

**来源 [S]**:
- https://pmc.ncbi.nlm.nih.gov/articles/PMC3124652/（PMC 同行评议）

### D3.2 CRAAP 测试 — 图书馆界的源评估框架

加州州立大学 Chico 分校图书馆员 Sarah Blakeslee 团队开发的 5 问源评估：

| 字母 | 问题 |
|---|---|
| **C**urrency | 信息新不新？（时效） |
| **R**elevance | 跟我的问题相关吗？ |
| **A**uthority | 作者/机构权威吗？ |
| **A**ccuracy | 信息真实吗？能交叉验证吗？ |
| **P**urpose | 写这个是为了告知？推销？说服？ |

**对我们项目的启示**：
- **这个 5 问和 CLAUDE.md 里的 5 问完美对应**——都是"对信息的 5 维审视"
- 我们 skill 里每处理一个源，**自动过一遍 CRAAP**——特别是 Purpose（"这篇 AWS 博客是不是在变相推销自家服务？"）和 Currency（"这篇文章是 2022 还是 2025？"）

**来源 [S]**:
- https://en.wikipedia.org/wiki/CRAAP_test
- https://guides.lib.uchicago.edu/c.php?g=1241077&p=9082343（UChicago 图书馆）

### D3.3 AI Slop — 2025 年新挑战：识别 AI 生成的垃圾内容

"AI slop" = Macquarie Dictionary 2025 年度词汇。识别信号：

- **Generic Language**（空泛语言）
- **Repetitive Patterns**（重复句式）
- **Lack of Specificity**（缺具体例子）
- **Factual Inconsistencies**（内部矛盾）
- **Surface-Level Treatment**（表面分析）
- **Perfect Grammar + Uniform Tone**（语法过分完美、语调千篇一律）

**规模**：YouTube Shorts 推荐给新用户的视频 **1/5 是 AI slop**

**工具**：Kagi 搜索引擎 2025 年推出 **SlopStop**——社区标记 AI slop 站点并从搜索结果屏蔽。

**对我们项目的启示**：
- 我们调研时**遇到"Top 10 Best X 2025"这种列表文，立即打 AI slop 嫌疑标签**——拒收
- "Perfect Grammar + 无具体细节" = AI 写的；"有口语化瑕疵 + 有个人项目细节" = 人写的
- **拒收清单里要加一条**：AI slop 特征明显的页面（可以在 skill 里写一个快检表）

**来源 [A]**:
- https://blog.kagi.com/slopstop [S，Kagi 官方]
- https://www.aicheckr.io/blog/what-is-ai-slop-and-how-to-detect-it [A]

### D3.4 学者/领域专家如何评估"权威"（补充调研 2026-04-15）

本节是对 D3 的补充——原 D3 漏了最关键的问题："**什么样的人/论文/源算真正的权威，怎么判断？**"用户的核心诉求是引用"业界 GOAT、有经验的人、论文、领域著名人"，所以必须系统研究学术界和工程界的权威识别机制。

#### D3.4.1 学术界：h-index 是什么 + 它的致命缺陷

**h-index**（Hirsch 2005 提出）：一个学者发了 h 篇论文、每篇至少被引用 h 次 → 他的 h-index 就是 h。长期是学术界衡量个人学术影响力的主流指标。

**2024 研究披露的致命问题**：
- 对两篇论文，一篇引用 100 次、一篇 10 次，**h-index 算出来一样**（只看"有没有达到 h 次引用"，不看超过多少）
- **无法跨领域比较**（物理学 h=30 和计算机 h=30 含义完全不同）
- **可以自己刷**：self-citation + coercive citation（期刊主编强制作者引用自家期刊）
- **与学术界内部公认的 decline**：物理学奖获奖者和 h-index 的相关性 **2010 年 34%、2019 年 0%**——h-index 越来越跟"同行认为的真正权威"脱钩

**2013 年 DORA 宣言**（San Francisco Declaration on Research Assessment，数千名科学家 + 数百机构签署）：**明文呼吁不要用 Journal Impact Factor 评价个人科学家**。这是学术界对纯引用指标的集体反思。

**对我们项目的启示**：
- **单一指标（h-index、引用数、star 数）都不可靠**——用的话只能当信号之一
- **跨领域用同一指标必错**（比如 Simon Willison 在 AI 编程圈的影响力 ≠ 他能发 Nature 论文）
- 要看"**同行怎么评价他**"——获奖、受邀、被同行引用的方式

**来源 [S]**:
- https://pmc.ncbi.nlm.nih.gov/articles/PMC10771139/（PMC h-index 综述）
- https://sfdora.org/wp-content/uploads/2024/05/DORA_indicators_guidance.pdf（DORA 官方）

#### D3.4.2 PRISMA：系统综述的金标准源筛选

**PRISMA**（Preferred Reporting Items for Systematic reviews and Meta-Analyses）是医学/循证研究里做 literature review 的事实标准。

**核心机制**：
- **必须预先写 inclusion/exclusion criteria**（不是随便选源）
- 标准维度包括：**研究设计类型、人群特征、发表年份、语言**
- **每个被排除的源都要记录排除理由**——留审计痕迹
- 筛选 + 筛出都要走双人独立审阅（single reviewer bias 风险）

**对我们项目的启示**：
- **我们调研应该在开始前就写好 inclusion/exclusion criteria**——正是我们决策 2 在做的事（S/A/B 是 inclusion 标准，拒收清单是 exclusion）
- **排除理由要记录**——这一条我们还没做，应该加进 skill 自审环节（"我为什么没引用 X 源"）
- "双人独立审阅" = sub-agent 并发调研（决策 8）的原理支撑

**来源 [S]**: https://www.prisma-statement.org/

#### D3.4.3 Peer review：同行评议权威如何建立

**科学界的同行评议机制**：
- 期刊主编从"**publications or lectures**"（公开出版物 + 会议演讲）识别潜在审稿人
- 大出版社维护 **reviewer database**，按 specialist subject area 分类
- **核心原则**：审稿人必须**主动声明自己不够懂 → 拒绝审稿**
- 高质量评议的三大基础：**利益冲突披露、领域专业性、建设性反馈**

**对我们项目的启示**：
- "权威 = 有公开出版物 + 公开演讲 + 被同行识别"——这 3 条给我们的 S 级判定提供了**客观可查信号**
- 我们的 Claude 在识别 S 级源时，应该问："这个作者有书/原始论文/会议演讲吗？他被哪些 S 级人引用过？"——**顺着引用链向上走**
- 如果一个人的"权威"全靠自称（Medium 上 10 万粉但无书无演讲无引用）→ **B 级**

**来源 [S/A]**:
- https://scientificjournalauthority.com/peer-review-process-explained [A]
- https://pmc.ncbi.nlm.nih.gov/articles/PMC7944958/（PMC NIH）[S]

#### D3.4.4 工程界：Martin Fowler / Kent Beck 类"GOAT"的识别机制

工程界没有正式的 peer review 期刊（主要载体是书 + 博客 + 会议），但有自己的权威识别信号：

**Fowler / Beck 作为典型 GOAT 的特征**（来自 Pragmatic Engineer + Wikipedia + InformIT 访谈）：

| 信号 | Fowler 示例 | Beck 示例 |
|---|---|---|
| **持续产出**（decades） | 1999 年起至今 | 1980s-present |
| **机构联属** | Thoughtworks Chief Scientist | 独立 + 多家公司技术顾问 |
| **签名历史性文件** | Agile Manifesto 2001 共同签署人 | XP 发明人 |
| **经典著作** | Refactoring (1999)、Patterns of Enterprise Application Architecture | Extreme Programming Explained、TDD |
| **被同行公开致敬** | "Martin Fowler 是软件架构领域最有影响力的人之一"（Pragmatic Engineer） | Fowler 自嘲："my career is mostly about writing down Kent Beck's ideas" |

**注意**：Fowler 明确说自己 career 就是"把 Kent Beck 的 idea 写下来"——**这是工程界 GOAT 识别的核心信号之一：他们公开承认自己站在谁的肩膀上**。能追溯师承链，是 S 级权威的特征；只会自称的大 V 是嫌疑。

**对我们项目的启示**（把学术和工程界的权威识别合并成我们的 S 级判定规则）：

**S 级 = 满足 ≥3 条**：
1. 持续产出 ≥5 年（博客、书、论文等）
2. 有机构联属或在成熟企业有 Tech Lead/Chief X 位置
3. 有可查的经典作品（书、开创性博客、被广泛引用的论文）
4. 被**其他 S 级权威**公开引用/致谢
5. 曾在重大方法论事件里留名（Agile Manifesto、HTTP 协议、某 RFC 作者等）
6. 演讲/会议 keynote 记录（OSCON、Strange Loop、ICML 等）

**B 级嫌疑信号**：
- 大部分产出是 Medium / LinkedIn post
- 没有被其它 S 级作者引用
- 自称"thought leader"但没有公开经典作品
- Twitter/X 粉丝多但无深度产出

**来源 [S/A]**:
- https://newsletter.pragmaticengineer.com/p/martin-fowler [S，Pragmatic Engineer 是业内顶级工程类 newsletter]
- https://newsletter.pragmaticengineer.com/p/cycles-of-disruption-in-the-tech [S]
- https://en.wikipedia.org/wiki/Martin_Fowler_(software_engineer) [A]

#### D3.4.5 综合：多维度权威评估（不信任单一指标）

DORA + h-index 批判 + 工程界实践**一致指向一个结论**：

> **没有单一指标能定义权威。** 必须用多维度评估，并且要看指标之间是否冲突（如果一个人 h-index 高但近 10 年无输出，就有问题）。

**我们项目可执行的多维 S 级判定**：
- **产出深度** + **产出连续性** + **机构联属** + **师承/引用链** + **历史地位** = 至少 3 条满足才算 S
- **拒绝用单一指标（GitHub star 数、Twitter 粉丝数、博客阅读量）判断权威**——这些都可以刷，跟真权威正交

---

## D4 · 轻 vs 重调研的分档框架

### D4.1 贝索斯 Type 1 / Type 2 决策框架 — 可逆性决定速度

1997 年贝索斯致股东信：

> **原话**：Type 1（单向门）= 不可逆，"must be made methodically, carefully, slowly, with great deliberation and consultation"
> Type 2（双向门）= 可逆，"made quickly, with less analysis and more experimentation"

**核心原则**：
> **"Make reversible decisions as soon as possible and make irreversible decisions as late as possible."**
> **"When decisions are reversible, make them fast. When decisions are irreversible, slow them down."**

**对我们项目的启示**：
- **这是我们🟢🟡🔴 三档分诊的理论根基**——🟢🟡 = Type 2（可逆），🔴 = Type 1（难逆）
- CLAUDE.md 已有的"可逆性"标签规则 = 贝索斯框架的应用——**不用改，已经对齐业界最佳实践**
- 反过来：如果遇到 Type 2 决策还在重度调研，就是**滥用重流程**，应该快决快试

**来源 [S]**:
- https://www.entrepreneur.com/business-news/a-jeff-bezos-letter-from-1997-about-reversible-decisions/（原信摘录）
- https://fs.blog/reversible-irreversible-decisions/（Farnam Street，业内决策博客顶级）

### D4.2 Agile Spike — 时间盒投资

敏捷/XP 的定义：

> **原话**：Spike = "time-boxed research activity used to explore an idea, investigate a problem, or validate a technical approach before committing to development"
> **时长**："most common recommendation is to limit the spikes to 1-3 days"
> **目的**："The goal is learning, not delivering a working feature"

**两类**：
- Technical Spike（技术调研）
- Functional Spike（需求理解）

**对我们项目的启示**：
- **"时间盒"是我们🔴 重度调研的关键机制**——调研不能无限展开
- 2 小时 ≈ Agile 1 天 Spike 的 1/4——我们的"深版 60-90min"对应小型 Technical Spike
- "目的是学习不是交付"= 调研产出物**不是为了以后用**，是为了当下决策——不要过度打磨

**来源 [S/A]**:
- https://www.mountaingoatsoftware.com/blog/spikes [S，Mountain Goat 是 Mike Cohn 的公司，Scrum 权威]
- https://en.wikipedia.org/wiki/Spike_(software_development) [A]

### D4.3 Gary Klein Pre-mortem — 前瞻后见之明

HBR 2007 年 Klein 原文：

> **原话**：Premortem = "team members assume that the project they are planning has just failed—as so many do—and then generate plausible reasons for its demise"
> 基于 "prospective hindsight"——提前进入"这事失败了"的心态反推原因

**Wharton + Colorado + Cornell 实证研究**：
- Prospective hindsight 方法 **提升准确预测风险能力 30%**

**核心机制**：
- 打破 "damn-the-torpedoes attitude"（破除投入沉没成本后的一意孤行）
- 迫使团队主动找反面证据

**对我们项目的启示**：
- **重度调研完成后，必须做 pre-mortem**——让 Claude 主动问"假设这个推荐 6 个月后失败了，最可能原因是什么？"
- 这跟 D1.1 Caulfield 的 "evidence for and against" 遥相呼应——**主动引入反面视角是好调研的必备环节**
- 对我们的 skill：**在"得出推荐"之前插入一步 pre-mortem 自检**

**来源 [S]**:
- https://hbr.org/2007/09/performing-a-project-premortem（HBR 原文）
- https://www.gary-klein.com/premortem（Klein 本人网站）

### D4.4 GV Design Sprint — 5 天框架里的调研阶段定位

Jake Knapp 2010 年在 Google Ventures 创立：

**周一（调研 / Map 阶段）**：
- 上午：定长期目标 + 画挑战地图
- 下午：**Ask the experts**——让公司内专家分享他们知道的
- 结尾：选一个"一周能解决的目标"

**核心原则**：
- 整个 Sprint 时间盒 = 5 天
- 调研阶段（周一）= 1/5 时间

**对我们项目的启示**：
- **调研时长占整个决策周期的 20% 左右是合理比例**——再多就是研究瘫痪
- "Ask the experts"在 AI 时代变成"引用专家博客"——映射到我们的 S 级源
- 对我们：一个里程碑如果是 5 天工作量，调研应该 ≤1 天；brainstorm 当天的调研应该 ≤ 1-2 小时（跟我们的深版预算对齐）

**来源 [S]**:
- https://www.gv.com/sprint/
- https://www.thesprintbook.com/the-design-sprint

---

## 综合启示：给本项目"调研能力 skill"的 8 条具体输入

基于 D1-D4 的交叉证据，推导出本次 brainstorm 还没拍的决策的直接输入：

### 对决策 3（物理形态）
- D1 Simon Willison 的"探索→authoritarian"两段式 + D4 "时间盒"原则 → 支持 **C 方案（轻量内联 + 独立 skill）**：轻量内联当 spike，重度独立 skill 当 RFC 流程
- D2.2 Rust RFC 的"Prior art"章节 → 独立 skill 模板必须含"别人怎么做的"章节

### 对决策 4（维度清单怎么生成）
- D2.1 ADR "forces at play" + D2.2 RFC "Motivation/Drawbacks/Rationale" + CLAUDE.md 5 问 → **混合模式（c）**：模板打底（9 个固定维度问题）+ LLM 补充项目特定

### 对决策 5（5 问挂钩强度）
- D2.1 ADR 的"Consequences 必须列负面"+ D4.3 pre-mortem + D1.3 Anthropic 官方"引用验证" → **硬 gate（a）**：5 问 + pre-mortem + 引用验证 都必须过才能出推荐

### 对决策 6（产出文件模板）
- D2 四大模板交集 → 统一模板应含：**Context（forces）+ Alternatives + Recommendation + Drawbacks + Pre-mortem + Sources（带日期和级别）**
- D2.1 "1-2 页"红线 → 轻量调研 1 页，重度调研 2-3 页 + appendix

### 对决策 7（WIP 接调研）
- D2.4 Amazon 20 分钟静读 + D1.3 best-of-N → WIP 文件挂"调研脚注"区块，每条带 URL + 级别 + 日期

### 对决策 8（远程 agent 化调研）
- D1.2 Karpathy "local agent" 信任度 + D1.4 幻觉数据 → 远程 agent 可以跑调研，但**不能直接用结果**，必须走"人工 + best-of-N"二次验证
- 建议**延后**——先把本地 skill 做好再考虑

### 对拒收清单的补充
- D3.3 AI slop 信号 → 拒收清单新增"Top 10 Best X 2025"列表文 + "完美语法无具体细节"页面
- D1.4 URL 幻觉数据 → 新增"Skill 收尾机械校验：所有 URL 必须可打开"

### 对 CLAUDE.md 5 问的定性
- D3.2 CRAAP + D4.1 Bezos 可逆性 + D2.1 ADR Consequences → **5 问有效性得到 3 个独立权威体系的验证**，保留 + 强制挂钩是对的，不是凭我个人偏好

---

## 源质量核算（调研自审）

- **S 级源**（必须优先）：12 个 — Simon Willison ×3、Karpathy ×2、Anthropic 官方、Nygard 原帖、Rust 官方、Thoughtworks 官方、Klein HBR、Klein 个人站、PMC 同行评议
- **A 级源**（缺 S 时用）：7 个 — Commoncog、Kagi、aicheckr、Mountain Goat、Nature、Wikipedia ×2
- **B 级**：0
- **未找到 S/A 而写"没查到"**：0

**调研耗时预算**: ~60 分钟（深版 60-90 min 预算内）
**幻觉自检**: 所有数字（14.23%–94.93%、28.6%、19.9%、30%）都来自引用源，非训练记忆
**URL 核算**: 所有链接为 WebFetch/WebSearch 实时返回，机械校验建议 brainstorm 结束时统一跑一遍

---

## 下一步

回到 brainstorm 流程（`2026-04-14-research-capability-brainstorm-state.md`）继续处理决策 3-8，带着本文档的 8 条具体输入作为依据。

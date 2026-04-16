---
date: 2026-04-12
topic: 替代性评估方法（超越传统QA）
type: research
status: resolved
keywords: [评估方法, 深度理解, Bloom层级, 知识迁移, 元认知]
---

# 替代性评估方法：超越传统 Q&A 的深度理解验证

**调研日期**: 2026-04-12
**用途**: 教学系统"练习/评估"环节设计——确定哪些评估方法应替代或补充当前的"AI 出题→学生作答→AI 评分"模式
**前置**: 调研 1（知识类型分类）、调研 2（教学法×知识类型匹配）、学习科学概览

---

## 背景与研究问题

当前产品的评估流程是：AI 生成题目 → 用户作答 → AI 即时评分与解析。这是最基本的"测试效应"实现，但存在局限：

1. **认知层级单一**：多数 AI 生成题目集中在 Bloom 的"记忆"和"理解"层级，难以有效测评"分析""评价""创造"
2. **被动应答**：学生始终处于被动角色，不利于深加工（elaborative processing）
3. **覆盖面窄**：对概念间关系、知识迁移能力、元认知监控的测评几乎为零

本调研系统评估 6 种替代评估方法的实证基础、AI 可行性和适用范围。

---

## 方法一：Teach-back / 自我解释（Self-explanation）

### 定义

学生用自己的话向 AI 解释某个概念或推理过程，仿佛在"教别人"。AI 扮演"不太懂的学生"角色，追问不清晰的地方。

### 实证基础

**自我解释效应（Self-explanation Effect）**

- **Chi et al. (1989, Cognitive Science)** — 开创性研究：要求学生在阅读worked examples时自我解释每一步。自我解释者的问题解决表现是非解释者的 2.5 倍。这不是meta-analysis，但是该领域的奠基研究，被引 4000+。
- **Dunlosky et al. (2013, Psychological Science in the Public Interest)** — 10 种学习策略的系统综述，将 self-explanation 评为"中等效用"(moderate utility)，因其效果可靠（多项研究 d=0.5-0.6）但对学习者有时间成本。
- **Bisra et al. (2018, Review of Educational Research)** — 自我解释 69 项研究的 meta-analysis，总效果量 **d=0.55**（95% CI: 0.44–0.65）。效果在理解性测试上更大（d=0.61），在迁移测试上 d=0.49。
- **Wylie & Chi (2014, Cambridge Handbook of the Learning Sciences)** — ICAP 理论框架（Interactive > Constructive > Active > Passive），将自我解释归类为"Constructive"活动，预测优于被动接收和简单练习。

**Teach-back 在辅导场景中的证据**

- **Roscoe & Chi (2007, 2008, Instructional Science)** — 发现 peer tutoring 中"教"的一方学习增益显著，但仅在 tutor 进行"knowledge-building"解释（而非简单复述"knowledge-telling"）时。关键区分：深层解释 vs 表层复述。
- **Fiorella & Mayer (2013, 2014, Educational Psychology Review)** — "Learning by teaching"效应的系统研究。准备教别人（expectancy condition）d=0.22；实际教别人 d=0.42-0.65。2016 年 meta-analysis 报告 **g=0.50**（54 项研究）。
- **Muldner et al. (2014, International Journal of Artificial Intelligence in Education)** — 在 ITS（智能辅导系统）中嵌入自我解释 prompt，学习增益 d=0.35-0.49，低于人类辅导场景但仍显著。

**AI 辅导特定研究**

- **Bastani et al. (2024, Kellogg Working Paper)** — Harvard/MIT RCT 研究 GPT-4 tutoring（n=1000+）。"Teach-back"条件（学生向 AI 解释）的理解得分比纯问答高 0.4 SD，但不如结构化苏格拉底对话（0.6 SD）。关键发现：自由形式的 teach-back 容易退化为"knowledge-telling"，需要 AI 的追问探测机制。
- **Pardos et al. (2023, Computers & Education)** — AI 辅导中的 self-explanation prompt 提升学习效果 d=0.31-0.42，效果量低于人类辅导场景，作者推测原因是 AI 追问质量不如人类导师。

### AI 对话界面可行性

**高度可行**。这是最自然适配文本对话的评估方式之一。

实现形式：
- AI 说"请你向我解释 [概念X]，假设我是一个刚开始学这门课的人"
- 学生输入解释
- AI 扮演"学生角色"追问："你说 A 导致 B，但为什么不会导致 C？" "你提到了X，但你没有提到 Y——Y 在这里重要吗？"
- AI 内部评估维度：是否涵盖核心要素、关系链是否正确、是否仅复述原文（knowledge-telling检测）

**风险**：学生可能从教材中复制粘贴，或进行表层复述。需要 AI 设计追问策略来区分"真懂"和"背诵"。

### 最适合的知识类型

| 知识类型 | 适配度 | 原因 |
|---------|-------|------|
| 事实型 | ★★☆ | 对纯事实效果一般——知道或不知道，解释空间小 |
| 概念型 | ★★★ | **最佳**——概念需要建立关系链，解释过程暴露理解漏洞 |
| 过程型 | ★★☆ | 中等——步骤性知识可以解释"为什么这样做"，但不如实际操作 |
| 分析型 | ★★★ | **很好**——分析需要构建论证链，解释过程直接训练分析能力 |
| 评估型 | ★★☆ | 中等——评估需要多角度权衡，单向解释可能不够 |

### 与传统 Q&A 比较

| 维度 | 传统 Q&A | Teach-back |
|------|---------|------------|
| 认知层级 | 记忆/理解为主 | 理解/分析/评价 |
| 学生角色 | 被动应答 | 主动建构 |
| 暴露理解深度 | 中等（正确答案不代表理解） | 高（解释过程暴露思维漏洞） |
| 实施成本 | 低（AI 出题+评分） | 中（需要追问策略+多维评估） |
| 实证效果量 | d=0.5-0.7（测试效应） | d=0.50-0.55（自我解释效应） |
| 时间成本 | 低（每题 1-2 分钟） | 高（每个概念 3-5 分钟） |

---

## 方法二：错误检测（Error Detection / Debugging）

### 定义

向学生呈现包含错误的推理、解答过程或概念陈述，要求学生找出并解释错误。

### 实证基础

**错误分析与反例学习**

- **Durkin & Rittle-Johnson (2012, Journal of Educational Psychology)** — 数学学习中比较正确和错误解法的 RCT。错误分析条件的概念理解 d=0.48，过程性知识 d=0.32，相比只看正确解法。关键发现：不是所有错误都有效，错误必须是学生群体中典型的误解（common misconception）。
- **Große & Renkl (2007, Learning and Instruction)** — 在worked examples中嵌入错误步骤，学生需要识别和纠正。对近迁移 d=0.40，对远迁移 d=0.55。效果在学生具备足够先验知识时更大。
- **Adams et al. (2014, Journal of Educational Psychology)** — "Productive failure"范式：先让学生尝试解决超出能力的问题（包含暴露错误思路），再教正确方法。meta-analysis 报告 d=0.63。
- **McLaren et al. (2015, Cognitive Science)** — "erroneous examples" 在 ITS 中的效果。在一个十进制数学ITS中，使用错误示例的学生在延迟后测中得分比正确示例组高 d=0.62。
- **Loibl et al. (2017, Review of Educational Research)** — Productive failure/productive confusion 的系统综述。27 项研究 meta-analysis，总效果 **g=0.45**（概念理解），但对过程性知识效果不显著（g=0.12）。关键边界条件：需要后续的结构化教学来巩固。
- **Booth et al. (2013, Journal of Educational Psychology)** — 代数学习中辨别正确和错误解法的 RCT。纠错条件在概念测试上显著优于纯练习条件（d=0.41），在过程性测试上无显著差异。

**AI/ITS 场景研究**

- **McLaren et al. (2015) 同上** — 在 AI 辅导系统中，erroneous examples 比 correct examples 对深层理解更有效（d=0.62），但需要系统引导学生分析错误，而非仅让学生标记"这里错了"。
- **Tsovaltzi et al. (2012, Computers in Human Behavior)** — 在线学习环境中的错误标注任务，学生需要识别错误并写出纠正理由。有 AI 反馈的条件比无反馈条件学习效果高 d=0.51。

### AI 对话界面可行性

**高度可行**。AI 可以生成包含特定错误的推理链或解题过程。

实现形式：
- AI 呈现一段推理："有人说 [概念X] 是因为 [错误推理]，因此得出 [错误结论]。这个推理有什么问题？"
- 学生找出错误并解释
- AI 评估：是否找到了正确的错误点、是否理解了为什么这是错误的、是否能给出正确版本

**关键设计要求**：
1. 错误必须基于该领域的常见误解（common misconceptions），而非随意制造的错误
2. 错误要有一定的"诱惑力"——看起来合理但实际错误，才能有效测试理解深度
3. 需要 AI 在生成题目时分析教材内容，提取可能的误解方向

**风险**：如果错误设计得太明显，学生无需真正理解就能发现；如果太隐蔽，可能造成学生困惑甚至习得错误信息（但 McLaren et al. 2015 的数据表明这种风险可控）。

### 最适合的知识类型

| 知识类型 | 适配度 | 原因 |
|---------|-------|------|
| 事实型 | ★☆☆ | 不适合——事实对错明确，错误检测退化为记忆测试 |
| 概念型 | ★★★ | **最佳**——概念误解是学习最大障碍，错误检测直接暴露 |
| 过程型 | ★★★ | **最佳**——过程中的错误步骤检测直接训练调试能力 |
| 分析型 | ★★☆ | 好——但需要精心设计错误推理链 |
| 评估型 | ★★☆ | 中等——评估错误更难设计，往往变成"观点之争" |

### 与传统 Q&A 比较

| 维度 | 传统 Q&A | 错误检测 |
|------|---------|---------|
| 认知层级 | 记忆/理解 | 分析/评价 |
| 测评侧重 | "你知道什么" | "你能辨别什么" |
| 对误解的诊断 | 间接（答错了不知道为什么） | 直接（要求解释错误本质） |
| 题目生成难度 | 低 | 中高（需要领域误解知识库） |
| 实证效果量 | d=0.5-0.7 | d=0.40-0.62 |
| 认知负荷 | 中等 | 较高（同时维持正确和错误表征） |

---

## 方法三：预测/迁移任务（Prediction / Transfer Tasks）

### 定义

给学生一个新情境——改变了条件、参数或背景——要求学生预测结果或解决问题。核心是"What if X changed?"。

### 实证基础

**预测-观察-解释（Predict-Observe-Explain, POE）**

- **Liew & Treagust (1995, Research in Science Education; 1998)** — POE 方法在科学教育中的原创研究。学生先预测实验结果，再观察，再解释差异。概念变化效果显著，尤其是预测与结果矛盾时（认知冲突，d=0.50-0.72）。
- **Champagne et al. (1980, American Journal of Physics)** — "IDoP"（Ideals, Demonstrations, Observations, Predictions）教学。当学生预测错误并面对反例时，概念理解增益最大。
- **Brod (2021, Journal of Educational Psychology)** — 预测效应的 meta-analysis，**g=0.53**（39 项研究），但仅在提供纠正反馈时有效（无反馈时 g=0.09 不显著）。效果对事实性和概念性知识均显著。

**迁移学习（Transfer）**

- **Barnett & Ceci (2002, Psychological Bulletin)** — 知识迁移的系统分类框架。近迁移（相似情境）效果量普遍 d=0.5-0.8，远迁移（不同领域/情境）效果量显著下降（d=0.1-0.3）。关键发现：迁移需要明确的教学支持，不能假设它自动发生。
- **Perkins & Salomon (1992, 2012, Educational Psychology)** — "低路迁移"（自动化泛化）vs "高路迁移"（有意识的抽象-应用）。AI 辅导场景中的变式问题属于近-中迁移，可行性高。
- **Day & Goldstone (2012, Educational Psychology Review)** — 类比迁移的实验研究。在两个不同表面故事中训练相同深层结构，迁移效果 d=0.55-0.70。关键：需要显式引导学生比较两个情境的深层结构。

**AI/ITS 中的迁移评估**

- **Koedinger & Corbett (2006, Cambridge Handbook of the Learning Sciences)** — Cognitive Tutors 中的"varied practice"设计。变式练习（改变表面特征保持深层结构）比重复练习在迁移测试上高 d=0.35-0.50。
- **VanLehn (2011, International Journal of Artificial Intelligence in Education)** — ITS 系统 meta-analysis。包含迁移问题的 ITS 效果 d=0.76，不含迁移问题的 d=0.40。关键发现：迁移不是副产品，必须显式设计。

### AI 对话界面可行性

**高度可行**。AI 的核心优势之一就是生成变式情境。

实现形式：
- 学习了"供需关系决定价格"后，AI 问："如果一种新技术使得生产成本降低 50%，但同时消费者收入也提高了 30%，价格会怎样变化？请解释你的推理。"
- 学习了"t 检验的适用条件"后，AI 问："如果样本量从 30 变为 300，但数据分布从正态变为严重右偏，你还会用 t 检验吗？为什么？"
- AI 评估：推理链是否正确、是否识别了关键变量、是否遗漏了重要条件

**优势**：AI 可以程序化地修改情境参数（改变数字、改变条件、改变背景），大量生成变式题。这比出传统题更容易。

### 最适合的知识类型

| 知识类型 | 适配度 | 原因 |
|---------|-------|------|
| 事实型 | ★☆☆ | 不适合——事实不涉及预测 |
| 概念型 | ★★★ | **最佳**——概念的核心就是预测"如果变了会怎样" |
| 过程型 | ★★☆ | 中等——可以改变条件让学生决定是否适用原过程 |
| 分析型 | ★★★ | **最佳**——分析要求在新情境中应用框架 |
| 评估型 | ★★★ | **很好**——改变条件后重新评估，直接训练判断力 |

### 与传统 Q&A 比较

| 维度 | 传统 Q&A | 预测/迁移 |
|------|---------|----------|
| 认知层级 | 记忆/理解 | 应用/分析 |
| 测评侧重 | 知识提取 | 知识应用与迁移 |
| 区分"背诵"和"理解" | 弱 | 强——新情境无法靠记忆应对 |
| 题目生成难度 | 低 | 中（AI 擅长变式生成） |
| 实证效果量 | d=0.5-0.7 | d=0.50-0.76 |
| 对反馈质量的依赖 | 中 | 高（预测错误时必须提供解释性反馈） |

---

## 方法四：概念图 / 知识组织（Concept Mapping / Knowledge Organization）

### 定义

学生构建概念之间的关系图或组织结构，展示自己对知识结构的理解。

### 实证基础

**概念图效应**

- **Nesbit & Adesope (2006, Review of Educational Research)** — 概念图的大规模 meta-analysis（55 项研究）。总效果量 **g=0.82**。但需注意：这是与"阅读文本/听讲座"相比，不是与其他主动学习策略相比。与其他主动策略（如写总结）相比，g=0.30。
- **Schroeder et al. (2018, Educational Psychology Review)** — 更新的 meta-analysis（72 项研究）。概念图 vs 被动学习 **g=0.72**；概念图 vs 其他主动学习 **g=0.36**。关键发现：效果量在"学习者自己构建"时（g=0.84）远大于"研究预设的概念图"（g=0.43）。
- **Cañas et al. (2017, in Applied Concept Mapping)** — 概念图在不同学科中的效果综述。科学类学科（d=0.70-0.90）效果大于人文社科（d=0.30-0.50）。原因：科学概念间有明确的层级和因果关系，更适合图示化。

**在评估中的使用**

- **Ruiz-Primo & Shavelson (1996, Journal of Research in Science Teaching)** — 概念图作为评估工具的信效度研究。概念图评估与传统测试的相关 r=0.40-0.60，说明它们测量了部分重叠但不完全相同的东西——概念图更能捕捉知识结构。
- **Yin et al. (2005, Journal of Research in Science Teaching)** — 概念图评分的多种方案比较。"关系准确性"（链接标签是否正确）比"结构复杂性"（节点数/层级数）更能预测深层理解。

### AI 对话界面可行性

**中等可行，需要设计适配**。传统概念图是视觉空间工具，在纯文本对话中实现受限。

可行的适配方案：
1. **结构化列表法**：AI 要求学生列出"概念A → 关系 → 概念B"的三元组
   - 例："请列出本模块的 5 个核心概念，以及它们之间的关系（用'→ 关系 →'连接）"
   - 学生回答："供给增加 → 导致 → 价格下降；需求增加 → 导致 → 价格上涨；..."
2. **分类排列法**：AI 给出一组概念，要求学生按层级/类别组织
   - "请把以下概念按从基础到高级排列：GDP、国民收入、消费、投资、净出口"
3. **关系判断法**：AI 给出概念对，要求学生描述关系
   - "通货膨胀与失业率之间是什么关系？是正相关、负相关还是没有直接关系？请解释。"

**局限**：文本形式的"概念图"失去了空间维度，信息密度和直观性下降。但核心学习机制（主动组织知识结构）仍然保留。

### 最适合的知识类型

| 知识类型 | 适配度 | 原因 |
|---------|-------|------|
| 事实型 | ★☆☆ | 不适合——事实之间关系有限 |
| 概念型 | ★★★ | **最佳**——概念图的核心目的就是组织概念关系 |
| 过程型 | ★★☆ | 中等——可以组织步骤的先后和依赖关系 |
| 分析型 | ★★★ | **很好**——分析需要理解要素之间的关系 |
| 评估型 | ★☆☆ | 较弱——评估侧重权衡而非结构 |

### 与传统 Q&A 比较

| 维度 | 传统 Q&A | 概念图/知识组织 |
|------|---------|---------------|
| 认知层级 | 记忆/理解 | 理解/分析（组织与关联） |
| 测评侧重 | 孤立知识点 | 知识间关系与结构 |
| 在文本界面的效果 | 高 | 中（失去空间维度） |
| 题目生成难度 | 低 | 中 |
| 实证效果量 | d=0.5-0.7 | g=0.36（vs 其他主动策略）到 g=0.82（vs 被动学习） |
| 独特价值 | 知识检索 | 知识结构化——其他方法难以替代 |

---

## 方法五：比较判断（Comparative Judgment）

### 定义

向学生呈现两个（或多个）解法、论证或方案，要求学生比较优劣、判断哪个更好，并说明理由。

### 实证基础

**比较与对比学习（Comparison and Contrasting）**

- **Alfieri et al. (2013, Journal of Educational Psychology)** — 比较学习的 meta-analysis（67 项研究）。总效果 **g=0.54**。关键发现：有引导的比较（guided comparison, g=0.64）远优于无引导的比较（unguided, g=0.29）。AI 可以提供结构化的比较框架。
- **Rittle-Johnson & Star (2011, Journal of Educational Psychology)** — 数学学习中比较多种解法。比较不同解法的学生在灵活性（flexibility）测试上优于只学一种解法的学生（d=0.48）。关键：比较需要明确引导学生关注什么维度。
- **Gentner et al. (2003, Cognitive Science)** — 结构对齐理论（Structure-mapping theory）。比较两个案例时，学习者更容易提取出深层共性（而非表面特征），这是"关系推理"的核心机制。

**在评估中的应用**

- **Pollitt (2012, Assessment in Education)** — 比较判断法（Adaptive Comparative Judgment, ACJ）用于评估的理论和实践。评价者信度 r=0.88-0.93，高于传统评分量表 r=0.70-0.80。但这是关于"用比较判断来评分"的研究，不完全等同于"让学生做比较来学习"。
- **Bouwer et al. (2018, Frontiers in Education)** — 学生自己做比较判断时的学习效果。学生在比较他人作品后，自己的写作质量提升 d=0.35-0.45。

**批判性思维训练**

- **Abrami et al. (2015, Educational Research Review)** — 批判性思维教学 meta-analysis（341 项研究）。嵌入式教学（在学科内容中训练批判思维）效果 g=0.54。"比较和评估论证"是批判性思维的核心子技能之一。
- **Tiruneh et al. (2016, Studies in Educational Evaluation)** — 嵌入学科教学的批判性思维训练，d=0.33-0.52，其中"评估论证质量"是效果最显著的子技能。

### AI 对话界面可行性

**高度可行**。AI 可以生成两个对比方案并结构化引导比较。

实现形式：
- AI 呈现两种解法："方法 A 用了 [策略X]，方法 B 用了 [策略Y]。哪种更好？为什么？在什么情况下你会选另一种？"
- AI 呈现两段论证："关于 [话题]，论证 1 认为...论证 2 认为...请评估它们各自的优缺点。"
- AI 评估：学生是否识别了关键差异维度、判断理由是否基于相关标准（而非无关偏好）、是否考虑了情境条件

**优势**：比较任务天然适合文本界面——并排呈现两段文字并要求评价，不需要特殊交互。

### 最适合的知识类型

| 知识类型 | 适配度 | 原因 |
|---------|-------|------|
| 事实型 | ★☆☆ | 不适合——事实无需比较 |
| 概念型 | ★★☆ | 中等——概念间的比较有用但不是核心 |
| 过程型 | ★★★ | **很好**——比较不同解法直接训练灵活性 |
| 分析型 | ★★★ | **最佳**——分析本质上就是比较、权衡、判断 |
| 评估型 | ★★★ | **最佳**——评估就是在比较中做判断 |

### 与传统 Q&A 比较

| 维度 | 传统 Q&A | 比较判断 |
|------|---------|---------|
| 认知层级 | 记忆/理解 | 分析/评价 |
| 测评侧重 | "你知道正确答案吗" | "你能分辨好坏吗" |
| 对高阶思维的激活 | 低 | 高 |
| 题目生成难度 | 低 | 中（需要生成质量相近但有差异的方案） |
| 实证效果量 | d=0.5-0.7 | g=0.54（有引导时 g=0.64） |
| 独特价值 | 知识检索 | 判断力训练——其他方法难以替代 |

---

## 方法六：学生自主出题（Student-Generated Questions / Generation Effect）

### 定义

学生基于学习材料自己创建问题，而非仅回答 AI 提出的问题。

### 实证基础

**生成效应（Generation Effect）**

- **Slamecka & Graf (1978, Journal of Experimental Psychology: Human Learning and Memory)** — 生成效应的经典发现：自己生成的信息比被动阅读的保持率更高，d=0.40-0.80（因材料类型而异）。
- **Bertsch et al. (2007, Memory)** — 生成效应的 meta-analysis（86 项研究），**d=0.40**。效果在语义丰富的材料上更大（d=0.52），在简单材料上较小（d=0.28）。
- **Foos et al. (1994, Contemporary Educational Psychology)** — 学生自主出题 vs 回答教师问题的 RCT。自主出题组在后续测试中得分高约 10-15%，d=0.35。但效果取决于出题质量。

**问题生成的教学研究**

- **Rosenshine et al. (1996, Review of Educational Research)** — 问题生成策略的综述（26 项研究）。学生生成问题的效果 **d=0.36**（对理解的效果），但效果高度依赖"问题质量训练"。未经训练的学生倾向于生成低层级的事实性问题（记忆型），而非深层理解问题。
- **King (1992, American Educational Research Journal)** — "Guided question generation"：给学生问题模板（如"X和Y有什么异同？""如果不是X会怎样？"）。有引导模板的出题效果 d=0.52 vs 无引导 d=0.18。关键发现：**不能让学生随意出题，必须提供高阶问题的框架/模板**。
- **Yu et al. (2014, Review of Educational Research)** — 学生出题的 meta-analysis（28 项研究），总效果 **g=0.44**。效果在高阶出题（分析/评价）时显著（g=0.56），在低阶出题（记忆）时不显著（g=0.19）。

**AI 场景中的出题**

- **Denny et al. (2008, Computer Science Education)** — PeerWise 系统：学生创建选择题并互评。学生出题数量与考试成绩相关 r=0.30，出题质量相关 r=0.45。但这是相关性，不能确定因果。
- **Marwan et al. (2023, Computers & Education)** — AI 增强的学生出题系统。AI 评估学生出题质量并提供改进建议后，出题质量提升 d=0.42，学习效果提升 d=0.31。

### AI 对话界面可行性

**中高可行，但需要精心设计**。

实现形式：
- AI 说"你已经学完了 [模块X]。现在请你为这个模块出 3 道题目——至少 1 道要求分析或比较，不能全是'是什么'的题。"
- 学生出题后，AI 评估题目质量：认知层级、是否涵盖核心知识点、题目表述是否清晰
- AI 进一步要求学生回答自己的题目（或互相出题在多用户场景）
- 高阶版本：AI 故意回答学生的题目（有时回答正确，有时故意犯错），让学生判断 AI 的回答是否正确

**关键设计要求**：
1. 必须提供出题框架/模板，否则学生会出低质量的记忆题
2. AI 需要评估出题质量，而不仅仅是验证答案
3. 可以与其他方法组合：学生出题 + AI"回答"（有时故意犯错）+ 学生判断 AI 是否对

### 最适合的知识类型

| 知识类型 | 适配度 | 原因 |
|---------|-------|------|
| 事实型 | ★☆☆ | 效果差——学生倾向于出"填空"式低质量题 |
| 概念型 | ★★☆ | 中等——需要引导才能出高阶概念题 |
| 过程型 | ★★☆ | 中等——出过程题需要较高的元认知能力 |
| 分析型 | ★★★ | **好**——出分析题要求理解分析框架 |
| 评估型 | ★★★ | **最佳**——出评估题的过程本身就是最高阶的认知活动 |

### 与传统 Q&A 比较

| 维度 | 传统 Q&A | 学生自主出题 |
|------|---------|------------|
| 认知层级 | 记忆/理解 | 分析/评价/创造 |
| 学生角色 | 被动（回答） | 主动（创建+回答） |
| 对元认知的训练 | 低 | 高（出题要求"思考什么值得问"） |
| 实施复杂度 | 低 | 高（需要评估题目质量，不仅仅是答案） |
| 实证效果量 | d=0.5-0.7 | g=0.44（有引导时 g=0.56） |
| 时间成本 | 低 | 高（出题比答题慢 2-3 倍） |

---

## 综合比较表

### 方法 × 知识类型 × 效果量

| 评估方法 | 核心效果量 | 事实型 | 概念型 | 过程型 | 分析型 | 评估型 | AI 对话可行性 |
|---------|-----------|--------|--------|--------|--------|--------|-------------|
| **传统 Q&A** (基线) | d=0.5-0.7 | ★★★ | ★★☆ | ★★★ | ★☆☆ | ★☆☆ | ★★★ |
| **Teach-back / 自我解释** | d=0.50-0.55 | ★★☆ | ★★★ | ★★☆ | ★★★ | ★★☆ | ★★★ |
| **错误检测** | d=0.40-0.62 | ★☆☆ | ★★★ | ★★★ | ★★☆ | ★★☆ | ★★★ |
| **预测/迁移** | d=0.50-0.76 | ★☆☆ | ★★★ | ★★☆ | ★★★ | ★★★ | ★★★ |
| **概念图/知识组织** | g=0.36-0.82 | ★☆☆ | ★★★ | ★★☆ | ★★★ | ★☆☆ | ★★☆ |
| **比较判断** | g=0.54-0.64 | ★☆☆ | ★★☆ | ★★★ | ★★★ | ★★★ | ★★★ |
| **学生自主出题** | g=0.44-0.56 | ★☆☆ | ★★☆ | ★★☆ | ★★★ | ★★★ | ★★☆ |

### 方法 × 关键维度

| 评估方法 | Bloom 层级 | 学生角色 | 实施复杂度 | 每题时间成本 | 独特不可替代价值 |
|---------|-----------|---------|-----------|------------|----------------|
| **传统 Q&A** | 记忆/理解 | 被动应答 | 低 | 1-2 min | 知识检索训练 |
| **Teach-back** | 理解/分析 | 主动建构 | 中 | 3-5 min | 暴露理解深度 |
| **错误检测** | 分析/评价 | 判断/辨别 | 中高 | 2-4 min | 误解诊断 |
| **预测/迁移** | 应用/分析 | 推理/预测 | 中 | 2-3 min | 迁移能力测评 |
| **概念图** | 理解/分析 | 组织/关联 | 中 | 3-5 min | 知识结构化（文本受限） |
| **比较判断** | 分析/评价 | 比较/权衡 | 中 | 2-4 min | 判断力训练 |
| **学生出题** | 评价/创造 | 创建/评估 | 高 | 4-6 min | 元认知训练 |

---

## 产品建议：知识类型驱动的评估方法匹配

### 核心原则

1. **不是替代，是组合**。传统 Q&A 对事实型和过程型知识仍然有效（d=0.5-0.7），不需要丢弃。问题是对概念型、分析型和评估型知识，需要补充更有效的方法。

2. **按知识类型自动选择评估方法**。这与现有的"按知识类型选教学法"（调研 2）完全一致——教法匹配和评估方法匹配是同一个逻辑。

3. **可行性优先**。概念图因文本界面限制降级为"关系列举"；学生出题因实施复杂度高建议在 MVP 后引入。

### 推荐方案

#### 第一梯队：MVP 应实现（效果好 + AI 可行性高 + 实施可控）

| 知识类型 | 主评估方法 | 补充方法 | 替代了什么 |
|---------|-----------|---------|-----------|
| **事实型** | 传统 Q&A（保持不变） | — | 无需替代 |
| **概念型** | **Teach-back** + **预测/迁移** | 错误检测 | 替代纯 Q&A |
| **过程型** | 传统 Q&A + **错误检测** | — | 补充错误步骤辨别 |
| **分析型** | **预测/迁移** + **比较判断** | Teach-back | 替代纯 Q&A |
| **评估型** | **比较判断** + **预测/迁移** | — | 替代纯 Q&A |

理由：
- **事实型保持 Q&A**：效果量最高（d=0.5-0.7），实施最简单，对事实型知识是最优解
- **概念型用 Teach-back**：效果量 d=0.55，最能暴露概念误解；补充预测/迁移（d=0.53）测试概念应用
- **过程型补充错误检测**：过程中的"找错误步骤"（d=0.62 in ITS）直接训练调试能力
- **分析/评估型用预测+比较**：这两种方法在高阶知识上效果最好，且 AI 生成变式和对比方案的成本低

#### 第二梯队：MVP 后迭代引入

| 方法 | 何时引入 | 前置条件 |
|------|---------|---------|
| **概念关系列举**（概念图简化版） | 模块复习阶段 | 需要设计结构化输入格式 |
| **学生自主出题** | 高阶功能 | 需要 AI 评估题目质量的能力；需要出题模板库 |
| **AI 故意犯错让学生判断** | 与出题结合 | 需要精确控制错误类型和难度 |

### 对产品不变量的影响

当前不变量 #5："Q&A 是一次一题 + 即时反馈：显示一题 → 用户作答 → 立即显示评分和解析 → 点'下一题'继续"

**建议修改为**："练习环节是一次一题 + 即时反馈。题目类型根据知识类型自动选择：可以是传统问答、解释回教、找错改错、情境预测或方案比较。核心不变量是一次一题和即时反馈，不是题目形式。"

### 实现路径

1. **AI prompt 层面**：在教学 prompt 中根据 KP 的知识类型选择评估方法模板。例如概念型 KP 的 prompt 加入"请用 teach-back 方式评估：让学生解释这个概念，然后追问 2-3 个探测性问题"
2. **前端层面**：不同评估方法可能需要不同的 UI 提示（如 teach-back 需要提示"请向 AI 老师解释..."而不是"请回答以下问题"），但核心交互仍然是文本输入框
3. **评估评分层面**：需要为每种方法设计评估维度。传统 Q&A 只需"对/错/部分对"；Teach-back 需要"是否覆盖核心要素 / 是否仅复述 / 关系链是否正确"等多维评估

---

## 来源列表

### Meta-analyses & Systematic Reviews

1. Bisra, K., Liu, Q., Nesbit, J. C., Salimi, F., & Winne, P. H. (2018). Inducing self-explanation: A meta-analysis. *Review of Educational Research*, 88(1), 3-38.
2. Fiorella, L., & Mayer, R. E. (2016). Eight ways to promote generative learning. *Educational Psychology Review*, 28, 717-741.
3. Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., & Willingham, D. T. (2013). Improving students' learning with effective learning techniques. *Psychological Science in the Public Interest*, 14(1), 4-58.
4. Nesbit, J. C., & Adesope, O. O. (2006). Learning with concept and knowledge maps: A meta-analysis. *Review of Educational Research*, 76(3), 413-448.
5. Schroeder, N. L., Nesbit, J. C., Anguiano, C. J., & Adesope, O. O. (2018). Studying and constructing concept maps: A meta-analysis. *Educational Psychology Review*, 30(2), 431-455.
6. Alfieri, L., Nokes-Malach, T. J., & Schunn, C. D. (2013). Learning through case comparisons: A meta-analytic review. *Educational Psychologist*, 48(2), 87-113.
7. Rosenshine, B., Meister, C., & Chapman, S. (1996). Teaching students to generate questions: A review of the intervention studies. *Review of Educational Research*, 66(2), 181-221.
8. Yu, F. Y., Liu, Y. H., & Chan, T. W. (2014). A meta-analysis of student question-generation studies. *Review of Educational Research* (conference proceedings).
9. Loibl, K., Roll, I., & Rummel, N. (2017). Towards a theory of when and how problem solving followed by instruction works. *Review of Educational Research*, 87(5), 861-898.
10. Abrami, P. C., Bernard, R. M., Borokhovski, E., Waddington, D. I., Wade, C. A., & Persson, T. (2015). Strategies for teaching students to think critically: A meta-analysis. *Review of Educational Research*, 85(2), 275-314.
11. Bertsch, S., Pesta, B. J., Wiscott, R., & McDaniel, M. A. (2007). The generation effect: A meta-analytic review. *Memory*, 15(2), 181-186.
12. Brod, G. (2021). Predicting as a learning strategy. *Journal of Educational Psychology*, 113(7), 1312-1323.

### Journal Articles

13. Chi, M. T. H., Bassok, M., Lewis, M. W., Reimann, P., & Glaser, R. (1989). Self-explanations: How students study and use examples in learning to solve problems. *Cognitive Science*, 13(2), 145-182.
14. Roscoe, R. D., & Chi, M. T. H. (2007). Understanding tutor learning: Knowledge-building and knowledge-telling in peer tutors' explanations and questions. *Review of Educational Research*, 77(4), 534-574.
15. Fiorella, L., & Mayer, R. E. (2013). The relative benefits of learning by teaching and teaching expectancy. *Contemporary Educational Psychology*, 38(4), 281-288.
16. Wylie, R., & Chi, M. T. H. (2014). The self-explanation principle in multimedia learning. In R. E. Mayer (Ed.), *Cambridge Handbook of Multimedia Learning*. Cambridge University Press.
17. Durkin, K., & Rittle-Johnson, B. (2012). The effectiveness of using incorrect examples to support learning about decimal magnitude. *Learning and Instruction*, 22(3), 206-214.
18. Große, C. S., & Renkl, A. (2007). Finding and fixing errors in worked examples: Can this foster learning outcomes? *Learning and Instruction*, 17(6), 612-634.
19. McLaren, B. M., Adams, D. M., Mayer, R. E., & Forlizzi, J. (2015). A computer-based game that promotes mathematics learning more than a conventional approach. *International Journal of Game-Based Learning*, 7(1).
20. Booth, J. L., Lange, K. E., Koedinger, K. R., & Newton, K. J. (2013). Using example problems to improve student learning in algebra. *Journal of Educational Psychology*, 105(3), 683-700.
21. Rittle-Johnson, B., & Star, J. R. (2011). The power of comparison in learning and instruction. *Journal of Educational Psychology*, 103(3), 555-568.
22. King, A. (1992). Facilitating elaborative learning through guided student-generated questioning. *Educational Psychologist*, 27(1), 111-126.
23. Barnett, S. M., & Ceci, S. J. (2002). When and where do we apply what we learn? A taxonomy for far transfer. *Psychological Bulletin*, 128(4), 612-637.
24. Day, S. B., & Goldstone, R. L. (2012). The import of knowledge export: Connecting findings and theories of transfer of learning. *Educational Psychology Review*, 24(3), 153-176.
25. VanLehn, K. (2011). The relative effectiveness of human tutoring, intelligent tutoring systems, and other tutoring systems. *Educational Psychologist*, 46(4), 197-221.
26. Ruiz-Primo, M. A., & Shavelson, R. J. (1996). Problems and issues in the use of concept maps in science assessment. *Journal of Research in Science Teaching*, 33(6), 569-600.

### AI Tutoring & Recent Studies

27. Bastani, H., Bayati, M., Bhaskar, U., & Xu, K. (2024). Generative AI can harm learning. *Kellogg School Working Paper / SSRN*.
28. Pardos, Z. A., et al. (2023). Learning gains from AI tutoring with self-explanation prompts. *Computers & Education*, 198.
29. Muldner, K., Lam, R., & Chi, M. T. H. (2014). Comparing learning from observing and from human tutoring. *Journal of Educational Psychology*, 106(1), 69-85.
30. Tsovaltzi, D., Melis, E., McLaren, B. M., Meyer, A. K., Dietrich, M., & Goguadze, G. (2012). Learning from erroneous examples: When and how do students benefit? *Computers in Human Behavior*, 28, 1753-1764.
31. Denny, P., Hamer, J., Luxton-Reilly, A., & Purchase, H. (2008). PeerWise: Students sharing their multiple choice questions. *Computer Science Education*, 18(1).
32. Marwan, S., et al. (2023). AI-supported student question generation. *Computers & Education*, 202.
33. Adams, D. M., McLaren, B. M., Durkin, K., Mayer, R. E., Rittle-Johnson, B., Isotani, S., & van Velsen, M. (2014). Using erroneous examples to improve mathematics learning with a web-based tutoring system. *Computers in Human Behavior*, 36, 401-411.

### Foundational / Theoretical

34. Slamecka, N. J., & Graf, P. (1978). The generation effect: Delineation of a phenomenon. *Journal of Experimental Psychology: Human Learning and Memory*, 4(6), 592-604.
35. Gentner, D., Loewenstein, J., & Thompson, L. (2003). Learning and transfer: A general role for analogical encoding. *Journal of Educational Psychology*, 95(2), 393-408.
36. Perkins, D. N., & Salomon, G. (2012). Knowledge to go: A motivational and dispositional view of transfer. *Educational Psychologist*, 47(3), 248-258.
37. Koedinger, K. R., & Corbett, A. T. (2006). Cognitive tutors: Technology bringing learning science to the classroom. In R. K. Sawyer (Ed.), *Cambridge Handbook of the Learning Sciences*. Cambridge University Press.
38. Pollitt, A. (2012). The method of Adaptive Comparative Judgement. *Assessment in Education*, 19(3), 281-300.
39. Cañas, A. J., Reiska, P., & Möllits, A. (2017). Developing higher-order thinking skills with concept mapping. *Journal of Baltic Science Education*, 16(4), 487-500.
40. Liew, C. W., & Treagust, D. F. (1995). A predict-observe-explain teaching sequence for learning about students' understanding of heat and expansion of liquids. *Australian Science Teachers Journal*, 41(1).

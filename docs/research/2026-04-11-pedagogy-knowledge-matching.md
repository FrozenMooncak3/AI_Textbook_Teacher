---
date: 2026-04-11
topic: 教学法与知识类型最优匹配
type: research
status: resolved
keywords: [教学法匹配, Hattie效果量, 脚手架, 苏格拉底法, 认知任务分析]
---

# 调研 2：教学法 × 知识类型最优匹配

**调研日期**: 2026-04-11
**用途**: 教学系统设计——每种知识类型匹配最有效的 AI 可实现的教学法
**前置**: 调研 1（5 类知识类型分类方案）

---

## Hattie Effect Size 参考数据

> d > 0.4 有实际意义，d > 0.6 为高效。来源：Visible Learning MetaX（2024-2025 更新）。

| 教学策略 | Effect Size (d) | AI 可实现性 |
|----------|----------------|------------|
| 认知任务分析 (Cognitive task analysis) | 1.29 | 中 — 需要 AI 拆解步骤 |
| 课堂讨论 / 对话 (Classroom discussion) | 0.82 | 高 — AI 对话天然适合 |
| 脚手架 (Scaffolding) | 0.82 | 高 — 渐进提示 |
| 教师清晰度 (Teacher clarity) | 0.75 | 高 — prompt 可控 |
| 互惠教学 (Reciprocal teaching) | 0.74 | 中 — 角色切换 |
| 反馈 (Feedback) | 0.70 | 高 — 即时反馈已有 |
| 间隔练习 (Spaced practice) | 0.60 | 高 — 已实现 |
| 元认知策略 (Metacognitive strategies) | 0.60 | 高 — 追问"你哪里不确定" |
| 直接讲解 (Direct instruction) | 0.59 | 高 — 最基础 |
| 同伴辅导 (Peer tutoring) | 0.53 | 中 — AI 模拟 |
| 精细化追问 (Elaborative interrogation) | 0.42 | 高 — "为什么会这样？" |
| 合作学习 (Cooperative learning) | 0.40 | 低 — 需多人 |
| Worked examples | 0.37 | 高 — 步骤演示 |
| 交错练习 (Interleaved practice) | 0.21 | 高 — 混合练习 |

**关键发现**：
- Worked examples 的 Hattie effect size (0.37) 偏低，但认知负荷理论研究中的独立 meta-analysis 显示 g=0.48-0.57，差异来自测量方式不同
- 认知任务分析 (1.29) 是最高效策略之一，但需要 AI 把复杂思维过程拆解为可见步骤 — 正是认知学徒制的核心
- 脚手架 (0.82) 不是独立教学法，而是贯穿所有方法的元原则

---

## 5×5 教学法匹配表

### 总览

| 知识类型 | 主教学法 | 辅助策略 | 理论依据 |
|---------|---------|---------|---------|
| **事实型** | 直接讲解 + 间隔重复 | 精细化追问、助记策略 | 直接讲解 d=0.59；间隔重复 d=0.60 |
| **概念型** | 类比建模 + 精细化追问 | 正反例对比、概念图 | 精细化追问 d=0.42；教师清晰度 d=0.75 |
| **过程型** | Worked Example 渐退 | 刻意练习、认知任务分析 | Worked example g≈0.5；认知任务分析 d=1.29 |
| **分析型** | 认知学徒制 | 苏格拉底式追问、脚手架 | 脚手架 d=0.82；课堂讨论 d=0.82 |
| **评估型** | 案例教学 + What-if 变式 | 元认知追问、角色切换 | 元认知策略 d=0.60；课堂讨论 d=0.82 |

### 各类型详细匹配

---

### 1. 事实型 → 直接讲解 + 间隔重复

**为什么这个组合最优**：
- 事实性知识的核心挑战是"记住"，不是"理解"
- Kirschner/Sweller/Clark (2006) 证明：对新手学习事实性内容，直接明确的讲解优于任何探究式方法
- 间隔重复是防遗忘的唯一可靠手段（d=0.60）

**AI 教学流程**：
1. **直接呈现**：用清晰简洁的语言给出定义/事实
2. **类比锚定**：用日常类比帮助初次记忆（"GDP 就像一个国家的年度收入总账"）
3. **精细化追问**：问"为什么这个术语用这个词？"或"这和 XX 有什么区别？"加深编码
4. **即时确认**：让学生复述
5. **间隔重复**：交给复习系统

**投资 spec 借鉴点**：直接使用其"先用类比建直觉，再给正式定义"的模式。增加精细化追问环节（投资 spec 没有这一步）。

**不用苏格拉底法的原因**：对事实性知识用苏格拉底法（"你觉得 GDP 是什么？"）效率极低——学生完全没有先验知识时，探究式方法会增加认知负荷而不产出学习。

---

### 2. 概念型 → 类比建模 + 精细化追问

**为什么这个组合最优**：
- 概念性知识的核心挑战是"理解关系"，需要在已有知识和新知识之间建立连接
- 精细化追问（d=0.42）和自我解释（d≈0.5）在概念学习中效果显著
- 教师清晰度（d=0.75）通过类比和对比实现

**AI 教学流程**：
1. **激活先知**：问学生已经知道什么相关概念
2. **类比建模**：用日常场景类比核心概念（"供需关系就像拍卖——买的人多价格就上去"）
3. **正式展开**：给出学术定义和组成要素
4. **正反例对比**：给出符合概念的例子和不符合的反例
5. **精细化追问**：问"为什么 A 是这样？""如果条件改变会怎样？"
6. **学生复述**：要求用自己的话解释概念

**与事实型的关键区别**：事实型止步于"记住"，概念型必须追到"为什么"和"什么条件下"。

---

### 3. 过程型 → Worked Example 渐退

**为什么这个组合最优**：
- 过程性知识的核心挑战是"按步骤执行"，需要看到完整示范后逐步独立
- Worked Example Effect 在认知负荷理论中是最成熟的研究成果之一：完整示范 → 部分步骤 → 独立解题的渐退过程，显著降低新手认知负荷
- 认知任务分析（d=1.29）用于将专家的内隐步骤显化

**AI 教学流程**：
1. **完整演示 (Full Worked Example)**：AI 展示完整解题过程，每步标注"做什么"和"为什么这么做"
2. **部分提示 (Faded Example)**：同类问题，AI 给出前几步，留最后几步让学生完成
3. **最少提示 (Minimal Scaffold)**：新问题，只给起始条件，学生独立完成，卡住时给提示
4. **独立练习 (Independent Practice)**：完全独立解题，AI 只在完成后给反馈
5. **变式迁移**：改变问题条件，测试是否理解步骤背后的逻辑而非死记步骤

**投资 spec 借鉴点**：直接使用其"刻意练习（worked example 渐退）"设计。增加"变式迁移"步骤防止死记硬背。

**Schwonke 等研究**：在 Cognitive Tutors 中，看过 worked example 的学生用更少时间获得了相同或更好的过程性知识和概念理解。

---

### 4. 分析型 → 认知学徒制

**为什么这个组合最优**：
- 分析性知识的核心挑战是"专家思维不可见"——学生看到结论但不知道专家怎么想到的
- 认知学徒制（Collins, 1991）通过 Modeling → Coaching → Scaffolding → Articulation 让隐性思维可见化
- 脚手架（d=0.82）和课堂讨论（d=0.82）是认知学徒制的组成部分

**AI 教学流程**：
1. **建模 (Modeling)**：AI 展示完整的分析推理过程——"我看到这个数据，我注意到 X 模式，这让我想到 Y 规则，所以我判断 Z"
2. **教练 (Coaching)**：给学生类似情境，学生尝试分析，AI 在旁观察并在关键点给提示
3. **脚手架 (Scaffolding)**：逐步减少提示，只在学生卡住时介入
4. **表达 (Articulation)**：要求学生用自己的话说出推理过程——"你是怎么得出这个判断的？"
5. **反思 (Reflection)**：引导学生比较自己和 AI 的推理过程，找出差异

**关键设计点**：
- Modeling 环节是 AI 最擅长的——可以把推理过程写得非常清晰，比人类老师做得更好
- Coaching 环节要抑制 AI 直接给答案的倾向——prompt 必须强制"先让学生尝试"
- 研究发现 (arxiv:2601.19053)：使用认知学徒制的 AI 交互中学生提出的追问数量是标准模式的 3.4 倍，回答长度增加 2.3 倍

**投资 spec 借鉴点**：C1 判断类使用认知学徒制的设计直接适用。投资 spec 识别的 AI 挑战（Modeling 对 AI 要求高）在通用教材场景减轻——通用教材的分析推理比投资决策更结构化。

---

### 5. 评估型 → 案例教学 + What-if 变式

**为什么这个组合最优**：
- 评估性知识的核心挑战是"没有标准答案"——需要在多个合理观点中权衡
- 案例教学让学生在具体情境中做真实判断，而非抽象讨论
- 元认知策略（d=0.60）通过追问"你为什么这么想"增强批判性思维

**AI 教学流程**：
1. **案例呈现**：给出包含多角度信息的真实或模拟案例
2. **初始判断**：让学生做出初步评价，说明理由
3. **What-if 变式**：改变条件——"如果 X 因素变了，你的结论会变吗？"
4. **反面论证**：AI 提出反面观点，让学生回应
5. **综合评价**：引导学生整合多方观点，形成更全面的判断
6. **元认知追问**：问"你觉得你的分析最薄弱的环节是什么？"

**案例素材来源**（因为通用教材不像投资教材有天然案例）：
- 有案例的教材（商科、法学、医学）：直接使用教材中的案例
- 无天然案例的教材（理科、数学）：AI 基于知识点生成"what-if 变体"——改变条件让学生判断结论如何变化
- 生成式场景：AI 根据教材内容构造模拟情境

**投资 spec 借鉴点**：
- "后视偏差防护"设计（先隐藏结局→揭示后追问"换个条件结论变吗"）适用于所有有案例的教材
- 投资 spec 的"真实公司数据"限制不适用于通用教材，用 AI 生成模拟场景替代

---

## 贯穿所有类型的元原则

这些不是独立教学法，而是所有 5 种匹配中都必须遵守的原则：

| 原则 | 来源 | 在每种类型中的体现 |
|------|------|------------------|
| **认知卸载防护** | Harvard RCT (d=0.73-1.3) | 绝不直接给答案；先让学生尝试再给反馈 |
| **脚手架 + ZPD** | Vygotsky; Hattie d=0.82 | 难度始终在"刚好够难"的区间；卡住时给渐进提示 |
| **即时反馈** | Hattie d=0.70 | 每次学生回答后立即给出反馈，不等批量处理 |
| **间隔重复** | Hattie d=0.60 | 所有类型学完后都进入间隔复习系统 |
| **先分块后交错** | 认知负荷理论 | 同类型连续教 2-3 个 KP → 再混合不同类型练习 |

---

## 与投资 spec 4×4 的对比

| 维度 | 投资 spec | 通用教材方案 | 变化原因 |
|------|----------|------------|---------|
| 分类数量 | 4 类 | 5 类 | 拆分"定义类"为事实型+概念型 |
| 事实型教法 | 直接讲解+间隔重复 | 直接讲解+间隔重复+精细化追问 | 增加追问加深编码 |
| 过程型教法 | 刻意练习(worked example) | Worked Example 渐退+变式迁移 | 增加变式防死记硬背 |
| 分析型教法 | 认知学徒制 | 认知学徒制（简化） | AI Modeling 在通用教材更易实现 |
| 评估型教法 | 案例教学（真实公司） | 案例教学+What-if 变式 | 通用教材无天然案例，用 AI 生成替代 |
| 新增 | — | 概念型→类比建模+精细化追问 | 新分类需要新方法 |

---

## 来源

- [Hattie Ranking - Visible Learning](https://visible-learning.org/hattie-ranking-influences-effect-sizes-learning-achievement/)
- [Visible Learning MetaX](https://www.visiblelearningmetax.com/research_methodology)
- [Kirschner, Sweller, Clark 2006 - Why Minimal Guidance Does Not Work](https://www.tandfonline.com/doi/abs/10.1207/s15326985ep4102_1)
- [Worked Example Effect - Wikipedia](https://en.wikipedia.org/wiki/Worked-example_effect)
- [Cognitive Apprenticeship - ISLS](https://www.isls.org/research-topics/cognitive-apprenticeship/)
- [LLMs with Cognitive Apprenticeship Model (arxiv 2601.19053)](https://arxiv.org/html/2601.19053v1)
- [AI Tutors Work With Guardrails - Edutopia](https://www.edutopia.org/article/ai-tutors-work-guardrails/)
- [Elaborative Interrogation - UW-La Crosse](https://www.uwlax.edu/catl/guides/teaching-improvement-guide/how-can-i-improve/elaborative-interrogation/)
- [Self-Explanation Meta-Analysis - BPS](https://www.bps.org.uk/research-digest/self-explanation-powerful-learning-technique-according-meta-analysis-64-studies)

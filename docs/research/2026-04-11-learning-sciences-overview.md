---
date: 2026-04-11
topic: 学习科学学术领域概览
type: research
status: resolved
keywords: [学习科学, 认知科学, 教育心理学, 设计研究法, 教学理论]
---

# 学习科学学术领域概览

**调研日期**: 2026-04-11
**用途**: 教学系统设计的理论基础。设计教学法匹配和 AI prompt 编码时必读。

---

## 你要找的学科叫什么

**Learning Sciences（学习科学）** — 一个跨学科领域，专门研究"人怎么学"和"怎么教更有效"。

结合了：认知科学、计算机科学、教育心理学、人类学、语言学。

核心方法：Design-Based Research（设计研究法）——在真实场景中设计学习干预、测试效果、迭代改进。

---

## 核心子领域

| 领域 | 研究什么 | 对产品最有用的成果 |
|------|---------|------------------|
| **Instructional Design (教学设计)** | 如何设计学习体验 | Gagné 九步教学法、Merrill 五原则、ADDIE 模型 |
| **Educational Psychology (教育心理学)** | 学习的心理机制 | Bloom 分类法、Vygotsky ZPD、动机理论 |
| **Cognitive Science of Learning** | 大脑如何编码/检索知识 | 间隔重复、交错练习、测试效应、worked example |
| **AI in Education (AIED)** | AI 如何辅助教学 | AutoTutor、Cognitive Tutors、ITS |

---

## 关键人物和贡献

### 教学策略效果研究

| 人物 | 贡献 | 对产品的意义 |
|------|------|-------------|
| **John Hattie** | 1800+ 项教学策略 meta-analysis，《Visible Learning》 | **最重要**: effect size 排名直接告诉你优先实现什么教学策略 |
| **Robert Marzano** | 9 种高效教学策略分类 | 产品教学策略选择的参考 |
| **M. David Merrill** | First Principles of Instruction (五原则) | 教学设计框架：问题中心、激活旧知、示范、应用、整合 |
| **Robert Gagné** | Nine Events of Instruction | 每次教学的 9 步结构（吸引注意→告知目标→回忆旧知→呈现内容→引导学习→练习→反馈→评估→迁移） |

### 认知与学习

| 人物 | 贡献 | 对产品的意义 |
|------|------|-------------|
| **Benjamin Bloom** | Bloom's Taxonomy (记忆→理解→应用→分析→评价→创造) | 知识类型分类的基础框架 |
| **Bloom (另一个研究)** | 2 Sigma Problem：1v1 辅导比课堂教学效果好 2 个标准差 | 产品的理论天花板——用 AI 逼近 1v1 辅导效果 |
| **Lev Vygotsky** | Zone of Proximal Development (最近发展区) | 教学必须在"刚好够难"的区间内。太简单无效，太难也无效 |
| **John Sweller** | Cognitive Load Theory (认知负荷理论) | 教学设计必须管理认知负荷：减少无关负荷、优化内在负荷、增强相关负荷 |
| **K. Anders Ericsson** | Deliberate Practice (刻意练习) | 高效学习 = 聚焦薄弱点 + 即时反馈 + 重复改进 |

### AI 教学系统

| 人物 | 贡献 | 对产品的意义 |
|------|------|-------------|
| **Kurt VanLehn** | AutoTutor (17 年研究) | 五步对话框架的来源。证明 AI 对话式教学有效 (d≈0.8) |
| **Kenneth Koedinger** | Carnegie Learning Cognitive Tutors | 证明 AI 1v1 辅导在数学领域接近人类教师效果 |
| **Allan Collins** | Cognitive Apprenticeship | 认知学徒制：Modeling→Coaching→Scaffolding→Articulation→Reflection→Exploration |
| **Rose Luckin** | AI in Education 领域领导者 | 学习者模型、智能辅导系统设计 |

---

## 关键教学框架

### Bloom's Taxonomy (用于知识类型分类)

```
创造 (Create)         ← 最高阶
评价 (Evaluate)
分析 (Analyze)
应用 (Apply)
理解 (Understand)
记忆 (Remember)       ← 最低阶
```

**对产品的意义**: 当前 app 的 KP 提取已经分了 4 种类型（定义/计算/C1判断/C2评估），这大致对应 Bloom 的记忆→应用→分析→评价。可以用 Bloom 作为更通用的分类基础。

### Gagné's Nine Events of Instruction

1. 吸引注意
2. 告知学习目标
3. 回忆先前知识
4. 呈现新内容
5. 提供学习引导
6. 引出表现（练习）
7. 提供反馈
8. 评估表现
9. 促进迁移

**对产品的意义**: 每个 KP 的教学流程可以参照这 9 步设计。当前 app 只做了步骤 6-8（练习→反馈→评估），缺少 1-5（教学部分）。

### Merrill's First Principles of Instruction

1. **Problem-centered**: 学习围绕真实问题展开
2. **Activation**: 激活已有知识
3. **Demonstration**: 示范（不只是告知）
4. **Application**: 让学习者应用
5. **Integration**: 整合到实际情境

**对产品的意义**: 教学环节设计的 5 个检查点——每个教学对话是否覆盖了这 5 个维度？

---

## Hattie Effect Size 高优先策略

> effect size d > 0.4 被认为有实际意义。d > 0.6 为高效。

| 策略 | Effect Size (d) | 产品实现可能性 |
|------|----------------|---------------|
| Collective teacher efficacy | 1.57 | 低（需要教师群体） |
| Self-reported grades | 1.33 | 高（元认知追问——让学生自评） |
| **Teacher clarity** | 0.84 | **高——AI 教学清晰度可通过 prompt 优化** |
| **Feedback** | 0.70 | **高——即时反馈是现有系统的强项** |
| **Spaced practice** | 0.60 | **高——间隔重复已实现** |
| **Worked examples** | 0.57 | **高——计算类已用 worked example** |
| Metacognitive strategies | 0.55 | 高（元认知追问——"你觉得哪里不确定"） |
| **Cognitive task analysis** | 0.48 | **中——需要 AI 拆解认知步骤** |
| Interleaved practice | 0.47 | 高（交错练习可实现） |
| Direct instruction | 0.59 | 高（定义类知识） |

**结论**: 产品应优先实现 effect size 最高且可被 AI 产品化的策略。Teacher clarity、Feedback、Spaced practice、Worked examples 是最高优先。

---

## 待深入调研

1. **通用知识类型分类**: Bloom 的 6 级 vs 投资 spec 的 4 类 vs Anderson-Krathwohl 修订版 → 确定产品使用哪种分类
2. **每种知识类型的最优教学法**: 用 Hattie effect size 数据匹配
3. **AI prompt 编码**: 如何把教学法规则编码成 AI prompt（参考 AutoTutor、Khanmigo 的设计）
4. **教学对话设计**: 什么样的对话节奏让用户觉得"有人在教我"而不是"AI 在废话"
5. **Duolingo 留存设计**: 游戏化、条纹机制、微学习的具体实现

**来源**:
- https://en.wikipedia.org/wiki/Learning_sciences
- https://journals.physiology.org/doi/full/10.1152/advan.00138.2015
- https://learningsciences.smu.edu/blog/instructional-design-models-educators-should-know

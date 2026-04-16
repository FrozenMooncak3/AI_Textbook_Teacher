---
date: 2026-04-12
topic: 形成性与终结性评估最优组合
type: research
status: resolved
keywords: [形成性评估, 终结性评估, 测试效应, 评估流水线, 学习科学]
---

# 形成性评估与终结性评估的最优组合

**调研日期**: 2026-04-12
**用途**: 决定产品评估流水线设计——阅读 → 教学 → QA → 测试 → 复习 是否最优，还是需要重构
**质量标准**: 仅引用 peer-reviewed meta-analysis、系统综述、顶刊实验研究。每个结论至少 2 个独立来源。

---

## 一、核心发现（带定量证据）

### 1.1 形成性评估的效果已被反复验证

| 来源 | 样本/范围 | 效果量 | 关键结论 |
|------|----------|--------|---------|
| Black & Wiliam (1998), 250+ 项研究 meta-analysis | 5 岁到大学生 | d = 0.40–0.70 | 形成性评估对学习成绩的提升效果超过其他任何单一干预 |
| Hattie (2009), Visible Learning | 1800+ meta-analysis 综合 | d = 0.90（教师形成性评价） | 在 138 项教学策略中排名第 3 |
| Yang et al. (2021), Psychological Bulletin | 222 独立研究, N=48,478 | g = 0.499 | 测试/小测对课堂学习成绩产生中等效果，跨所有学科和教育阶段通用 |

**结论**: 形成性评估是学习科学中证据最强的策略之一。问题不是"要不要做"，而是"怎么做最高效"。

### 1.2 检索练习（Retrieval Practice）的测试效应

| 来源 | 方法 | 效果量 | 关键结论 |
|------|------|--------|---------|
| Rowland (2014), Psychological Bulletin | Meta-analysis, 测试 vs 重读 | g = 0.50 | 检索练习的效果中等偏大；初始回忆测试比再认测试效果更强 |
| Adesope et al. (2017), Review of Educational Research | 272 独立效果量, 188 实验 | g = 0.51（vs 重读）, g = 0.93（vs 无活动）, g = 0.67（课堂） | 练习测试是学习最有效的策略之一 |
| Pan & Rickard (2018), Psychological Bulletin | 192 效果量, 122 实验, N=10,382 | d = 0.40（迁移）, d = 0.58（跨格式迁移） | 测试效应可以迁移到未测过的内容，跨题型迁移效果更大 |
| Dunlosky et al. (2013), Psychological Science in the Public Interest | 10 种学习策略系统评价 | — | 练习测试评为"高效用"，优于精细化追问（中等效用）和重读（低效用） |

**关键发现**: Dunlosky 评价体系中，练习测试（practice testing）和分布式练习（distributed practice）是唯二获得"高效用"评级的策略。

### 1.3 嵌入式评估 vs 独立评估的效果差异

| 来源 | 比较条件 | 关键发现 |
|------|---------|---------|
| Tordet & Jamet (2025), Teaching of Psychology | 嵌入式小测 vs 课后小测 (N=81) | 嵌入式小测组在认知参与、情境兴趣和自我调节学习水平上均高于课后小测组 |
| Springer (2020), Journal of Computing in Higher Education | 嵌入式问题 vs 无问题 | 嵌入式问题显著提高学习效果和注意力保持 |
| Pastotter & Bäuml (2014), Frontiers in Psychology | 检索练习的前向效应 | 对已学材料的检索练习会促进后续新材料的学习（forward testing effect） |

**关键发现**: 嵌入在教学过程中的评估和独立的评估服务不同的认知功能——前者更好地促进注意力和参与，后者更好地促进深层检索和长期保持。两者不是冗余关系。

### 1.4 单次练习测试 vs 多次练习测试

| 来源 | 关键发现 | 解释 |
|------|---------|------|
| Adesope et al. (2017) | 单次练习测试的效果优于多次练习测试 | 多次测试可能导致测试疲劳；更重要的是，多次测试之间的间隔过短会削弱间隔效应 |
| Karpicke & Roediger (2008), Science | 更多检索次数 → 更好的长期保持 | 但关键前提是检索必须间隔分布，而非连续集中 |
| Rawson & Dunlosky (2022), Current Directions in Psychological Science | 连续重学（Successive Relearning）| 多次检索有效的前提是间隔足够长，且每次检索都是"努力性"的 |

**重要区分**: 这不是"一次测试就够"的意思。而是说：
- **同一学习单元内**：1 次高质量独立检索练习 > 连续多次低质量测试
- **跨时间维度**：间隔分布的多次检索 >> 单次检索（这就是间隔重复的原理）

### 1.5 过度评估的风险

| 来源 | 关键发现 |
|------|---------|
| Imperial College London, Assessment Design Guidelines | 过度低风险评估会造成学生工作负荷过重，削弱每次评估的价值 |
| Bloom (1968), via Guskey (2007) | 教师有"过度测试"的倾向——评估频率存在最优点，超过后回报递减 |
| Ackerman & Kanfer (2009), Journal of Applied Psychology | 认知疲劳对标准化测试成绩有显著负面影响 |

---

## 二、最优评估流水线设计

### 2.1 评估的三个功能层

综合上述证据，学习评估服务三个不可替代的功能：

| 功能层 | 目的 | 时机 | 认知机制 |
|--------|------|------|---------|
| **层 1：嵌入式理解检查** | 确认理解、维持注意力、提供即时反馈 | 教学过程中 | 注意力重置（reset-of-encoding）、前向测试效应 |
| **层 2：独立检索练习** | 从记忆中检索信息、暴露知识缺口、促进深层编码 | 教学完成后、正式考试前 | 测试效应（d=0.50）、迁移学习（d=0.40） |
| **层 3：终结性评估** | 评定掌握程度、触发补救或推进 | 学习单元结束时 | 掌握学习（mastery learning, d=1.0）、元认知校准 |

**三层缺一不可的证据**:

1. **层 1 不能替代层 2**: Tordet & Jamet (2025) 证明嵌入式评估促进参与，但嵌入式问题不需要从记忆中独立检索——学生刚看完材料就回答，不构成"努力性检索"（effortful retrieval）。Rowland (2014) 发现效果量与检索努力程度正相关。
2. **层 2 不能替代层 3**: 练习测试促进学习（assessment *for* learning），但不能替代对掌握程度的正式判定（assessment *of* learning）。Bloom 的掌握学习模型明确要求"形成性测试 → 补救 → 总结性测试"三步循环。
3. **层 3 不能替代层 1 和层 2**: 只有终结性测试而没有前两层的系统，错过了两个最强的学习机会——教学中的即时反馈（d=0.70）和独立检索练习（d=0.50）。

### 2.2 但三层必须有足够的差异化

冗余的风险不在于"层太多"，而在于"每层做一样的事"。

**差异化原则（基于证据）**:

| 维度 | 层 1 嵌入式 | 层 2 独立检索 | 层 3 终结性 |
|------|-----------|-------------|-----------|
| **认知水平** | 记忆 + 理解（Bloom 低阶） | 应用 + 分析（Bloom 中高阶） | 全覆盖（含评价 + 创造） |
| **信息获取** | 刚看完原文，信息在工作记忆中 | 无原文参考，必须从长时记忆检索 | 无原文、无笔记、无前序记录 |
| **反馈方式** | 对话式即时反馈 + 追问 | 即时评分 + 详细解析 | 仅分数和诊断 |
| **题目来源** | 与教学内容直接关联的追问 | 覆盖全模块的独立题目 | 新生成的题目，不重复前序 |
| **失败后果** | 无惩罚，AI 继续教 | 暴露薄弱点，但不阻止推进 | 80% 过关线，未过需补救 |

**Pan & Rickard (2018) 的关键发现**: 当练习测试和最终测试的**格式不同**时，迁移效果更大（d=0.58 vs d=0.40）。这直接支持"每层评估应使用不同题型和认知要求"的设计。

### 2.3 最优评估频率

综合 Bloom 掌握学习模型、Adesope (2017) meta-analysis、以及微学习文献：

**单个学习单元（模块）内的最优评估节点 = 3 个**：
1. 教学过程中的嵌入式检查（每 1-3 个知识点一次追问）
2. 教学完成后的 1 次独立检索练习
3. 学习单元结束时的 1 次终结性测试

**为什么不是 4 个或 5 个**:
- Adesope (2017): 单次高质量练习测试 > 多次低质量练习测试
- Bloom (1968, via Guskey): 教师有过度测试倾向——更多不等于更好
- 认知负荷理论: 学习单元内的评估过多会占用本应用于编码的认知资源

**为什么不是 2 个（跳过独立检索）**:
- 如果只有嵌入式检查 + 终结性测试，中间没有独立检索练习，学生第一次真正从记忆中提取信息就是在高风险考试中——这会增加测试焦虑，且错过了最有效的学习机会（testing effect, g=0.50）

---

## 三、对产品流程的具体建议

### 3.1 当前流程评估

当前流程: **阅读 → 教学（AI 对话，含嵌入式问题）→ QA（独立出题）→ 测试（80% 过关）→ 间隔复习**

与最优三层模型的映射:

| 产品环节 | 对应评估层 | 评估 |
|---------|-----------|------|
| 教学（AI 对话） | 层 1 嵌入式理解检查 | 正确匹配。教学对话中的追问和即时反馈对应 Tordet & Jamet 的嵌入式评估 |
| QA（独立出题） | 层 2 独立检索练习 | 正确匹配。脱离原文的独立出题对应 Rowland 的努力性检索 |
| 测试（80% 过关） | 层 3 终结性评估 | 正确匹配。Bloom 掌握学习模型的标准过关线（研究推荐 75-85%，产品设80% 完全合理） |
| 间隔复习 | 跨时间的层 2 重复 | 正确匹配。Rawson & Dunlosky 的 Successive Relearning |

### 3.2 核心结论：保留当前四环节结构

**当前流程与学习科学证据高度吻合。不应合并或删除任何环节。**

理由：
1. **教学（层 1）和 QA（层 2）不冗余**: 它们服务不同的认知功能——教学对话中的追问检查即时理解，QA 的独立出题要求从长时记忆检索。这是"嵌入式评估"和"独立检索练习"的区别，Tordet & Jamet (2025) 和 Rowland (2014) 提供了明确的差异化证据。
2. **QA（层 2）和测试（层 3）不冗余**: QA 是 assessment *for* learning（促进学习的评估），测试是 assessment *of* learning（评定学习的评估）。前者的目的是暴露并修复知识缺口，后者的目的是判定是否达标。Bloom 的掌握学习模型要求两者分开。
3. **跳过 QA 直接考试会降低学习效果**: 学生第一次独立检索就在高风险考试中，会增加测试焦虑（Ackerman & Kanfer, 2009），且错过测试效应带来的学习增益（g=0.50）。

### 3.3 但需要强化差异化设计

当前结构正确，但为了最大化每层的独特价值、避免用户"又要答题"的感觉，需要在以下维度做出差异化：

#### 教学对话（层 1）的评估特征
- **形式**: 开放式对话追问（"你觉得为什么？""用自己的话解释"）
- **认知水平**: 主要检查理解和记忆
- **特征**: 可以看原文、可以反复讨论、AI 引导式、无评分压力
- **设计目标**: 确保学生真的理解了，不是跳过去的

#### QA（层 2）的评估特征
- **形式**: 结构化题目（选择、判断、简答、应用题）
- **认知水平**: 应用和分析为主（Bloom 中高阶）——不重复教学中已检查的理解层
- **特征**: 不可看原文、一题一答、即时反馈 + 详细解析、不影响过关
- **设计目标**: 独立检索 + 暴露知识缺口 + 为考试做准备
- **关键差异**: 必须要求"努力性检索"——学生必须从记忆中提取，而非从刚看过的材料中找答案

#### 测试（层 3）的评估特征
- **形式**: 全新生成的题目，不重复教学和 QA 中的原题
- **认知水平**: 全覆盖，包含更高阶的评价和创造
- **特征**: 不可看原文、不可看笔记、不可看 QA 记录、有过关线、有时间感
- **设计目标**: 判定掌握程度，80% 过关
- **关键差异**: Pan & Rickard (2018) 证明跨格式迁移效果更大（d=0.58）——测试的题型应与 QA 有差异

### 3.4 一个优化建议：QA 环节的"自适应退出"

Adesope (2017) 发现单次高质量练习测试 > 多次重复测试。结合这一发现：

**建议**: QA 环节不应设固定题数，而应根据学生表现自适应：
- 前 3-5 题覆盖核心知识点
- 如果正确率 > 80%，提前完成 QA，进入测试
- 如果正确率 < 60%，增加针对薄弱点的题目，但总数不超过 8-10 题
- 避免"做 20 题"的疲劳感，保持每次 QA 在 5-10 分钟

这既利用了检索练习的学习效应，又避免了过度评估的认知疲劳。

---

## 四、来源列表

### Meta-Analysis 和系统综述（最高证据级别）

1. **Black, P., & Wiliam, D. (1998)**. Assessment and Classroom Learning. *Assessment in Education: Principles, Policy & Practice*, 5(1), 7-74.
   - 250+ 项研究 meta-analysis, d=0.40-0.70
   - https://www.gla.ac.uk/t4/learningandteaching/files/PGCTHE/BlackandWiliam1998.pdf

2. **Hattie, J. (2009)**. *Visible Learning*. Routledge.
   - 1800+ meta-analysis 综合, 教师形成性评价 d=0.90
   - https://visible-learning.org/hattie-ranking-influences-effect-sizes-learning-achievement/

3. **Rowland, C. A. (2014)**. The effect of testing versus restudy on retention: A meta-analytic review of the testing effect. *Psychological Bulletin*, 140(6), 1432-1463.
   - g=0.50, 测试 vs 重读
   - https://pubmed.ncbi.nlm.nih.gov/25150680/

4. **Adesope, O. O., Trevisan, D. A., & Sundararajan, N. (2017)**. Rethinking the Use of Tests: A Meta-Analysis of Practice Testing. *Review of Educational Research*, 87(3), 659-701.
   - 272 效果量, g=0.51(vs 重读), g=0.67(课堂), 单次 > 多次
   - https://journals.sagepub.com/doi/abs/10.3102/0034654316689306

5. **Pan, S. C., & Rickard, T. C. (2018)**. Transfer of test-enhanced learning: Meta-analytic review and synthesis. *Psychological Bulletin*, 144(7), 710-756.
   - 192 效果量, N=10,382, d=0.40(迁移), d=0.58(跨格式)
   - https://pubmed.ncbi.nlm.nih.gov/29733621/

6. **Yang, C., Luo, L., Vadillo, M. A., Yu, R., & Shanks, D. R. (2021)**. Testing (quizzing) boosts classroom learning: A systematic and meta-analytic review. *Psychological Bulletin*, 147(4), 399-435.
   - 222 独立研究, N=48,478, g=0.499
   - https://pubmed.ncbi.nlm.nih.gov/33683913/

7. **Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., & Willingham, D. T. (2013)**. Improving Students' Learning With Effective Learning Techniques. *Psychological Science in the Public Interest*, 14(1), 4-58.
   - 10 种学习策略系统评价, 练习测试和间隔练习获"高效用"
   - https://journals.sagepub.com/doi/abs/10.1177/1529100612453266

### 实验研究（顶刊）

8. **Karpicke, J. D., & Roediger, H. L. (2008)**. The critical importance of retrieval for learning. *Science*, 319(5865), 966-968.
   - 重复测试 vs 重复学习, 测试组长期保持显著更好
   - https://www.researchgate.net/publication/5574966_The_Critical_Importance_of_Retrieval_for_Learning

9. **Roediger, H. L., & Karpicke, J. D. (2006)**. Test-enhanced learning. *Psychological Science*, 17(3), 249-255.
   - 检索练习比重读改善回忆 50%
   - https://journals.sagepub.com/doi/10.1111/j.1467-9280.2006.01693.x

10. **Rawson, K. A., & Dunlosky, J. (2022)**. Successive Relearning: An Underexplored but Potent Technique. *Current Directions in Psychological Science*, 31(4), 365-371.
    - 连续重学的间隔条件和效果
    - https://journals.sagepub.com/doi/full/10.1177/09637214221100484

11. **Tordet, C., & Jamet, E. (2025)**. Comparing Embedded and End-of-Session Formative Quizzes. *Teaching of Psychology*.
    - N=81, 嵌入式 > 课后式（参与、兴趣、自我调节）
    - https://journals.sagepub.com/doi/10.1177/00986283251339616

12. **Pastotter, B., & Bäuml, K.-H. T. (2014)**. Retrieval practice enhances new learning: the forward effect of testing. *Frontiers in Psychology*, 5, 286.
    - 前向测试效应：检索练习促进后续新学习
    - https://pmc.ncbi.nlm.nih.gov/articles/PMC3983480/

13. **Soderstrom, N. C., & Bjork, R. A. (2015)**. Learning Versus Performance. *Perspectives on Psychological Science*, 10(2), 176-199.
    - 学习与表现的区分，期望困难理论
    - https://journals.sagepub.com/doi/abs/10.1177/1745691615569000

### 评估设计和掌握学习

14. **Bloom, B. S. (1984)**. The 2 Sigma Problem. *Educational Researcher*, 13(6), 4-16.
    - 1v1 辅导 + 掌握学习 = +2σ（两个标准差）
    - https://en.wikipedia.org/wiki/Bloom's_2_sigma_problem

15. **Guskey, T. R. (2007)**. Closing Achievement Gaps: Revisiting Benjamin S. Bloom's "Learning for Mastery". *Journal of Advanced Academics*, 19(1), 8-31.
    - 掌握学习模型的形成性测试 → 补救 → 总结性测试循环
    - https://tguskey.com/wp-content/uploads/Mastery-Learning-5-Revisiting-Blooms-Learning-for-Mastery.pdf

16. **Biggs, J. (2003)**. SOLO Taxonomy and Assessment Design.
    - 形成性和终结性评估应在不同认知复杂度层级运作
    - https://pmc.ncbi.nlm.nih.gov/articles/PMC10078662/

17. **Bjork, R. A., & Bjork, E. L. (2011)**. Creating Desirable Difficulties to Enhance Learning.
    - 期望困难：变化条件、交错、间隔、测试四大策略
    - https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/04/EBjork_RBjork_2011.pdf

### ITS 和 AI 教育研究

18. **Kulik, J. A., & Fletcher, J. D. (2016)**. Effectiveness of Intelligent Tutoring Systems: A Meta-Analytic Review. *Review of Educational Research*, 86(1), 42-78.
    - ITS 中位效果：+0.66σ
    - https://eric.ed.gov/?id=EJ1090502

19. **VanLehn, K. (2006)**. The Behavior of Tutoring Systems. *International Journal of Artificial Intelligence in Education*, 16, 227-265.
    - 辅导系统的 step loop 和 assessment 机制
    - https://cs.uky.edu/~sgware/reading/papers/vanlehn2006behavior.pdf

20. **Graesser, A. C., et al. (2004)**. AutoTutor: A tutor with dialogue in natural language. *Behavior Research Methods*, 36(2), 180-192.
    - 5 步辅导框架中的嵌入式评估
    - https://link.springer.com/article/10.3758/BF03195563

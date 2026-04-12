# 竞品深度分析

**调研日期**: 2026-04-11
**用途**: MVP 扩展设计——了解市场格局、差异化定位

---

## 1. NotebookLM (Google)

**本质**：AI 文档分析与内容呈现工具，不是教学工具。

**核心功能（截至 2026-03）**：
- **Source Grounding**: 所有回答基于用户上传的文档，引用原文出处
- **Audio Overviews**: 将文档转为播客式双人对话音频
- **Lecture Mode (2025-12 新增)**: 30 分钟单人音频讲课，结构类似课堂，非摘要
- **Learning Guide**: 交互式学习指南，提出开放性问题引导参与
- **Interactive Mode**: 听音频时可"举手提问"，AI 暂停回答后继续
- **Cinematic Video Overviews (2026-03)**: 将 PDF 转为纪录片风格动画视频
- **Flashcards & Quizzes**: 从文档生成闪卡和测验，附"explain"按钮深入解释
- **Chat 引擎**: 2026-02 升级为 Gemini 3.1 Pro

**定价**: 免费（Google 补贴）

**强项**:
- 免费 + Google 用户基础 + 快速迭代
- Source grounding 确保内容准确性
- 多种内容呈现方式（文字/音频/视频/闪卡）
- PDF 处理速度快（Google 基础设施）

**弱点 — 这些是我们的机会**:
1. **没有教学法**: Learning Guide 只是"提出问题"，不是"根据知识类型选择最优教学方法"
2. **没有知识追踪**: 不知道用户会什么、不会什么。每次交互都是从零开始
3. **没有学习路径**: 没有"先学这个再学那个"的结构化进度
4. **没有自适应**: 不会根据用户理解程度调整教学策略
5. **没有间隔重复**: 没有复习系统，不管遗忘曲线
6. **认知卸载风险**: Chat 模式下用户可以直接获取答案，没有防护设计

**威胁等级**: **高** — 免费且在快速迭代。如果 Google 投入教育学团队做真正的教学功能，凭免费+用户基础很危险。

**差异化策略**: 他们做"内容呈现"，我们做"教学"。本质区别：图书管理员 vs 私人家教。

**来源**:
- https://blog.google/innovation-and-ai/models-and-research/google-labs/notebooklm-student-features/
- https://dataconomy.com/2025/12/26/google-notebooklm-introduces-lecture-mode-for-30-minute-ai-learning/
- https://medium.com/@jimmisound/the-cognitive-engine-a-comprehensive-analysis-of-notebooklms-evolution-2023-2026-90b7a7c2df36

---

## 2. Khanmigo (Khan Academy + OpenAI)

**本质**: 苏格拉底式 AI 家教，绑定 Khan Academy 内容。

**核心功能**:
- 苏格拉底式对话：永不直接给答案，用问题引导学生思考
- 绑定 Khan Academy 的课程内容（数学、科学、写作等）
- 实时 AI 辅导，步骤分解

**定价**: $4-9/月

**有效性研究**:
- AI tutor 学生 post-test median 4.5 vs 对照组 3.5
- 心理学课使用 AI tutor 后考试成绩提升 15 个百分点
- Common Sense Media 评分 4 星（高于 ChatGPT/Bard）
- MIT/J-PAL 正在进行大规模 RCT

**强项**:
- 有研究验证效果
- 苏格拉底式方法防止认知卸载
- 数学教学特别强

**弱点**:
1. **只有一种教学法**: 纯苏格拉底式，不根据知识类型切换方法
2. **只能教 Khan 内容**: 不支持用户上传自己的教材/PDF
3. **英文为主**: 对中文用户不友好
4. **内容受限**: 主要面向 K-12 和基础大学课程

**威胁等级**: **中** — 不支持任意教材，和我们不直接竞争

**来源**:
- https://www.khanmigo.ai/
- https://www.povertyactionlab.org/initiative-project/ai-powered-tutoring-unleashing-full-potential-personalized-learning-khanmigo

---

## 3. OpenMAIC (清华大学)

**本质**: 开源多 agent 课堂模拟平台。

**核心功能**:
- 一键将 PDF/主题转为交互式课堂
- 多 agent 环境：AI 老师（不同教学风格）+ AI 助教 + AI 同学
- 自动生成课件、测验、模拟、实时讨论
- 自适应教学：根据学生表现动态调整难度和策略
- 即时评分 + 知识差距分析 + 个性化学习路径建议

**技术栈**: Next.js + React + TypeScript, LangGraph (multi-agent state machine), 支持 OpenAI/Anthropic/Gemini/DeepSeek

**验证**: 700+ 清华真实学生使用

**强项**:
- 多 agent 交互创造课堂氛围（不只是 1v1）
- 开源，技术可参考
- 学术背景强

**弱点**:
1. **是课堂模拟不是 1v1 辅导**: 面向"上课"场景，不是"自学教材"场景
2. **研究项目不是商业产品**: 没有用户体验打磨、没有商业模式
3. **需要自行部署**: 技术门槛高，非消费者产品
4. **教学法不透明**: 没有公开详细的教学法匹配机制

**威胁等级**: **低-中** — 理念有启发价值（多 agent），但不是直接竞品

**可借鉴之处**: 多 agent 教学理念（未来可探索，当前停车场）

**来源**:
- https://github.com/THU-MAIC/OpenMAIC
- https://sterlites.com/blog/openmaic-ai-multi-agent-classroom-future

---

## 4. ChatGPT / Claude 直接使用

**本质**: 通用 AI 对话，用户自行用于学习。

**"竞品"原因**: 这是用户的默认选择——"直接问 ChatGPT"。

**用于学习时的问题**:
1. **认知卸载严重**: Harvard RCT 显示不受限制使用 ChatGPT 学习后测成绩降 17%
2. **没有结构**: 用户不知道该学什么、学到哪了
3. **没有追踪**: 每次对话从零开始，不记得你会什么
4. **没有质量控制**: 可能给错误信息，用户无法判断
5. **没有复习系统**: 不管遗忘曲线

**威胁等级**: **高** — 是最大竞争对手，因为零切换成本、用户已经习惯

**差异化**: 你的产品 = "正确使用 AI 学习的产品化方案"，防止用户错误使用 AI（认知卸载）

---

## 5. 其他竞品

| 产品 | 类型 | 威胁 | 备注 |
|------|------|------|------|
| Quizlet | 闪卡+间隔重复 | 低 | 只有记忆，没有教学 |
| Anki | 间隔重复 | 低 | 强大但陡峭学习曲线，没有教学 |
| Duolingo | 游戏化语言学习 | 低（不同领域） | 方法论参考：留存设计、微学习、条纹机制 |
| Coursera/EdX AI | 课程内 AI 辅导 | 低-中 | 绑定平台课程，不支持任意教材 |
| TeachMap AI | AI 学习路径 | 中 | $15-50/月，自适应学习路径 |

---

## 市场数据

- AI tutors 市场规模：2024 年 $16.3 亿 → 2030 年预计 $79.9 亿 (CAGR 30.5%)
- K-12 是最大细分市场
- 2025 年 58% 教育管理者"经常"或"总是"使用 AI（2024 年为 31%）
- MagicSchool 报告 28% 成绩提升 + 88% 满意度
- 竞争加剧：Microsoft/Pearson 合作、ChatGPT Edu 推出

**来源**:
- https://www.grandviewresearch.com/industry-analysis/ai-tutors-market-report
- https://nerdleveltech.com/ai-tutoring-platforms-the-2026-deep-dive-you-need

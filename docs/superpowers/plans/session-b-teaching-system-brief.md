---
date: 2026-03-28
topic: 教学系统深度调研Session简报
type: plan
status: resolved
keywords: [teaching-system, session-brief, research, design]
---

# Session B 任务简报：教学系统深度调研 + 设计

---

## 你是谁、要做什么

你是 ai-textbook-teacher 项目的 PM/架构师。这个 session 的任务是：**为产品设计一个 AI 教学系统**——让 app 从"做题机器"变成"真正教用户"。

这是三线 MVP 扩展的第二项。扫描 PDF（第一项）在另一个 session 处理。留存机制（第三项）依赖你的设计产出，在你之后做。

---

## 先读什么（按顺序）

### 必读 — 项目上下文
1. `CLAUDE.md` — 项目规则和角色分工
2. `docs/project_status.md` — 当前状态
3. `docs/architecture.md` — 系统架构（页面、API、DB、AI 角色、接口契约）
4. `docs/superpowers/plans/2026-04-11-mvp-expansion-timeline.md` — 三线时间线和依赖关系

### 必读 — 本次调研基础（已有）
5. `docs/research/2026-04-11-teaching-spec-evaluation.md` — **最重要**：月饼投资教学 spec 的评价，列出了可借鉴/需重设计/不借鉴的部分
6. `docs/research/2026-04-11-learning-sciences-overview.md` — 学习科学领域概览、Hattie effect size、关键教学框架
7. `docs/research/2026-04-11-competitive-analysis.md` — 竞品分析（NotebookLM/Khanmigo/OpenMAIC）
8. `docs/research/2026-04-11-user-positioning.md` — 用户定位
9. `docs/research/2026-04-11-ai-cost-and-moat.md` — 成本和护城河

### 必读 — 借鉴源
10. `D:\已恢复\Users\Sean\月饼投资计划\docs\specs\04-teaching-system.md` — 月饼投资项目的教学系统 spec。**不是照搬**，是借鉴其中的教学法设计思路，适配到通用教材场景

### 必读 — 产品决策
11. `docs/journal/2026-04-11-two-learning-modes.md` — 两种学习模式：课件→教学模式（只教不考），教材→完整模式（教+考+复习）
12. `docs/journal/INDEX.md` — open 项中与教学相关的条目
13. `docs/decisions.md` — 已关闭决策（不重新讨论）

---

## 你要做什么

### 阶段 1：深度调研（先做，产出存 `docs/research/`）

在已有调研基础上，针对以下 4 个问题做深度 web 调研：

**调研 1：通用知识类型分类方案**
- 当前 app 的 KP 提取已经分 4 类：定义 / 计算 / C1判断 / C2评估
- 投资 spec 也用这 4 类，但这是投资领域特化的
- 需要研究：Bloom Taxonomy、Anderson-Krathwohl 修订版、Merrill's Component Display Theory 等知识分类框架
- 产出：推荐一个适合通用教材的知识类型分类方案（5-6 类），并说明与现有 4 类的映射关系

**调研 2：教学法 × 知识类型最优匹配**
- 基于调研 1 确定的分类，每种类型匹配最有效的教学法
- 用 Hattie effect size 数据作为选择依据（learning-sciences-overview.md 里有初步数据）
- 参考投资 spec 的 4×4 匹配（teaching-spec-evaluation.md 里有评价），但不局限于那 4 种方法
- 产出：知识类型 × 教学法匹配表 + 每种匹配的理论依据

**调研 3：AI 教学对话 prompt 编码**
- 研究 AutoTutor、Khanmigo 等系统如何将教学法编码成 AI prompt
- 关键问题：如何让 AI "教得像个好老师"而不是"在废话"
- 投资 spec 的五步对话框架（AutoTutor）和 10 维度质量保证可以参考
- 产出：prompt 编码方案建议（结构、关键规则、质量控制点）

**调研 4：教学 UX — 怎样让学不无聊**
- 投资 spec 在教学正确性上很强，但在"让用户想继续学"上很弱（teaching-spec-evaluation.md 里有这个批评）
- 研究：Duolingo 的微学习设计、游戏化教学的有效 pattern、对话式学习的 UX 最佳实践
- 关键问题：一次教 3-5 个 KP、每个 KP 走 5 步对话 = 15-25 轮对话，用户怎么坚持？
- 产出：教学 UX 设计原则和具体建议

### 阶段 2：Brainstorm 设计

调研完成后，走 /brainstorming skill 流程设计教学系统：

**核心设计问题**：
1. 新的学习流程是什么？（当前：读→QA→考→复习，改后可能是：读→教学→考→复习）
2. "教学"环节的具体产品形态？（对话式？分步式？混合？）
3. 两种模式如何实现？（教学模式 vs 完整模式，共享什么、分别什么）
4. 知识类型分类方案（基于调研 1）
5. 教学法匹配规则（基于调研 2）
6. Coach AI 角色的 prompt 架构（基于调研 3）
7. 对现有架构的改动范围（读 architecture.md 评估）

**约束条件**：
- 产品不变量不得违反（见 CLAUDE.md）
- 现有测试（80% 过关线）和复习系统（间隔重复）保留
- Token 成本可控（参考 ai-cost-and-moat.md 的估算）
- 不做 MVP 范围外的功能

**产出**：
- 调研文档存 `docs/research/`
- 设计 spec 存 `docs/superpowers/specs/`
- 更新 `docs/project_status.md`

---

## 关键提醒

- **不是照搬投资 spec**：那是为投资学习体系设计的，领域特异性强。借鉴理念，重新设计适配通用教材的方案
- **teaching-spec-evaluation.md 是起点**：里面已经列出了可借鉴和需要重新设计的部分
- **两种模式是确定的产品方向**：不需要重新讨论，基于它来设计
- **用户是非技术背景**：汇报时用中文、用类比、不堆术语（见 CLAUDE.md 沟通协议）

# 教学系统 Brainstorm 进行中状态（WIP）

**创建日期**: 2026-04-12
**用途**: compact 防御——记录 brainstorm 进度，避免 session 断档丢失状态
**最终产出**: `docs/superpowers/specs/2026-04-12-teaching-system-design.md`（brainstorm 完成后生成）

> ⚠️ compact 后恢复时**先读这个文件**，不要从 summary 重建——summary 会丢细节。

---

## 基础设定（产品定位，不会变）

- **教学模式 = 付费墙护城河**：高价 subscription 才能解锁，所有竞品都没有
- **完整模式 = 基础版**：MVP 默认，所有用户可用
- **设计铁律**：两种模式必须随时可切换，不能把逻辑卡死；预留引导消费位置；token 成本差异可作为卖点

---

## 调研（全部完成）

### 第一批（2026-04-11）

1. `docs/research/2026-04-11-knowledge-type-classification.md` — 5 类知识类型（factual/conceptual/procedural/analytical/evaluative）
2. `docs/research/2026-04-11-pedagogy-knowledge-matching.md` — 5×5 教学法匹配（含 Hattie effect size）
3. `docs/research/2026-04-11-ai-prompt-encoding.md` — 三层 prompt 架构 + 5 套 system prompt
4. `docs/research/2026-04-11-teaching-ux.md` — 微学习 7 条规则（3-5 个 KP/session, 10-20 分钟）

### 第二批（2026-04-12）

5. `docs/research/2026-04-12-testing-effect-marginal-value.md` — A：认为 QA 冗余（**被 B/D 推翻**，误读 Rawson & Dunlosky）
6. `docs/research/2026-04-12-formative-summative-optimal-combo.md` — B：三层评估不可合并（嵌入式 + 独立检索 + 终结）
7. `docs/research/2026-04-12-alternative-assessment-methods.md` — C：6 种评估方法按知识类型匹配
8. `docs/research/2026-04-12-optimal-learning-sequence.md` — D：ICAP 框架 + Gagne 9 步 → 加 Phase 0 + Notes 降级
9. `docs/research/2026-04-12-frontend-backend-order.md` — 契约优先，维持 Claude→Codex→Gemini 顺序

### 第三批（2026-04-13）

10. `docs/research/2026-04-13-subscription-downgrade-patterns.md` — 订阅降级策略与 Entitlement Management（Notion/Figma/Airtable/Slack/Dropbox/Jira 6 家 + Stripe/Stigg 架构）；核心结论：**Atlassian "数据在床下"模式** + **业务表只记事实，权限层解耦** + **entitlement 函数封装**

---

## 已拍死的决策（不再讨论）

### 流程层

- **5 阶段流程**：Phase 0 激活 → Phase 1 阅读 → Phase 2 教学 → Phase 3 QA → Phase 4 测试 → Phase 5 复习
- **QA 保留但转型**：不同题型 + 强制独立检索（不可看原文） + 自适应 3-10 题
- **Test 题型与 QA 不同**：Pan & Rickard 2018 跨格式 d=0.58
- **Teaching → QA 紧接**，间隔留给 Spaced Review
- **Notes 降级**：不作独立环节（具体去处待定，见决策 5）

### 设计层

- **5 类知识类型**：factual / conceptual / procedural / analytical / evaluative
- **5×5 教学法匹配**：每类 KP 固定匹配一种教学法（见 pedagogy-knowledge-matching.md）
- **按知识类型自动选评估方法**：事实→Q&A；概念→Teach-back+预测；过程→Q&A+错误检测；分析→预测+比较；评估→比较+预测
- **三层 prompt 架构**：角色层（5 套 system prompt）+ 知识锚定层 + 对话管理层
- **UI 为 Option C Hybrid**：结构化壳（SplitPanel + KnowledgePointList + ChatBubble + FeedbackPanel）+ 对话内核，复用 QASession 组件

### 决策 1：两种模式切换机制（2026-04-12 拍板）

- **Q1 谁选**：用户选（教学模式是付费墙，用户决策）
- **Q2 何时选**：**随时可选**（不能卡死，为未来付费墙切换服务）
- **Q3 能否切换**：**随时双向切换**（付费用户切换自由，数据保留）
- **数据 schema**：books 表加 `learning_mode TEXT NOT NULL DEFAULT 'full' CHECK(mode IN ('teaching','full'))`
- **切换逻辑**：
  - full → teaching：不删除 QA/Test/Review 数据，只隐藏入口
  - teaching → full：已 Teaching 的 KP 解锁 QA/Test 流程
- **UI 入口**：上传页选初始模式 + 书级 Action Hub 页有切换按钮
- **引导消费预留**：教学模式需要标注"付费功能"位置（MVP 不实装付费墙）

### 决策 2：教学 Session 粒度与分段（2026-04-12 拍板）

- **Q1 一次教几个 KP**：一个 Cluster = 一个 Session（3-5 个 KP，10-25 分钟）
- **Q2 怎么分段**：按 cluster 天然分段（复用现成的 cluster 结构，复习时同一批 KP 进入 P 值追踪）
- **Q3 轻量（3 步）vs 完整（5 步）谁决定**：**AI 默认 + 用户可覆盖**
  - AI 按 `knowledge_points.importance` 字段给默认深度（importance=1 → 轻量；importance=2-3 → 完整）
  - 用户进 session 时可一键切"全深"或"全浅"
- **fallback 校正**：
  - 如果 cluster 只有 1-2 个 KP → 自动合并相邻 cluster
  - 如果 cluster 超过 7 个 KP → 自动拆半
  - 这个校正由 AI 在 KP 提取阶段顺便做

---

## 待 brainstorm 的决策（按依赖顺序）

### 决策 3：学习状态流变更 + Entitlement 地基（2026-04-13 拍板）

基于 `docs/research/2026-04-13-subscription-downgrade-patterns.md` 的订阅降级调研，确定 Atlassian "数据在床下"模式。

**状态流设计**（pure enum，同时容纳两条路径）：
```
not_started → reading → [taught] → qa_in_progress → qa_complete → tested → completed
                         ↑ 教学路径走这一步，完整路径跳过
```

- 完整模式：`reading → qa_in_progress → qa_complete → tested → completed`
- 教学模式：`reading → taught → qa_in_progress → qa_complete → tested → completed`
- `taught` 只表示"已走过教学环节"（事实），与付费无关
- **3a Phase 0 加到两种模式**：`not_started → activating → reading → ...`
- `notes_generated` **删除**（Notes 降级为 AI 静默生成，不占 status）

**MVP 必做地基**（即使所有用户默认开通教学，这些也要做对）：
1. `teaching_sessions` 独立表（不塞进 modules，transcript 用 jsonb）
2. `modules.learning_status` 用 pure enum（不含 tier 字样）
3. `user_subscriptions` 表预埋（MVP 默认所有人 'premium'）
4. `canUseTeaching(userId)` entitlement 函数（MVP 内 `return true`）
5. 所有 teaching-related API 走 entitlement 守卫
6. `books.preferred_learning_mode` 设计为"偏好"字段（允许中途切换）

**MVP 之后做**（不影响地基）：
- 付费墙 UI / Stripe 集成 / 升级 CTA
- `feature_flags` 表 / `plan_features` join 表（feature ≥ 3 时再抽象）
- Grace period 调度 / 60 天 auto-delete
- 降级 soft-lock UI / 挽留话术

**学习路径指南文档**：
- 路径：`docs/learning-path-guide.md`
- 用途：学习者视角的通用指南，可给其他 CC session 复用

### 决策 4：Phase 0 具体形态（2026-04-14 拍板）

- **4a 内容**：目标清单 + 1-2 道探测题（Pretesting Effect 要真实检索才触发）
- **4b 题目来源**：AI 一次生成后缓存（同一模块复用，省 token）
- **4c 触发时机**：只第一次进入模块时走，之后跳过（pretesting 是"首次进入激活"）
- **4d 结果用途**：纯仪式感，不记录、不影响后续（MVP 简单可靠，未来可升级到"按探测结果调 Phase 2 教学深度"作为付费卖点）

### 决策 5：教学与原文结合方式（2026-04-14 拍板）

**方向**：C — 紧耦合 SplitPane（左 PDF 原文 + 右 AI 教学对话，同步高亮）

**地基策略（两层分工）**：

1. **数据层（MVP 必做，一次做对永不重做）**：
   - `knowledge_points` 表加 `source_anchor` 字段（jsonb：页码 + 段落索引）
   - AI 提取 KP 时**必须**顺便提取锚点（不然未来升级 UI 要重跑所有书的 AI 提取，成本巨大）

2. **UI 层（MVP 分步做）**：
   - **MVP v1**：SplitPane 骨架 + "查看原文"按钮跳转（实现简单）
   - **MVP v2**（小升级）：自动同步高亮（数据零迁移，只改前端）

**为什么选 C**：
- 教学模式是付费墙，UI 差异感最强的就是 SplitPane 同屏
- 调研里 `2026-04-11-teaching-ux.md` 本就推荐 SplitPane
- 锚点提取一次性做，运行时零成本

### 决策 6：Notes 降级后的去处（2026-04-14 拍板）

- **6a 用户手写笔记 `reading_notes`**：**保留**（从"学习流程必经"降为"可选辅助工具"）。理由：写作本身是元认知训练，AI 替代不了
- **6b AI 生成 `module_notes` 触发时机**：**qa 结束后**（两种模式都有）。这时有用户答题数据，AI 能生成"你哪里对哪里错"的精准诊断
- **6c UI 呈现**：**集成到模块详情页一个"笔记"tab**（不做独立主菜单）
- **6d 生成格式**：
  - **按 KP 组织 + AI/用户对照**
  - 每个 KP 一个区块：🤖 AI 总结（含个性化学习诊断） + 👤 用户手写笔记
  - 用户笔记通过 `page_number` + KP 的 `source_anchor` 自动映射到对应 KP
  - **颜色方案**：AI = 🤖 + 默认教材色（黑/深灰），用户 = 👤 + amber（与 Companion 体系呼应）
- **AI 笔记核心价值**：不是"本 KP 讲了什么"的空洞摘要，是**结合用户答题表现的个性化学习诊断**

**产品不变量关联**：6a 保留手写笔记 → 产品不变量 #3「测试时禁止看笔记」**继续有效**（决策 9 已确认）

### 决策 7：知识类型迁移策略（2026-04-14 拍板）

**前提**：当前数据库**一个 KP 都没提取过**，所以"迁移"伪命题。

**方案**：直接替换，无迁移。

- **schema 改动**：`knowledge_points.type` 的 `CHECK` 约束直接替换为新 5 类 `factual / conceptual / procedural / analytical / evaluative`
- **旧 5 类（position / calculation / c1_judgment / c2_evaluation / definition）全部废弃**，TypeScript 类型定义同步更新
- **Prompt 必须更新**：`seed-templates.ts` 的 KP 提取 prompt 加入新 5 类的**判断标准**（调研 §101-109 的识别规则表），不能只列类型名
- **多标签**：**单标签**（一个 KP 只属一类，和教学法 5×5 匹配一致）

### 决策 8：AI 角色组织（2026-04-14 拍板）

- **8a 教学 AI 归属**：**新增 `teacher` 角色**（不扩展 coach）
  - 理由：coach 职责是"评价对错+纠错"，teacher 职责是"引导建构"，语义不同
  - 付费差异：teacher 可配更贵模型（Opus），coach 用便宜的（Sonnet），成本可控
  - cost tracking 清晰：教学 token 和 QA token 分开统计
- **8b Prompt 模板组织**：**按 5 种教学法分 5 套 system prompt**（对应 5 种知识类型）
  - 对应调研 `2026-04-11-ai-prompt-encoding.md` 的"角色层"
  - 对话阶段（激活/讲解/举例/练习/迁移）在 prompt 内用分支实现（对话管理层）
  - 未来加教学法只需加 1 套 prompt，不动代码

**MVP schema 操作**：
- `prompt_templates` 表新增 5 条 `role='teacher'` 记录
- stage 值命名：`teach_factual` / `teach_conceptual` / `teach_procedural` / `teach_analytical` / `teach_evaluative`
- 代码加 `getTeacherPrompt(kpType)` 选 prompt 函数

### 决策 9：产品不变量是否修改（2026-04-14 拍板）

**结论**：现有 5 条产品不变量**不改，不加**，保持精简。

**新增知识锚点**：认知卸载防护（"AI 不能直接给答案"等 4 条硬规则）**不提升为产品不变量**，保留在 `docs/research/2026-04-11-ai-prompt-encoding.md` §168-198，由 role prompts 实现时直接引用。

**判断标准**（为什么不加）：
- 现有 5 条不变量都是 **UI 可强制的行为规则**（隐藏按钮 / 禁用修改 / 隐藏入口 / 后端卡住 / 严格一问一答）
- 认知卸载防护是 **prompt 层的模型行为约束**，不是 UI 层规则
- prompt 约束属工程实现规范，spec / role prompts 会直接引用研究文件，不需要提升到 CLAUDE.md 顶层不变量

**5 条现有产品不变量在教学模式下的确认**：
| # | 不变量 | 教学模式下状态 |
|---|-------|--------------|
| 1 | 用户必须读完原文才能进入 Q&A | 保留（Phase 1 → Phase 2 前也要读完） |
| 2 | Q&A 已答的题不可修改 | 保留 |
| 3 | 测试阶段禁止查看笔记和 Q&A 记录 | **保留 + 加强**：教学对话记录、reading_notes、module_notes 在 Phase 4 全部隐藏 |
| 4 | 模块过关线 80% | 保留 |
| 5 | Q&A 一次一题 + 即时反馈 | 保留（Phase 3 不受教学流程影响） |

**教学模式新增隐含规则**（不提升为不变量，在 spec 中陈述）：
- Phase 2 教学→Phase 3 QA 过渡时，**教学对话记录应对 QA 隐藏**（防止"回看教学答案"作弊，同决策 3 的闭卷原则一致）
- Phase 4 测试时，**教学对话、AI 笔记、手写笔记全部隐藏**（#3 的延伸）

**实现注意事项（spec 层记录）**：
- role prompts 构建时必须抄入 `2026-04-11-ai-prompt-encoding.md` §168-198 的 4 条硬规则 + 3 条应对策略
- 教学法按 §128-134 的 5 类映射：事实型不用苏格拉底，概念型/分析型用苏格拉底

### 决策 10：开发范围与分阶段（2026-04-14 拍板）

**方案 C：两段式**（M4 最小闭环 + M5 差异化升级）。

#### M4：Teaching Mode 最小闭环（能上线跑起来）

地基一次做对 + 核心对话体验走通，允许 UI 简陋。

**Schema 改动（全部一次到位，未来不返工）**：
1. `books.learning_mode` / `books.preferred_learning_mode`（决策 1）
2. `modules.learning_status` enum 全替换（决策 3）
3. `teaching_sessions` 独立表（决策 3）
4. `user_subscriptions` 表预埋，MVP 默认所有人 'premium'（决策 3）
5. `knowledge_points.source_anchor` jsonb（决策 5）
6. `knowledge_points.type` CHECK 全替换为新 5 类（决策 7）
7. `prompt_templates` 新增 5 条 `role='teacher'` 记录（决策 8）

**Backend**：
- `canUseTeaching(userId)` entitlement 函数（MVP `return true`）
- KP 提取 prompt 更新（新 5 类判断标准 + source_anchor 提取）
- 5 套 teacher system prompts（按教学法分，复用调研 §128-134 + §168-198）
- Phase 2 教学对话 API（调用 `getTeacherPrompt(kpType)`）
- 模式切换 API（`PUT /api/books/:id/learning-mode`）

**Frontend**：
- 上传页模式选择 UI
- 书级模式切换按钮（Action Hub）
- Phase 2 教学对话 UI（**纯单栏对话**，无 SplitPane；原文通过"查看原文"按钮跳转）
- **Phase 0 简化版**：只显示目标清单（"本次要学 X / Y / Z"），**不做探测题 + 缓存**
- 教学模式下 QA/Test 按 §9 规则隐藏教学对话记录入口

**砍掉（M5 做）**：
- SplitPane 自动同步高亮
- Phase 0 完整版（探测题生成 + 缓存）
- module_notes 个性化诊断 UI
- 笔记 tab 完整 UI（M4 用简单占位）
- 付费墙 UI / 升级 CTA

#### M5：Teaching Mode 差异化升级（付费亮点）

- SplitPane 壳 + 锚点自动同步高亮（数据已在 M4 备好，只加前端）
- Phase 0 完整版：探测题生成 + 缓存（首次进入模块触发）
- module_notes 个性化诊断（QA 完后生成，结合答题表现）
- 笔记 tab 完整 UI（KP 区块 + AI/用户对照 + amber 色）
- 付费墙 UI 预留位（功能标识 + 升级 CTA），但 MVP 不卡付费

#### 关键原则

- **M4 做完即可上线给用户/朋友试用**（核心教学闭环可验证）
- **M5 拿到 M4 反馈再启动详细 brainstorm**（不现在就 over-design）
- **M4 和 M5 的详细设计（任务拆分、API 契约、UI 组件）在里程碑启动时另开 brainstorm**，本次只定范围

---

## 当前进度

- ✅ 决策 1（两种模式切换）已拍板
- ✅ 决策 2（Session 粒度与分段）已拍板
- ✅ 决策 3（学习状态流 + Entitlement 地基）已拍板
- ✅ 决策 4（Phase 0 具体形态）已拍板
- ✅ 决策 5（教学与原文结合方式）已拍板
- ✅ 决策 6（Notes 降级后的去处）已拍板
- ✅ 决策 7（知识类型迁移策略）已拍板
- ✅ 决策 8（AI 角色组织）已拍板
- ✅ 决策 9（产品不变量是否修改）已拍板
- ✅ 决策 10（开发范围与分阶段）已拍板
- 🎉 **10 个决策全部拍板完成，准备转正式 design spec**

---

## 最终产出

brainstorm 全部完成后，本文件转为 `docs/superpowers/specs/2026-04-12-teaching-system-design.md`（正式 design spec），然后进 writing-plans 写实施计划。

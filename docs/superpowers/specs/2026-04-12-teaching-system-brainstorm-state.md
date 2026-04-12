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

### 决策 3：学习状态流变更【下一个】

- 当前：unstarted → reading → qa → notes_generated → testing → completed
- 加入 Phase 0 和 Phase 2 + Notes 降级后新流是什么
- 教学模式的状态流如何处理（跳过后续）

### 决策 4：Phase 0 具体形态

- UI 表现（目标展示 + 1-2 探测题）
- 可跳过吗
- 不评分不记录怎么表达

### 决策 5：Notes 降级后的去处

- reading_notes 表还留吗
- AI 自动生成笔记的时机
- Notes 页面存留/改造/删除

### 决策 6：知识类型迁移策略

- 旧 5 类 → 新 5 类 mapping
- 已有 KP 怎么处理（重跑 AI 分类 vs 标 legacy）
- 是否需要 AI 支持多标签

### 决策 7：AI 角色组织

- 教学归"教练"扩展 vs 拆新角色"教学官"
- prompt 模板组织

### 决策 8：产品不变量是否修改

- #5（一次一题即时反馈）→ 改"练习环节"
- #3（测试禁看笔记）→ Notes 降级后如何调整

### 决策 9：开发范围与分阶段

- 一个里程碑全做完 vs 拆
- 先做哪部分（教学模式 vs 完整模式；最小闭环含什么）

---

## 当前进度

- ✅ 决策 1（两种模式切换）已拍板
- ✅ 决策 2（Session 粒度与分段）已拍板
- 🔄 下一步：决策 3（学习状态流变更）
- 每完成一个决策，更新本文件的"已拍死"区和"待 brainstorm"区

---

## 最终产出

brainstorm 全部完成后，本文件转为 `docs/superpowers/specs/2026-04-12-teaching-system-design.md`（正式 design spec），然后进 writing-plans 写实施计划。

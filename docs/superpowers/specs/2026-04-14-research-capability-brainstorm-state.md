---
date: 2026-04-14
topic: 调研能力Brainstorm进度追踪
type: spec
status: resolved
keywords: [research, brainstorm, WIP, authority-weighting, compact-defense]
---

# Research Capability Brainstorm 进行中状态（WIP）

**创建日期**: 2026-04-14
**用途**: compact 防御——记录 brainstorm 进度，避免 session 断档丢失状态
**最终产出**: `docs/superpowers/specs/2026-04-14-research-capability-design.md`

> ⚠️ compact 后恢复时**先读这个文件**，不要从 summary 重建——summary 会丢细节。

---

## 基础设定（不会变）

- **用户是非技术 CEO**：所有技术汇报必须走 CLAUDE.md 的 5 问格式（它是什么/现在的代价/带来什么/关闭哪些门/选错后果）
- **调研已经是事实工作流**：`docs/research/` 已有 21 个文件
- **已有 memory 规则**：`feedback_research-before-recommendation.md`（列维度→源质量→审批→带 URL 建议）、`feedback_explain-research.md`（详细解释必备）
- **本次产出是「调研能力」的 skill 化**：目标是把散在 memory 里的规则结构化成 skill + 触发条件 + 模板
- **不可违反产品红线**：CLAUDE.md 里的产品不变量与 CCB 角色分工不动

---

## 调研

本次 brainstorm 自己触发了一次 meta 重度调研（"别人是怎么调研的"），调研方向：

- **D1**：Vibe coding / AI 时代的调研实践（Simon Willison、Karpathy、Claude Code 工作流、LLM 幻觉防御）
- **D2**：工程决策调研模板（ADR、RFC、Amazon 6-pager、Thoughtworks Tech Radar）
- **D3**：源质量 / AI 时代信息素养（EBM 证据金字塔、AI slop 识别、伪造引用检测）
- **D4**：轻 vs 重调研分档（Agile Spike、GV Design Sprint、Gary Klein pre-mortem）
- **D5（砍）**：提问技巧——过于通识，不查

**源质量标准**：S 级为主（人物原帖、官方文档、成熟企业工程博客、方法论原始出处）；找不到 S 允许降 A 级（2024-2026 有署名技术媒体），实在没有降 B 级（HN/Reddit 高赞 + domain expert），每条显式标级。**训练记忆 0 容忍**。

**调研深度**：深版（每维度 5+ 源，2+ 小时预算）。

**产出文件**：`docs/research/2026-04-14-how-to-research-before-decisions.md`（进行中）

---

## 已拍死的决策（不再讨论）

### 决策 0：CLAUDE.md 5 问框架的定性（2026-04-14 拍板）

5 问（它是什么/现在的代价/带来什么/关闭哪些门/选错后果）**保留**，判定为"框架有用但执行不严格"。**改进方向**：不是改框架本身，而是在新 skill 里把它明文挂钩到"Propose 2-3 approaches"那一步，强制 5 问完整回答，不再允许只答 2-3 条。

**拒绝的替代方案**：从 CLAUDE.md 移除 5 问（用户一度怀疑它是"不小心加的"）。理由：memory `feedback_explain-research` 已引用它，社区无法找到更好的非技术 CEO 沟通框架。

### 决策 1：调研分档规则（2026-04-14 拍板）

**三档分诊**：
- 🟢 **不调研**：纯代码实现选择、项目内已有答案、仅影响当前模块（易反悔）
- 🟡 **轻量调研**：满足任一即触发——单点事实核对 / ≤2 选项对比 / 决策易反悔 / 结论只服务当前决策。**不产出独立文件**，贴 URL + 1-2 行摘录在 brainstorming 对话里
- 🔴 **重度调研**：满足任一即触发——3+ 选项结构化对比 / 决策难反悔 / 跨领域专家知识 / 结论会被后续多决策引用 / 用户明确要求。**必须产出 `docs/research/YYYY-MM-DD-<topic>.md`**，走完整 [列维度→源质量→审批→查→带 URL 报告] 流程

**硬规则**：CLAUDE.md 标注"难以反悔"的决策 **默认走 🔴**，不得降级。

**轻量调研也需留痕迹**（待 Q2 决定是否)——目前倾向"留"，在 WIP 文件或 design spec 挂调研脚注区块。

### 决策 2：源质量分级标准（2026-04-14 拍板）

| 级别 | 例子 | 使用规则 |
|---|---|---|
| **S** | 人物原帖（Simon Willison、Fowler）、成熟企业工程博客（Google、Stripe、Thoughtworks）、方法论原始出处（Nygard ADR）、官方文档 | 必须优先 |
| **A** | 2024-2026 有署名技术媒体（InfoQ、LeadDev、ACM） | S 缺席时用，每条显式标 `[A 级]` |
| **B** | HN/Reddit 高赞讨论 + domain expert | S、A 都缺席时用，显式标 `[B 级 · 社区意见]` |
| **拒收** | 无日期博客、SEO 列表文、Medium 内容农场、AI 生成摘要无原始出处、**Claude 训练记忆** | 0 容忍 |

**"查不到"必须写"没查到"**，不得用训练记忆凑数。

---

## 待 brainstorm 的决策（按依赖顺序）

### 决策 3：调研能力的物理形态（2026-04-15 拍板）

**拍板结果**：新建独立 skill `research-before-decision`，brainstorming skill 内部声明触发条件（类比它现在引用 `writing-plans` 作为下一步的方式）。

**具体分工**：
- 🔴 **重度调研** → 触发独立 skill `research-before-decision`，产出 `docs/research/YYYY-MM-DD-<topic>.md`
- 🟡 **轻量调研** → 内联在 brainstorming 对话里（WebSearch/WebFetch 后贴 URL + 1-2 行摘录），不调用 skill、不产生独立文件
- 🟢 **不调研** → 无动作

**brainstorming skill 的改动**（与决策 7 协同）：在"Ask clarifying questions"和"Propose 2-3 approaches"之间新增一节 **"Research Trigger Check"**，明文声明：
- 遇到🔴 级触发条件 → **必须调用** `research-before-decision` skill，等调研完再回来
- 遇到🟡 级 → 内联 WebSearch/WebFetch，对话里贴 URL
- 遇到🟢 → 跳过

**拒绝的替代方案**：
- B 方案（只扩 brainstorming）：执行阶段遇到"要不要用 X 库"也想调研时，没有 skill 可调用，必须走 brainstorming 流程，别扭。业界 Rust RFC + ADR 并存也说明独立对象更健康。
- C 方案（两个 skill）：过度设计，轻量调研不值得独立 skill，内联更轻。

**调研支持**：
- D1.1 Simon Willison 的"探索→authoritarian"两段式 = 轻/重两档天然存在
- D4.2 Agile Spike 的"时间盒"= 重度必须走完整流程，轻度不值得
- D2.2 Rust RFC vs D2.1 ADR 的关系 = 业界成熟做法就是独立 + 分级

**可逆性**：中等。Skill 文件结构后期想改为 B 或 C，要改 brainstorming skill 引用 + 移动内容，大约 1-2 小时工作量。

### 决策 4：调研维度清单如何生成（2026-04-15 拍板）

**拍板结果**：**双模板 + 项目永久维度 + 临场补 + 调研收尾自检**。

**双模板结构**：

**模板 A·战略选型决策**（"要不要用 X / 选 A 还是 B"）——沿用 CLAUDE.md 5 问：
1. 它是什么
2. 现在的代价
3. 带来什么能力
4. 关闭哪些门
5. 选错后果

**模板 B·实施方案决策**（"怎么做不炸"）：
1. 当前状态（as-is）
2. 目标状态（to-be）
3. 迁移路径（steps + 时长）
4. 回滚方案（plan B）
5. 验证策略（怎么知道成功了）

**两套模板后强制追加**：
- **项目永久维度**：中国可达性 / 成本档位 / 是否违反 CLAUDE.md 产品不变量（可随项目演进增补，但不临场临时加）
- **Claude 临场补**：根据具体 topic 补 2-4 个项目特定维度（写入调研产物前列给用户审批）
- **调研收尾自检**：S/A/B 源分布、URL 全可开、无训练记忆混入（机械校验）

**压力测试证据**（4 个真实 topic）：
- 云部署：6 维漏"中国可达性"和"三容器支持" → 临场补是必需
- 数据库迁移：模板 A 偏虚 → 需要模板 B（实施方案）
- AI provider 选型：又出现"中国可达性" → 固化进项目永久维度
- Paywall 设计：模板 A 最契合

**拒绝的替代方案**：
- A 方案（纯固定按决策类型模板）：维护成本高，4 topic 测试显示每次都需要临场补
- B 方案（纯 LLM 临场推断）：D1.4 幻觉数据显示临场易漏维度

**调研支持**：
- D2.1 ADR "forces at play" 四维打底 = 模板化传统
- D2.2 Rust RFC 9 段式 = 业界用固定模板
- CLAUDE.md 5 问本身 = 通用模板
- D3.2 CRAAP 5 问 = 信息素养模板传统

**可逆性**：低。模板就是文件里的字，改文件即可。

### 决策 5：5 问挂钩强度（2026-04-15 拍板）

**拍板结果**：A 方案——**硬 gate**。`research-before-decision` skill 产出推荐前，必须产出完整 5 问表格，缺任一条则 skill 违规。

**唯一豁免**：允许显式写 `N/A: <原因>`（例如"单选项决策，无替代可比较"）。**不允许默默跳过**。

**核心理由（"自我监督悖论"）**：
- 软规则（B 方案）= "AI 自己判断何时跳过"——正是要约束的行为交给被约束者判断，自我矛盾
- 现有 `feedback_explain-research` memory 就是 B 方案，用了 3 天证明无效
- C 方案（条件硬 gate）依然让 Claude 判断"是该严还是该松"，没逃出悖论
- A 方案把判断外包给规则本身，Claude 只能执行 + 写 N/A 声明，不能判断要不要执行

**拒绝的替代方案**：
- B 软提醒：`feedback_explain-research` 已用了 3 天证明无效
- C 条件硬 gate：多一层判断逻辑 = 多一个绕过点

**调研支撑**：
- D2.1 ADR 原文强制"Consequences 必须列完全，包含负面"——Nygard 反对关键段留空
- D2.4 Amazon 6-pager "assume each sentence is wrong until proven otherwise"——缺一面 = 缺验证
- D3.2 CRAAP 测试 5 问同构，图书馆界不允许跳段
- D1.4 幻觉数据（14-95% 编造率）证明 AI 需要机械约束，不是软承诺

**可逆性**：低——skill 文件改段落强度即可。

### 决策 6：产出文件模板（2026-04-15 拍板）

**拍板结果**：
1. **文件名严格统一**：`docs/research/YYYY-MM-DD-<topic-slug>.md`（slug 小写英文连字符，ASCII）
2. **Frontmatter 硬要求**（缺字段 = skill 违规）：
   ```yaml
   ---
   date: YYYY-MM-DD
   topic: <中文简述>
   triage: 🔴
   template: A | B
   budget: <实际耗时 min>
   sources: { S: N, A: N, B: N }
   ---
   ```
3. **Body 灵活**：不同 topic 可用不同叙述结构（对比表 / 段落论证 / bullet）
4. **必选末段：源质量自审**（缺 = 违规）
   - S/A/B 源数量
   - URL 全部验证可开（✅/❌）
   - 幻觉自查声明（"所有数字/引用来自引用源，非训练记忆"）

**示范样本**：`docs/research/2026-04-14-how-to-research-before-decisions.md`（今天的 meta 调研就是样本），在新 skill 文档里作为 reference example 挂链接。

**存量文件处理**：已有 22 个旧文件**不强制迁移**（保留历史），只约束新文件。

**拒绝的替代方案**：
- A 全量强制模板：body 僵化，不同 topic 叙述结构天然不同
- B 纯推荐：回到现状，格式继续乱

**调研支撑**：
- D2.1 ADR：Nygard 不强制 body 格式，但强制四段必须都有——**strict structure + flexible prose** 的经典
- D2.2 Rust RFC：9 段硬要求，段内灵活
- D2.3 Thoughtworks Radar：四环硬分类，描述灵活
- 业界普遍做法就是 strict frontmatter + flexible body

**可逆性**：低——改模板就是改 skill 文件的事。

### 决策 7：所有调研都落盘成知识库（2026-04-15 拍板）

**拍板结果**：🔴 和 🟡 **都落盘**到 `docs/research/YYYY-MM-DD-<topic>.md`，统一命名，统一文件夹，方便未来复用。**🟢 不调研，无文件。**

**核心意图**（用户原话）：调研记录不只是为当前决策，**也是项目知识库**，供未来 Claude / 用户检索复用。

**🟡 轻模板**（区别于 🔴 完整模板）：
- Frontmatter：同 🔴 但 `triage: 🟡` + 额外 `scope: <单点事实 | ≤2 选项 | 易反悔 | 只服务当前决策>`
- Body 极简三段：问题（一行）/ 发现（bullet + URL + S/A/B）/ 结论（一行）
- 末段"源质量自审"**保留**（S/A/B 数 + URL 可开 + 无训练记忆声明）

**对决策 3 的副作用修订**：
- 之前写的"🟡 内联 WebSearch/WebFetch，不产物文件"→ 改为"🟡 依然在 brainstorming 对话里当场查（不走 research-before-decision skill 的长流程），但**锁决策时** brainstorming **落盘** 🟡 文件"
- 物理形态不动：skill 依然独立，主要服务 🔴；🟡 由 brainstorming 自行处理落盘

**调研支撑**：
- D3.1 EBM 金字塔：Level VI 单病例也归档，低级证据≠不记录
- D2.1 ADR："1-2 页"也是决策，照样归档
- D2.3 Thoughtworks Radar Assess 环：未成熟技术也登记便于复盘

**拒绝的替代方案**：
- A 只进 WIP：brainstorm 结束 WIP 清理后证据消失
- B 只进 spec：spec 是单次决策的产物，不构成跨项目知识库
- C 两处都进：冗余维护

**可逆性**：低——改 skill 文档即可。

### 决策 9：调研质量 = 权威加权（2026-04-15 拍板）

**拍板结果**：A 方案——**S 级判定升级为多维信号 ≥3 条**（不再是"官方文档 + 大厂博客"这种语义模糊的描述）。

**S 级 = 满足以下 ≥3 条**：
1. 持续产出 ≥5 年（博客、书、论文等）
2. 机构联属（成熟企业 Tech Lead / Chief X、高校教职、研究所）
3. 有可查的经典作品（书、开创性博客、被广泛引用的论文）
4. 被其他 S 级权威公开引用/致谢（师承链可追溯）
5. 在重大方法论事件里留名（敏捷宣言、RFC 作者、HTTP 协议等）
6. 演讲/会议 keynote 记录（OSCON、Strange Loop、ICML、QCon 等）

**B 级嫌疑信号**（遇到这些信号就从 A 降到 B）：
- 产出只在 Medium / LinkedIn post
- 没被其它 S 级作者引用
- 自称 thought leader 但无公开经典作品
- Twitter/X 粉丝多但无深度产出

**硬拒绝**（并入原决策 2 拒收清单）：
- 无日期博客、SEO 列表文、"Top 10 Best X 2025"
- Medium 内容农场、AI slop（完美语法 + 空泛 + 无具体细节）
- AI 生成摘要无原始出处
- **Claude 训练记忆**

**核心原则**：
- **不信任单一指标**（h-index、GitHub star、Twitter 粉丝、博客阅读量都可刷或已脱钩）
- **多信号交叉验证**——学术界 peer review + 工程界 Fowler/Beck 模式的共同结论
- **拒绝靠"看起来像官方"糊弄**——AI 必须能数出至少 3 条信号才能标 S

**调研支撑**（来自 `docs/research/2026-04-14-how-to-research-before-decisions.md` D3.4 节）：
- D3.4.1 h-index 与物理学奖获奖者相关性从 2010 年 34% 掉到 2019 年 0% → 单一指标失效
- D3.4.1 DORA 2013 宣言 16000+ 学者联署反对用 JIF 评价个人
- D3.4.3 学术界 peer review 的权威信号：公开出版物 + 演讲 + 同行识别 + self-decline
- D3.4.4 Fowler/Beck 5 信号：持续产出 + 机构联属 + 经典作品 + 历史事件留名 + 公开致谢师承
- D3.4.5 综合：多维评估比单一指标更可靠

**拒绝的替代方案**：
- B 方案（≥2 条即可）：门槛低，容易混进伪权威
- C 方案（用户另提）：无

**spec 写入位置**：§3.2 源质量分级（全面替换原 S 级"官方文档 + 成熟企业博客"的语义描述）

**可逆性**：低——改 skill 文档一段话即可。

---

### 决策 8：🔴 重度调研的执行模式（2026-04-15 拍板）

**拍板结果**：**每维度派一个 sub-agent 并行调研**，主 Claude 只做聚合。

**分工**：
- `research-before-decision` skill 启动后，按决策 4 生成维度清单（模板 A/B + 永久维度 + 临场补）
- 维度清单审批通过后，**每个维度派一个独立 sub-agent**（general-purpose agent），给它：
  - 维度名 + 要回答的问题
  - 源质量标准（S/A/B + 拒收清单，见决策 2）
  - 深度档位（用户选定的 2-3 / 3-5 / 5+ 源）
  - 要求返回的结构化格式（引述 + URL + 级别 + 对项目启示）
- 所有 sub-agent 并发跑
- 主 Claude 聚合成最终产出文件（按决策 6 模板），并执行决策 9 的调研质量自检

**理由**：
- 主对话上下文不被 WebSearch/WebFetch 原文挤爆（今天 meta 调研亲历，4 维 × 5 源就已经压力大，常态 10+ 维会爆）
- 并行快 N 倍
- 每个 agent 专注单维度，质量更高
- 项目已有 sub-agent 成熟经验（spec-document-reviewer、Explore）

**Sub-agent prompt 标准化**（写入 skill 文档）：
- 用"smart colleague who just walked into the room"风格（Agent 工具原生建议）
- 必带："the user is a non-technical CEO, cite URL for every claim, never use training memory, flag uncertainty explicitly"

**🟡 轻量调研不派 sub-agent**——太轻不值得启动成本，主 Claude 当场查即可。

**原决策 8（远程 agent 无人值守）**：**删除**。本次不讨论，未来有需要再开新 brainstorm。

**可逆性**：中等——改 skill 执行段落。

---

## 当前进度

- ✅ 决策 0（5 问保留 + 挂钩）
- ✅ 决策 1（三档分诊）
- ✅ 决策 2（源质量分级）
- ✅ Meta 调研 D1-D4 完成（`docs/research/2026-04-14-how-to-research-before-decisions.md`）
- ✅ 决策 3（独立 skill + brainstorming 内置触发条件）
- ✅ 决策 4（双模板 + 项目永久维度 + 临场补 + 调研收尾自检）
- ✅ BS-1（brainstorming skill 改动：spec 增量写）
- ✅ 决策 5（硬 gate + 允许写 N/A）
- ✅ 决策 6（文件名严格 + frontmatter 严格 + body 灵活 + 自审强制）
- ✅ 决策 7（🟡🔴 都落盘知识库 + 🟡 轻模板 + 决策 3 副作用修订）
- ✅ 决策 8（每维度派 sub-agent + 原远程 agent 决策删除）
- ✅ 决策 9（调研质量 = S 级多维信号 ≥3 条 + B 级嫌疑信号 + 硬拒绝合并）
- 🔄 下一步：brainstorm 收尾——spec 完整性自查 → spec-document-reviewer → 用户审阅 → writing-plans

---

## 额外待办：brainstorming skill 独立改动清单

这些不是"调研能力"的决策，但本次 brainstorm 过程中发现 brainstorming skill 本身需要改，一并在最终 spec 里体现：

### BS-1：spec 增量写（2026-04-15 用户拍板，无异议）

**问题**：目前 brainstorming skill **步骤 7** "Write design doc" 是最后一步批量。brainstorm 中途 compact 或中断 → 只有 WIP 留着，spec 永远不存在。（注：**步骤 6** 已有"每决策锁定后更新 WIP"规则，WIP 不会丢，但 spec 会。）

**改动**：每拍死一个决策 → 立刻追加到 spec 文件。WIP 文件地位相应降低，只保留"决策 trail + 还没拍的议题 + 额外待办"。

**实施影响**：
- brainstorming skill **步骤 7** 拆成：**7a** "初始化 spec 文件骨架"（步骤 2 决定开 brainstorm 时即建，不等到步骤 7）、**7b** "每决策锁定后追加到 spec"（挂在现有步骤 6 的 lock 点上，与 WIP 更新同步执行）、**7c** "最终 spec 完整性检查"（brainstorm 结束前过一遍）
- 步骤 8（spec 审查）及之后不变
- WIP 文件协议不变，但文档里要说明"spec 和 WIP 是双写不是二选一"

---

## 最终产出

Brainstorm 完成后：
1. 写正式 design spec 到 `docs/superpowers/specs/2026-04-14-research-capability-design.md`
2. 按 spec 创建/修改 skill 文件（research-before-decision skill + 更新 brainstorming skill）
3. 更新 CLAUDE.md 里的 skill 清单
4. 本 WIP 文件保留（作为决策留痕），不删
5. 移除 MEMORY.md 的 brainstorm 指针

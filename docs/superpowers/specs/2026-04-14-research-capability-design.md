---
date: 2026-04-14
topic: 调研能力Skill设计
type: spec
status: resolved
keywords: [research, skill, authority-weighting, brainstorming, sub-agent]
---

# Research Capability Skill — Design Spec

**创建日期**: 2026-04-14（brainstorm 启动）
**最后更新**: 2026-04-15
**状态**: 进行中——按 BS-1 规则每拍死一个决策即追加；见 WIP `2026-04-14-research-capability-brainstorm-state.md`
**调研依据**: `docs/research/2026-04-14-how-to-research-before-decisions.md`
**主责**: Claude（PM + 架构师）；此 spec 改动范围仅限 `.claude/skills/**`、`CLAUDE.md`、`docs/**`

---

## 1. 目标与范围

### 1.1 要解决的问题

用户（非技术 CEO）要求：做关键决策时，Claude 不得依赖训练记忆，必须引用可验证的、时效新的、领域权威的外部源。现有机制（memory 里的 `feedback_research-before-recommendation`）依赖 Claude"想起来"执行，不可靠；云部署 brainstorm 期间已出现过"凭训练记忆编造 Google Vision 定价"的事故。

### 1.2 解决方式（高层）

把调研能力 **skill 化**：新建 `research-before-decision` skill + 改造 `brainstorming` skill 让它按触发条件主动调用新 skill。

### 1.3 非目标

- 不取代 `writing-plans` / `executing-plans` / `frontend-design` 等既有 skill
- 不影响 CCB 多模型协作协议
- 不触及产品不变量（CLAUDE.md 红线）
- 不实现远程 agent 无人值守调研（原计划的决策 8 已删除，未来有需要再开新 brainstorm；本次决策 8 指的是 **sub-agent 并行执行**，见 §4.6）

---

## 2. 待改动清单（engineering units）

| 对象 | 动作 | 说明 |
|---|---|---|
| `.claude/skills/research-before-decision/SKILL.md` | **新建** | 本 spec 的核心产物 |
| `.claude/skills/brainstorming/SKILL.md` | **修改** | 加 Research Trigger Check 节 + BS-1（spec 增量写）规则 |
| `CLAUDE.md` | **修改** | skill 清单新增 research-before-decision；5 问挂钩（硬 gate，见 §4.5） |
| `docs/decisions.md` | **本次不动** | ADR 格式迁移本次不在范围，保留现状 |
| MEMORY.md | **修改** | brainstorm 完成后移除 WIP 指针；**默认把 `feedback_research-before-recommendation` 压缩为一行指向新 skill 的指针**（保留 "Why" 段落作为历史事故记录，避免两处真相源漂移），T4 任务里如有反对证据再议 |

---

## 3. 触发机制（共享常量，跨多个 skill 引用）

### 3.1 三档分诊规则（决策 1）

| 档 | 触发条件（满足任一） | 动作 |
|---|---|---|
| 🟢 不调研 | 纯代码实现选择 / 项目内已有答案 / 仅影响当前模块（易反悔） | 直接决定 |
| 🟡 轻量调研 | 单点事实核对 / ≤2 选项 / 决策易反悔 / 结论只服务当前决策 | 在 brainstorming 对话里当场 WebSearch/WebFetch，**锁决策时落盘到 `docs/research/` 轻模板**（见 §4.4）；不走 `research-before-decision` skill 完整流程 |
| 🔴 重度调研 | 3+ 选项对比 / 决策难反悔 / 跨领域专家知识 / 结论会被后续多决策引用 / 用户明确要求 | **调用 `research-before-decision` skill**，产出 `docs/research/YYYY-MM-DD-<topic>.md` |

**硬规则**：CLAUDE.md 标注"难以反悔"的决策 **默认走 🔴**，不得降级。

**调研支持**：Bezos Type 1/2 决策框架（1997）+ Agile Spike 时间盒原则 + GV Design Sprint 20% 时间占比。

### 3.2 源质量分级（决策 2 + 决策 9 升级）

**核心原则**：不信任单一指标（h-index、GitHub star、Twitter 粉丝、博客阅读量都可刷或已脱钩）。必须多信号交叉验证。

#### S 级判定 = 满足以下 **≥3 条**（决策 9 升级）

1. **持续产出 ≥5 年**（博客、书、论文等）
2. **机构联属**（成熟企业 Tech Lead / Chief X、高校教职、研究所）
3. **有可查的经典作品**（书、开创性博客、被广泛引用的论文）
4. **被其他 S 级权威公开引用/致谢**（师承链可追溯）
5. **在重大方法论事件里留名**（敏捷宣言、RFC 作者、HTTP 协议等）
6. **演讲/会议 keynote 记录**（OSCON、Strange Loop、ICML、QCon 等）

**S 级典型例子**：Simon Willison、Martin Fowler、Kent Beck、Andrej Karpathy、Michael Nygard（ADR 原作者）；成熟企业工程博客（Thoughtworks、Google、Stripe、Anthropic）、方法论原始出处、同行评议论文、官方文档。

#### A 级 = 不满足 S 的 ≥3 条，但来自有署名且有可查背景的技术产出

- 2024-2026 有署名技术媒体（InfoQ、LeadDev、ACM、Nature 等）
- 实名工程师会议演讲（但不到 keynote 级别）
- 单机构工程博客不满足 S 级门槛的

**使用规则**：S 缺席时用，每条显式标 `[A]`。

#### B 级 = 社区意见，仅作参考

- HN / Reddit 高赞讨论 + domain expert 留言
- GitHub Issue 讨论里的 maintainer 回复（若 maintainer 未达 S 级）

**使用规则**：S、A 都缺席时才用，显式标 `[B · 社区意见]`。

#### B 级嫌疑信号（遇到以下信号则从 A 降到 B）

- 产出只在 Medium / LinkedIn post
- 没被其它 S 级作者引用
- 自称 "thought leader" 但无公开经典作品
- Twitter/X 粉丝多但无深度产出

#### 硬拒绝（0 容忍，违规 = skill 违规）

- 无日期博客、SEO 列表文、"Top 10 Best X 2025"
- Medium 内容农场、AI slop（完美语法 + 空泛 + 无具体细节）
- AI 生成摘要无原始出处
- **Claude 训练记忆**

**查不到必须写"没查到"**，不得凭训练记忆凑数。

**调研支持**：
- EBM 证据金字塔（医学界 50 年沉淀）+ CRAAP 测试（图书馆界）+ Kagi SlopStop（2025 AI slop 识别）
- DORA 宣言 2013（16000+ 学者联署反对 JIF）+ h-index 与物理学奖 2019 年相关性 0%（单一指标失效）
- 学术界 peer review + 工程界 Fowler/Beck 模式（多信号交叉验证）

---

## 4. `research-before-decision` skill 规格

### 4.1 入口

被 `brainstorming` skill 的 "Research Trigger Check" 节调用，或在其它阶段（如 `executing-plans` 遇到"要不要用 X 库"）由当前 skill 主动调用。

### 4.2 运行步骤

1. **判断档位**：按 §3.1 确认是🔴（否则不该被调用到）
2. **选模板**（决策 4）：
   - 模板 A·战略选型决策（"要不要用 X / 选 A 还是 B"）→ CLAUDE.md 5 问
   - 模板 B·实施方案决策（"怎么做不炸"）→ as-is / to-be / migration / rollback / validation
3. **追加项目永久维度**：中国可达性 / 成本档位 / CLAUDE.md 产品不变量是否违反
4. **Claude 临场补 2-4 个项目特定维度**，列出来请用户审批
5. **确认源质量标准**：默认按 §3.2 S 级优先、允许降级显式标级
6. **执行调研**：**每维度派一个 sub-agent 并行跑**（见 §4.6 决策 8），主 Claude 只做聚合。🟡 轻量调研不派 sub-agent，主 Claude 当场查。
7. **产出文件**：`docs/research/YYYY-MM-DD-<topic>.md`，结构见 §4.4
8. **调研收尾自检**：S/A/B 源分布统计 + URL 逐个验证可打开 + 幻觉自查（"每个数字都来自引用源，非训练记忆"）
9. **5 问硬 gate 自检**（决策 5，详见 §4.5）：必须产出完整 5 问表格（模板 A）或完整 5 段（模板 B），缺任一条 = skill 违规，仅允许显式 `N/A: <原因>`。未通过则返回步骤 6/7 补齐，不得进入步骤 10。
10. **返回 brainstorming**（或调用方）继续后续决策

### 4.3 模板详细

**模板 A（战略选型）**：
1. 它是什么
2. 现在的代价
3. 带来什么
4. 关闭哪些门
5. 选错后果

**模板 B（实施方案）**：
1. 当前状态（as-is）
2. 目标状态（to-be）
3. 迁移路径（steps + 时长）
4. 回滚方案（plan B）
5. 验证策略（怎么知道成功了）

**项目永久维度**（每次强制追加）：
- 中国可达性
- 成本档位（MVP 阶段烧钱敏感）
- 是否违反 CLAUDE.md 产品不变量

**临场补**：2-4 条，Claude 根据 topic 推断，需用户审批后才开工。

**调研支持**：测试 4 个真实 topic（云部署 / DB 迁移 / AI provider / paywall），证实"6 维覆盖战略层，漏项目特定维度"，必须双模板 + 项目永久维度 + 临场补。

### 4.4 产出文件模板（决策 6 拍板）

**文件名硬规则**：`docs/research/YYYY-MM-DD-<topic-slug>.md`，slug 小写英文连字符、ASCII-only。

**Frontmatter 硬字段**（缺则 skill 违规）：
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

**Body 灵活**：不同 topic 可用对比表 / 段落论证 / bullet，不强制结构。

**必选末段：源质量自审**（缺则违规）：
- S/A/B 源数量统计
- URL 全部验证可打开（✅/❌）
- 幻觉自查声明："所有数字/引用来自引用源，非训练记忆"

**参考样本**：`docs/research/2026-04-14-how-to-research-before-decisions.md`——skill 文档里作为 reference example 挂链接。

**存量文件**：已有 22 个文件（含本次 meta 调研）**不强制迁移**（保留历史），只约束新文件。

### 4.4.a 🟡 轻模板（决策 7）

🟡 轻量调研也产出文件，但用简化模板：

```yaml
---
date: YYYY-MM-DD
topic: <中文简述>
triage: 🟡
scope: <单点事实 | ≤2 选项 | 易反悔 | 只服务当前决策>
budget: <实际耗时 min，通常 10-20>
sources: { S: N, A: N, B: N }
---
```

**Body 极简三段**：
- **问题**（一行陈述）
- **发现**（bullet：摘录 + [URL] + [S/A/B]）
- **结论**（一行，对当前决策的影响）

**源质量自审末段保留**（S/A/B 数、URL 可开、无训练记忆声明）。

**意图**：`docs/research/` 是项目知识库，所有查询都归档便于未来复用，不只是当前决策的一次性工具。`grep triage: 🔴 docs/research/*.md` 可一键筛出所有重调研。

### 4.5 5 问挂钩强度（决策 5 拍板）

**硬 gate**：skill 产出"推荐"之前，必须完整产出 5 问表格。缺任一条（例如"关闭哪些门"为空）= skill 违规。

**唯一豁免**：允许显式写 `N/A: <原因>`（例如"单选项决策，无替代可比较"）。不允许默默跳过。

**理由（简版）**：软规则让 AI 自己判断何时跳过 = 自我监督悖论；现有 `feedback_explain-research` 就是软规则，已用 3 天证明无效。硬 gate 把判断外包给规则本身，Claude 只能执行或显式声明 N/A，不能判断要不要执行。

**写入位置**：`research-before-decision` skill §4.2 **步骤 9**（§4.2 已新增），位于"调研收尾自检"（步骤 8）之后、"返回调用方"（步骤 10）之前的 pre-check gate。

### 4.6 🔴 执行模式：每维度派 sub-agent 并行（决策 8）

**拍板结果**：🔴 重度调研启动后，按决策 4 生成的维度清单（模板 A/B + 项目永久维度 + 临场补），**每个维度派一个独立 sub-agent** 并行调研，主 Claude 只做聚合。

**Sub-agent 派发标准**：
- 类型：`general-purpose`（项目已有成熟经验：spec-document-reviewer、Explore）
- 每个 agent 的 prompt 必须包含：
  1. **维度名 + 要回答的具体问题**
  2. **源质量标准**：完整复述 §3.2（S 级 ≥3 条信号 / A / B / 硬拒绝）
  3. **深度档位**：用户选定的 2-3 / 3-5 / 5+ 源
  4. **结构化返回格式**：每条发现必须含【引述 + URL + 级别 (S/A/B) + 对项目启示】
  5. **固定约束**：非技术 CEO、每个数字带 URL、禁用训练记忆、不确定要明说

**Prompt 风格**：按 Agent 工具原生建议的 "smart colleague who just walked into the room"——自包含、给足背景、有判断力。

**并行与聚合**：
- 所有 sub-agent **同一条 message 并发派发**（多 Agent 工具调用）
- 主 Claude 收齐所有返回后执行 §4.4 的 frontmatter + body + §4.4 末段源质量自审
- 主 Claude 执行 §4.5 的 5 问硬 gate 自检

**🟡 轻量调研不派 sub-agent**：启动成本高于调研本身价值，主 Claude 当场 WebSearch/WebFetch 即可。

**理由**：
- 主对话上下文不被 WebSearch/WebFetch 原文挤爆（本次 meta 调研 4 维 × 5 源已感压力，常态 10+ 维会爆）
- 并行节省 wall-clock 时间
- 每个 agent 专注单维度，深度更高

**调研支撑**：项目已有 sub-agent 基础设施（Explore / spec-document-reviewer 模式）；Agent 工具原生 prompt 规范。

**可逆性**：中等——skill 文件改执行段落即可。

---

## 5. `brainstorming` skill 改动

### 5.1 新增节：Research Trigger Check（决策 3）

在既有流程的 "Ask clarifying questions" 和 "Propose 2-3 approaches" 之间插入。

**行为**：
- 按 §3.1 判断当前待决议题的档位
- 🔴 → **调用** `research-before-decision` skill，等其产出后再回到 brainstorming 继续
- 🟡 → 内联 WebSearch/WebFetch，对话里贴 URL + 摘录
- 🟢 → 跳过

### 5.2 BS-1：spec 增量写（本次 brainstorm 发现的独立改动）

**问题**：现有 brainstorming skill 步骤 **7 "Write design doc"** 是最后一步批量；brainstorm 中途 compact 或中断 → spec 永远不存在。（注：现有步骤 6 "Present design and lock decisions" 已经包含"每决策锁定后更新 WIP"规则，WIP 不会丢，但 spec 会。）

**改动**：
- **步骤 7 拆成 7a / 7b / 7c**：
  - **7a（spec 骨架初始化）**：在步骤 2 决定开 brainstorm 后，**立刻**建 spec 文件骨架（engineering units 分节，如数据模型 / API / UI / 测试），不是等到步骤 7 才建
  - **7b（每决策追加）**：挂在现有步骤 6 的"locked decisions"触发点——每拍死一个决策，在更新 WIP 的**同时**，把"决策 → 对应 engineering unit"追加到 spec。WIP 记 rationale + 决策 trail，spec 记 engineering 交付物，**双写不是二选一**
  - **7c（最终完整性检查）**：步骤 7 的收尾——通读 spec，确认每个 WIP 决策都有对应 spec 段落、无"待定"残留、cross-ref 全部解析
- **步骤 8（spec 审查）和之后不变**

### 5.3 🟡 轻量调研落盘（决策 7）

brainstorming 在 Research Trigger Check 判定 🟡 后，在对话里当场查（WebSearch/WebFetch），但**锁决策时必须落盘**到 `docs/research/` 轻模板文件（见 §4.4.a）。不走 `research-before-decision` skill 的完整长流程（列维度 → 审批 → 执行），因为 🟡 不需要那种重度结构；但落盘这件事跑不掉。

**意图**：把调研当项目知识资产，不是单次决策的一次性工具。

---

## 6. CLAUDE.md 改动

### 6.1 5 问保留（决策 0）

判定为"框架有用但执行不严格"，**保留不改**，改进方向是在 `research-before-decision` skill 里强制挂钩。调研支持：CRAAP 5 问 + ADR Consequences + pre-mortem 三大独立权威体系对照。

### 6.2 Skill 使用节

"Skill 使用"段新增 `research-before-decision` skill 介绍（一行描述 + 触发条件）。

### 6.3 5 问挂钩强度

已在 §4.5 拍板为硬 gate。CLAUDE.md 的 5 问段落**不改文字**，只在"Skill 使用"节增加一行指向 `research-before-decision` skill 是硬 gate 执行方。

---

## 7. 远程 agent 无人值守调研（本次不做）

原计划决策 8 拟讨论的"远程 agent 无人值守调研"**本次删除**，不纳入本 spec。理由：Karpathy 2025 年公开推崇 local agent；D1.4 幻觉数据指向"人工 + best-of-N 二次验证"必须存在，无人值守风险过高。本次的决策 8 改为聚焦 **sub-agent 并行执行**（见 §4.6）。未来若有需要做无人值守调研，另开 brainstorm。

---

## 8. 实施计划（等 brainstorm 结束后进 writing-plans）

占位。brainstorm 完成后由 `writing-plans` skill 生成 task-level 计划，预计 tasks：
- T1: 写 `.claude/skills/research-before-decision/SKILL.md`（含 §4.1-§4.6 全部规格 + sub-agent prompt 模板）
- T2: 改 `.claude/skills/brainstorming/SKILL.md`（加 §5.1 Research Trigger Check + §5.2 BS-1 增量 spec + §5.3 🟡 落盘）
- T3: 更新 `CLAUDE.md`（Skill 使用节新增 research-before-decision 介绍 + 硬 gate 指向）
- T4: 更新 MEMORY.md（移除 brainstorm WIP 指针；评估 `feedback_research-before-recommendation` 是否合并为 skill 引用）
- T5: spec 自审（本任务已做）+ spec-document-reviewer 子代理审 + 用户 review

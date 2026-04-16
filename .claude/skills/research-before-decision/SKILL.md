---
name: research-before-decision
description: "You MUST use this before recommending any 🔴 tier decision (3+ options / hard to reverse / cross-domain expert knowledge / referenced by multiple downstream decisions / user explicitly requests). Executes multi-dimensional research with authority-weighted source quality grading, dispatches one sub-agent per dimension, produces a durable knowledge-base file at docs/research/YYYY-MM-DD-<topic>.md, and enforces the CLAUDE.md 5-question hard gate before returning."
---

# Research Before Decision

做关键决策前的结构化调研 skill。核心约束：**不允许用训练记忆凑数**，每个数字/引用必须带 URL，源质量按 S/A/B 多信号加权，5 问表格硬 gate。

参考样例：`docs/research/2026-04-14-how-to-research-before-decisions.md` 是本 skill 诞生的 meta 调研，也是输出格式的参考范本。

---

## When to Use (Triage)

| 档 | 触发条件（满足任一） | 动作 |
|---|---|---|
| 🟢 不调研 | 纯代码实现选择 / 项目内已有答案 / 仅影响当前模块（易反悔） | 直接决定，**不调用本 skill** |
| 🟡 轻量调研 | 单点事实核对 / ≤2 选项 / 决策易反悔 / 结论只服务当前决策 | 调用方（通常是 brainstorming）当场 WebSearch/WebFetch 并落 🟡 轻模板文件，**不调用本 skill** 长流程 |
| 🔴 重度调研 | 3+ 选项对比 / 决策难反悔 / 跨领域专家知识 / 结论会被后续多决策引用 / 用户明确要求 | **必须调用本 skill** 完整 10 步 |

<HARD-GATE>
CLAUDE.md 标注"难以反悔"的决策**默认走 🔴**，不得降级。
</HARD-GATE>

---

## Source Quality Standard (S/A/B + 硬拒绝)

**核心原则**：不信任单一指标（h-index、GitHub star、Twitter 粉丝、博客阅读量都可刷或已脱钩）。必须多信号交叉验证。

### S 级 = 满足以下 ≥3 条

1. 持续产出 ≥5 年（博客、书、论文等）
2. 机构联属（成熟企业 Tech Lead / Chief X、高校教职、研究所）
3. 有可查的经典作品（书、开创性博客、被广泛引用的论文）
4. 被其他 S 级权威公开引用/致谢（师承链可追溯）
5. 在重大方法论事件里留名（敏捷宣言、RFC 作者、HTTP 协议等）
6. 演讲/会议 keynote 记录（OSCON、Strange Loop、ICML、QCon 等）

**S 级典型**：Simon Willison、Martin Fowler、Kent Beck、Andrej Karpathy、Michael Nygard；Thoughtworks / Google / Stripe / Anthropic 官方工程博客；方法论原始出处；同行评议论文；官方文档。

### A 级 = 不满足 S 的 ≥3 条但来自署名且有可查背景的技术产出

- 2024-2026 有署名技术媒体（InfoQ、LeadDev、ACM、Nature）
- 实名工程师会议演讲（未到 keynote 级别）
- 单机构工程博客不满足 S 级门槛的

**使用规则**：S 缺席才用，显式标 `[A]`。

### B 级 = 社区意见

- HN / Reddit 高赞讨论 + domain expert 留言
- GitHub Issue 讨论里的 maintainer 回复（若 maintainer 未达 S 级）

**使用规则**：S、A 都缺席才用，显式标 `[B · 社区意见]`。

**B 级嫌疑信号**（遇到以下任一则从 A 降到 B）：
- 产出只在 Medium / LinkedIn post
- 没被其它 S 级作者引用
- 自称 "thought leader" 但无公开经典作品
- Twitter/X 粉丝多但无深度产出

### 硬拒绝（0 容忍，违规 = skill 违规）

- 无日期博客、SEO 列表文、"Top 10 Best X 2025"
- Medium 内容农场、AI slop（完美语法 + 空泛 + 无具体细节）
- AI 生成摘要无原始出处
- **Claude 训练记忆**

**查不到必须写"没查到"**，不得凭训练记忆凑数。

---

## Run Sequence（10 步）

1. **判断档位**：确认当前议题确实是 🔴（否则返回调用方，让它走轻量路径）
2. **选模板**：
   - **模板 A · 战略选型决策**（"要不要用 X / 选 A 还是 B"）：1. 它是什么 / 2. 现在的代价 / 3. 带来什么能力 / 4. 关闭哪些门 / 5. 选错后果
   - **模板 B · 实施方案决策**（"怎么做不炸"）：1. 当前状态 as-is / 2. 目标状态 to-be / 3. 迁移路径 / 4. 回滚方案 / 5. 验证策略
3. **追加项目永久维度**（每次强制）：中国可达性 / 成本档位（MVP 烧钱敏感）/ 是否违反 CLAUDE.md 产品不变量
4. **Claude 临场补 2-4 个项目特定维度**，列给用户审批后才动
5. **确认源质量档位**：默认 §Source Quality Standard 的 S 级优先、允许降级显式标级
6. **执行调研**：**每维度派一个 general-purpose sub-agent 并行跑**（见下方 Sub-Agent Dispatch），主 Claude 只做聚合。🟡 不进这一步
7. **产出文件**：`docs/research/YYYY-MM-DD-<topic-slug>.md`（slug 小写英文连字符、ASCII-only），结构见 §Output File Format
7.1. **更新 INDEX**：更新 `docs/research/INDEX.md`，按主题分组追加一行：`- [YYYY-MM-DD] <topic> \`[kw1, kw2]\` <triage 图标> → [link](<filename>)`
8. **调研收尾自检**：S/A/B 源分布统计 + URL 逐个验证可打开 + 幻觉自查声明
9. **5 问硬 gate 自检**：必须产出完整 5 问表格（模板 A）或完整 5 段（模板 B），缺任一条 = skill 违规，仅允许显式 `N/A: <原因>`。未通过返回步骤 6/7 补齐，不得进入步骤 10
10. **返回调用方**

---

## Sub-Agent Dispatch（步骤 6 细节）

🔴 重度调研启动后，维度清单审批通过时，**每个维度派一个独立 general-purpose sub-agent 并发执行**。

**为什么用 sub-agent**：
- 主对话上下文不被 WebSearch/WebFetch 原文挤爆
- 并行节省 wall-clock 时间
- 每个 agent 专注单维度，深度更高

**Sub-agent prompt 必须包含**（"smart colleague who just walked into the room"风格）：

1. **维度名 + 要回答的具体问题**（给足 topic 背景，不能让 agent 自己猜）
2. **完整源质量标准**（把 §Source Quality Standard 的 S/A/B + 硬拒绝清单整段贴进 prompt）
3. **深度档位**：用户选定的 2-3 / 3-5 / 5+ 源
4. **结构化返回格式**：每条发现必须含【引述 + URL + 级别 (S/A/B) + 对项目启示】
5. **固定约束**：`the user is a non-technical CEO; cite URL for every claim; never use training memory; flag uncertainty explicitly as "没查到"; do NOT fabricate`

**Prompt 模板示例**（按需替换 `{...}` 字段）：

```
Task tool (general-purpose):
  description: "Research dimension: {dimension_name}"
  prompt: |
    You are researching one dimension of a project decision.

    ## Topic Context
    {topic — 1-3 sentences giving the decision background}

    ## Your Dimension
    {dimension_name} — {question to answer}

    ## Source Quality Standard (mandatory)
    {Paste §Source Quality Standard S/A/B + hard-reject list here verbatim}

    ## Depth
    Return {N} sources minimum, {M} maximum. Prefer S-tier; only drop to A if S is absent; only drop to B if both are absent. Label every source explicitly.

    ## Output Format
    For each finding:
    - **Claim**: <one-sentence finding>
    - **Quote**: <direct quote from source, ≤40 words>
    - **URL**: <link — must be openable, 2024-2026 preferred>
    - **Tier**: [S | A | B · reason]
    - **Project implication**: <how this affects the current decision>

    ## Fixed Constraints
    - The user is a non-technical CEO; no jargon-dump, use life analogies
    - Every number / named entity MUST have a URL
    - If you cannot find a source, write "没查到: <what was searched>" — DO NOT fabricate from training memory
    - If uncertain, flag explicitly ("uncertain: ...")
```

**并行派发**：所有 sub-agent 放在 ONE message 的多个 Agent 工具调用里，而不是串行。

**聚合**：主 Claude 收齐所有返回后，按 §Output File Format 整合成单一文件；执行步骤 8（源质量自审）和步骤 9（5 问硬 gate）。

---

## Output File Format（步骤 7）

### 🔴 重度模板

**文件名**：`docs/research/YYYY-MM-DD-<topic-slug>.md`（slug 小写英文连字符、ASCII-only）

**Frontmatter 硬字段**（缺则违规）：

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

**必选末段 · 源质量自审**（缺则违规）：
- S/A/B 源数量统计
- URL 全部验证可打开 (✅/❌)
- 幻觉自查声明："所有数字/引用来自引用源，非训练记忆"

### 🟡 轻模板（调用方自行落盘，不走本 skill 长流程）

**Frontmatter**：

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

**源质量自审末段保留**。

---

## 5-Question Hard Gate（步骤 9）

**硬 gate**：步骤 9 在返回调用方前执行。必须产出完整 5 问表格（模板 A）或完整 5 段（模板 B），缺任一条 = skill 违规。

**唯一豁免**：允许显式写 `N/A: <原因>`（例如"单选项决策，无替代可比较"）。不允许默默跳过。

**理由**：软规则让 AI 自己判断何时跳过 = 自我监督悖论。硬 gate 把判断外包给规则本身，Claude 只能执行或显式声明 N/A。

---

## Reference Example

`docs/research/2026-04-14-how-to-research-before-decisions.md` —— 本 skill 诞生的 meta 调研。D1-D5 覆盖 Vibe coding / 工程决策模板 / 源质量 / 分档框架 / 权威识别，22 个 S 级源 + 10 个 A 级源，末段有完整源质量自审。**新调研产出时可照此格式写**。

存量 `docs/research/` 下 21 个旧文件（早于本 skill 创建）**不强制迁移**，只约束新产出。

---

## Chain Position

被动触发：本 skill 只由其他 skill（主要是 `brainstorming`，也可以是 `executing-plans` 等）在判定为 🔴 档时显式调用。**自己不主动启动**。

返回调用方后由调用方继续后续流程。

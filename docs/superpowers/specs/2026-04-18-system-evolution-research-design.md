# 系统进化机制调研 Design

**创建日期**: 2026-04-18
**状态**: WIP（brainstorm 进行中，决策锁定后增量写入）
**关联 WIP**: `docs/superpowers/specs/2026-04-18-system-evolution-research-brainstorm-state.md`

---

## 背景

**研究对象**：Claude + CCB + skills + memory 协作系统本身的进化机制
**研究问题**：市面上有没有更好的方式根据日常事件进化我们的系统？
**维度**：A 记忆 / B 技能 / C 事件捕获 / D 工作流 / E 自我诊断（5 维全要）
**Research 档位**：🔴

---

## 调研源清单

锁定 8 源，两档。

### Tier 1 · 深扫（结构同构，必读代码/文档）

| # | 源 | 身份 | 主要覆盖维度 |
|---|----|------|-------------|
| 1 | [hermes-agent](https://github.com/NousResearch/hermes-agent.git) | Nous Research 开源 agent 框架 | 全维 |
| 2 | Anthropic 官方：[claude-code](https://github.com/anthropics/claude-code) + `claude-agent-sdk`（位于 [anthropics](https://github.com/anthropics) org，sub-agent 自查 Python / TypeScript 具体 repo 名） | 我们的上游范式 | 全维 |
| 3 | Letta（前 MemGPT） | 长期记忆分层 SOTA，论文 + 实现 | A 记忆 |
| 4 | Cline + Continue | VSCode 世界对标；memory bank / .clinerules | A 记忆 / B 技能 |
| 5 | Superpowers skills framework by Jesse Vincent (obra) — sub-agent 在 GitHub 以 "superpowers claude skills obra" 定位仓库（**非**本地 `.superpowers/` HTML 残留） | 我们当前 brainstorming / writing-plans / TDD / systematic-debugging 等 skills 的源头 | B 技能 |

### Tier 2 · 专项扫（针对特定维度）

| # | 源 | 主要覆盖维度 |
|---|----|-------------|
| 6 | OpenDevin / OpenHands | E 自我诊断（verification loop） |
| 7 | Aider | C 事件捕获（repo-map = 环境事件→上下文信号） |
| 8 | Devin / Cognition 官方 blogs | 架构框架（long-horizon agent 战略发声） |

**被否决**：Cursor rules 生态（缺架构）/ SWE-agent 论文（落地弱）/ AutoGen-CrewAI（对比 CCB 边际价值低）/ BabyAGI-AutoGPT（过时）。

**澄清**：本地 `.superpowers/` 目录是 brainstorming visual companion 残留 HTML，不是框架安装——#5 指上游 Superpowers skills repo。

---

## 调研问题（按维度）

### A. 记忆沉淀

**必答**：
1. 结构：扁平 / 分层（工作记忆+长期记忆）/ 图谱实体？
2. 写入触发：显式用户请求 / Claude 自判 / 事件驱动 / 持续捕获？
3. 检索方式：全量 load / 语义召回 / relevance filter / embedding-based？
4. 衰减：过期 / 使用频次权重 / 手动修剪 / 不衰减？
5. 冲突更新：覆盖 / 版本化 / 合并 / 人工审查？
6. 用户控制面：edit API / 拒存 / undo / audit log？

**加分**：跨 session / 跨项目共享；多人/多租户隔离；token 成本模型。

### B. 技能系统演化

**必答**：
1. 创作路径：人工写 / 模板 + LLM 生成 / 用户描述→生成？
2. 触发：runtime 描述匹配 / 预载 / slash-only？
3. 演化：版本化 / 热重载 / A-B 灰度 / 用户 override？
4. 组合：chain / DAG / 嵌套 / 事件驱动？
5. 失效处理：静默 fallback / 显式错误 / 推荐替代？

**加分**：marketplace；私有 vs 团队共享；配额 / 性能监控。

### C. 事件捕获 / 信号挖掘

**必答**：
1. 事件分类：git commit / 对话轮 / tool call / 错误 / 用户纠错 / 用户认可？
2. 采集机制：hook 边界 / agent 层 middleware / 事后扫日志？
3. 信号提取：聚类 / 频率 / 模式挖掘 / LLM 总结？
4. 闭环：信号→记忆 / 信号→skill 更新 / 信号→prompt 调整？

**加分**：实时 vs 批；隐私边界（什么该被捕获）；人工 review 节点。

### D. 工作流进化

**必答**：
1. 拓扑：单 agent / 主从 / 对等 / 动态？
2. 派发：手动 / 规则 / AI 决策？
3. Review loop：触发点 / 深度 / 防死循环机制？
4. 失败恢复：retry / 回退 / 升级 / human-fallback？

**加分**：预算（token/time）控制；并行度管理；human-in-loop 节点设计。

### E. 自我诊断

**必答**：
1. 信号源：使用频次 / 失败率 / override 率 / 上下文膨胀？
2. 触发：周期 / 阈值 / 用户请求 / 持续监控？
3. 行动化：自动修 / 建议人工 / 丢 journal / 告警？
4. 假阳/假阴风险管理？

**加分**：基准线指标；回归/对比实验；"系统健康"定义。

---

## 质量门槛（S/A/B 源定义）

**基准线**：全量沿用 `.claude/skills/research-before-decision/SKILL.md` §Source Quality Standard——S/A/B 多信号加权，反对单指标；硬拒绝包括 Medium 农场、SEO 列表、AI slop、Claude 训练记忆。

### S/A/B 判定（摘要）

- **S 级**：≥3/6 信号满足——5 年持续产出 / 机构联属 / 经典作品 / 被其它 S 级引用 / 方法论事件留名 / 会议 keynote
- **A 级**：2024-2026 署名技术媒体 / 实名工程师演讲 / 单机构工程博客未达 S 门槛者
- **B 级**：HN/Reddit 高赞 + 专家留言 / maintainer GitHub Issue 回复
- **硬拒绝**：无日期博客、SEO 列表、Medium 内容农场、AI slop、Claude 训练记忆

### 本次研究领域特定补充（3 条）

1. **官方 repo 源码升格 S 级**：本次调研的 8 个目标系统（hermes-agent / Letta / Cline / OpenDevin / Aider / Superpowers 等）的 GitHub 源码 + 官方 README 算 S 级，即使仓库年龄 <5 年。
   - 理由：skill 的"持续产出 ≥5 年"信号在新兴 agent 领域会过度惩罚——这个领域整体从 2023 Q4 才起步。

2. **2024-2026 强优先**：agent 系统从 2023 Q4 Claude/GPT-4 时代才成形。2023 之前的范式（BabyAGI / AutoGPT 原版）结论必须标 `[dated]` 或"历史语境"。

3. **Paper vs 实现分离引证**：同一系统的学术论文（S · 同行评议）和工程实现（S · 官方代码）可能偏离。
   - 例：MemGPT 论文（2023 arXiv）和 Letta 实际代码（2024+）——论文的分层记忆理论 vs 实际产品的简化妥协，需分别引用不混淆。

---

## Pass 结构

### Pass 1 · 默认执行

- **派发**：5 个 general-purpose sub-agent 并行，每维度一个（A/B/C/D/E）
- **覆盖**：每 agent 扫全 8 源，精力权重 Tier 1 70% / Tier 2 30%
- **Tier 2 按维度相关性重点切入**：

| 维度 | Tier 2 重点源 | 相关性 |
|---|---|---|
| A 记忆 | Letta（Tier 1 主力）+ Aider repo-map | repo-map 作"上下文记忆"补充 |
| B 技能 | Superpowers skills repo | 我们当前 skills 的源头 |
| C 事件捕获 | Aider | repo-map = "环境事件→上下文信号" |
| D 工作流 | Devin / Cognition blogs | long-horizon agent 战略框架 |
| E 自我诊断 | OpenDevin / OpenHands | verification loop 代码可读 |

- **精力比自适应**：默认 Tier 1 70% / Tier 2 30%；**C 事件捕获 / E 自我诊断两维例外**——若 sub-agent 实查发现 Tier 1 五源对本维无专门材料，可把本维度精力比翻转为 Tier 2 ≥50%（仍须扫 Tier 1 确认"无"，不得跳过）。
- **深度**：每 agent min 5 sources / max 10 引用
- **Wall-clock 预计**：30-50 min（并行）
- **Sub-agent prompt**：按 `research-before-decision` skill §Sub-Agent Dispatch 模板构造（topic context / dimension / quality standard / depth / output format / 固定约束），**额外追加**：每维度末尾必须写一段 synthesis（≤150 词），解释本维度跨源结论、冲突点与对我们系统的启示——sub-agent 自己写，主 Claude 聚合时不补。

### Pass 2 · 按 gap 条件触发

**触发条件**（满足任一）：
1. Pass 1 某维度 S 级源 <2
2. Pass 1 结论出现矛盾（跨源观点冲突）
3. 5 问硬 gate 出现 `N/A`
4. 用户主观判断"深度不够"

**执行方式**：按识别的 gap 精准派 1-5 agents，每个 agent 只回答 1-2 个具体子问题。

**跳过条件**（提前结束）：
- Pass 1 通过 5 问硬 gate
- 每维度 ≥2 S 级源
- 用户确认"已经够了"

**Pass 2 产出**：追加到 Pass 1 同一文件的新章节，标 `[Pass 2]`，保持单一知识库。

---

## 产出格式

### 文件

**单一文件**：`docs/research/2026-04-19-system-evolution-survey.md`

**拒绝 5 个 per-dim 分文件**：跨维度洞察会散落，无法回答"这 5 维之间如何相互影响"类问题。

### 结构（覆盖 skill 🔴 template 硬字段）

**Frontmatter**（skill 硬要求，缺则违规）：

```yaml
---
date: 2026-04-19
topic: 系统进化机制调研
triage: 🔴
template: A
budget: <实际耗时 min>
sources: { S: N, A: N, B: N }
---
```

**Body 5 段**：

- **§ 1 顶部合成**（template A 5 问，aggregated 跑一次）：
  - Q1 它是什么：agent 系统各维度 SOTA 机制 overview
  - Q2 现在的代价：我们基线 vs SOTA 的机会成本
  - Q3 带来什么能力：可借鉴的机制（按维度）
  - Q4 关闭哪些门：各方向的 tradeoff
  - Q5 选错后果：借鉴错方向的风险

- **§ 2 分维度章节**（A 记忆 / B 技能 / C 事件捕获 / D 工作流 / E 自我诊断）：
  - 每维度章节包含：研究问题、按源引用的发现（quote + URL + tier + project implication）、维度内 synthesis

- **§ 3 Pass 2**（若触发）：追加新章节标 `[Pass 2]`，保持单一知识库

- **§ 4 末段 · 源质量自审**（skill 硬要求，缺则违规）：
  - S/A/B 源数量统计
  - URL 全部验证 ✅/❌
  - 幻觉自查声明："所有数字/引用来自引用源，非训练记忆"

### INDEX 更新（按 skill §Run Sequence 7.1）

`docs/research/INDEX.md` 追加：

```
- [2026-04-19] 系统进化机制调研 `[agent系统, 进化, 记忆, 技能, 事件捕获, 工作流, 自我诊断]` 🔴 → [link](2026-04-19-system-evolution-survey.md)
```

### 关键决策点

1. **Template A 而不是 B**：本次是为未来决策做 survey，不是施工方案
2. **5 问只在顶部跑一次**，不每维度跑——25 cell 过冗余；维度深度在维度章节发挥
3. **Pass 2 追加同文件**，不另开——单一知识库原则
4. **单文件不分 per-dim**：跨维度洞察必须集中

---

## Success Criteria + 下游路径

### Success Criteria（研究"做够了"的判定）

**三重 gate，全过才算完成**：

1. **Skill 硬 gate**（强制）：Template A 5 问完整填写。对应 `research-before-decision` skill §5-Question Hard Gate——缺任一问 = skill 违规，仅允许显式 `N/A: <原因>`。

2. **质量 gate**（本次研究额外约束）：
   - 每维度 ≥2 S 级源
   - 每"必答"子问题至少 2 源支撑
   - 结论间无未解释的矛盾（跨源观点冲突必须在 synthesis 中解释）
   - **源池穷尽豁免**：若 sub-agent 已扫完 8 源池仍 <2 S 级源，不强制触发 Pass 2；但必须在维度 synthesis 显式声明"本维度 S 级源仅 N 个（已穷尽 8 源池）"并解释为何这不推翻结论。豁免只对 S 级源数量生效，不豁免其余两条。

3. **用户 gate**（主观节点）：用户审阅 `survey.md` 文件后确认"深度够用"。

**未过任一 gate → 触发 Pass 2**（决策 4 定义）
**全过 → 进入下游路径**

### 下游路径

**方案 A（采纳）：新开一轮 brainstorm 做系统设计**

研究产出会暴露 5 维度 × N 机制的选择空间（例如记忆分层 vs 扁平、skill 生成 vs 手写、事件捕获 hook 策略等）——这是典型"新 brainstorm 材料"场景。

**下游完整流程**：
1. 研究完成 → survey 文件落盘 + INDEX 更新
2. 用户通读 survey，标注感兴趣的方向
3. 新开 brainstorm（使用 `brainstorming` skill，主题："基于调研选择系统进化方向"）
4. 从研究结论中提取可落地机制 → 判断哪些适合我们当前规模 → 排序优先级 → 拆里程碑
5. 进 writing-plans → task-execution

**被否决方案 B（直接 writing-plans 跳过系统设计）**：
- 风险：错过"采纳哪种模式"关键讨论；按 Claude 直觉选型容易翻车

**被否决方案 C（仅落知识库不进 plan）**：
- 风险：没有 forcing function 推动进化；研究变成"为研而研"
- 可作兜底方案，但不推荐主动走这条路

---

## 执行

基于本 Design，invoke `research-before-decision` skill 或分发 sub-agent 阵列执行调研，产出落盘 `docs/research/`。

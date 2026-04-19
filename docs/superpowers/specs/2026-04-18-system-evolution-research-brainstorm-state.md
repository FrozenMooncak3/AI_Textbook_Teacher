# 系统进化机制调研 Brainstorm 进行中状态（WIP）

**创建日期**: 2026-04-18
**用途**: compact 防御——记录 brainstorm 进度，避免 session 断档丢失状态
**最终产出**: `docs/superpowers/specs/2026-04-18-system-evolution-research-design.md`

> ⚠️ compact 后恢复时**先读这个文件**，不要从 summary 重建——summary 会丢细节。

---

## 基础设定（不会变）

- **元层面 brainstorm**：研究对象不是教材老师产品，而是 Claude + CCB + skills + memory 协作系统本身如何进化
- **用户命题**："市面上有没有更好的进化方式可以根据我平常发生的事来进化我们的系统"
- **维度范围**：全要 5 维（A 记忆 / B 技能 / C 事件捕获 / D 工作流 / E 自我诊断）
- **已锁定必调研源**：`https://github.com/NousResearch/hermes-agent.git`
- **允许二轮深度调研**：一轮不够可再来
- **Research 档位**：🔴（3+ 选项 / 难反悔 / 跨领域 / 结论被后续多决策引用 / 用户明确要求）
- **当前系统基线**（进化的起点）：
  - 记忆：auto-memory（`MEMORY.md` + 分类 .md），40+ 条；手动 memory-cleanup skill
  - 技能：手动 writing-skills；F.3 刚做过 skill 瘦身（session-init 127→60 行）
  - 事件捕获：手动 journal skill + retrospective skill（用户触发，非自动）
  - 工作流：CCB 协议（Codex 后端 / Gemini 前端），task-execution 统筹，3-step dispatch
  - 自我诊断：无自动机制，靠用户发起（如 F.3 bloat diagnosis）
  - Hook 层：SessionStart inject project_status + PreCompact block（F.3 新增）
  - 澄清：本地 `.superpowers/` 目录是 brainstorming visual companion 残留 HTML，不是框架安装

---

## 调研

（执行阶段产出，当前 brainstorm 只定方向）

---

## 已拍死的决策（不再讨论）

### 决策 1：调研源清单 (2026-04-18 拍板)

锁定 8 源，两档：

**Tier 1 · 深扫**（结构同构，必读代码/文档）：
1. hermes-agent（用户指定）
2. Anthropic Agent SDK + Claude Code 官方 repo
3. Letta（前 MemGPT）
4. Cline + Continue
5. Superpowers skills repo（上游，brainstorming / writing-plans / TDD / systematic-debugging 等 skills 的源头）

**Tier 2 · 专项扫**（针对特定维度）：
6. OpenDevin / OpenHands → E 自我诊断（verification loop）
7. Aider → C 事件捕获（repo-map = 环境事件→上下文信号）
8. Devin / Cognition 官方 blogs → 架构框架（long-horizon agent）

**被否决**（保留理由）：
- Cursor rules 生态：零散真实实例，缺架构洞察
- SWE-agent 论文（Princeton）：学术范式，落地弱
- AutoGen / CrewAI：对比我们 CCB 边际价值低
- BabyAGI / AutoGPT：范式过时，信号稀薄

### 决策 2：每维度调研问题 (2026-04-18 拍板)

5 维每维定义"必答"（必须每源回答）和"加分"（有则记录）。

**A. 记忆沉淀**
- 必答：结构 / 写入触发 / 检索方式 / 衰减 / 冲突更新 / 用户控制面
- 加分：跨 session / 跨项目共享；多人隔离；token 成本模型

**B. 技能系统演化**
- 必答：创作路径 / 触发 / 演化 / 组合 / 失效处理
- 加分：marketplace；私有 vs 共享；配额 / 性能监控

**C. 事件捕获 / 信号挖掘**
- 必答：事件分类 / 采集机制 / 信号提取 / 闭环
- 加分：实时 vs 批；隐私边界；人工 review 节点

**D. 工作流进化**
- 必答：拓扑 / 派发 / Review loop / 失败恢复
- 加分：预算控制；并行度；human-in-loop 节点设计

**E. 自我诊断**
- 必答：信号源 / 触发 / 行动化 / 假阳-假阴风险
- 加分：基准线指标；回归对比；"系统健康"定义

详细子问题见 `design.md` 对应章节。

### 决策 3：质量门槛（S/A/B 源定义）(2026-04-18 拍板)

**全量沿用 `research-before-decision` skill §Source Quality Standard**：
- S 级：≥3/6 信号（5 年产出 / 机构联属 / 经典作品 / 被 S 级引用 / 方法论事件留名 / 会议 keynote）
- A 级：署名技术媒体 / 实名工程师演讲 / 未达 S 的工程博客
- B 级：HN/Reddit 高赞 + 专家留言 / maintainer GitHub Issue 回复
- 硬拒绝：无日期博客 / SEO 列表文 / Medium 农场 / AI slop / **Claude 训练记忆**

**领域补充 3 条**：
1. **官方 repo 源码升格 S 级**：本次调研 8 源的 GitHub 源码 + 官方 README 算 S，即使仓库年龄 <5 年
2. **2024-2026 强优先**：agent 系统从 2023 Q4 成形；2023 之前结论必须标 `[dated]`
3. **Paper vs 实现分离引证**：同一系统论文（S · 同行评议）与实现（S · 官方代码）可能偏离，需分别引用（例：MemGPT 论文 vs Letta 实现）

### 决策 4：Pass 结构 (2026-04-18 拍板)

**方案 A：5 agents 按维度派，覆盖 8 源，Pass 1 默认 + Pass 2 按 gap 触发**

**Pass 1**：5 agents 并行（A/B/C/D/E），每 agent 扫全 8 源，Tier 1 70% / Tier 2 30%，min 5 / max 10，wall-clock 30-50 min。Tier 2 按维度重点（A→Letta+Aider / B→Superpowers / C→Aider / D→Devin / E→OpenDevin）。

**Pass 2**：触发任一则启动——① 某维 S 源 <2 ② 结论矛盾 ③ 5 问 gate N/A ④ 用户主观"不够"。按 gap 精准派 1-5 agents，每个答 1-2 子问题。

**被否决方案 B**：8 agents（5 按维+3 按源）——Tier 2 独立视角价值 < agent 数 ×1.6 成本 + 合并复杂度。

### 决策 5：研究产出格式 (2026-04-19 拍板)

**单一文件** + **skill 🔴 模板** + **template A**：

- 文件：`docs/research/2026-04-19-system-evolution-survey.md`
- Frontmatter 硬字段：date / topic / triage 🔴 / template A / budget / sources {S,A,B}
- Body 5 段：
  - § 1 顶部合成（template A 5 问跑一次，aggregated）：Q1 它是什么 / Q2 代价 / Q3 能力 / Q4 关门 / Q5 选错后果
  - § 2 分维度章节（A/B/C/D/E），每维：研究问题 + 发现（quote+URL+tier+implication）+ 维度 synthesis
  - § 3 Pass 2（若触发）追加 `[Pass 2]` 章节
  - § 4 末段源质量自审（skill 硬要求）
- INDEX：`docs/research/INDEX.md` 追加一行含 keywords

**决策点**：
① 单文件不分 5 个 per-dim（跨维度洞察会散落）
② Template 选 A 不选 B（survey 不是施工方案）
③ 5 问顶部跑一次不每维度跑（25 cell 过冗余）
④ Pass 2 同文件追加（单一知识库）

### 决策 6：Success criteria + 下游路径 (2026-04-19 拍板)

**Success Criteria**（三重 gate，全过才算完成）：
1. Skill 硬 gate：Template A 5 问完整填写（skill §5-Question Hard Gate 强制）
2. 质量 gate：每维度 ≥2 S 级源；每"必答"子问题至少 2 源支撑；结论间无未解释矛盾
3. 用户 gate：用户审阅 survey 文件后确认"深度够用"

未过任一 gate → 触发 Pass 2（见 decision 4）；全过 → 进下游。

**下游路径**：方案 A — 新开一轮 brainstorm 做系统设计
- 研究会暴露 5 维 × N 机制选择空间
- 新 brainstorm 从研究结论提取可落地机制 → 判断适合规模 → 排序优先级 → 拆里程碑
- 走正常 Design Chain：brainstorming → writing-plans → task-execution

**被否决方案 B**（直接 writing-plans 跳过系统设计）：错过采纳决策讨论，易翻车。
**被否决方案 C**（只落知识库不进 plan）：缺 forcing function，研究变"为研而研"。

---

## 待 brainstorm 的决策（按依赖顺序）

_（全部 6 决策已锁定 2026-04-19）_

---

## 当前进度

- ✅ 决策 1-6（全部 2026-04-18~19 拍板）
- ✅ Brainstorm 完成
- ✅ 调研 Pass 1 执行完成（2026-04-19，5 sub-agent 并行，6 分钟 wall-clock）
- ✅ Survey 落盘：`docs/research/2026-04-19-system-evolution-survey.md`（57KB，S:42 / A:11 / B:4）
- ✅ 三重 gate 通过：skill 硬 gate / 质量 gate / 用户 gate（2026-04-19 用户确认"深度够用"）
- 🎯 **本 brainstorm 生命周期结束**。下游：系统设计 brainstorm（方案 A）handoff 已写 → `2026-04-19-system-evolution-design-handoff.md`

---

## 最终产出

- ✅ `docs/superpowers/specs/2026-04-18-system-evolution-research-design.md`（调研方案 spec）
- ✅ `docs/research/2026-04-19-system-evolution-survey.md`（调研成果 survey）
- ✅ `docs/research/INDEX.md` 追加 🔴 条目
- ✅ `docs/superpowers/specs/2026-04-19-system-evolution-design-handoff.md`（下一轮 brainstorm 启动指令）
- ⏭️ 下游：新 session 冷启动，按 handoff 读 survey 做系统设计 brainstorm → writing-plans → task-execution

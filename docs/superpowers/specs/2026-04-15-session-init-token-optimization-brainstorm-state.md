---
name: session-init token optimization brainstorm WIP
description: compact 防御——session-init / brainstorming token 膨胀问题的决策进度追踪
---

# Session-Init Token Optimization Brainstorm 进行中状态（WIP）

**创建日期**: 2026-04-15
**用途**: compact 防御——记录 brainstorm 进度，避免 session 断档丢失状态
**最终产出**: `docs/superpowers/specs/2026-04-15-session-init-token-optimization-design.md`

> ⚠️ compact 后恢复时**先读这个文件**，不要从 summary 重建——summary 会丢细节。

---

## 基础设定（不会变）

- **核心矛盾**：既要每次新 session "了解项目全貌 + 所有上下文 + 讨论过的东西"，又要控制每次 session-init + brainstorming 的启动 token（现已占 20-30%，并持续上升）。两端不能妥协成其一。
- **增长性**：项目还会持续增长（journal、specs、research、architecture.md 都在膨胀）。任何方案必须对"文件量级变大"有 robust 应对，不能做静态假设。
- **相关历史决策**：
  - 2026-04-09 parked T2「记忆清除 skill」（`docs/journal/INDEX.md` 工程流程 → T2）——用户已经识别过 token 问题。**此次 brainstorm 承接并扩大该项。**
  - Session-init 第三次升级引入 CEO 仪表盘 + skill 治理（2026-03-29）——目前结构的起源。
  - 2026-04-14 WIP State File Protocol 上线——brainstorming 增加了"读 WIP 文件"这一额外启动读取项，**增加了本问题的压力**。
- **调研方向（用户提供）**：
  1. https://github.com/thedotmack/claude-mem.git
  2. https://github.com/affaan-m/everything-claude-code.git
  3. https://github.com/obra/superpowers.git
  4. **开放问题**: 如何更有效地用 Claude Code 管理项目进度，让每个 session 都了解全貌但又不让 token 消耗随项目成长而无限膨胀（2026-04-15 用户追加）

---

## 调研

2026-04-15 完成 🔴 深度调研（4 维 + Synthesizer）：

- [D1 claude-mem](../../research/2026-04-15-claude-mem-repo-analysis.md) — AGPL-3.0 污染 + Windows 差 + 单 Claude 假设，整体不采纳；借三层工作流思想
- [D2 everything-claude-code](../../research/2026-04-15-everything-claude-code-repo-analysis.md) — MIT 安全但 install.ps1 Windows 阻断；借 context-budget 三档 + SessionStart 极简原则
- [D3 obra/superpowers](../../research/2026-04-15-obra-superpowers-repo-analysis.md) — obra = Jesse Vincent（S 级），我们 superpowers/ 结构源头；v5.0.3 的 compact 不重跑补丁 = 决定性发现
- [D4 社区最佳实践](../../research/2026-04-15-cc-long-project-context-mgmt.md) — Anthropic + Willison + Shrivu + Vincent 独立收敛到"开机只读索引，正文按需"
- [Synthesizer](../../research/2026-04-15-session-init-optimization-synthesis.md) — 汇总推荐清单 P1-P7

---

## 已拍死的决策（不再讨论）

### 决策 1：痛点边界 + 成功标准（2026-04-15 拍板）

**痛点优先级**
- 🔴 最痛：**A. 开机就挤** — session-init 吃掉 20-30% context，起步即被压缩
- 🟡 次要：B. 长会话中段 compact、C. brainstorming 重读贵（A 缓解后二者自动减轻，但 C 可独立优化）

**定量目标**
- session-init 开机读取 **≤ 10% context**（现 20-30%，拍死 10%，用户拒绝更激进如 8%）
- **"知道有这件事存在"的能力不可失**——细节可按需加载，但议题名 + 一句话概括必须在索引中全量可见
- **禁止"为省 token 直接删信息"**——只接受"分层 + 按需加载"

**开机必须在 context 里的（不可妥协）**
- 当前里程碑位置、下一步、blocker
- 未 commit / 未 push 状态
- 所有议题（parked / 已关闭决策 / WIP brainstorm / feedback memory）的**存在性 + 一句话概括**
- 停车场里命中"基础设施影响"或"触发条件到期"的项——**要求主动标签**（journal 入库时打，不靠读全文判断）

**开机可按需（不读，触发时加载）**
- 已关闭决策全文（只读索引）
- feedback memory 规则正文（现在已基本是此模式，保留）
- 停车场非关键项 journal 全文
- previous milestone spec 全文
- architecture.md 全文（读摘要卡 + 按需读相关段）

**方向性偏好（用户点头）**
- RAG-style 分层：详细 index + 分类清晰 + 命名有信息密度 → 开机只读索引
- 停车场定期清理合并：已脱离主线的合并成历史摘要，**独立"记忆清理 skill"承载**（决策 6/附加决策范围）
- 用户接受入库标签工作量变大、接受新增一个清理 skill

**Rejected / 未选**
- 更激进阈值（≤ 8% / ≤ 5%）— 用户选稳健的 10%，避免失真
- "保留现有读全文判断"— 用户宁可付标签成本换开机成本
- 动 feedback memory 规模 — 当前已是轻索引+按需细节模式，未膨胀，不是主战场

---

### 决策 2：基础策略路线（2026-04-15 拍板）

**路线 D：混合架构**

**组成**
- **主体**：路线 A（多层索引 + 按需 hydrate）—— 所有 docs/ 大文件（journal、decisions、specs、research）建详细 index，开机只读 index，正文按触发加载
- **兜底**：路线 B 的"定期清理 skill"—— 陈旧条目合并成摘要 + 指针到 `archive/`，防止 index 本身越积越多
- **加速器**：路线 C 的思路 —— 3 个 repo + 第 4 开放问题调研作用重新定位为"在 D 框架下挑可用零件"，不吞整套工具链

**理由**
- 核心焦虑"怕丢全貌" → A 保留 100% 信息完整性（只改读法），不压缩（不走 B 作为主路线）、不外置（不走 C）
- 10% 目标 A 单独即可打到，不需要 C 的激进方案
- 可逆性 🟢：所有改动在 docs/ 文本文件层面，无外部依赖，git 可回退

**Rejected / 未选**
- 路线 A 单用：缺少兜底，index 会随时间堆积
- 路线 B 单用：压缩有损，与"怕丢全貌"直接冲突
- 路线 C 单用 / 主导：外部工具吞长时记忆会降低协作透明度（用户看不到工具内部状态），迁入易迁出难

**下游影响**
- 决策 3（3 repo 调研）调研问题重新锚定为："在 D 框架下，repo A/B/C 和开放问题能贡献哪些零件？"—— 不再是"哪个 repo 最好"
- 决策 4（session-init 重构）定形为"改读 index，不读原文"
- 决策 6（文件体系改造）确定包含"清理 skill"作为独立子项

---

### 决策 3：调研结论 + 零件采纳清单（2026-04-15 拍板）

**采纳（7 个零件）**

| # | 零件 | 优先级 | 来源 |
|---|------|--------|------|
| P1 | SessionStart 极简化（仪表盘 only，其他拆成按需 skill） | 🔴 | obra + ECC + Anthropic |
| P2 | 多层 INDEX + Frontmatter schema（docs/research、superpowers 加 INDEX） | 🔴 | claude-mem 三层 + Anthropic Skills |
| P3 | compact/--resume 后不重跑 session-init（砍一半 token） | 🔴 | obra v5.0.3 |
| P4 | 定期清理 skill（memory-cleanup，合并陈旧到 archive） | 🔴 | claude-mem + ECC |
| P5 | token-budget 三档（Always/Sometimes/Rarely） | 🟡 | ECC context-budget |
| P6 | Grep-on-demand 标准模板（按需现查） | 🟡 | obra Superpowers |
| P7 | Subagent context isolation（research-before-decision 已在做） | 🟡 | obra v5.0.2 |

**明确拒绝**

- claude-mem 整套（AGPL-3.0 污染付费订阅）
- ECC install.ps1（Windows issue #1435 永久阻断 Edit/Write）
- claude-mem MCP retrieval（单 Claude 假设，CCB 不兼容——见下方详细冲突分析）
- 外部向量库 / Chroma / SQLite-FTS（违反"git revert 可回退"）

**CCB 与 MCP 的三条冲突（记录以免忘记）**

1. MCP tool 只挂调用它的 agent —— Codex/Gemini 查不到，全局省 token 打折
2. Codex/Gemini 不原生讲 MCP 协议 —— 要自搭中间层，成本爆炸
3. 记忆从 markdown 搬到 SQLite/向量库 —— 用户看不到内容，git revert 回退难，违反 CLAUDE.md 可逆性原则

**实施顺序（3 周）**

1. 周 1：铺 frontmatter schema + 补齐 INDEX（P2）
2. 周 2：重写 session-init 主体（P1）+ 改触发条件（P3）+ grep 模板（P6）
3. 周 3：memory-cleanup skill（P4）+ token-budget 验证 ≤10%（P5）

**Rejected / 未选**
- 单独把 P7 独立推进 —— research-before-decision skill 已内置，重复
- 先做清理 skill 再做 INDEX —— INDEX 没建好，清理 skill 无从判断哪些该合并，顺序反

---

### 决策 4：session-init 重构具体方案（2026-04-15 拍板）

**预期效果**：session-init 开机占用 20-30% → **≤ 3%**（≈ 5-6k token on 200k window）

**拆分方案**

| 内容 | 去向 | 加载方式 | 开机 token |
|------|------|---------|-----------|
| CEO 仪表盘生成 | 留在 session-init | 开机自动 | ~1.5k |
| 读 INDEX（不读原文） | 留在 session-init | 开机自动 | ~1.5k |
| 停车场扫描（仅读打标签的项） | 留在 session-init | 开机自动 | ~0.5k |
| **session-wide 运行规则** | 抽到 `.claude/skills/session-rules/SKILL.md` | **做法 A：`@import` 到 CLAUDE.md** | ~1.5k（同现在，但解耦）|
| Skill 使用手册（23 个 skill 表） | 抽到 `.claude/skills/skill-catalog/SKILL.md` | 按需 skill（描述触发） | 0（只有 ~100 描述在 context）|
| CCB 分工 + dispatch 协议 | 抽到 `.claude/skills/ccb-protocol-reference/SKILL.md` | 按需（被 structured-dispatch 链式调用）| 0（只有 ~100 描述）|

**Skill 自动触发的"显式表格"保留**：这张表（"用户说 X → 调 skill Y"）是现在可靠性的核心，**整体搬到 `session-rules/SKILL.md`**，借 `@import` 永远在 context，不降可靠性。

**@import 语法已验证**（🟡 调研 2026-04-15-claude-md-import-syntax.md）：
- 语法：`@path/to/file`（无空格、无花括号）
- 相对路径从包含 import 的文件解析（不是 cwd）
- Token 成本 = 直接写入 CLAUDE.md 同等
- 最多 5 层嵌套
- Gotcha: 外部路径首次 import 弹窗批准，拒绝即永久禁用

**compact/--resume 检测**（P3 落地）
- Session 首次启动：session-init 跑完整流程 + 写 `.ccb/session-marker`
- 后续启动：检测到 marker 存在 → 跳过重读，只刷新仪表盘
- Session 结束：清除 marker
- Claude Code 本身不暴露"是否 compact"信号，marker 文件是兜底方案（obra v5.0.3 同款实现）

**新增 3 个 skill 文件**
- `.claude/skills/session-rules/SKILL.md`（当前 session-init Step 4 内容 + 显式触发表）
- `.claude/skills/skill-catalog/SKILL.md`（当前 session-init Step 5 内容）
- `.claude/skills/ccb-protocol-reference/SKILL.md`（从 `docs/ccb-protocol.md` 提炼）

**CLAUDE.md 改动**：结尾新增一行 `@.claude/skills/session-rules/SKILL.md`

**可逆性**：🟢 全部 `.claude/skills/` 和 CLAUDE.md 文件改动，git revert 一次回滚

**Rejected / 未选**
- 做法 B（session-rules 纯按需）：风险高，Claude 可能忘调用
- 用 hook 检测 compact：Claude Code hook 不暴露 compact 事件，改用 marker 文件
- 把 skill-catalog 也 @import：不必要，skill 手册只在 Claude 查 skill 时需要，按需足够

---

### 决策 5：brainstorming 重读优化（2026-04-15 拍板）

**预期效果**：brainstorming 进场 10-15k → **3-5k**

**Mandatory Read List 变更**

| 现有 | 改后 |
|------|------|
| `project_status.md` | 不读（session-init 已加载）|
| `journal/INDEX.md` | 不读（session-init 已加载）|
| MEMORY.md | 不读（auto-loaded）|
| `architecture.md` 全文（6-10k）| **只读"摘要卡"章节**（~1.5k，决策 6 新增）|
| Previous milestone spec 全文 | 读 `docs/superpowers/INDEX.md` 找相关，按 keywords 匹配展开 |
| 相关源码 | 按 architecture.md 摘要卡的接口契约指向按需读 |

**核心：INDEX 相关性判断机制（机制 B + C 轻量版）**

> 用户最担心的风险：INDEX 判断失误 = 信息真的丢了，威胁决策 1 "知道有这件事存在的能力不能丢"

- **日常走 B**：所有 INDEX 强制加 `keywords` 字段（3-5 个关键词）。Claude 读 INDEX 时把 brainstorm 当前主题的关键词与每条 keywords 对比：
  - **高分匹配**（2+ 词撞）→ 自动展开全文
  - **中分匹配**（1 词撞）→ 展开全文 + 告知用户（"已展开 X，如无关请说"）
- **绝不走 A 单用**（纯 Claude 判断）：盲点太多
- **Brainstorming 开场必须告知已展开的 INDEX 条目清单**，让用户一眼看到读了什么，漏了能纠正
- **用户可强制**："去读 X" 即展开

**附带要求（落到决策 6）**：所有 INDEX 文件的每个条目必须加 `keywords` 字段——包括：
- `docs/journal/INDEX.md`（改造现有，补齐所有条目 keywords）
- `docs/research/INDEX.md`（新建）
- `docs/superpowers/INDEX.md`（新建）
- `docs/decisions.md`（每条决策加 keywords）

**保留不变**
- WIP state file protocol（防 compact 核心）
- Research Trigger Check
- BS-1 增量 spec 写入
- 5 问 hard gate
- Visual Companion

**Rejected / 未选**
- 机制 A 单用（纯 Claude 判断）：命名没撞关键词就漏，慢性信息流失
- 机制 C 单用（每次都等用户确认候选）：打断节奏太多
- 不加 keywords，靠 Claude 读 title + 描述猜：描述质量参差，不可靠

---

### 决策 6：文件体系改造 + 清理 skill（2026-04-15 拍板）

**A. Frontmatter schema 统一**

所有 `docs/journal/*.md`、`docs/research/*.md`、`docs/superpowers/specs|plans/*.md` 强制字段：
- `date`, `topic`, `type`, `status`, `keywords`（3-5 个）, `urgency`（仅 parked）

一次性迁移约 40-50 个文件（2-3 小时）。

**B. 新建 INDEX 文件**
- `docs/journal/INDEX.md`（已存在，补齐 keywords）
- `docs/research/INDEX.md`（**新建**，21 个文件无全局入口）
- `docs/superpowers/INDEX.md`（**新建**，specs + plans 分组）
- `docs/decisions.md`（已是索引式，每条补 keywords）

条目格式含 keywords，每条 1-2 行。

**C. architecture.md 摘要卡**

顶部加 `## 0. 摘要卡` 新章节：核心表名 / 核心接口契约 / ⚠️ 约束汇总，硬上限 1.5k token。全文保留。

**D. memory-cleanup skill**

手动触发季度清理：
1. 候选识别：`status: resolved` > 6 个月 / `status: parked` + `urgency: normal` > 12 个月
2. 每次 ≤10 条，逐条 y/n 确认（默认 no）
3. 搬到 `docs/archive/YYYY-QN/`，合并摘要
4. 所有 INDEX 指针更新到 archive
5. 原文**搬不删**（git 可找回）

**E. INDEX 持续维护（用户追问补充）**

- journal skill（已在做）：入库时更新 `docs/journal/INDEX.md`
- research-before-decision skill：**新增**落盘后更新 `docs/research/INDEX.md`
- brainstorming skill：**新增**产出 spec 后更新 `docs/superpowers/INDEX.md`
- writing-plans skill：**新增**产出 plan 后更新 `docs/superpowers/INDEX.md`
- claudemd-check skill：**新增**扫描各类 docs 目录，若文件未入对应 INDEX 则报警

**不用 hook 强制**（hook 拦 Write 影响开发节奏，误伤风险高），靠 skill 内嵌步骤 + claudemd-check 末尾验证双保险。

**Rejected / 未选**
- PostToolUse hook 自动更新 INDEX：拦截 Write 工具风险大，误伤可能
- 用数据库/外部工具做索引：违反"纯 markdown + git 可回退"原则
- cleanup skill 自动删除（非搬）：违反"不丢信息"核心原则
- cleanup 每次处理全部候选：批量一次性太大，用户审查疲劳会 rubber-stamp

---

---

## 待 brainstorm 的决策（按依赖顺序，初稿）

### 决策 1：痛点边界 + 成功标准【下一个】

在启动任何调研前，必须先锚定：
- token 消耗大头具体在哪（session-init 开机 / 长会话持续读 / brainstorming 重读 / 全部）
- 目标边界（降到多少% / 降哪个阶段 / 接受什么代价）
- 哪些"了解全貌"的能力是不可妥协的

### 决策 2：策略路线

根据决策 1 的边界，从"压缩 / 延迟加载 / 外部索引 / 分层读取 / 换工具"里选基础策略路线。

### 决策 3：3 个 repo 的适用性（🔴 深度调研）

每个 repo 做什么、能解决决策 1/2 中的哪些问题、搬过来的代价是多少、是否能本地化适配。

### 决策 4：session-init 重构方案

落到具体改动：改读什么 / 何时读 / 哪些移到按需 / 新的仪表盘生成成本。

### 决策 5：brainstorming 重读优化

brainstorming 的"Mandatory Read List"同样贵，需不需要一起优化。

### 决策 6：文件体系改造

是否需要为 "每次 session 了解全貌" 建立新的轻量索引/摘要层（journal 索引、architecture 摘要卡、decisions TL;DR 等）。

---

## 当前进度

- ✅ 决策 1（痛点 + 成功标准，2026-04-15 拍板）
- ✅ 决策 2（基础策略路线：路线 D 混合架构，2026-04-15 拍板）
- ✅ 决策 3（零件采纳清单 P1-P7 + 拒绝清单 + 3 周实施顺序，2026-04-15 拍板）
- ✅ 决策 4（session-init 重构：拆 3 新 skill + @import + marker 检测，2026-04-15 拍板）
- ✅ 决策 5（brainstorming 重读优化 + INDEX keywords 机制 B+C 轻量版，2026-04-15 拍板）
- ✅ 决策 6（A 统一 frontmatter + B 2 新 INDEX + C architecture 摘要卡 + D cleanup skill + E 持续维护，2026-04-15 拍板）
- ✅ 所有决策拍完，进入 spec 完稿 + review 阶段

---

## 最终产出

决策全部拍完后转写到：
`docs/superpowers/specs/2026-04-15-session-init-token-optimization-design.md`

实现计划另起 `docs/superpowers/plans/`。

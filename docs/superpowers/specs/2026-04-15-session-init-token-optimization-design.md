---
date: 2026-04-15
topic: Session-Init Token优化设计
type: spec
status: resolved
keywords: [session-init, token-optimization, frontmatter, index, memory-cleanup]
---

# Session-Init Token Optimization — 设计文档

**状态**: 🔄 Brainstorm 进行中（见 `2026-04-15-session-init-token-optimization-brainstorm-state.md`）

---

## 1. 目标与边界

### 1.1 核心问题
session-init 在 session 开机阶段读取 20-30% context；项目继续增长会突破 compact 阈值。brainstorming 的 Mandatory Read List 同样贵。两者共同压缩了主工作区容量。

### 1.2 定量目标
- **session-init 开机读取 ≤ 10% context**（当前 20-30%）
- brainstorming 首轮 context load 同步下降（具体数值见决策 5）

### 1.3 不可妥协的能力
每次新 session 开机时 context 中**必须**具备：
- 当前里程碑位置、下一步、blocker
- 未 commit / 未 push 状态
- 所有议题（parked、已关闭决策、WIP brainstorm、feedback memory）的**存在性 + 一句话概括**
- 停车场命中"基础设施影响"或"触发条件到期"标签的项（完整内容 / 摘要 + 立即处理建议）

### 1.4 可按需加载的内容
- 已关闭决策全文
- feedback memory 规则正文（当前已是此模式）
- 停车场非关键项 journal 全文
- previous milestone spec 全文
- architecture.md 全文（默认读摘要卡 + 按需读相关段）

### 1.5 设计原则
- **分层 + 按需**：索引始终全量；细节延迟加载
- **禁止为省 token 直接删信息**
- **标签驱动**：关键性/过期性等属性在入库时标记，不靠读全文判断
- **可增长**：项目继续膨胀时开机成本不线性上涨

## 2. 策略路线

**路线 D：混合架构** — 多层索引（主体）+ 清理 skill（兜底）+ 外部调研结果作为可选零件（加速器）。

### 2.1 核心原则
1. **Index 永远全量可见**：所有 docs/ 大文件都有一层详细 index，开机读 index，正文按需
2. **标签驱动关键性**：parked 项在入库时打"基础设施/触发条件到期"标签，不靠读全文判断
3. **定期清理防膨胀**：新增"记忆清理 skill"，周期性合并陈旧条目到 `archive/`，保留摘要 + 指针
4. **外部工具慎选**：3 repo 调研结果只采用"零件级"借鉴，不替换主权到外部系统

### 2.2 涉及的 doc 类型与索引策略
（具体索引结构和映射见决策 6）

- `docs/journal/` → 升级现有 INDEX.md（更详细 + 强制标签字段）
- `docs/decisions.md` → 已是索引式，检查命名密度
- `docs/superpowers/specs/` → 新增 index（每个 spec 一句话概括 + 状态）
- `docs/research/` → 新增 index（当前仅靠文件名，无全局入口）
- `docs/architecture.md` → 拆出"摘要卡"章节作为开机读取部分

### 2.3 可逆性
🟢 **容易反悔** — 全部是 docs/ 和 skill 文件改动，无外部依赖，出错 git revert 即可。

## 3. 外部工具引入

### 3.1 采纳清单（P1-P7）

| 编号 | 零件 | 优先级 | 来源 | 适用目标 | 搬运方式 |
|------|------|--------|------|---------|---------|
| P1 | SessionStart 极简化 | 🔴 Must | obra / ECC / Anthropic | session-init skill | 重写结构，保 CEO 仪表盘，其他内容拆成独立按需 skill |
| P2 | 多层 INDEX + frontmatter schema | 🔴 Must | claude-mem 三层 + Anthropic Skills 三层 | docs/research/INDEX.md、docs/superpowers/INDEX.md、所有 docs frontmatter | 新建 INDEX 文件 + 补齐所有 markdown 的 frontmatter 字段 |
| P3 | compact/--resume 后不重跑 session-init | 🔴 Must | obra v5.0.3 | session-init skill 触发条件 | 在 skill 入口判断 resume/compact，跳过重读 |
| P4 | 定期清理 skill（memory-cleanup） | 🔴 Must | claude-mem observation archive + ECC context-budget | 新建 `.claude/skills/memory-cleanup/` | 从零写 skill，借 claude-mem 的思想但不抄代码（AGPL） |
| P5 | token-budget 三档（Always/Sometimes/Rarely） | 🟡 Should | ECC context-budget skill | 所有 skill + docs | 给现有文件打分类标签，辅助 P1 决定保留哪些 |
| P6 | Grep-on-demand 标准模板 | 🟡 Should | obra Superpowers | 所有 skill 里的"读文件前先 grep" | 写一段复用模板 |
| P7 | Subagent context isolation | 🟡 Should（已在做） | obra v5.0.2 | 所有派 sub-agent 的 skill | research-before-decision 已内置，验证其他 skill 是否也做到 |

### 3.2 拒绝清单

| 项 | 原因 |
|----|------|
| claude-mem 整体（代码 / npm install） | AGPL-3.0 会污染 teaching mode 付费订阅 |
| ECC install.ps1 | Windows 11 issue #1435，`fs.renameSync` 永久阻断 Edit/Write/Bash |
| claude-mem MCP retrieval | 单 Claude 假设，CCB 三模型不兼容 |
| 外部向量库（Chroma / SQLite-FTS） | 违反"git revert 可回退"要求，透明度下降 |

### 3.3 CCB 与 MCP 的冲突（架构决策记录）

本项目**永久规避 MCP-based memory tools**，原因：

1. **MCP tool 只挂调用它的 agent** — 装 claude-mem 只有 Claude 能查记忆，Codex/Gemini 仍需读全量文档，全局 token 目标打折
2. **Codex/Gemini 不原生讲 MCP 协议** — 要自搭中间层，维护成本爆炸
3. **记忆从 markdown 变成黑箱数据库** — 用户（非技术 CEO）看不到内容，git revert 回退难，违反 CLAUDE.md "容易反悔" 原则

**结论**：所有"记忆/索引"功能都用 markdown + grep 实现，保留"docs/ 是唯一真相源 + git 可回退 + 用户可读"三条底线。

### 3.4 实施顺序
1. 周 1：铺 frontmatter + 补 INDEX（P2）
2. 周 2：重写 session-init（P1）+ 改触发条件（P3）+ grep 模板（P6）+ budget 分类（P5）
3. 周 3：memory-cleanup skill（P4）+ 量化验证 ≤10%

## 4. Session-Init 重构方案

### 4.1 新 session-init 结构

**职责缩减到 2 件事**：
1. 生成 CEO 仪表盘
2. 读 INDEX 文件 + git 状态，汇总到仪表盘

**流程**
```
Step 1 (if .ccb/session-marker exists):
  → skip full reload, just refresh dashboard from git state
  → exit

Step 2 (first-time startup):
  → read docs/project_status.md (head only)
  → read docs/journal/INDEX.md
  → read docs/research/INDEX.md (new, see Section 6)
  → read docs/superpowers/INDEX.md (new, see Section 6)
  → read MEMORY.md (auto-loaded)
  → run git log / status / inbox scan
  → scan parked items: only read files tagged `urgency: infra-affecting` or `trigger-date: 到期`
  → output CEO dashboard
  → write .ccb/session-marker
  → exit
```

**预期 token**: ~5-6k (≈ 3% of 200k context)

### 4.2 抽出的 3 个新 skill

| Skill 文件 | 内容来源 | 加载方式 |
|-----------|---------|---------|
| `.claude/skills/session-rules/SKILL.md` | 当前 session-init Step 4（运行规则 + 显式 skill 触发表） | **CLAUDE.md `@import`** (always loaded) |
| `.claude/skills/skill-catalog/SKILL.md` | 当前 session-init Step 5（23 个 skill 手册） | 按需触发（Claude 查 skill 时） |
| `.claude/skills/ccb-protocol-reference/SKILL.md` | `docs/ccb-protocol.md` 精华提炼 + dispatch 模板 | 按需触发（被 `structured-dispatch` 链式调用）|

### 4.3 CLAUDE.md 改动

**3.1 结尾添加 `@import`**：
```
@.claude/skills/session-rules/SKILL.md
```

语法依据：`docs/research/2026-04-15-claude-md-import-syntax.md`（🟡 调研验证）

**3.2 重写"Skill 使用"段落**（当前 CLAUDE.md 第 101-103 行）：

现状文字：
> "每次会话开始，调用 session-init skill。它包含 CEO 仪表盘、运行规则和完整的 skill 使用手册。详见 `.claude/skills/session-init/SKILL.md`。"

重构后该文字过时（运行规则已搬到 `session-rules`、skill 手册搬到 `skill-catalog`）。改为：

> "每次会话首次启动时调用 session-init skill（CEO 仪表盘 + git 状态 + INDEX 扫描）。运行规则通过 CLAUDE.md `@import` 自动加载（`session-rules` skill）；skill 使用手册按需加载（`skill-catalog` skill）。Compact/resume 后 session-init 通过 `.ccb/session-marker` 自动跳过，只刷新仪表盘。详见 `.claude/skills/session-init/SKILL.md`。"

### 4.4 session-init SKILL.md frontmatter 更新

**现状 description 字段**（`.claude/skills/session-init/SKILL.md` 顶部 YAML）：
> "CEO 仪表盘 + session-wide 运行规则 + skill 使用手册。Session 开始和 compact 后自动调用。"

**问题**：描述了被搬走的两项，并且 "compact 后自动调用" 被 Decision 4 的 marker 机制反转。不改则 auto-trigger 语义错乱（可能 compact 后仍自动跑，抵消 token 节省）。

**改为**：
> "CEO 仪表盘 + git 状态 + INDEX 扫描。Session 首次启动时调用；compact/resume 后通过 `.ccb/session-marker` 跳过重读，仅刷新仪表盘。"

### 4.5 Compact/--resume 检测

**机制**：`.ccb/session-marker` 文件
- 首次启动：无 marker → 跑完整流程 → 写 marker
- Compact/Resume：有 marker → 跳过重读 → 只刷新仪表盘
- 手动新 session：用户删除 marker 或用 `/fresh-start` 命令（可选）

**为什么用文件而非 hook**：Claude Code 不暴露 compact 事件信号，obra v5.0.3 同款实现。

### 4.6 Skill 自动触发可靠性保证

"用户输入 X → 自动调 skill Y" 的显式表格从 session-init 搬到 `session-rules/SKILL.md`，借 `@import` 永远在 context，**可靠性不降**（表格逐字保留）。

### 4.7 可逆性
🟢 全部 `.claude/skills/` 和 CLAUDE.md 文件改动，git revert 可完全回滚。

## 5. Brainstorming 读取优化

### 5.1 Mandatory Read List 变更

| 现在读 | 改后 |
|--------|------|
| `project_status.md` | 删（session-init 已加载）|
| `journal/INDEX.md` | 删（session-init 已加载）|
| MEMORY.md | 删（auto-loaded）|
| `architecture.md` 全文 | 只读"摘要卡"章节（决策 6.3）|
| Previous milestone spec 全文 | 通过 `docs/superpowers/INDEX.md` 按 keywords 匹配展开 |
| 相关源码 | 按 architecture.md 摘要卡的接口契约按需读 |

**预期 token**: 10-15k → 3-5k

### 5.2 INDEX 相关性判断机制（机制 B + C 轻量版）

**核心风险**：INDEX 判断失误 = 信息真的丢了，威胁决策 1 的"知道有这件事存在"不可妥协项。

**机制**
- **日常（机制 B）**：所有 INDEX 强制 `keywords` 字段（3-5 个）。Claude 用当前 brainstorm 主题关键词与每条对比：
  - 高分（2+ 词撞）→ 自动展开
  - 中分（1 词撞）→ 展开 + 告知用户
- **保护（机制 C 轻量版）**：brainstorming 开场必须列出已展开的 INDEX 条目清单
- **用户强制**：用户说 "去读 X" → 强制展开

### 5.3 保留不变
WIP state file protocol / Research Trigger Check / BS-1 增量写 / 5 问 hard gate / Visual Companion — 全部保留。

### 5.4 可逆性
🟢 仅修改 `.claude/skills/brainstorming/SKILL.md`，git revert 回滚。

## 6. 文件体系改造

### 6.1 Frontmatter schema（统一 metadata）

所有 `docs/journal/*.md`、`docs/research/*.md`、`docs/superpowers/specs|plans/*.md` 强制字段：

```yaml
---
date: YYYY-MM-DD
topic: <中文一句话>
type: journal | research | spec | plan | decision
status: open | in_progress | parked | resolved
keywords: [kw1, kw2, kw3]   # 3-5 个，服务 Section 5.2 的 B 机制
urgency: infra-affecting | trigger-date:YYYY-MM-DD | normal   # 仅 parked
---
```

一次性迁移约 40-50 现有文件，约 2-3 小时。

### 6.2 新 INDEX 文件

| 文件 | 现状 | 变更 |
|------|------|------|
| `docs/journal/INDEX.md` | 已有 | 补齐每条 keywords |
| `docs/research/INDEX.md` | **不存在** | 新建，按年份 / 类型分组 |
| `docs/superpowers/INDEX.md` | **不存在** | 新建，specs / plans 分组 |
| `docs/decisions.md` | 已是索引式 | 每条决策补 keywords |

条目格式（参考 journal/INDEX.md）每条 1-2 行，含 keywords。

### 6.3 architecture.md 摘要卡

在 architecture.md 顶部加 `## 0. 摘要卡`：
- 核心表名清单（每表一行）
- 核心接口契约（每 endpoint 一行：method + path + 核心 response）
- ⚠️ 约束汇总（单行）
- **硬上限 1.5k token**

全文 1-N 章保留。

### 6.4 memory-cleanup skill

**位置**: `.claude/skills/memory-cleanup/SKILL.md`

**流程**：
1. 扫描 `docs/journal/` + `docs/decisions.md` + `docs/archive/`
2. 识别候选：
   - `status: resolved` 超 6 个月
   - `status: parked` + `urgency: normal` 超 12 个月
3. 给用户清单（每次 ≤10 条），**逐条 y/n 确认**（默认 no）
4. 确认的：搬到 `docs/archive/YYYY-QN/`，合并摘要 → `docs/archive/YYYY-QN-summary.md`，INDEX 指针更新到 archive
5. 原文**搬不删**，git 追踪可找回

**反误删 3 层保护**：每次 ≤10 条 / 显式 y/n / 搬不删。

### 6.5 INDEX 持续维护机制

| 谁产出新文件 | 要更新哪个 INDEX | 负责方 |
|-------------|----------------|-------|
| journal skill 入库 | `docs/journal/INDEX.md` | 已在做（现状） |
| research-before-decision skill 落盘 | `docs/research/INDEX.md` | **新增**步骤 |
| brainstorming skill 产出 spec | `docs/superpowers/INDEX.md` | **新增**步骤 |
| writing-plans skill 产出 plan | `docs/superpowers/INDEX.md` | **新增**步骤 |
| 决策关闭 → `docs/decisions.md` | 文件本身是索引 | Claude |
| **保底**: claudemd-check skill | 扫描四个目录，文件未入 INDEX 则报警 | **新增**步骤 |

**不用 PostToolUse hook**，靠 skill 内嵌 + claudemd-check 验证双保险。

## 7. 迁移与回退

### 7.1 3 周实施路线

**周 1 — 文件体系地基（决策 6）**
1. 给所有 `docs/journal/*.md` / `docs/research/*.md` / `docs/superpowers/specs|plans/*.md` 补齐 frontmatter（含 keywords / status / urgency）
2. 新建 `docs/research/INDEX.md`（按年份 + 类型分组）
3. 新建 `docs/superpowers/INDEX.md`（specs + plans 分组）
4. 给 `docs/journal/INDEX.md` 补齐每条 keywords
5. 给 `docs/decisions.md` 每条补 keywords
6. 给 `docs/architecture.md` 加 `## 0. 摘要卡` 章节（1.5k 上限）

**周 2 — 核心重构（决策 4 + 5）**

⚠️ **步骤顺序硬约束**：Step 1 → Step 2 → Step 5 不可调换。若 Step 5（CLAUDE.md `@import`）先于 Step 1-2（`session-rules` 文件创建 + 内容填充）执行，会出现 `@import` 指向空/骨架文件的时间窗口，期间新开 session 会丢失运行规则。Step 3-4、6-9 可在 Step 2 完成后并行。

1. 新建 3 个 skill：`session-rules` / `skill-catalog` / `ccb-protocol-reference`
2. 把 session-init Step 4/5 内容搬到前两个 skill；从 `docs/ccb-protocol.md` 提炼到第 3 个（Step 1-2 完成 = `session-rules/SKILL.md` 已含完整运行规则表）
3. 重写 session-init SKILL.md（只留仪表盘 + INDEX 读取 + git 状态 + 停车场扫描）
4. 更新 session-init SKILL.md frontmatter `description` 字段（§4.4）
5. session-init 入口加 marker 文件检测
6. **⚠️ 仅在 Step 1-2 完成后**：CLAUDE.md 结尾加 `@.claude/skills/session-rules/SKILL.md` + 重写"Skill 使用"段落（§4.3）
7. brainstorming SKILL.md 改 Mandatory Read List + 加 INDEX 相关性判断机制
8. 更新 research-before-decision / brainstorming / writing-plans skill 的 Deliverable 步骤（加"更新对应 INDEX"）
9. 更新 claudemd-check skill 加"扫描 docs 目录检查 INDEX 同步"

**周 3 — cleanup + 验证**
1. 新建 `.claude/skills/memory-cleanup/` skill
2. 手动跑一次 dry run，校准识别算法
3. 量化验证：开新 session 量 session-init 占用，必须 ≤ 10%（目标 ~3%）
4. 量化验证：跑一次 brainstorming，首轮 context 占用 ≤ 5k

### 7.2 回退路径

**每周末是 git 安全点**：
- 周 1 后出问题 → revert 回迁前
- 周 2 后出问题 → revert 到周 1 末（文件体系保留，skill 回原样）
- 周 3 后出问题 → revert cleanup skill 即可

**全盘回退**：`git revert` 所有相关 commit，一次性回到现状。所有改动都在 `docs/` + `.claude/skills/` + `CLAUDE.md`，无代码层影响。

### 7.3 验证方法

| 指标 | 当前 | 目标 | 测量方法 |
|------|------|------|---------|
| session-init 开机 context 占用 | 20-30% | ≤ 10%（目标 ~3%）| 开新 session 后用 /context 命令 |
| brainstorming 首轮 context 占用 | 10-15k | ≤ 5k | 开新 session 跑 brainstorm 后量 |
| INDEX 准确性 | N/A | 新文件 100% 入 INDEX | claudemd-check 扫描报告 |
| compact 后重读 | 全量 | 跳过 | session-marker 存在时应跳过完整流程 |

## 8. 变更清单

### 8.1 新增文件
- `.claude/skills/session-rules/SKILL.md`
- `.claude/skills/skill-catalog/SKILL.md`
- `.claude/skills/ccb-protocol-reference/SKILL.md`
- `.claude/skills/memory-cleanup/SKILL.md`
- `docs/research/INDEX.md`
- `docs/superpowers/INDEX.md`

### 8.2 修改文件
- `CLAUDE.md`（加 `@import` + 重写"Skill 使用"段落第 101-103 行，见 §4.3）
- `.claude/skills/session-init/SKILL.md`（删 Step 4/5，加 marker 检测，**更新 frontmatter `description` 字段**见 §4.4）
- `.claude/skills/brainstorming/SKILL.md`（改 Mandatory Read List + 加 INDEX 相关性机制）
- `.claude/skills/research-before-decision/SKILL.md`（加 Deliverable 更新 INDEX 步骤）
- `.claude/skills/writing-plans/SKILL.md`（加 Deliverable 更新 INDEX 步骤）
- `.claude/skills/journal/SKILL.md`（加 keywords 字段强制）
- `.claude/skills/claudemd-check/SKILL.md`（加 INDEX 同步扫描）
- `docs/architecture.md`（加 `## 0. 摘要卡`）
- `docs/decisions.md`（每条补 keywords）
- `docs/journal/INDEX.md`（每条补 keywords）
- 所有 `docs/journal/*.md` / `docs/research/*.md` / `docs/superpowers/specs|plans/*.md`（补 frontmatter）

### 8.3 运行时变更
- `.ccb/session-marker` 文件（运行时创建，session 结束清理）

### 8.4 不涉及
- ❌ `src/**`（无代码改动）
- ❌ `scripts/**`（无脚本改动）
- ❌ `package.json`（无依赖变更）
- ❌ 外部服务 / API / 数据库

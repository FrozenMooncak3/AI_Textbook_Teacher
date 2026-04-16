---
date: 2026-04-15
topic: Session-Init Token Optimization 实施计划
type: plan
status: resolved
keywords: [session-init, token, index, frontmatter, memory-cleanup]
---

# Session-Init Token Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Adaptation note**: this is a docs/skill refactor, not a code change. There are no unit tests. Each task ends with a manual verification step (open new session, count tokens, check file rendering) instead of a `pytest` run. TDD doesn't apply; "verify before commit" does.

**Goal:** 把 Claude Code session-init 开机 context 占用从 20-30% 降到 ≤10%（实测目标 ~3%），同时保留"知道每件事存在"的全局视野。

**Architecture:** 路线 D 混合架构 — 多层 INDEX（主体）+ 统一 frontmatter schema + memory-cleanup skill（兜底）+ obra/ECC/claude-mem 零件级借鉴。session-init 拆成 3 个新 skill（`session-rules` 通过 CLAUDE.md `@import` 始终加载，`skill-catalog` / `ccb-protocol-reference` 按需加载），compact/--resume 通过 `.ccb/session-marker` 跳过重读。

**Tech Stack:** Markdown + YAML frontmatter + Claude Code skills + CLAUDE.md `@import` 语法 + bash + git。零 src/ 改动，零依赖变更。

**Spec:** `docs/superpowers/specs/2026-04-15-session-init-token-optimization-design.md`
**WIP 决策追溯**: `docs/superpowers/specs/2026-04-15-session-init-token-optimization-brainstorm-state.md`
**关键调研**: `docs/research/2026-04-15-claude-md-import-syntax.md`（@import 语法）/ `docs/research/2026-04-15-session-init-optimization-synthesis.md`（外部零件采纳清单）

---

## File Structure

### 新增（6 个）
- `.claude/skills/session-rules/SKILL.md` — 当前 session-init Step 4（运行规则 + skill 自动触发表）
- `.claude/skills/skill-catalog/SKILL.md` — 当前 session-init Step 5（23 个 skill 手册）
- `.claude/skills/ccb-protocol-reference/SKILL.md` — `docs/ccb-protocol.md` 精华提炼 + dispatch 模板
- `.claude/skills/memory-cleanup/SKILL.md` — 周期清理 skill（搬不删 + 用户逐条 y/n）
- `docs/research/INDEX.md` — research 目录主索引（按年份 + 类型分组）
- `docs/superpowers/INDEX.md` — superpowers 目录主索引（specs + plans 分组）

### 修改（11 类）
- `CLAUDE.md` — 末尾加 `@import` + 重写"Skill 使用"段落
- `.claude/skills/session-init/SKILL.md` — 删 Step 4/5、加 marker 检测、改 frontmatter description
- `.claude/skills/brainstorming/SKILL.md` — 改 Mandatory Read List + 加 INDEX 相关性判断机制
- `.claude/skills/research-before-decision/SKILL.md` — Deliverable 加"更新 INDEX"步骤
- `.claude/skills/writing-plans/SKILL.md` — Deliverable 加"更新 INDEX"步骤
- `.claude/skills/journal/SKILL.md` — 强制 keywords 字段
- `.claude/skills/claudemd-check/SKILL.md` — 加"扫描 docs 目录检查 INDEX 同步"
- `docs/architecture.md` — 顶部插入 `## 0. 摘要卡` 章节（≤1.5k token）
- `docs/decisions.md` — 每条决策补 keywords
- `docs/journal/INDEX.md` — 每条补 keywords
- 所有 `docs/journal/*.md` / `docs/research/*.md` / `docs/superpowers/specs|plans/*.md`（约 130 个文件）— 补齐 frontmatter

### 运行时
- `.ccb/session-marker` — runtime 文件，session-init 创建，可通过手动删除强制重载

### 0 影响
- ❌ `src/**` / `scripts/**` / `package.json` / 外部服务 / 数据库

---

## Hard Ordering Constraint（最关键的施工规则）

**Week 2 内部**：Step 1 → Step 2 → Step 6（CLAUDE.md `@import`）顺序不可调换。

**为什么**：如果 Step 6 先于 Step 1-2 执行，CLAUDE.md 会 `@import` 一个空/骨架的 `session-rules/SKILL.md`，期间任何新开 session 都丢失运行规则表，自动派发 / 想法分流 / skill 触发全失效。

**强制做法**：每个 Week 2 任务在 commit 前重新阅读这条约束。

---

## 验收标准（Week 3 末必须全部满足）

| 指标 | 当前 | 目标 | 测量方法 |
|------|------|------|---------|
| session-init 开机 context 占用 | 20-30% | ≤ 10%（目标 ~3%） | 开新 session，运行 `/context` |
| brainstorming 首轮 context 占用 | 10-15k | ≤ 5k | 开新 session 调 `/brainstorming`，量增量 |
| INDEX 准确性 | N/A | 新文件 100% 入 INDEX | 跑 claudemd-check |
| Compact 后行为 | 全量重读 | 跳过 | session-marker 存在时 session-init 应跳过 Step 2 完整流程 |

---

# Week 1 — 文件体系地基（决策 6）

每个文件改完独立 commit，方便回退。Week 1 末打 git tag `session-init-opt-week1`。

---

### Task 1.1: Frontmatter schema 文档化

**Files:**
- Create: `docs/conventions/frontmatter-schema.md`

**Why first:** 后续所有补 frontmatter 任务要照这个 schema 走，先冻结规格再批量改文件。

- [ ] **Step 1: Write the schema doc**

```markdown
# Frontmatter Schema for docs/

> 适用于 docs/journal/*.md、docs/research/*.md、docs/superpowers/specs|plans/*.md
> 强制字段缺失 → claudemd-check 报错

## 必填字段

| 字段 | 类型 | 取值 | 用途 |
|------|------|------|------|
| `date` | YYYY-MM-DD | ISO 日期 | 时间排序 |
| `topic` | string | 中文一句话 | INDEX 一行展示 |
| `type` | enum | `journal` \| `research` \| `spec` \| `plan` \| `decision` | 路由到对应 INDEX |
| `status` | enum | `open` \| `in_progress` \| `parked` \| `resolved` | memory-cleanup 候选判定 |
| `keywords` | array[string] | 3-5 个，中英混排 OK | brainstorming INDEX 相关性匹配 |

## 可选字段（仅 parked 状态）

| 字段 | 取值 | 用途 |
|------|------|------|
| `urgency` | `infra-affecting` \| `trigger-date:YYYY-MM-DD` \| `normal` | session-init 停车场扫描决定是否拉出 |

## 完整示例

\`\`\`yaml
---
date: 2026-04-15
topic: Session-init token 优化设计
type: spec
status: in_progress
keywords: [session-init, token, index, frontmatter, memory-cleanup]
---
\`\`\`
```

- [ ] **Step 2: Verify schema renders correctly**

打开文件确认 markdown 没坏。

- [ ] **Step 3: Commit**

```bash
git add docs/conventions/frontmatter-schema.md
git commit -m "docs(conventions): add frontmatter schema for INDEX-driven token optimization"
```

---

### Task 1.2: 给 docs/journal/*.md 补 frontmatter

**Files:**
- Modify: 所有 `docs/journal/*.md`（除 INDEX.md，约 37 个文件）

- [ ] **Step 1: 列出所有需要改的文件**

```bash
ls docs/journal/*.md | grep -v INDEX.md
```

记录数量。

- [ ] **Step 2: 逐个文件补 frontmatter**

每个文件顶部插入：

```yaml
---
date: <从文件名提取 YYYY-MM-DD>
topic: <扫一眼文件第一段，提一句话中文摘要>
type: journal
status: <根据当前 INDEX.md 中该项归类：open / in_progress / parked / resolved>
keywords: [<3-5 个，从标题和首段提关键词>]
urgency: <仅当 status=parked：infra-affecting / trigger-date:YYYY-MM-DD / normal>
---
```

**关键判断**：status 直接对照 `docs/journal/INDEX.md` 当前归类——open 段下的就 open，parked 下的就 parked + 给 urgency。INDEX.md 里写了 "T1/T2/T3" 的 parked 项，T1 = `urgency: infra-affecting`（理由：T1 = 当前里程碑必做 = 横切影响），T2/T3 = `urgency: normal`，trigger 写明 "M2 开始时" 之类的就用 `trigger-date:` 形式。

- [ ] **Step 3: Verify frontmatter parses**

```bash
for f in docs/journal/*.md; do
  if [ "$(basename "$f")" = "INDEX.md" ]; then continue; fi
  head -1 "$f" | grep -q "^---$" || echo "MISSING FRONTMATTER: $f"
done
```

期望：无输出。

- [ ] **Step 4: Commit**

```bash
git add docs/journal/*.md
git commit -m "docs(journal): add frontmatter to all entries per schema"
```

---

### Task 1.3: 给 docs/research/*.md 补 frontmatter

**Files:**
- Modify: 所有 `docs/research/*.md`（除 README.md 和 INDEX.md，约 31 个）

- [ ] **Step 1: 检查现有 frontmatter 状态**

```bash
for f in docs/research/*.md; do
  if [ "$(basename "$f")" = "README.md" ]; then continue; fi
  head -1 "$f" | grep -q "^---$" && echo "HAS: $f" || echo "MISSING: $f"
done
```

记录哪些已经有（2026-04-14 之后用 research-before-decision skill 落盘的应该都有），哪些缺。

- [ ] **Step 2: 给缺的补 frontmatter**

老文件常见 frontmatter 缺 `keywords` / `status` / `type`。补齐：
- `type: research`
- `status: resolved`（research 文件一旦落盘就视为 resolved，除非用户标 in_progress）
- `keywords`：从文件标题和"问题"段提取 3-5 个

- [ ] **Step 3: 给已有 frontmatter 的文件补缺失字段**

检查每个 HAS 文件的 frontmatter，缺什么补什么。已有的字段不动。

- [ ] **Step 4: Verify**

```bash
for f in docs/research/*.md; do
  if [ "$(basename "$f")" = "README.md" ]; then continue; fi
  head -10 "$f" | grep -q "^keywords:" || echo "MISSING keywords: $f"
done
```

期望：无输出。

- [ ] **Step 5: Commit**

```bash
git add docs/research/*.md
git commit -m "docs(research): backfill frontmatter (keywords/status/type)"
```

---

### Task 1.4: 给 docs/superpowers/specs/*.md 和 plans/*.md 补 frontmatter

**Files:**
- Modify: 所有 `docs/superpowers/specs/*.md`、`docs/superpowers/plans/*.md`（约 60 个）

- [ ] **Step 1: 列文件**

```bash
ls docs/superpowers/specs/*.md docs/superpowers/plans/*.md
```

- [ ] **Step 2: 逐个补 frontmatter**

对每个 spec：
```yaml
---
date: <文件名 YYYY-MM-DD>
topic: <从文件名 + 第一段提取>
type: spec
status: <对照 project_status.md：进行中=in_progress，老 milestone 已完成=resolved，brainstorm-state 文件且 brainstorm 未完=in_progress>
keywords: [...]
---
```

对每个 plan：相同结构，`type: plan`，status 同理（unchecked items 多 = in_progress，全 checked = resolved）。

- [ ] **Step 3: Verify**

```bash
for f in docs/superpowers/specs/*.md docs/superpowers/plans/*.md; do
  head -10 "$f" | grep -q "^keywords:" || echo "MISSING: $f"
done
```

期望：无输出。

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/*.md docs/superpowers/plans/*.md
git commit -m "docs(superpowers): add frontmatter to specs and plans"
```

---

### Task 1.5: 给 docs/decisions.md 每条决策补 keywords

**Files:**
- Modify: `docs/decisions.md`

- [ ] **Step 1: Read current file**

`docs/decisions.md` 是单文件多决策结构。每条决策有自己的标题。

- [ ] **Step 2: 给每条决策末尾追加 keywords 行**

格式：

```markdown
## 决策 N: <标题>
<原文不动>

**Keywords**: kw1, kw2, kw3
```

- [ ] **Step 3: Verify all entries have keywords**

```bash
grep -c "^## 决策" docs/decisions.md
grep -c "^\*\*Keywords\*\*:" docs/decisions.md
```

两个数字必须相等。

- [ ] **Step 4: Commit**

```bash
git add docs/decisions.md
git commit -m "docs(decisions): add keywords to each closed decision"
```

---

### Task 1.6: 给 docs/journal/INDEX.md 每条补 keywords

**Files:**
- Modify: `docs/journal/INDEX.md`

- [ ] **Step 1: Read current INDEX**

每行格式 `- [tag] 描述 → [link]`。改成 `- [tag] 描述 \`[kw1, kw2, kw3]\` → [link]`（keywords 用 inline code 让视觉不打架）。

- [ ] **Step 2: 逐行补 keywords**

只有未来 brainstorming 真的会按 keywords 匹配的 open / in_progress / parked 项需要严格补，resolved 项可以宽松。但**全部都要补**，便于 grep。

- [ ] **Step 3: Verify**

```bash
# 计算列表行数 vs 含 keywords 的行数（用 -F 固定字符串，避免反引号转义问题）
total=$(grep -c "^- \[" docs/journal/INDEX.md)
with_kw=$(grep -cF '`[' docs/journal/INDEX.md)
echo "total=$total with_keywords=$with_kw"
```

差额必须为 0。

- [ ] **Step 4: Commit**

```bash
git add docs/journal/INDEX.md
git commit -m "docs(journal): add keywords to every INDEX entry"
```

---

### Task 1.7: 新建 docs/research/INDEX.md

**Files:**
- Create: `docs/research/INDEX.md`

- [ ] **Step 1: 扫描 research 目录**

```bash
ls docs/research/*.md | grep -v -E "INDEX|README"
```

- [ ] **Step 2: 写 INDEX**

按 spec §6.2 的格式：年份 + 类型分组。从每个文件的 frontmatter 提取 `date` / `topic` / `keywords` / `triage`。

模板：

```markdown
# Research Index

> 所有 docs/research/*.md 的全局索引。新调研落盘必须更新本文件（research-before-decision skill / brainstorming skill 自动维护）。
> 关键字段：triage（🟢 不调研未落盘 / 🟡 轻 / 🔴 重）。

## 2026-04 · 云部署调研
- [2026-04-14] OCR 选项 `[ocr, vision-api, paddleocr]` 🔴 → [link](2026-04-14-cloud-ocr-options.md)
- ...

## 2026-04 · 教学 / 学习科学
- ...

## 2026-04 · 工程 / 工具
- [2026-04-15] @import 语法 `[claude-md, import, syntax]` 🟡 → [link](2026-04-15-claude-md-import-syntax.md)
- ...

## 2026-04-15 · Session-Init 优化
- [2026-04-15] claude-mem repo 分析 `[claude-mem, mcp, agpl]` 🔴 → [link](2026-04-15-claude-mem-repo-analysis.md)
- ...
```

不强求时间分组规整，按"主题群"分组用户更易找。

- [ ] **Step 3: Verify all files indexed**

```bash
file_count=$(ls docs/research/*.md | grep -v -E "INDEX|README" | wc -l)
index_lines=$(grep -c "→ \[link\]" docs/research/INDEX.md)
echo "files=$file_count indexed=$index_lines"
```

差额必须为 0。

- [ ] **Step 4: Commit**

```bash
git add docs/research/INDEX.md
git commit -m "docs(research): add global INDEX with keywords + triage"
```

---

### Task 1.8: 新建 docs/superpowers/INDEX.md

**Files:**
- Create: `docs/superpowers/INDEX.md`

- [ ] **Step 1: 扫描**

```bash
ls docs/superpowers/specs/*.md docs/superpowers/plans/*.md
```

- [ ] **Step 2: 写 INDEX**

```markdown
# Superpowers Index

> 所有 specs / plans 的全局索引。brainstorming skill / writing-plans skill 落盘时自动更新。

## Specs

### 进行中（in_progress）
- [2026-04-15] Session-init token 优化 `[session-init, token, index]` → [spec](specs/2026-04-15-session-init-token-optimization-design.md)
- ...

### 已完成（resolved）
- [2026-03-21] Architecture redesign `[architecture, redesign]` → [spec](specs/2026-03-21-architecture-redesign-design.md)
- ...

### Brainstorm WIP
- [2026-04-12] 云部署 `[cloud, deployment]` → [WIP](specs/2026-04-12-cloud-deployment-brainstorm-state.md)
- ...

## Plans

### 进行中
- ...

### 已完成
- ...
```

- [ ] **Step 3: Verify**

```bash
file_count=$(ls docs/superpowers/specs/*.md docs/superpowers/plans/*.md | wc -l)
index_lines=$(grep -cE "→ \[(spec|plan|WIP)\]" docs/superpowers/INDEX.md)
echo "files=$file_count indexed=$index_lines"
```

差额必须为 0。

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/INDEX.md
git commit -m "docs(superpowers): add global INDEX for specs + plans"
```

---

### Task 1.9: docs/architecture.md 加摘要卡章节

**Files:**
- Modify: `docs/architecture.md`（顶部插入 `## 0. 摘要卡`）

- [ ] **Step 1: 读 architecture.md 现状**

确认现有章节编号（找出"## 1."的位置）。

- [ ] **Step 2: 在"## 1."前插入摘要卡**

格式（≤ 1.5k token，约 600 字）：

```markdown
## 0. 摘要卡

> brainstorming skill 默认只读这一章；详细内容按需查 §1-N。

### 核心表（24 张）
users / books / modules / kps / questions / mistakes / ... （每行 ≤80 字符，只列名 + 一句话职责）

### 核心 API 端点
- `POST /api/books/upload` — PDF 上传 + 启动处理
- `GET /api/books/[id]/module-status` — 模块级处理状态
- `POST /api/books/[id]/extract?moduleId=N` — 手动重试模块
- ... (从现有 §"接口契约"提炼，每行 method + path + 一句话)

### AI 角色（5 个）
extractor / coach / examiner / reviewer / assistant — 详见 §X

### 核心约束（⚠️）
- OCR_PROVIDER 等环境变量必须设
- 大 PDF 分块阈值 35K 字符
- ... （汇总 architecture.md 全文 ⚠️ 标记，每行 ≤80 字符）

---
```

- [ ] **Step 3: 验证 token 上限**

```bash
# 摘要卡章节字符数（中文 ≈ 1 char ≈ 1.5 tokens）应在 1000 字以内 ≈ 1.5k tokens
awk '/^## 0\. 摘要卡/,/^## 1\./' docs/architecture.md | wc -c
```

期望：< 2000 字符。

**Windows git-bash 兼容备用**：如果 awk range 模式对中文标题不工作，用 Read 工具直接看新章节字符数，或：
```bash
start=$(grep -n "^## 0\. 摘要卡" docs/architecture.md | cut -d: -f1)
end=$(grep -n "^## 1\." docs/architecture.md | cut -d: -f1)
sed -n "${start},${end}p" docs/architecture.md | wc -c
```

- [ ] **Step 4: Commit**

```bash
git add docs/architecture.md
git commit -m "docs(architecture): add §0 summary card for token-light loading"
```

---

### Task 1.10: Week 1 安全点 + tag

- [ ] **Step 1: 验证 Week 1 全部完成**

```bash
git log --oneline -10
```

应看到 1.1-1.9 共 9 条 commit。

- [ ] **Step 2: 打 git tag**

```bash
git tag session-init-opt-week1
```

**回退路径**：Week 2 出问题 → `git reset --hard session-init-opt-week1`。

- [ ] **Step 3: 通知用户 Week 1 完成**

向用户报告：
- Week 1 完成内容（schema + frontmatter 全量补齐 + 2 新 INDEX + architecture 摘要卡）
- 下一步 Week 2 涉及 session-init 重构，开新 session 时 dashboard 内容暂时不变（只是文件多了）

---

# Week 2 — 核心重构（决策 4 + 5）

## ⚠️ 硬约束

**Step 6（CLAUDE.md 加 @import）必须在 Step 1-2（创建并填充 session-rules SKILL.md）之后**。否则 @import 指向空文件，新开 session 丢运行规则。

执行顺序：1.1 → 1.2 → 2.1 → 2.2 → 2.3 → 3.1 → 3.2 → 4 → 5 → 6 → 7 → 8 → 9。

---

### Task 2.1: 新建 session-rules skill 骨架

**Files:**
- Create: `.claude/skills/session-rules/SKILL.md`

- [ ] **Step 1: 创建空骨架**

```markdown
---
name: session-rules
description: Session-wide 运行规则（自动派发 / 想法分流 / skill 自动触发表 / git 管理 / chain routing）。通过 CLAUDE.md @import 始终加载，无需手动调用。
---

# Session-Wide 运行规则

> 本 skill 通过 CLAUDE.md `@import` 自动加载，规则全程生效，不需要用户提醒。

(内容由 Task 2.2 填充)
```

- [ ] **Step 2: Verify file created**

```bash
ls -la .claude/skills/session-rules/SKILL.md
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/session-rules/SKILL.md
git commit -m "feat(skills): scaffold session-rules skill (empty)"
```

---

### Task 2.2: 把 session-init Step 4 内容搬进 session-rules

**Files:**
- Modify: `.claude/skills/session-rules/SKILL.md`
- Read: `.claude/skills/session-init/SKILL.md`（line 113-176，Step 4 全部）

- [ ] **Step 1: 复制 session-init Step 4 全文到 session-rules**

`session-init/SKILL.md` 的 Step 4 包含：
- 规则 1: 自动派发
- 规则 2: 想法分流
- 规则 3: Skill 自动触发表
- 规则 4: Git 管理
- 规则 5: Chain Routing

**逐字保留**这 5 条规则（决策 4.5 强约束："skill 自动触发表逐字保留"）。

骨架填充后结构：

```markdown
---
name: session-rules
description: ...（保持不变）
---

# Session-Wide 运行规则

> 本 skill 通过 CLAUDE.md `@import` 自动加载...

## 规则 1: 自动派发
（从 session-init Step 4 全文复制）

## 规则 2: 想法分流
（从 session-init Step 4 全文复制）

## 规则 3: Skill 自动触发
（从 session-init Step 4 全文复制——这是最关键的表，逐字搬）

## 规则 4: Git 管理
（从 session-init Step 4 全文复制）

## 规则 5: Chain Routing
（从 session-init Step 4 全文复制）

---

## 行为契约
（从 session-init 末尾"行为契约"段复制）
```

- [ ] **Step 2: Verify 内容完整**

```bash
# 检查 5 条规则全在
grep -c "^## 规则" .claude/skills/session-rules/SKILL.md
# 期望 5
```

- [ ] **Step 3: Verify skill 自动触发表完整**

```bash
# 这是最容易丢的一行
grep "用户说\"停车场\"" .claude/skills/session-rules/SKILL.md
```

期望：找到 1 行。

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/session-rules/SKILL.md
git commit -m "feat(skills): populate session-rules with running rules from session-init Step 4"
```

---

### Task 2.3: 新建 skill-catalog skill 并搬入 session-init Step 5

**Files:**
- Create: `.claude/skills/skill-catalog/SKILL.md`
- Read: `.claude/skills/session-init/SKILL.md`（line 179-227，Step 5 全部）

- [ ] **Step 1: 创建 skill-catalog/SKILL.md**

```markdown
---
name: skill-catalog
description: 23 个 skill 的完整使用手册（核心流程 11 个 + Agent 参考 7 个 + 低频工具 5 个 + 用户命令 3 个）。Claude 不知道某 skill 干什么时按需查阅。
---

# Skill 使用手册

（从 session-init Step 5 完整复制：核心流程 skill 表 + Agent 参考 skill 表 + 低频工具 skill 表 + 用户命令表）
```

- [ ] **Step 2: Verify all 4 skill tables present**

```bash
grep -c "^### " .claude/skills/skill-catalog/SKILL.md
# 期望 ≥ 4（核心 / agent / 低频 / 用户命令）
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/skill-catalog/SKILL.md
git commit -m "feat(skills): add skill-catalog with full skill manual from session-init Step 5"
```

---

### Task 2.4: 新建 ccb-protocol-reference skill

**Files:**
- Create: `.claude/skills/ccb-protocol-reference/SKILL.md`
- Read: `docs/ccb-protocol.md`

- [ ] **Step 1: 提炼 docs/ccb-protocol.md 精华**

读 `docs/ccb-protocol.md`，提取以下精华到新 skill：
- 角色分工（Claude PM / Codex 后端 / Gemini 前端）
- 派发模板（结构化 dispatch 的字段清单）
- 派发档位（轻 / 标准 / 重）判断标准
- 派发流程的 3-step 协议（tier confirm / user approval / English dispatch）

不要全文复制 `docs/ccb-protocol.md`——只取派发时会用到的部分。

```markdown
---
name: ccb-protocol-reference
description: CCB 派发协议精华（角色分工 / 派发模板 / 档位判断 / 3-step 协议）。被 structured-dispatch 链式调用，提供 dispatch 时所需的精确格式。
---

# CCB Protocol Quick Reference

> 完整版见 `docs/ccb-protocol.md`。本 skill 只含 dispatch 时高频查的部分。

## 角色分工
...

## 派发档位判断
...

## 派发模板
...

## 3-Step Protocol
...
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/ccb-protocol-reference/SKILL.md
git commit -m "feat(skills): add ccb-protocol-reference (essence extracted from docs/ccb-protocol.md)"
```

---

### Task 2.5: 重写 session-init/SKILL.md（删 Step 4/5 + 加 marker）

**Files:**
- Modify: `.claude/skills/session-init/SKILL.md`

- [ ] **Step 1: 改 frontmatter description**

把第 3 行 `description:` 改为：

```yaml
description: CEO 仪表盘 + git 状态 + INDEX 扫描。Session 首次启动时调用；compact/resume 后通过 .ccb/session-marker 跳过重读，仅刷新仪表盘。
```

- [ ] **Step 2: 在 Step 1 前插入 marker 检测**

在当前 `## Step 1: Load Context` 前插入：

```markdown
## Step 0: Compact/Resume Detection

```bash
test -f .ccb/session-marker && echo "RESUME" || echo "FRESH"
```

- 如果输出 `RESUME`：跳过 Step 1-2 完整重读，只跑 git status + 输出"恢复"型仪表盘（一行：`📊 已从 compact/resume 恢复，最近 commit: <git log -1 --oneline>`），然后 exit。
- 如果输出 `FRESH`：继续 Step 1。
```

- [ ] **Step 3: 改 Step 1 的 Load Context 表**

**先 grep 确认现状**（避免 Edit 因表项不在而失败）：
```bash
grep -n "decisions.md\|ccb-protocol.md\|architecture.md" .claude/skills/session-init/SKILL.md
```

确认这 3 项都在表里，再做以下修改：
- ❌ 删 `docs/decisions.md`（→ session 中按需 grep）
- ❌ 删 `docs/ccb-protocol.md`（→ ccb-protocol-reference skill 按需）
- ❌ 删 `docs/architecture.md` 全文（→ 改读 `docs/architecture.md` `## 0. 摘要卡`）
- ✅ 新增 `docs/research/INDEX.md`
- ✅ 新增 `docs/superpowers/INDEX.md`
- ✅ 保留 `docs/project_status.md`、`docs/journal/INDEX.md`、MEMORY.md

新表：

```markdown
| Source | What to extract |
|--------|----------------|
| `docs/project_status.md` | Current milestone, next step, blockers |
| `docs/journal/INDEX.md` | Open / in_progress / parked 项的 1 行摘要 + keywords |
| `docs/research/INDEX.md` | 调研知识库索引 |
| `docs/superpowers/INDEX.md` | Specs / plans 索引 |
| `docs/architecture.md` `## 0. 摘要卡` | 表名 + 接口契约 + ⚠️ 约束（不读 §1-N） |
| MEMORY.md | Already in context (auto-loaded) |
```

- [ ] **Step 4: 删除 Step 4 和 Step 5 整段**

整段删除（这两段已经搬到 session-rules / skill-catalog）。

- [ ] **Step 5: 在 Step 3 仪表盘输出后追加 marker 写入**

在 `## Step 3: CEO 仪表盘` 末尾加：

```markdown
## Step 4: 写入 marker

```bash
mkdir -p .ccb && touch .ccb/session-marker
```

后续 compact/resume 时 Step 0 检测到 marker 就跳过重读。

**手动强制重载**：用户删除 `.ccb/session-marker` 后开新 session 即重新跑完整流程。
```

- [ ] **Step 6: 保留"行为契约"段**

最后那段"## 行为契约"保留不变，但内容会和 session-rules 的"行为契约"重复——这是有意的（session-init 里的是缩略版给 dashboard 阶段用，session-rules 是详细版按 @import 始终在）。

- [ ] **Step 7: Verify session-init 体积大幅减少**

```bash
wc -l .claude/skills/session-init/SKILL.md
```

期望：原 237 行 → 改后 ≤ 100 行。

- [ ] **Step 8: Commit**

```bash
git add .claude/skills/session-init/SKILL.md
git commit -m "feat(skills): slim session-init (drop Step 4/5, add marker, swap to INDEX reads)"
```

---

### Task 2.6: ⚠️ CLAUDE.md 加 @import + 重写 Skill 使用段落

**前置硬约束**：必须 Task 2.1 + 2.2 已完成（即 `session-rules/SKILL.md` 已含完整 5 条规则）。

- [ ] **Step 0: 验证前置条件**

```bash
grep -c "^## 规则" .claude/skills/session-rules/SKILL.md
```

**必须输出 5**。如果是 0 或 missing，立刻 STOP——回去做 Task 2.1-2.2。

```bash
test -f .claude/skills/session-rules/SKILL.md && echo OK || echo MISSING
```

必须 OK。

- [ ] **Step 1: 修改 CLAUDE.md "Skill 使用" 段落**

定位当前 CLAUDE.md 第 101-103 行（"## Skill 使用"段落开头）。原文：

```markdown
## Skill 使用
每次会话开始，调用 session-init skill。它包含 CEO 仪表盘、运行规则和完整的 skill 使用手册。
详见 `.claude/skills/session-init/SKILL.md`。
```

替换为（spec §4.3.2 措辞）：

```markdown
## Skill 使用
每次会话首次启动时调用 session-init skill（CEO 仪表盘 + git 状态 + INDEX 扫描）。运行规则通过 CLAUDE.md `@import` 自动加载（`session-rules` skill）；skill 使用手册按需加载（`skill-catalog` skill）。Compact/resume 后 session-init 通过 `.ccb/session-marker` 自动跳过，只刷新仪表盘。详见 `.claude/skills/session-init/SKILL.md`。
```

- [ ] **Step 2: 文件末尾追加 @import**

CLAUDE.md 最末（"## 已关闭的决策" 之后）追加：

```markdown

@.claude/skills/session-rules/SKILL.md
```

- [ ] **Step 3: Verify @import 路径解析**

```bash
test -f .claude/skills/session-rules/SKILL.md && echo "@import target exists"
grep -n "^@" CLAUDE.md
```

期望：target exists + 看到 `@.claude/skills/session-rules/SKILL.md` 一行。

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claudemd): @import session-rules + rewrite Skill 使用 paragraph"
```

---

### Task 2.7: brainstorming skill 改 Mandatory Read List

**Files:**
- Modify: `.claude/skills/brainstorming/SKILL.md`

- [ ] **Step 1: 找 Mandatory Read List 段落**

```bash
grep -n "Mandatory Read List" .claude/skills/brainstorming/SKILL.md
```

- [ ] **Step 2: 修改读取表**

按 spec §5.1 改：

```markdown
## Mandatory Read List (Milestone-Level Work)

For milestone-level brainstorming, "explore project context" means reading these specific files:

| File | Why | 备注 |
|------|-----|------|
| ~~`docs/architecture.md`~~ → `docs/architecture.md` `## 0. 摘要卡` | 表名 + 接口契约 + ⚠️ 约束 | 全文按需 grep / 读相关章节 |
| ~~`docs/project_status.md`~~ | session-init 已加载 | 删 |
| ~~`docs/journal/INDEX.md`~~ | session-init 已加载 | 删 |
| ~~MEMORY.md~~ | auto-loaded | 删 |
| Previous milestone's spec (if any) | 通过 `docs/superpowers/INDEX.md` 按 keywords 匹配展开 | 不再默认读全文 |
| Related source code | 按 architecture.md 摘要卡的接口契约按需读 | 同 |
```

- [ ] **Step 3: 加 INDEX 相关性判断段落**

在 Mandatory Read List 后插入新段（spec §5.2）：

```markdown
## INDEX 相关性判断（机制 B+C 轻量版）

**核心风险**：INDEX 判断失误 = 信息真的丢了。

**机制**：
- **日常（机制 B）**：所有 INDEX 强制 `keywords` 字段（3-5 个）。Claude 用当前 brainstorm 主题关键词与每条对比：
  - 高分（2+ 词撞）→ 自动展开（读全文）
  - 中分（1 词撞）→ 展开 + 告知用户："已展开 [文件名]，因为 keyword [X] 撞了"
- **保护（机制 C 轻量版）**：brainstorming 开场必须列出已展开的 INDEX 条目清单
- **用户强制**：用户说 "去读 X" → 强制展开
```

- [ ] **Step 4: Verify 不破坏其他段落**

```bash
# checklist 11 项还在
grep -c "^[0-9]\+\." .claude/skills/brainstorming/SKILL.md
```

期望 ≥ 11。

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/brainstorming/SKILL.md
git commit -m "feat(skills): brainstorming reads INDEX summary cards, defers details to keyword match"
```

---

### Task 2.8: research-before-decision / writing-plans / journal skills 加 INDEX 维护步骤

**Files:**
- Modify: `.claude/skills/research-before-decision/SKILL.md`
- Modify: `.claude/skills/writing-plans/SKILL.md`
- Modify: `.claude/skills/journal/SKILL.md`

- [ ] **Step 1: research-before-decision 加 INDEX 步骤**

找 "Output File Format" 或 "Run Sequence Step 7"（落盘步骤）。在落盘 `docs/research/YYYY-MM-DD-<slug>.md` 之后加：

```markdown
**Step 7.1**: 更新 `docs/research/INDEX.md`，按主题分组追加一行：
`- [YYYY-MM-DD] <topic> \`[kw1, kw2]\` <triage 图标> → [link](<filename>)`
```

- [ ] **Step 2: writing-plans 加 INDEX 步骤**

找写完 plan 后的"Save plans to"段。追加：

```markdown
**Post-save**: 更新 `docs/superpowers/INDEX.md` Plans 段，追加新 plan 一行（含 keywords + status）。
```

- [ ] **Step 3: journal skill 加 keywords 字段强制**

找 journal 入库流程或 frontmatter 模板。强制要求每个新 journal 文件 frontmatter 含 `keywords: [...]`（3-5 个）+ status + urgency（如 parked）。

- [ ] **Step 4: brainstorming skill 加 INDEX 步骤**

`.claude/skills/brainstorming/SKILL.md` 中"Write design doc" Step 7c（final completeness check）后追加：

```markdown
**Step 7d**: 更新 `docs/superpowers/INDEX.md` Specs 段，追加新 spec 一行（in_progress 段下，含 keywords）。
```

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/research-before-decision/SKILL.md \
        .claude/skills/writing-plans/SKILL.md \
        .claude/skills/journal/SKILL.md \
        .claude/skills/brainstorming/SKILL.md
git commit -m "feat(skills): each producer skill now updates its INDEX on deliverable"
```

---

### Task 2.9: claudemd-check 加 INDEX 同步扫描

**Files:**
- Modify: `.claude/skills/claudemd-check/SKILL.md`

- [ ] **Step 1: 找现有检查清单段落**

```bash
grep -n "^## " .claude/skills/claudemd-check/SKILL.md
```

- [ ] **Step 2: 追加 INDEX 同步检查项**

```markdown
## 检查 N: INDEX 同步

扫描以下目录，每个目录里的文件必须在对应 INDEX 中有一行：

| 目录 | INDEX |
|------|-------|
| `docs/journal/*.md`（除 INDEX.md）| `docs/journal/INDEX.md` |
| `docs/research/*.md`（除 INDEX.md / README.md）| `docs/research/INDEX.md` |
| `docs/superpowers/specs/*.md` | `docs/superpowers/INDEX.md` |
| `docs/superpowers/plans/*.md` | `docs/superpowers/INDEX.md` |

bash 实现：

```bash
# journal
for f in docs/journal/*.md; do
  bn=$(basename "$f" .md)
  [ "$bn" = "INDEX" ] && continue
  grep -q "$bn" docs/journal/INDEX.md || echo "MISSING in journal INDEX: $bn"
done

# research
for f in docs/research/*.md; do
  bn=$(basename "$f" .md)
  [ "$bn" = "INDEX" -o "$bn" = "README" ] && continue
  grep -q "$bn" docs/research/INDEX.md || echo "MISSING in research INDEX: $bn"
done

# superpowers
for f in docs/superpowers/specs/*.md docs/superpowers/plans/*.md; do
  bn=$(basename "$f" .md)
  grep -q "$bn" docs/superpowers/INDEX.md || echo "MISSING in superpowers INDEX: $bn"
done
```

任一项报 MISSING → claudemd-check 失败，提醒用户补 INDEX。
```

- [ ] **Step 3: 加 frontmatter schema 检查**

也加一项扫描所有 `docs/journal|research|superpowers/{specs,plans}/*.md` 必须含 `keywords:` 字段。

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/claudemd-check/SKILL.md
git commit -m "feat(skills): claudemd-check now verifies INDEX sync + frontmatter schema"
```

---

### Task 2.10: Week 2 验证 + 安全点 tag

- [ ] **Step 1: 开新 session 实测**

**用户配合**：退出当前 session → 重启 → 让 session-init 跑一遍。观察并报告：
- session-init 是否输出"FRESH"分支
- dashboard 是否完整（停车场 / 决策 / 风险 / 近期完成 4 个板块）
- `.ccb/session-marker` 是否被创建

```bash
ls -la .ccb/session-marker
```

期望：文件存在。

- [ ] **Step 2: 二次开新 session 测 marker**

**这一步需要用户配合**（Claude 自己无法重启 CLI）。请用户：
1. 退出当前 Claude Code session
2. 重新启动一个新 session（不删 `.ccb/session-marker`）
3. 观察 session-init 输出，告诉 Claude：是 "RESUME" 分支还是 "FRESH" 分支
4. dashboard 是否仅显示一行恢复提示

期望：RESUME 分支 + 一行恢复提示。如果还跑全流程 → marker 没生效，回查 Task 2.5 Step 5 + Step 0 实现。

- [ ] **Step 3: /context 测 token 占用**

在新 session 跑 `/context`，记录 session-init 后的 context %。

期望：≤ 10%（目标 ~3%）。

- [ ] **Step 4: 测 brainstorming token**

新 session 调 `/brainstorming` 假装做一个小决策。观察：
- 是否还在读 architecture.md 全文（不应该）
- 是否读了 INDEX 而非全文（应该）

`/context` 增量应 ≤ 5k。

- [ ] **Step 5: tag**

```bash
git tag session-init-opt-week2
```

回退路径：Week 3 出问题 → `git reset --hard session-init-opt-week2`。

- [ ] **Step 6: 通知用户 Week 2 完成 + 量化数据**

报告实测 token 占用 vs 目标。

---

# Week 3 — Memory Cleanup + 最终验收

---

### Task 3.1: 新建 memory-cleanup skill

**Files:**
- Create: `.claude/skills/memory-cleanup/SKILL.md`

- [ ] **Step 1: 写 SKILL.md**

```markdown
---
name: memory-cleanup
description: 周期性清理陈旧 journal / decisions / 老 spec，搬到 docs/archive/YYYY-QN/，合并摘要写回 INDEX 指针。用户每季度或感觉文档膨胀时手动调用 /memory-cleanup。**搬不删**，git 可找回。
---

# Memory Cleanup

> 反误删 3 层保护：每次扫描 ≤10 条候选 / 用户逐条 y/n 确认（默认 no）/ 搬不删（git 追踪可找回）

## 流程

### Step 1: 扫描候选

**唯一权威源是 frontmatter `date` 字段**——文件 mtime 在 fresh clone 后会全部重置，会把老文件误判为新。mtime 只能粗筛。

```bash
# mtime 仅作粗筛 hint
find docs/journal -name "*.md" -mtime +180 2>/dev/null | head -20
```

具体识别算法（**以 frontmatter date 为准**）：
- `status: resolved` 且 frontmatter `date` 距今 > 6 个月 → 候选
- `status: parked` 且 `urgency: normal` 且 frontmatter `date` 距今 > 12 个月 → 候选
- 不动 `status: open / in_progress`
- 不动 `urgency: infra-affecting / trigger-date:*` 项

### Step 2: 给用户清单

输出格式（每次最多 10 条）：

\`\`\`
候选清单（搬到 docs/archive/2026-Q2/）：

1. [resolved 240天前] docs/journal/2026-03-22-m0-verification.md — M0 最终验证通过
   keywords: [m0, verification, foundation]
   y/n? [n]: _

2. ...
\`\`\`

### Step 3: 用户逐条 y/n（默认 no）

只处理 y 的项。

### Step 4: 搬运（不删）

```bash
mkdir -p docs/archive/YYYY-QN
git mv <原路径> docs/archive/YYYY-QN/
```

### Step 5: 合并摘要

在 `docs/archive/YYYY-QN-summary.md` 追加：

\`\`\`markdown
## <原文件名>
- date: ...
- topic: ...
- 摘要: <从原文 1 段提炼>
- 原 link: <archive 后的相对路径>
\`\`\`

### Step 6: 更新 INDEX

把原 INDEX 中该条改为指向 archive：
\`\`\`
- [archived] <原描述> → [archive](archive/YYYY-QN/<file>.md)
\`\`\`

### Step 7: Commit

```bash
git add -A
git commit -m "chore(memory-cleanup): archive N stale entries from <category>"
```

---

## 反误删契约

- 一次 ≤ 10 条候选
- 用户逐条 y/n，默认 no
- 搬不删，git 历史保留
- 如果用户 30 天内 revert，无任何信息丢失
```

- [ ] **Step 2: Verify**

```bash
ls -la .claude/skills/memory-cleanup/SKILL.md
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/memory-cleanup/SKILL.md
git commit -m "feat(skills): add memory-cleanup skill (archive-not-delete with y/n gating)"
```

---

### Task 3.2: memory-cleanup 跑一次 dry-run 校准

- [ ] **Step 1: 调用 skill 但只到 Step 2（看候选清单）**

`/memory-cleanup` 调用，停在用户 y/n 确认前。

- [ ] **Step 2: 评估候选数量与质量**

观察输出：
- 候选数量（应在 0-30 之间，超 30 说明算法太宽松）
- 误判率（明显不该清的项是否进了候选）

如果误判率 > 10%，回 SKILL.md 调整识别规则（如把"6 个月"改"9 个月"）。

- [ ] **Step 3: 实际执行清理（用户决定）**

向用户呈现清单 → 用户决定 y/n → 执行 / 跳过。

- [ ] **Step 4: Commit（如果实际跑了清理）**

```bash
git add -A
git commit -m "chore(memory-cleanup): first run, archived N entries"
```

---

### Task 3.3: 最终量化验证

- [ ] **Step 1: session-init 开机 token 测量**

开 3 次新 session（fresh，先删 `.ccb/session-marker`），每次记 `/context` 输出。

```bash
rm -f .ccb/session-marker
# 然后开新 session, 跑 /context
```

期望：3 次都 ≤ 10%（目标 ~3%）。

- [ ] **Step 2: brainstorming 首轮 token 测量**

新 session 调 `/brainstorming "假装做个小决策"`。等它进入 propose approaches 阶段后跑 `/context`。

期望：增量 ≤ 5k。

- [ ] **Step 3: INDEX 100% 覆盖检查**

跑 `/claudemd-check`。

期望：INDEX 同步检查 0 MISSING，frontmatter 检查 0 MISSING。

- [ ] **Step 4: compact resume 测试**

在已有 session 中触发 compact（让对话累积到 compact 阈值），观察 compact 后是否：
- session-init 不重跑（`Step 0` 检测到 marker → "RESUME"）
- 仪表盘只刷新一行恢复提示

- [ ] **Step 5: 写验证报告**

更新 `docs/project_status.md`，"进行中" 改为"已完成"，附上 4 项指标实测值。

```bash
git add docs/project_status.md
git commit -m "docs(status): session-init token optimization complete + verified"
```

- [ ] **Step 6: 更新 changelog**

`docs/changelog.md` 顶部追加"实施完成"条目，列实测数据。

```bash
git add docs/changelog.md
git commit -m "docs(changelog): session-init token optimization implementation done"
```

- [ ] **Step 7: tag**

```bash
git tag session-init-opt-week3
git tag session-init-opt-complete
```

- [ ] **Step 8: 删除 spec/WIP 文件中的"进行中"标记 + 更新 INDEX 状态**

- spec frontmatter `status: in_progress` → `status: resolved`
- WIP 文件 status 同
- `docs/superpowers/INDEX.md` 把这两条从"进行中"段移到"已完成"段
- `docs/journal/INDEX.md` 加一条 milestone:resolved 记录

```bash
git add docs/superpowers/specs/2026-04-15-session-init-token-optimization-*.md \
        docs/superpowers/INDEX.md \
        docs/journal/INDEX.md
git commit -m "docs: mark session-init token optimization milestone resolved"
```

---

### Task 3.4: 失败回退路径文档化

如果 Week 3 验收任一指标不达标：

| 失败项 | 回退路径 |
|--------|---------|
| session-init token > 10% | `git reset --hard session-init-opt-week1`（保留文件体系，回退 skill 重构）|
| brainstorming token > 5k | 仅 revert `.claude/skills/brainstorming/SKILL.md` 单文件 |
| compact 后仍重读 | 仅 revert `.claude/skills/session-init/SKILL.md` 的 Step 0/marker 段 |
| INDEX 漏文件 | 不回退，补齐 INDEX 重跑 |
| 全盘失败 | `git reset --hard <session-init-opt-week1 之前最后一个 commit>` |

无任务步骤——仅作为收尾文档保留。

---

## 总验收（Week 3 末）

- [ ] session-init ≤ 10% (实测 ___%)
- [ ] brainstorming 首轮 ≤ 5k token (实测 ___ tokens)
- [ ] INDEX 100% 覆盖（claudemd-check 0 MISSING）
- [ ] Compact resume 行为正确（marker 检测生效）
- [ ] 3 个 git tag 已打（week1 / week2 / week3）
- [ ] project_status + changelog 已更新
- [ ] 6 个新文件 + 11 类修改文件全部 commit
- [ ] 0 src/ 改动（`git diff --stat session-init-opt-complete~25..HEAD -- src/` 必须空）

---

## 记 commit + push 节奏

- 每 task 1 commit（plan 设计如此）
- Week 末 1 tag + 1 push（让用户云端有备份）
- 任何 Week 内出问题 → `git reset --hard <上一个 task 的 commit>`，不要 force push

---

## 未来回看用的关键 link

- 设计 spec: `docs/superpowers/specs/2026-04-15-session-init-token-optimization-design.md`
- WIP 决策: `docs/superpowers/specs/2026-04-15-session-init-token-optimization-brainstorm-state.md`
- 调研综合: `docs/research/2026-04-15-session-init-optimization-synthesis.md`
- @import 语法: `docs/research/2026-04-15-claude-md-import-syntax.md`
- 项目规则: `CLAUDE.md`

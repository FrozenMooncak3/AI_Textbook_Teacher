# Session-Init 升级 + Skill 治理 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 session-init 从技术状态摘要升级为 CEO 仪表盘，加入 skill 自动触发和想法分流，扩展 claudemd-check 的审计范围，清理冗余 skill。

**Architecture:** 改 2 个 skill（session-init 重写、claudemd-check 扩展）、合并 1 个 skill（executing-plans 吸收 subagent-driven-development）、删除 3 个 skill 目录、更新 CLAUDE.md 引用。所有改动在 Claude 文件边界内。

**Tech Stack:** Markdown skill 文件，无代码改动。

**Spec:** `docs/superpowers/specs/2026-03-29-session-init-upgrade-design.md`

---

### Task 1: 合并 subagent-driven-development 到 executing-plans

**Files:**
- Modify: `.claude/skills/executing-plans/SKILL.md`
- Reference: `.claude/skills/subagent-driven-development/SKILL.md`
- Move: `.claude/skills/subagent-driven-development/implementer-prompt.md` → `.claude/skills/executing-plans/implementer-prompt.md`
- Move: `.claude/skills/subagent-driven-development/spec-reviewer-prompt.md` → `.claude/skills/executing-plans/spec-reviewer-prompt.md`
- Move: `.claude/skills/subagent-driven-development/code-quality-reviewer-prompt.md` → `.claude/skills/executing-plans/code-quality-reviewer-prompt.md`

- [ ] **Step 1: 复制 prompt 模板文件到 executing-plans 目录**

```bash
cp ".claude/skills/subagent-driven-development/implementer-prompt.md" ".claude/skills/executing-plans/implementer-prompt.md"
cp ".claude/skills/subagent-driven-development/spec-reviewer-prompt.md" ".claude/skills/executing-plans/spec-reviewer-prompt.md"
cp ".claude/skills/subagent-driven-development/code-quality-reviewer-prompt.md" ".claude/skills/executing-plans/code-quality-reviewer-prompt.md"
```

- [ ] **Step 2: 重写 executing-plans/SKILL.md**

合并后的 executing-plans 应包含：

1. 保留原有的基本流程（Load → Execute → Complete）
2. 从 subagent-driven-development 移植：
   - 两阶段 review 流程（spec compliance → code quality），使用本目录下的 prompt 模板
   - Implementer 状态处理（DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED）
   - Model selection 指导（根据任务复杂度选模型）
3. 移除：
   - "use superpowers:subagent-driven-development instead" 的引导语
   - 原 subagent-driven-development 的 subagent dispatch 细节（CCB 下用 structured-dispatch）
4. 更新 Integration 部分：移除对 using-superpowers 的引用
5. 更新 Chain Position：保留 Execution Chain 位置不变

- [ ] **Step 3: 验证合并结果**

读 `.claude/skills/executing-plans/SKILL.md`，检查：
- 包含两阶段 review 流程
- 包含 4 种 implementer 状态处理
- 不再引用 subagent-driven-development
- 不再引用 using-superpowers
- prompt 模板路径指向 `./implementer-prompt.md` 等本目录文件

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/executing-plans/
git commit -m "refactor: merge subagent-driven-development into executing-plans"
```

---

### Task 2: 重写 session-init

**Files:**
- Modify: `.claude/skills/session-init/SKILL.md`
- Reference: `docs/superpowers/specs/2026-03-29-session-init-upgrade-design.md` (Section 2.1, 2.2)

- [ ] **Step 1: 重写 session-init/SKILL.md**

新版 session-init 结构：

```
---
name: session-init
description: CEO 仪表盘 + session-wide 运行规则。Session 开始和 compact 后自动调用。
---

# Session Init

## Step 1: Load Context (parallel reads)
[保留现有的文件读取列表和 git 命令，不变]

## Step 2: Assess Position
[保留现有的信号检测表，不变]
[新增] 交叉分析：检查 parked 项与当前里程碑的关联性

## Step 3: CEO 仪表盘
[用 spec Section 2.1 的 5 板块格式替换旧的 Brief User]
[包含详略自动判断逻辑]

## Step 4: Session-Wide 运行规则
[从 spec Section 2.2 完整写入]
规则 1: 自动派发
规则 2: 想法分流
规则 3: Skill 自动触发（10 个核心流程 skill 的触发表）
规则 4: 里程碑级 Git 隔离（含例外和异常处理）
规则 5: Chain Routing（保留现有内容）

## Step 5: Skill 使用手册
[核心流程 skill 清单 + Agent 参考 skill 清单 + 低频工具 skill 清单]
[从 spec Section 2.4 最终归类表写入]

## 行为契约
[替代旧的 "Does NOT" 部分]
- 主动执行运行规则，不等用户提醒
- 想法分流主动判断，不问用户
- 但不替代用户做产品决策（需要决策的事列在仪表盘里等用户拍板）
```

- [ ] **Step 2: 验证新 session-init**

读 `.claude/skills/session-init/SKILL.md`，检查：
- 包含 5 板块仪表盘格式
- 包含详略自动判断逻辑
- 包含 5 条运行规则
- 包含完整 skill 使用手册（3 类 skill 清单）
- 不再有 "Does NOT" 部分
- 不引用 using-superpowers

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/session-init/SKILL.md
git commit -m "feat: upgrade session-init to CEO dashboard with skill governance"
```

---

### Task 3: 扩展 claudemd-check

**Files:**
- Modify: `.claude/skills/claudemd-check/SKILL.md`
- Reference: `docs/superpowers/specs/2026-03-29-session-init-upgrade-design.md` (Section 2.3)

- [ ] **Step 1: 在 claudemd-check 中添加步骤 10**

在现有步骤 9（沟通协议检查）之后添加：

```markdown
10. **检查：Skill 合规**
    读 session-init 的运行规则（Step 4），回顾本次 session 实际发生的事件，逐条检查是否遵守。只审计实际发生的事，未发生的跳过。
```

在输出格式中添加：

```
✓/✗ Skill 合规：
  - 派发任务：走了完整流程 / 未派发，跳过
  - 想法分流：已分流 N 条 / 无新想法，跳过
  - brainstorming 后记录：已写 journal / 未 brainstorm，跳过
  - 完成前验证：已执行 / 本次未声称完成，跳过
  - Git 隔离：在隔离分支上 / 无进行中里程碑，跳过
```

- [ ] **Step 2: 验证**

读 `.claude/skills/claudemd-check/SKILL.md`，检查：
- 步骤 10 存在且格式正确
- 输出格式包含 Skill 合规行
- 检查依据指向 session-init 运行规则（不硬编码）

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/claudemd-check/SKILL.md
git commit -m "feat: add skill compliance audit to claudemd-check"
```

---

### Task 4: 更新 CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: 替换 Skill 使用部分的引用**

找到 CLAUDE.md 中的：
```
## Skill 使用
每次会话开始，先读 `.claude/skills/using-superpowers/SKILL.md` 并遵守其规则。
```

替换为：
```
## Skill 使用
每次会话开始，调用 session-init skill。它包含 CEO 仪表盘、运行规则和完整的 skill 使用手册。
详见 `.claude/skills/session-init/SKILL.md`。
```

- [ ] **Step 2: 验证**

读 `CLAUDE.md`，确认：
- 不再引用 using-superpowers
- 引用指向 session-init
- 其他部分未被意外修改

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update skill reference from using-superpowers to session-init"
```

---

### Task 5: 删除冗余 skill 目录

**Files:**
- Delete: `.claude/skills/using-superpowers/` (含 SKILL.md, references/codex-tools.md, references/gemini-tools.md)
- Delete: `.claude/skills/dispatching-parallel-agents/` (含 SKILL.md)
- Delete: `.claude/skills/subagent-driven-development/` (含 SKILL.md, implementer-prompt.md, spec-reviewer-prompt.md, code-quality-reviewer-prompt.md)

- [ ] **Step 1: 确认前置任务完成**

检查：
- Task 1 已将 prompt 模板复制到 executing-plans（不会因删除丢失）
- Task 4 已将 CLAUDE.md 引用更新（不会指向已删除目录）

- [ ] **Step 2: 删除目录**

```bash
rm -rf ".claude/skills/using-superpowers"
rm -rf ".claude/skills/dispatching-parallel-agents"
rm -rf ".claude/skills/subagent-driven-development"
```

- [ ] **Step 3: 验证无残留引用**

搜索整个项目中是否还有对已删除 skill 的引用：

```bash
grep -r "using-superpowers\|dispatching-parallel-agents\|subagent-driven-development" --include="*.md" .
```

如有残留引用，修正后再 commit。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove redundant skills (using-superpowers, dispatching-parallel-agents, subagent-driven-development)"
```

---

### Task 6: 更新 journal 和 project_status

**Files:**
- Modify: `docs/journal/INDEX.md`
- Modify: `docs/project_status.md`

- [ ] **Step 1: 更新 journal INDEX**

将 parked 项 "Session Init 全局报告" 从 parked 移到 resolved：
```
## resolved（已解决）
- [idea] Session Init 全局报告：升级为 CEO 仪表盘 + skill 治理（2026-03-29）→ [2026-03-29-session-init-report.md](./2026-03-29-session-init-report.md)
```

- [ ] **Step 2: 更新 project_status.md**

在最新完成中记录本次工作。

- [ ] **Step 3: Commit + Push**

```bash
git add docs/journal/INDEX.md docs/project_status.md
git commit -m "docs: update journal and project status for session-init upgrade"
git push origin master
```

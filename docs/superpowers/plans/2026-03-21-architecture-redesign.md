---
date: 2026-03-21
topic: CCB+Skill体系架构重构
type: plan
status: resolved
keywords: [CCB, skill, architecture, migration, CLAUDE.md]
---

# 架构重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将项目从多 Agent 文件协调架构迁移到 CCB + Skill 体系，瘦身 CLAUDE.md，新建 AGENTS.md 和 GEMINI.md，创建 2 个自定义 skill，更新 .gitignore，最后 commit + push。

**Architecture:** 三层分离（身份层 + 规则层 + 技能层）。三个指令文件（CLAUDE.md / AGENTS.md / GEMINI.md）各自定义身份和边界，共享 .claude/skills/ 作为 skill 仓库，通过 CCB /ask /pend 通信。

**Tech Stack:** Claude Code + Codex + Gemini CLI，CCB 协调，Superpowers + ECC skills

**Spec:** `docs/superpowers/specs/2026-03-21-architecture-redesign-design.md`

---

## 文件清单

| 操作 | 文件 |
|------|------|
| 重写 | `CLAUDE.md` |
| 新建 | `AGENTS.md` |
| 新建 | `GEMINI.md` |
| 新建 | `.claude/skills/debug-ocr/SKILL.md` |
| 新建 | `.claude/skills/api-contract/SKILL.md` |
| 修改 | `.gitignore`（追加 CCB 运行时忽略规则） |
| 更新 | `docs/project_status.md`（反映架构变更） |
| 更新 | `docs/changelog.md`（追加变更记录） |
| 更新 | `docs/decisions.md`（追加架构决策） |

旧文件全部保留不删：`.agents/MASTER_IDENTITY.md`、`AGENT1_IDENTITY.md`、`AGENT2_IDENTITY.md`、`MASTER_LOG.md`、`AGENT1_LOG.md`、`AGENT2_LOG.md`

---

### Task 1: 重写 CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: 备份当前 CLAUDE.md**

```bash
cp CLAUDE.md CLAUDE.md.bak
```

- [ ] **Step 2: 重写 CLAUDE.md**

新内容（~60 行），包含以下章节：
1. **项目是什么**（从旧文件复制，改一个字：`.txt` → `PDF`）
2. **每次会话开始时**：读 `docs/project_status.md` 和 `docs/decisions.md`（精简版，不含 learning_flow 触发条件）
3. **技术栈**（只列 Claude 需要知道的：框架、AI 模型、数据库类型）
4. **产品不变量**（5 条，从旧文件复制）
5. **技术红线**（4 条，从旧文件复制）
6. **CCB 角色分工**：Claude = PM + 架构师（不写业务代码），Codex = 后端（AGENTS.md），Gemini = 前端（GEMINI.md）
7. **文件边界**：可写 docs/**、.agents/PLAN.md、.agents/API_CONTRACT.md；不写 src/**
8. **协调文件**：引用 PLAN.md、API_CONTRACT.md、changelog.md
9. **禁止事项**（从旧文件复制）
10. **与项目负责人的沟通协议**（从旧文件复制，只有 Claude 需要）
11. **Skill 使用**：每次会话开始，先读 `.claude/skills/using-superpowers/SKILL.md` 并遵守其规则
12. **已关闭的决策**：精简为"详见 `docs/decisions.md`"

删除的章节：数据库表结构（→ AGENTS.md）、调试（→ AGENTS.md + debug-ocr skill）、工作协议（→ skill）、GitHub/Commit 规范（→ coding-standards skill）

- [ ] **Step 3: 验证 CLAUDE.md**

检查：
- 行数 < 80 行
- 包含产品不变量 5 条
- 包含技术红线 4 条
- 包含 CCB 角色分工
- 包含 Skill 使用入口
- 不包含"怎么做"的流程细节

- [ ] **Step 4: 删除备份**

```bash
rm CLAUDE.md.bak
```

---

### Task 2: 新建 AGENTS.md（Codex 指令）

**Files:**
- Create: `AGENTS.md`

- [ ] **Step 1: 创建 AGENTS.md**

内容来源：
- 身份声明：改写自 `.agents/AGENT1_IDENTITY.md`（去掉"大声确认"等对话式语言，改为指令式）
- 技术栈：从 CLAUDE.md 旧版提取后端相关部分（Next.js API Routes、SQLite + better-sqlite3、Python + PaddleOCR、Claude API）
- 数据库表结构：从 CLAUDE.md 旧版移入（7 张原始表 + Phase 2 新增的 conversations、messages、highlights、notes 表）
- 调试信息：从 CLAUDE.md 旧版移入（日志页面、API、logAction 用法）
- 产品不变量：复制 5 条
- 技术红线：复制 4 条
- 文件边界：从 AGENT1_IDENTITY.md 提取，更新为 CCB 语境（去掉"Agent 2"引用，改为"Gemini"）
- 工作流程：4 步（读 PLAN → 读 API_CONTRACT → 干活 → 追加 changelog）
- Skill 使用：`using-superpowers` 自动路由

- [ ] **Step 2: 验证 AGENTS.md**

检查：
- 包含数据库表结构（11 张表）
- 包含调试信息
- 文件边界正确（可写 src/lib/**、src/app/api/**、scripts/**）
- 禁止碰的文件列表正确
- 包含 Skill 使用入口

---

### Task 3: 新建 GEMINI.md（Gemini 指令）

**Files:**
- Create: `GEMINI.md`

- [ ] **Step 1: 创建 GEMINI.md**

内容来源：
- 身份声明：改写自 `.agents/AGENT2_IDENTITY.md`
- 技术栈：React 19 + Next.js 15 App Router、Tailwind CSS、pdf.js
- 产品不变量：复制 5 条（使用 AGENT2_IDENTITY.md 的前端视角版本，如"界面上不能有跳过入口"）
- 技术红线：复制（含"不使用 Tailwind 以外的 UI 库"）
- 文件边界：从 AGENT2_IDENTITY.md 提取，更新为 CCB 语境
- 工作流程：4 步
- Skill 使用：`using-superpowers` 自动路由

- [ ] **Step 2: 验证 GEMINI.md**

检查：
- 文件边界正确（可写 src/app/**/*.tsx、src/app/globals.css）
- 禁止碰的文件列表正确
- 产品不变量是前端视角版本
- 包含 Skill 使用入口

---

### Task 4: 创建自定义 skill — debug-ocr

**Files:**
- Create: `.claude/skills/debug-ocr/SKILL.md`

- [ ] **Step 1: 创建 debug-ocr skill**

用 @writing-skills skill 的格式创建。内容：

```markdown
---
description: 排查 PaddleOCR / 截图 OCR / ocr_server.py 相关问题
globs: scripts/ocr_*.py, src/app/api/**/screenshot*
alwaysApply: false
---

# Debug OCR

## 何时使用
- OCR 识别结果为空或乱码
- ocr_server.py 无响应或超时
- OCR 进度卡住不动
- 截图问 AI 返回"无法识别"

## 排查步骤

1. **检查 ocr_server.py 是否运行**
   - `curl http://localhost:8765/health`
   - 如果不通：`python scripts/ocr_server.py` 启动

2. **检查日志**
   - 访问 http://localhost:3000/logs 或 GET /api/logs
   - 搜索 action 含 "ocr" 的日志条目

3. **检查 OCR 进度**
   - GET /api/books/[bookId]/status
   - 确认 ocrCurrentPage 是否在增长

4. **测试单页 OCR**
   - `python scripts/ocr_pdf.py data/uploads/[bookId].pdf --page 1`
   - 确认输出是否有文字

5. **检查截图 OCR**
   - 确认请求体中 imageBase64 格式正确（data:image/png;base64,...）
   - 检查 ocr_server.py 的 stderr 输出

## 常见问题
- **模型加载超时**：ocr_server.py 首次启动需 10-20s 加载模型，之后请求 < 5s
- **端口冲突**：默认 8765，检查是否被占用
- **图片格式错误**：必须是 base64 编码的 PNG/JPG
```

---

### Task 5: 创建自定义 skill — api-contract

**Files:**
- Create: `.claude/skills/api-contract/SKILL.md`

- [ ] **Step 1: 创建 api-contract skill**

```markdown
---
description: 新增或修改 API 接口时，更新 .agents/API_CONTRACT.md
globs: src/app/api/**/*.ts
alwaysApply: false
---

# API Contract

## 何时使用
- 新增 API 端点
- 修改现有 API 的请求/响应格式
- 前端需要对接新接口

## 更新规范

### 新增接口时，必须在 API_CONTRACT.md 中添加

1. **HTTP 方法 + 路径**：如 `GET /api/books/[bookId]/conversations`
2. **Request Body**（如有）：JSON 格式，含字段类型
3. **Response 200**：JSON 格式，含字段类型
4. **错误响应**：遵循统一错误格式 `{ "error": "描述", "code": "ERROR_CODE" }`

### 格式模板

（参考 .agents/API_CONTRACT.md 中已有接口的格式）

### 变更记录

在 API_CONTRACT.md 底部的"变更记录"区追加一条：
`[日期] [Codex/Gemini] 新增/修改了什么接口`

## 通知流程
- Codex 新增接口后 → Claude 通过 /ask gemini 通知前端
- Gemini 发现需要新接口 → Claude 通过 /ask codex 委派后端实现
```

---

### Task 6: 更新 .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: 追加 CCB 运行时忽略规则**

在 `.gitignore` 末尾追加：

```
# CCB runtime session files
.ccb/.*-session
```

- [ ] **Step 2: 验证**

```bash
git status
```

确认 `.ccb/.*-session` 文件不再出现在 untracked 列表中。

---

### Task 7: 更新项目文档

**Files:**
- Modify: `docs/project_status.md`
- Modify: `docs/changelog.md`
- Modify: `docs/decisions.md`

- [ ] **Step 1: 更新 project_status.md**

在"当前状态"部分更新：
- 架构：从"多 Agent 并行开发"改为"CCB 多模型协作（Claude PM + Codex 后端 + Gemini 前端）"
- 新增"架构重构"条目：已完成 CLAUDE.md 瘦身、AGENTS.md、GEMINI.md、自定义 skill

- [ ] **Step 2: 追加 changelog.md**

```
## 2026-03-21

### 架构重构：从多 Agent 迁移到 CCB + Skill 体系

- 重写 CLAUDE.md（154行 → ~60行，删除流程细节，只保留身份/规则/CCB角色）
- 新建 AGENTS.md（Codex 后端指令，含数据库表结构和调试信息）
- 新建 GEMINI.md（Gemini 前端指令）
- 创建自定义 skill：debug-ocr（OCR 排查流程）、api-contract（接口契约更新规范）
- 更新 .gitignore（忽略 CCB 会话文件）
- 旧 Agent 文件（.agents/*_IDENTITY.md、*_LOG.md）冻结保留

修改文件：CLAUDE.md, .gitignore, docs/project_status.md, docs/changelog.md, docs/decisions.md
新增文件：AGENTS.md, GEMINI.md, .claude/skills/debug-ocr/SKILL.md, .claude/skills/api-contract/SKILL.md
```

- [ ] **Step 3: 追加 decisions.md**

```
### D-NEW: 架构迁移到 CCB + Skill 体系

- **决策**：从多 Agent 文件协调（Master + Agent1 + Agent2）迁移到 CCB 多模型协作（Claude + Codex + Gemini）+ Skill 体系
- **理由**：消除手动搬运对话的痛苦；Prompt/Skill 分离让指令文件稳定、流程可插拔
- **可逆性**：容易反悔——旧文件全部保留，回退只需 `git checkout` 恢复旧版本
- **设计文档**：docs/superpowers/specs/2026-03-21-architecture-redesign-design.md
```

---

### Task 8: 审查 + Commit + Push

**Files:**
- All modified/created files

- [ ] **Step 1: 用 verification-before-completion 审查所有变更**

@verification-before-completion — 检查：
- CLAUDE.md < 80 行，包含所有必要章节
- AGENTS.md 包含数据库表结构、文件边界、Skill 入口
- GEMINI.md 包含文件边界、前端视角产品不变量、Skill 入口
- 三个文件的产品不变量和技术红线一致
- debug-ocr skill 格式正确
- api-contract skill 格式正确
- .gitignore 包含 CCB 规则
- 旧文件全部仍然存在（没有被误删）

- [ ] **Step 2: git add 具体文件**

```bash
git add CLAUDE.md AGENTS.md GEMINI.md \
  .claude/skills/debug-ocr/SKILL.md \
  .claude/skills/api-contract/SKILL.md \
  .gitignore \
  docs/project_status.md \
  docs/changelog.md \
  docs/decisions.md \
  docs/superpowers/specs/2026-03-21-architecture-redesign-design.md \
  docs/superpowers/plans/2026-03-21-architecture-redesign.md
```

- [ ] **Step 3: commit**

```bash
git commit -m "架构重构：CCB + Skill 体系（CLAUDE.md 瘦身 + AGENTS.md + GEMINI.md）"
```

- [ ] **Step 4: push**

```bash
git push origin master
```

- [ ] **Step 5: 验证 GitHub**

```bash
gh repo view FrozenMooncak3/AI_Textbook_Teacher --web
```

确认 AGENTS.md 和 GEMINI.md 出现在仓库根目录。

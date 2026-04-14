# 项目状态（Project Status）

> 每次新 session 的第一个文件。保持"此刻的真实状态"。
> 每完成任何一个操作，必须更新这个文件。

---

## 当前状态（2026-04-12）

**方向**：MVP 扩展三线推进——扫描 PDF（**已完成**）→ 教学系统 → 留存机制，串行执行

**当前里程碑**：扫描 PDF 实施 — **已完成**（9 tasks 全通过）

**最新完成**：
- **扫描 PDF 9 tasks 全部完成**：T1-T7（Codex 后端）+ T8（Gemini 前端，1 次 retry 修 `any`/`console.error` 红线）+ T9（Claude 文档验证）
- 实际效果：文字页立即解锁阅读，扫描页后台 OCR 不阻塞；模块级独立状态追踪（text/ocr/kp），一就绪就可用
- 新 API：`GET /api/books/[bookId]/module-status` + `POST /api/books/[bookId]/extract?moduleId=N`
- 新 UI：StatusBadge 6 状态（加了 processing/readable）+ ProcessingPoller 模块级渲染 + ActionHub 按三元组 badge/可点击性
- 扫描 PDF 设计 spec + 实施计划（含 2 轮 review）存档于 `docs/superpowers/specs/` 和 `docs/superpowers/plans/`
- PDF 处理技术调研 → `docs/research/2026-04-11-pdf-processing-research.md`
- MVP 扩展首轮调研完成（竞品/学习科学/AI成本/护城河/用户定位）→ `docs/research/`
- 两种学习模式洞察 → `docs/journal/2026-04-11-two-learning-modes.md`
- MVP 扩展时间线 → `docs/superpowers/plans/2026-04-11-mvp-expansion-timeline.md`

**下一步**：**云部署里程碑**（基础设施，新立项）— 本地测试环境痛苦，产品负责人拍板切换"独立开发者云部署模式"。brainstorm WIP 在 `docs/superpowers/specs/2026-04-12-cloud-deployment-brainstorm-state.md`，下一步决策 1（OCR 处理方式）。

**冻结中的里程碑**：
- **教学系统**（决策 1-10 全部拍板 2026-04-14，design spec 已写，待 M4/M5 拆分详细 brainstorm）：WIP 在 `docs/superpowers/specs/2026-04-12-teaching-system-brainstorm-state.md`，design spec 在 `docs/superpowers/specs/2026-04-12-teaching-system-design.md`，云部署结束后启动 M4/M5
- **扫描 PDF 端到端人工测试**：因本地 OCR server 起不来推迟，改为云环境测试

**里程碑收尾**：
- ✅ milestone-audit 已完成（2026-04-12，架构 ⚠️ 4 条新增约束已写入 architecture.md）
- ⏳ claudemd-check 待跑

**Advisory 累计**：11 条（T6: 3 + T7: 3 + T8: 5），其中 2 条已在清理任务修复（40f895b + 277738d），剩余 9 条经人工评估为 by-design，不单独追修。

**架构**：CCB 多模型协作（Claude PM + Codex 后端 + Gemini 前端），Superpowers + Skill 体系，Hook 自动化守卫

---

## 里程碑总览

> 里程碑定义以设计 spec（Section 6）为准。

| 里程碑 | 内容 | 状态 |
|--------|------|------|
| M0 | 地基重建：19 张表 + prompt 模板系统 + bug 修复 | **已完成**（2026-03-22） |
| M1 | 提取器 AI：上传 PDF → 三阶段 KP 提取 → KP 表和模块地图写入 DB → 模块地图页面 | **已完成**（2026-03-28） |
| M2 | 教练 AI（核心）：读前指引 → 阅读（笔记+截图问答）→ Q&A（4 种题型+即时反馈+预生成）→ 学习笔记生成 | **已完成**（2026-03-29） |
| M3 | 考官 AI：测试出题 → 盲测 → 评分 → 80% 过关 → 错题诊断 | **已完成**（2026-04-01） |
| M3.5 | 里程碑衔接修复：测试→复习调度触发 + schema 清理 + reviewer prompt 重写 | **已完成**（2026-04-02） |
| M4 | 复习系统：复习调度（3/7/15/30/60 天）→ 聚类出题 → P 值更新 → 前端复习会话 | **已完成**（2026-04-02） |
| M5 | 功能补完：截图问 AI 两步流程 + AIResponse Markdown 渲染 + 正确答案展示 + 仪表盘 + 错题诊断 | **已完成**（2026-04-03） |
| M5.5 | 稳固 & App Shell：侧栏导航 + 白屏修复 + OCR 自动触发 + 进度显示 + LoadingState | **已完成**（2026-04-04） |
| M6 | MVP Launch：PostgreSQL 迁移 + 用户账号 + 大 PDF 分块 + PDF 阅读器 + 部署上线 | **已完成**（2026-04-06） |
| UX Redesign | Amber Companion 设计系统全覆盖 + 页面合并 + 考试/复习重写 + 共享组件 | **已完成**（2026-04-09） |
| Component Library | 33 组件从 Stitch 落地 + 全页面重写 + 旧组件清理 + Radix UI | **已完成**（2026-04-09） |
| Scanned PDF | 文字+扫描混合 PDF 渐进处理 + 模块级状态 + 前端可阅读态 | **已完成**（2026-04-12） |

### Scanned PDF 完成内容

| 任务 | 描述 | 执行者 | 状态 |
|------|------|--------|------|
| T1 | DB Schema + Docker Foundation | Codex | ✅ |
| T2 | OCR Server — /classify-pdf | Codex | ✅ |
| T3 | OCR Server — /extract-text (pymupdf4llm) | Codex | ✅ |
| T4 | OCR Server — 仅扫描页 OCR + Provider 抽象 | Codex | ✅ |
| T5 | text-chunker 页范围追踪 | Codex | ✅ |
| T6 | kp-extraction 按模块重写 | Codex | ✅ |
| T7 | API 路由（upload + extract + module-status） | Codex | ✅ |
| T8 | 前端模块级处理 UI | Gemini | ✅ (1 retry: any/console 红线) |
| T9 | 集成验证 + 文档 | Claude | ✅ |

### M6 完成内容

| 任务 | 描述 | 执行者 | 状态 |
|------|------|--------|------|
| T1 | PostgreSQL Foundation (db.ts + schema) | Codex | ✅ |
| T2 | Convert lib/ files to async | Codex | ✅ |
| T3 | Convert API routes (books+conversations+logs) | Codex | ✅ |
| T4 | Convert API routes (modules+review+qa) | Codex | ✅ |
| T5 | Auth system backend | Codex | ✅ |
| T6 | Auth frontend + server page conversion | Gemini | ✅ |
| T7 | Large PDF chunking | Codex | ✅ (1 retry) |
| T8 | PDF reader replacement (react-pdf-viewer) | Gemini | ✅ |
| T9 | Bug fixes (auth guards + security) | Codex | ✅ |
| T10 | Deployment (Docker + compose) | Codex | ✅ |
| T11 | Smoke test + docs update | Claude | ✅ |

### M5 完成内容

| 任务 | 描述 | 状态 |
|------|------|------|
| T1 | Schema migration: mistakes 表 + screenshot_qa 模板修复 | ✅ |
| T2 | AIResponse 组件 + react-markdown 依赖 | ✅ |
| T3 | 截图问 AI API 拆分（screenshot-ocr + screenshot-ask 重写） | ✅ |
| T4 | 正确答案/解析：review/respond + test/submit 返回值增强 | ✅ |
| T5 | Dashboard + Mistakes 后端 API | ✅ |
| T6 | AiChatDialog 前端两步流程 | ✅ |
| T7 | ReviewSession/TestSession 正确答案展示 + AIResponse 迁移 | ✅ |
| T8 | Dashboard + Mistakes 前端页面 | ✅ |
| T9 | AIResponse 全站 rollout | ✅ |

### 依赖关系

```
M0 → M1 → M2 → M3 → M4 → M5
              ↑
       独立问答通道（已有，持续可用）
```

---

## 核心架构变化（相比旧 Phase 1/2）

- **5 个 AI 角色**：提取器 / 教练 / 考官 / 复习官 / 助手，各有独立 prompt 模板
- **KP 成为一级实体**：知识点有独立表，驱动所有学习活动
- **即时反馈**：Q&A 每题答完立即反馈（不再是全部答完后批量）
- **P-value 复习权重**：动态权重系统控制复习题量
- **数据库从 12 张表扩展到 24 张表**（M6: +users, invite_codes, sessions），PostgreSQL 部署

---

## 已有资产（Phase 1 + Phase 2 遗留，M0 后部分复用）

- Phase 1 完整学习流程可运行（上传 → 模块 → Q&A → 测试 → 错题）
- Phase 2 PDF 阅读器 + 截图问 AI 后端已完成
- PaddleOCR 常驻 HTTP 服务（`scripts/ocr_server.py`）
- Vercel AI SDK 多模型客户端（`src/lib/ai.ts`，支持 Anthropic/Google/OpenAI 兼容 provider）

---

## 历史记录

| 日期 | 里程碑 |
|------|--------|
| 2026-03-14 | Phase 0 完成，文档体系建立 |
| 2026-03-15 | Phase 1 完成，完整学习流程可运行 |
| 2026-03-17 | 引入多 Agent 架构 |
| 2026-03-18 | Phase 2 启动，后端 M1-M5 全部完成 |
| 2026-03-21 | 架构迁移到 CCB + Skill 体系 |
| 2026-03-21 | MVP 重新设计，目标用户定位中国留学生 |
| 2026-03-21 | 旧文件清理，文档体系精简 |
| 2026-03-22 | M0 Task 0-5 完成（schema 重写 + prompt 模板 + bug 修复） |
| 2026-03-22 | **M0 完成**：最终验证通过（8/8 checks） |
| 2026-03-28 | **Hook 自动化完成**：4 个 hook + structured-dispatch skill + claudemd-check 更新 |
| 2026-03-28 | **第三次 brainstorming 实施完成**：session-init skill + retrospective skill + 6 skill chain 声明 + CLAUDE.md/using-superpowers 更新 |
| 2026-03-29 | **M2 完成**：教练 AI 全部代码 + review 修复完成，6 项 fix 已 push |
| 2026-03-29 | **多模型抽象层完成**：Vercel AI SDK 集成，12 个调用点迁移，`AI_MODEL` 环境变量切换 |
| 2026-03-29 | **Session-Init 升级 + Skill 治理**：CEO 仪表盘、skill 合规审计、skill 合并/清理（26→22） |

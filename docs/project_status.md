# 项目状态（Project Status）

> 这是 Context 压缩后恢复工作状态的第一个文件。
> 规则：每完成任何一个操作，必须更新这个文件。保持"此刻的真实状态"。

---

## 当前状态（2026-03-21）

**阶段**：Phase 2 — PDF 阅读器 + 截图问 AI

**架构**：CCB 多模型协作（Claude PM + Codex 后端 + Gemini 前端），Superpowers + ECC skill 体系

**架构重构已完成 ✅**：
- CLAUDE.md 瘦身（154行 → 79行），只保留身份/规则/CCB角色
- 新建 AGENTS.md（Codex 后端指令）和 GEMINI.md（Gemini 前端指令）
- 创建自定义 skill：debug-ocr、api-contract
- 旧 Agent 文件（.agents/*_IDENTITY.md、*_LOG.md）冻结保留
- 设计文档：docs/superpowers/specs/2026-03-21-architecture-redesign-design.md

**Agent 1 后端进度（M1-M5 全部完成 ✅）**：
- M1 ✅ PDF 文件访问 API + claude.ts 超时保护 + OCR 坏页修复
- M2 ✅ 截图问 AI 后端（conversations/messages 表 + screenshot-ask API + 追问 API）
- M3 ✅ OCR 后台化 + 逐页进度更新 + status API 扩展
- M4 ✅ 目录导航 TOC API（PyMuPDF 书签提取）
- M5 ✅ 高亮标注 + 页面笔记（highlights/notes 表 + CRUD API）
- 额外 ✅ 截图 OCR 改为常驻 HTTP 服务（解决模型重复加载超时问题）

**Agent 2 前端进度（M1-M4 完成，M5 待开发）**：
- M1 ✅ PDF 阅读器（连续滚动 + 单页切换 + 工具栏 + pdf.js 渲染冲突修复）
- M2 ✅ 截图问 AI 前端（框选 + 对话框 + 追问，已对接真实 API）
- M3 ✅ OCR 进度条 + 上传后直接跳转阅读器
- M4 ✅ 目录导航侧边栏（可折叠 + 位置高亮 + 跳转）
- M5 🔧 高亮标注 + 页面笔记前端（待开发）

**待解决**：
- ⚠️ OCR 进度条停在 1/189 不动（需排查：OCR 脚本卡住 or 前端轮询问题）
- ⚠️ 截图 OCR 识别失败（AI 返回"无法识别"，需排查 ocr_server.py 是否运行）
- ⚠️ 缺少历史对话列表 API（Agent 2 NOTE：需 Agent 1 提供 GET /api/books/[bookId]/conversations）

**下一步**：
- 排查 OCR 进度条 + 截图 OCR 两个 bug
- Agent 2 完成 M5 前端（高亮 + 笔记）
- Agent 1 补充历史对话列表 API

**详细计划见**：`.agents/PLAN.md`

---

## Phase 1 任务清单（按顺序）

- [x] 第1步：数据库建表（6张表，app 启动时自动初始化）
- [x] 第2步：文本上传 API + 上传页面
- [x] 第3步：模块地图生成（Claude API）+ 展示页面
- [x] 第4步：读前指引（任务锚生成 + 原文视图）
- [x] 第5步：Q&A 页面（逐题交互）
- [x] 第6步：模块测试页面
- [x] 第7步：错题诊断 + 记录

---

## Phase 0 已完成清单

- [x] Next.js 15 项目初始化（TypeScript + Tailwind）
- [x] 安装核心依赖（`@anthropic-ai/sdk`、`better-sqlite3`）
- [x] `CLAUDE.md`（项目核心指令，含产品不变量、决策日志、工作协议）
- [x] `project_spec.md`（产品规格书）
- [x] `docs/learning_flow.md`（学习规则）
- [x] `docs/ROADMAP.md`（Phase 0-3 路线图）
- [x] `docs/decisions.md`（决策日志，7 条已关闭决策）
- [x] `docs/changelog.md`（变更日志）
- [x] `.gitignore` 修复（保护 `data/app.db`）
- [x] `data/` 目录创建

---

## Phase 1 完成状态（2026-03-15）

**7/7 步骤全部完成。** 完整学习流程已可运行：
上传 PDF/TXT → 模块地图生成 → 读前指引 → 原文阅读 → Q&A → 模块测试 → 错题诊断

---

## 已知风险

| 风险 | 影响 | 应对 |
|------|------|------|
| Claude API 处理长文本成本高 | Phase 1 第3步 | 按模块分批处理，不一次性发全文 |
| SQLite 不支持 Vercel 文件系统 | Phase 3 | MVP 先本地测试，Phase 3 再迁移 Supabase |
| OCR 大文件（100+ 页）耗时 12 分钟 | 新用户留存 | Phase 2 M3 解决：上传后立刻看 PDF，OCR 后台跑 |
| PaddleOCR 模型首次运行需联网下载 | 开发环境 | 已下载完成，后续运行无需联网 |
| 截图 OCR 精度（扫描版模糊/倾斜） | M2 截图问 AI | PaddleOCR 实测可用，半页 ~4s |
| 多 Agent 并行改同一文件导致冲突 | 开发效率 | 文件级硬边界隔离，见 .agents/IDENTITY 文件 |
| 截图 OCR 需启动常驻服务 | 运维复杂度 | `python scripts/ocr_server.py` 需在 Next.js 之前或同时启动 |

---

## 历史记录

| 日期 | 里程碑 |
|------|--------|
| 2026-03-14 | Phase 0 完成，文档体系建立 |
| 2026-03-15 | Phase 1 完成（7/7 步骤），完整学习流程可运行 |
| 2026-03-17 | 引入多 Agent 架构（Master + Agent 1 + Agent 2） |
| 2026-03-18 | Phase 2 启动：PDF 阅读器 + 截图问 AI |
| 2026-03-18 | Agent 1 后端 M1-M5 全部完成 |

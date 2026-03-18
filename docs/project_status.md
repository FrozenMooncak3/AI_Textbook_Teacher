# 项目状态（Project Status）

> 这是 Context 压缩后恢复工作状态的第一个文件。
> 规则：每完成任何一个操作，必须更新这个文件。保持"此刻的真实状态"。

---

## 当前状态（2026-03-18）

**阶段**：Phase 2 — PDF 阅读器 + 截图问 AI

**架构**：多 Agent 并行开发（Master 统筹 + Agent 1 后端 + Agent 2 前端）

**Agent 1 后端进度（M1-M5 全部完成 ✅）**：
- M1 ✅ PDF 文件访问 API + claude.ts 超时保护 + OCR 坏页修复
- M2 ✅ 截图问 AI 后端（conversations/messages 表 + screenshot-ask API + 追问 API）
- M3 ✅ OCR 后台化 + 逐页进度更新 + status API 扩展
- M4 ✅ 目录导航 TOC API（PyMuPDF 书签提取）
- M5 ✅ 高亮标注 + 页面笔记（highlights/notes 表 + CRUD API）
- 额外 ✅ 截图 OCR 改为常驻 HTTP 服务（解决模型重复加载超时问题）

**Agent 2 前端进度**：
- M1 进行中：PDF 阅读器页面（pdf.js + 连续翻页 + 工具栏）🔧

**下一步**：
- Agent 2 完成 M1-M5 前端对接
- Agent 1 后端已就绪，等前端联调

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

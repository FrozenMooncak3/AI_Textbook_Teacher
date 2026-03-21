# 变更日志（Changelog）

> 记录每次完成的功能和修改，包含日期、内容、涉及文件。
> 目的：Context 压缩后，新对话的 Claude 读这个文件可以知道"代码里现在有什么"。
> 规则：每完成一个功能或修改，必须在这里追加一条记录。

---

## 2026-03-21 | 架构重构：从多 Agent 迁移到 CCB + Skill 体系

- 重写 CLAUDE.md（154行 → 79行，删除流程细节，只保留身份/规则/CCB角色）
- 新建 AGENTS.md（Codex 后端指令，含数据库表结构和调试信息）
- 新建 GEMINI.md（Gemini 前端指令）
- 创建自定义 skill：debug-ocr（OCR 排查流程）、api-contract（接口契约更新规范）
- 更新 .gitignore（忽略 CCB 会话文件）
- 旧 Agent 文件（.agents/*_IDENTITY.md、*_LOG.md）冻结保留

修改文件：CLAUDE.md, .gitignore, docs/project_status.md, docs/changelog.md, docs/decisions.md
新增文件：AGENTS.md, GEMINI.md, .claude/skills/debug-ocr/SKILL.md, .claude/skills/api-contract/SKILL.md
设计文档：docs/superpowers/specs/2026-03-21-architecture-redesign-design.md
实施计划：docs/superpowers/plans/2026-03-21-architecture-redesign.md

---

## 2026-03-15 | Bug 修复批次：OCR + 日志 + 指引持久化

**完成内容**：三个问题一次修完。

**具体操作**：
- 新增 OCR 支持：`scripts/ocr_pdf.py`（PyMuPDF + Tesseract），`src/lib/parse-file.ts` 改用 Python OCR
- 新增系统日志：`src/lib/log.ts`、`src/app/api/logs/route.ts`、`src/app/logs/page.tsx`，数据库加 `logs` 表
- 修复读前指引重复生成：`modules` 表加 `guide_json` 列，`guide/route.ts` 改为先读缓存再生成
- `ModuleLearning.tsx` 加载时先 GET 已有指引
- `page.tsx` 改为真实首页（教材列表 + 日志入口）
- API routes 加 logAction 调用（books、modules、guide）
- 修复代理问题：`src/lib/claude.ts` 改用 undici ProxyAgent（解决中国区 403）
- 安装依赖：`undici`、`pdf2json`（测试用）

**修改文件**：`src/lib/db.ts`、`src/lib/log.ts`（新建）、`src/lib/parse-file.ts`、`src/lib/claude.ts`、`scripts/ocr_pdf.py`（新建）、`src/app/api/logs/route.ts`（新建）、`src/app/logs/page.tsx`（新建）、`src/app/api/modules/[moduleId]/guide/route.ts`、`src/app/books/[bookId]/modules/[moduleId]/ModuleLearning.tsx`、`src/app/api/books/route.ts`、`src/app/api/modules/route.ts`、`src/app/page.tsx`

---

## 2026-03-14 | Phase 0：项目地基

**完成内容**：项目 Setup 全部完成，文档体系建立。

**具体操作**：
- 初始化 Next.js 15 项目（TypeScript + Tailwind）
- 安装核心依赖：`@anthropic-ai/sdk`、`better-sqlite3`
- 创建 `CLAUDE.md`（项目核心指令）
- 创建 `project_spec.md`（产品规格书，含确认的流程决策）
- 创建 `docs/learning_flow.md`（学习规则，Q&A / 测试 / 评分 / 错题）
- 创建 `docs/ROADMAP.md`（Phase 0-3 路线图）
- 创建 `docs/architecture.md`（技术架构）
- 创建 `docs/decisions.md`（决策日志，初始化 7 条决策）
- 创建 `docs/changelog.md`（本文件）
- 修复 `.gitignore`：加入 `data/*.db` 保护数据库文件
- 创建 `data/` 目录

**修改的文件**：
- 新增：`project_spec.md`、`docs/learning_flow.md`、`docs/ROADMAP.md`、`docs/decisions.md`、`docs/changelog.md`、`data/.gitkeep`
- 修改：`CLAUDE.md`、`.gitignore`

**当前状态**：Phase 0 完成，尚未写任何业务代码。

---

## 2026-03-15 | Phase 0：补丁——决策更新与沟通协议

**完成内容**：Phase 0 补充更新，反映今日讨论确认的决策变更。

**具体操作**：
- 推翻 PDF 处理旧决策：app 改为服务端自动处理文件转换，用户上传 PDF 即可
- 确认技术栈（Next.js / SQLite / Claude API / Tailwind）经用户讨论后正式锁定
- CLAUDE.md 新增"与项目负责人的沟通协议"（高管技术汇报格式 + 可逆性判断框架）
- CLAUDE.md 删除"禁止在 app 内处理 PDF"禁令

**修改的文件**：
- 修改：`CLAUDE.md`、`docs/decisions.md`、`docs/ROADMAP.md`

---

## 2026-03-15 | Phase 1 第1步：数据库建表

**完成内容**：6 张表全部创建，app 启动时自动初始化。

**具体操作**：
- 创建 `src/lib/db.ts`：数据库连接单例 + `initSchema()` 建表逻辑
- 启用 WAL 模式（写性能优化）和外键约束
- 验证：`node` 直接运行确认 6 张表正常创建

**修改的文件**：
- 新增：`src/lib/db.ts`

---

## 2026-03-15 | Phase 1 第2步：文件上传 API + 上传页面

**完成内容**：用户可上传 PDF 或 TXT 文件，服务端提取文本存入数据库，跳转至教材页。

**具体操作**：
- 安装 `pdf-parse`（新版 API 使用 `PDFParse` 类）
- 创建 `src/lib/parse-file.ts`：统一处理 PDF/TXT 文本提取
- 创建 `src/app/api/books/route.ts`：POST 上传 + GET 列表
- 创建 `src/app/upload/page.tsx`：上传页面（文件拖选 + 教材名称输入）
- 验证：API 返回 201，数据库写入正常

**修改的文件**：
- 新增：`src/lib/parse-file.ts`、`src/app/api/books/route.ts`、`src/app/upload/page.tsx`
- 修改：`package.json`（新增 pdf-parse 依赖）

---

## 2026-03-15 | Phase 1 第3步：模块地图生成 + 展示页面

**完成内容**：上传教材后，AI 分析原文并生成学习模块地图，模块地图页面展示所有模块。

**具体操作**：
- 创建 `src/lib/claude.ts`：Claude 客户端单例
- 创建 `src/app/api/modules/route.ts`：POST 生成模块（调用 Claude API）+ GET 查询模块
- 创建 `src/app/books/[bookId]/page.tsx`：模块地图 Server Component
- 创建 `src/app/books/[bookId]/ModuleMap.tsx`：Client Component，含生成按钮 + 模块卡片列表

**修改的文件**：
- 新增：`src/lib/claude.ts`、`src/app/api/modules/route.ts`、`src/app/books/[bookId]/page.tsx`、`src/app/books/[bookId]/ModuleMap.tsx`

**注意**：需要在 `.env.local` 中配置 `ANTHROPIC_API_KEY` 才能调用 Claude API

---

## 2026-03-15 | Phase 1 第4步：读前指引 + 原文视图

**完成内容**：进入模块后，AI 生成读前指引（目标/重点/易错点），用户阅读原文后才能进入 Q&A。

**具体操作**：
- 创建 `src/app/api/modules/[moduleId]/guide/route.ts`：生成读前指引
- 创建 `src/app/api/modules/[moduleId]/status/route.ts`：PATCH 更新模块学习状态
- 创建 `src/app/books/[bookId]/modules/[moduleId]/page.tsx`：模块页面（Server Component）
- 创建 `src/app/books/[bookId]/modules/[moduleId]/ModuleLearning.tsx`：读前指引 + 原文视图（Client Component）

**修改的文件**：
- 新增：4个文件（见上）

---

## 2026-03-15 | Phase 1 第5步：Q&A 页面（逐题交互 + AI 评分）

**完成内容**：完整 Q&A 流程——AI 出题、逐题作答（已答不可改）、全部答完后 AI 逐题评分。

**具体操作**：
- `src/app/api/modules/[moduleId]/questions/route.ts`：GET 获取/生成题目（按 KP 数量出题，缓存到 DB）
- `src/app/api/qa/[questionId]/respond/route.ts`：POST 保存回答（已答不可修改，硬约束）
- `src/app/api/modules/[moduleId]/evaluate/route.ts`：POST AI 逐题评分，含错误类型诊断
- `src/app/books/[bookId]/modules/[moduleId]/qa/page.tsx`：Q&A 页面（Server Component）
- `src/app/books/[bookId]/modules/[moduleId]/qa/QASession.tsx`：完整交互状态机（loading → answering → evaluating → results）

**修改的文件**：
- 新增：5个文件（见上）

---

## 2026-03-15 | Phase 1 第6步：模块测试页面

**完成内容**：完整测试流程——软性提醒 → 出题 → 作答 → AI 评分 → 80% 过关判断。

**具体操作**：
- `src/app/api/modules/[moduleId]/test-questions/route.ts`：生成测试题（单选+计算+思考，含反模式限制）
- `src/app/api/modules/[moduleId]/test-evaluate/route.ts`：评分（单选自动判对，开放题 AI 评分），更新 pass_status
- `src/app/books/[bookId]/modules/[moduleId]/test/page.tsx`：测试页面
- `src/app/books/[bookId]/modules/[moduleId]/test/TestSession.tsx`：完整状态机（reminder → loading → answering → submitting → results）

**修改的文件**：
- 新增：4个文件（见上）

---

## 2026-03-15 | Phase 1 第7步：错题诊断 + 记录

**完成内容**：Q&A 和测试的错题自动写入 mistakes 表，错题诊断页展示 4 种错误类型对应的补救方案。

**具体操作**：
- 新增 `src/lib/mistakes.ts`：共享错题记录工具函数（防重复写入，自动设置3天后复习日期）
- 修改 `evaluate/route.ts`：Q&A 得分 < 6 的题自动记录错题
- 修改 `test-evaluate/route.ts`：测试失分题自动记录错题
- 新增 `src/app/api/modules/[moduleId]/mistakes/route.ts`：查询错题 API
- 新增 `src/app/books/[bookId]/modules/[moduleId]/mistakes/page.tsx`：错题诊断页（含4种错误类型补救建议）
- 修改 `ModuleMap.tsx`：测试未过关时显示"查看错题"入口

**修改的文件**：
- 新增：3个文件
- 修改：3个文件

---

## 2026-03-17 | 多 Agent 架构建立 + 上传页优化

**完成内容**：引入多 Agent 并行开发架构，同时优化上传页等待体验。

**具体操作**：
- 创建 `.agents/` 系统文件：Master/Agent1/Agent2 身份文件、工作日志、计划文件、接口契约
- Agent 2 完成上传页进度提示优化：三阶段状态（idle/uploading/redirecting）+ OCR 等待说明

**修改的文件**：
- 新增：`.agents/` 下全部文件（MASTER_IDENTITY.md、AGENT1_IDENTITY.md、AGENT2_IDENTITY.md、PLAN.md、API_CONTRACT.md、*_LOG.md）
- 修改：`src/app/upload/page.tsx`（Agent 2）

---

## 2026-03-18 | Phase 2 M1：PDF API + OCR 修复

**完成内容**：Agent 1 完成 M1 全部后端任务，PDF 阅读器前端开发中。

**具体操作**：
- 创建 `GET /api/books/[bookId]/pdf` API，返回 PDF 文件流
- `claude.ts` 加 60s 超时保护
- `ocr_pdf.py` 加页级 try/except，坏页不再导致全书 OCR 崩溃
- Agent 2 开始 M1 前端：PDF 阅读器页面（pdf.js 集成）

**修改的文件**：
- 新增：`src/app/api/books/[bookId]/pdf/route.ts`（Agent 1）、`src/app/books/[bookId]/reader/page.tsx`（Agent 2，进行中）
- 修改：`src/lib/claude.ts`、`scripts/ocr_pdf.py`（Agent 1）

---

## 2026-03-18 | Phase 2 M2：截图问 AI 后端

**完成内容**：Agent 1 完成 M2 全部后端任务。截图 OCR + AI 对话的完整链路可用。

**具体操作**：
- `db.ts` 新增 `conversations` 和 `messages` 两张表
- 创建 `POST /api/books/[bookId]/screenshot-ask`：base64 截图 → PaddleOCR → Claude 解读 → 存对话记录
- 创建 `POST /api/conversations/[conversationId]/messages`：带历史上下文追问
- 创建 `scripts/ocr_image.py`：截图 OCR 专用脚本
- 截图 OCR 速度验证：半页裁剪 3.97s（目标 < 5s），通过

**修改的文件**：
- 新增：`src/app/api/books/[bookId]/screenshot-ask/route.ts`、`src/app/api/conversations/[conversationId]/messages/route.ts`、`scripts/ocr_image.py`
- 修改：`src/lib/db.ts`

---

## 2026-03-18 | Phase 2 M3：OCR 后台化 + 逐页进度

**完成内容**：Agent 1 完成 M3。OCR 进度可被前端实时轮询。

**具体操作**：
- `db.ts` 新增 `ocr_current_page` 和 `ocr_total_pages` 列（ALTER TABLE 迁移）
- `ocr_pdf.py` 改为逐页更新进度（原来每 10 页），启动时写入总页数
- `GET /api/books/[bookId]/status` 扩展：返回 `{ parseStatus, ocrCurrentPage, ocrTotalPages }`
- 兼容旧数据：`parse_status='done'` 映射为 `'completed'`

**修改的文件**：
- 修改：`src/lib/db.ts`、`scripts/ocr_pdf.py`、`src/app/api/books/[bookId]/status/route.ts`

---

## 2026-03-18 | Phase 2 M4：目录导航 TOC API

**完成内容**：Agent 1 完成 M4。PyMuPDF 提取 PDF 内嵌书签。

**具体操作**：
- 创建 `scripts/extract_toc.py`：从 PDF 提取书签目录，输出 JSON
- 创建 `GET /api/books/[bookId]/toc`：返回 `{ items: [{title, page, level}] }`
- 修复 Windows 环境 Python stdout 中文编码问题

**修改的文件**：
- 新增：`scripts/extract_toc.py`、`src/app/api/books/[bookId]/toc/route.ts`

---

## 2026-03-18 | 截图 OCR 修复：常驻 HTTP 服务

**完成内容**：修复截图问 AI 的 OCR 超时问题。

**具体操作**：
- 根本原因：每次 `execFile` 重新加载 PaddleOCR 模型（10-20s），撞 30s 超时
- 新增 `scripts/ocr_server.py`：PaddleOCR 常驻 HTTP 服务（端口 9876），模型只加载一次
- `screenshot-ask` API 改为 `http.request` 直连本地 OCR 服务，绕过 `HTTP_PROXY`
- `ocrImage()` 的 catch 块加 `logAction` 错误日志（不再静默失败）
- 超时 30s → 60s

**修改的文件**：
- 新增：`scripts/ocr_server.py`
- 修改：`src/app/api/books/[bookId]/screenshot-ask/route.ts`

**备注**：启动方式 `python scripts/ocr_server.py`，需在 Next.js 之前或同时启动

---

## 2026-03-18 | Phase 2 M5：高亮标注 + 页面笔记

**完成内容**：Agent 1 完成 M5。数据库表 + 完整 CRUD API。

**具体操作**：
- `db.ts` 新增 `highlights` 表（id, book_id, page_number, text, color, rects_json, created_at）
- `db.ts` 新增 `notes` 表（id, book_id, page_number, content, created_at, updated_at）
- `highlights` API：GET（按页筛选）、POST（新增）、DELETE
- `notes` API：GET（按页筛选）、POST、PUT（编辑）、DELETE

**修改的文件**：
- 新增：`src/app/api/books/[bookId]/highlights/route.ts`、`src/app/api/books/[bookId]/notes/route.ts`
- 修改：`src/lib/db.ts`

---

<!-- 后续每完成一个功能，在此处追加，格式如下：

## YYYY-MM-DD | Phase X：功能名称

**完成内容**：[做了什么]

**修改的文件**：
- 新增：[文件列表]
- 修改：[文件列表]
- 删除：[文件列表]

**备注**：[遇到的问题、临时方案、待优化点]

-->

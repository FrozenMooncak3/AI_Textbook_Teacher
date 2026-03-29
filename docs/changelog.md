# 变更日志（Changelog）

> 记录每次完成的功能和修改，包含日期、内容、涉及文件。
> 目的：Context 压缩后，新对话的 Claude 读这个文件可以知道"代码里现在有什么"。
> 规则：每完成一个功能或修改，必须在这里追加一条记录。

## 2026-03-29 | Gemini Flash 兼容性修复

- **Token 限制提升**: Guide maxOutputTokens 1024→4096, Generate-questions 4096→16384，修复 Gemini Flash 输出截断导致的 JSON 解析失败
- **原因**: Gemini Flash 对中文内容输出更冗长，原有 token 上限按 Claude 的简洁输出设定，不适用于其他模型

修改文件：
- `src/app/api/modules/[moduleId]/guide/route.ts`
- `src/app/api/modules/[moduleId]/generate-questions/route.ts`

---

## 2026-03-29 | M2: Coach AI - 前端修复 (Code Review Issues)

- **Fix 1 (C1): 解决阅读笔记重复保存**: 优化 `ModuleLearning.tsx` 中的 `handleSaveNotes` 逻辑，在保存新内容前先获取并逐一删除该模块已有的 `reading_notes`。
- **Fix 2 (I2): 实现 Q&A 进度恢复**: 改造 `QASession.tsx`，在加载题目后尝试获取 `qa_responses`（若后端支持），自动定位到首个未答题目并恢复已答题目的反馈状态。
- **Fix 3 (I3): 移除重复的笔记生成调用**: 移除 `QASession.tsx` 中 `handleFinalize` 的 `generate-notes` fetch 调用，统一由 `NotesDisplay.tsx` 负责生成逻辑。
- **Fix 4 (I4+I5): 清理未使用代码**: 移除 `ModuleLearning.tsx` 中未使用的 `useCallback`, `useRef` 以及 `QASession.tsx` 中未使用的 `bookId` 属性，同步更新相关页面调用。

修改文件：
- `src/app/books/[bookId]/modules/[moduleId]/ModuleLearning.tsx`
- `src/app/books/[bookId]/modules/[moduleId]/qa/QASession.tsx`
- `src/app/books/[bookId]/modules/[moduleId]/qa/page.tsx`

---

## 2026-03-28 | M2: Coach AI - 后端实现 (Tasks 0-5)

- **T0: learning_status 修复**: `db.ts` 默认值 `not_started` → `unstarted`，添加 `guide_json` 列 + 迁移脚本
- **T1: 阅读笔记 CRUD API**: `GET/POST/DELETE /api/modules/[moduleId]/reading-notes`，使用 `handleRoute`
- **T2: Q&A 出题 API**: `POST /api/modules/[moduleId]/generate-questions`，读取 KP + 笔记 + 截图问答，调 `coach/qa_generation` 模板
- **T3: Q&A 即时反馈 API**: `POST /api/modules/[moduleId]/qa-feedback`，调 `coach/qa_feedback` 模板
- **T4: 学习笔记生成 API**: `POST /api/modules/[moduleId]/generate-notes`，调 `coach/note_generation` 模板
- **T5: Guide 模板化重构**: `guide/route.ts` 从内联 prompt 切换到 `getPrompt('coach', 'pre_reading_guide')`

修改文件：`src/lib/db.ts`, `src/app/api/modules/[moduleId]/status/route.ts`, `src/app/api/books/[bookId]/module-map/confirm/route.ts`, `src/app/api/modules/[moduleId]/guide/route.ts`, `src/lib/seed-templates.ts`
新增文件：`src/app/api/modules/[moduleId]/reading-notes/route.ts`, `src/app/api/modules/[moduleId]/generate-questions/route.ts`, `src/app/api/modules/[moduleId]/qa-feedback/route.ts`, `src/app/api/modules/[moduleId]/generate-notes/route.ts`

---

## 2026-03-28 | M2: Coach AI - 前端实现 (Tasks 6-9)

- **T6: Module Learning State Machine**: 重写 `ModuleLearning.tsx`，实现 `unstarted → reading → qa → notes_generated → completed` 状态机。
- **T7: Instant Feedback Q&A**: 重写 `QASession.tsx`，支持逐题交互、即时 AI 反馈、脚手架提示及多种题型 UI 变体。
- **T8: Study Notes Display**: 新建 `NotesDisplay.tsx`，渲染 AI 生成的学习总结笔记，支持模块终态确认。
- **T9: Module Map Status**: 在模块地图中新增状态勋章显示，修复后端 API 遗漏的 `learning_status` 字段。

修改文件：
- `src/app/books/[bookId]/modules/[moduleId]/ModuleLearning.tsx`
- `src/app/books/[bookId]/modules/[moduleId]/page.tsx`
- `src/app/books/[bookId]/modules/[moduleId]/qa/QASession.tsx`
- `src/app/books/[bookId]/module-map/page.tsx`
- `src/app/api/books/[bookId]/module-map/route.ts`
- `src/lib/services/kp-extraction-types.ts`
新增文件：
- `src/app/books/[bookId]/modules/[moduleId]/NotesDisplay.tsx`

---

## 2026-03-28 | M1 完成：提取器 AI 里程碑正式关闭

- M1 所有任务（T0-T5）已完成，集成测试全链路通过
- 后端：三阶段 KP 提取 pipeline（structure scan → block extraction → quality validation）
- 前端：module-map 页面展示 + reader 集成状态横幅
- 验证结果：38 KP + 7 聚类 + 2 模块写入 DB，前端正常展示
- 下一步：进入 M2（教练 AI）

---

## 2026-03-28 | M1: Codex JSON 修复 + Status API Bug 发现

- **Codex 修复（已合并）**: `repairLooseJSON()` 字符级 JSON 修复 + prompt 模板改为英文 + 严格 JSON 格式要求。Stage 1 JSON 解析成功率从 20% 提升到 100%（5/5 sections）
- **提取结果**: 全 pipeline 跑通，38 KP + 7 聚类 + 2 模块写入 DB
- **新发现 Bug**: `GET /api/books/[bookId]/status` 返回裸 JSON，前端 module-map 页面期望 `{ success: true, data: {...} }` 格式，导致页面永远显示"正在提取"
- **已修复（Codex c10884f）**: status route 用 `handleRoute()` 重构，响应格式改为 `{ success: true, data: {...} }`；`src/lib/claude.ts` timeout 改为 300s
- **M1 集成测试通过**: 前端 module-map 页面正常展示 38 KP + 2 模块

修改文件：`src/app/api/books/[bookId]/status/route.ts`, `src/lib/claude.ts`, `src/lib/services/kp-extraction-service.ts`, `src/lib/seed-templates.ts`

---

## 2026-03-28 | M1: 集成测试 Bug 修复

- **Status endpoint 修复**: `GET /api/books/[bookId]/status` 缺少 `kp_extraction_status` 字段，前端无法追踪提取进度
- **API 超时修复**: Claude API 客户端超时从 60s 提升到 180s，防止提取调用超时
- **blockExtract 容错**: 每个 section 的提取加 try/catch，单个 section 失败不再中断整个 pipeline
- **测试结果**: 提取 pipeline 可完整运行（Stage 0→1→2→DB 写入），但 Stage 1 JSON 解析成功率仅 20%（5 个小节中 4 个返回非法 JSON），需要进一步排查

修改文件：`src/app/api/books/[bookId]/status/route.ts`, `src/lib/claude.ts`, `src/lib/services/kp-extraction-service.ts`

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
- 推翻 PDF 处理旧决策：app 改为服务端自动处理文件转换，用户上传 PDF即可
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
- 创建 `src/app/api/modules/[moduleId]/status/route.ts` : PATCH 更新模块学习状态
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

## 2026-03-22 | M0 Task 0：结构化错误处理 + 服务层分离

**完成内容**：基于 Harness 架构调研，建立三级错误分类 + handleRoute 包装函数 + 服务层模式，为 M1-M5 的代码质量打地基。

**具体操作**：
- 新增 `src/lib/errors.ts`：UserError（用户错误，400/404/409/422）+ SystemError（系统错误，500）
- 新增 `src/lib/handle-route.ts`：handleRoute 包装函数，自动将 throw 的错误映射为统一 JSON 响应 `{ success, data?, error?, code? }`
- 新增 `src/lib/services/book-service.ts`：第一个服务模块（list + getById），示范"薄路由 + 胖服务层"模式
- 改造 `src/app/api/books/route.ts`：GET 重构为 handleRoute + bookService（POST 不动）
- 更新 `AGENTS.md`：新增编码规范章节（错误处理 / 路由结构 / 服务模块），修复产品不变量 #5（批量反馈 → 即时反馈）

**修改的文件**：
- 新增：`src/lib/errors.ts`、`src/lib/handle-route.ts`、`src/lib/services/book-service.ts`
- 修改：`src/app/api/books/route.ts`、`AGENTS.md`

**设计文档**：`docs/superpowers/specs/2026-03-22-error-handling-service-layer-design.md`
**实现计划**：`docs/superpowers/plans/2026-03-22-m0-task0-error-handling-service-layer.md`

---

## 2026-03-22 | M0 Task 1：数据库 schema 重写

**完成内容**：19 张 KP 中心化表的破坏性迁移，替换旧的 12 张表 schema。

**具体操作**：
- 重写 `src/lib/db.ts` 的 `initSchema()`，用 19 张表的完整 SQL 替换旧建表逻辑
- 删除旧表 definition（questions, user_responses, review_tasks, notes）
- 删除所有旧的 ALTER TABLE 迁移代码块
- 新增表：knowledge_points, clusters, reading_notes, module_notes, qa_questions, qa_responses, test_papers, test_questions, test_responses, review_schedule, review_records, prompt_templates
- 保留表（同结构或扩展）：books, modules, conversations, messages, highlights, logs, mistakes

**修改的文件**：
- 修改：`src/lib/db.ts`

---

## 2026-03-22 | M0 Task 2：Prompt 模板系统

**完成内容**：创建 prompt 模板加载/渲染系统 + 11 个种子模板（覆盖 5 个 AI 角色的全部阶段）。

**具体操作**：
- 新增 `src/lib/prompt-templates.ts`：getActiveTemplate / renderTemplate / getPrompt 三个函数
- 新增 `src/lib/seed-templates.ts`：11 个种子模板定义 + seedTemplates() 幂等插入
- 修改 `src/lib/db.ts`：import seedTemplates 并在 initSchema() 末尾调用
- 新增 `scripts/test-prompt-templates.ts`：renderTemplate 单元测试

**修改的文件**：
- 新增：`src/lib/prompt-templates.ts`、`src/lib/seed-templates.ts`、`scripts/test-prompt-templates.ts`
- 修改：`src/lib/db.ts`

**备注**：首次写入时遇到 Windows UTF-8/GBK 编码问题，中文模板内容变为乱码，通过第二次 commit 修复（M0-T2-fix）。

---

## 2026-03-22 | M0 Task 3：更新 mistakes.ts

**完成内容**：重写 mistakes 模块适配新 schema（新增 kpId、errorType、source、remediation 字段）。

**具体操作**：
- 重写 `src/lib/mistakes.ts`：RecordMistakeParams 接口 + recordMistake / getUnresolvedMistakes / resolveMistake 三个函数

**修改的文件**：
- 修改：`src/lib/mistakes.ts`

---

## 2026-03-22 | M0 Task 4：修复 OCR 进度条 bug

**完成内容**：OCR 进度条从停在 1/189 修复为逐页正常更新。

**具体操作**：
- `scripts/ocr_pdf.py`：改为命令行参数接收 `--book-id` 和 `--db-path`，每页 try/except + 每页更新进度
- `src/app/api/books/route.ts`：POST 改用 `spawn` 显式传 DB 路径，捕获 stderr，处理非零退出码
- `src/app/api/books/[bookId]/status/route.ts`：加类型接口，映射 done→completed / error→failed

**修改的文件**：
- 修改：`scripts/ocr_pdf.py`、`src/app/api/books/route.ts`、`src/app/api/books/[bookId]/status/route.ts`

---

## 2026-03-22 | M0 Task 5：修复截图 OCR bug

**完成内容**：截图问 AI 从"无法识别"修复为正常回答（OCR 失败时用 Claude vision 兜底）。

**具体操作**：
- `scripts/ocr_server.py`：加图片预处理（EXIF 旋转、对比度增强、小图放大）+ 置信度过滤（<0.35 丢弃）
- `src/app/api/books/[bookId]/screenshot-ask/route.ts`：重写为双通道——OCR 结果可用时作为辅助文本，不可用时直接把 base64 截图发给 Claude vision API，prompt 告诉 Claude 用图片回答

**修改的文件**：
- 修改：`scripts/ocr_server.py`、`src/app/api/books/[bookId]/screenshot-ask/route.ts`

---

## 2026-03-22 | 架构优化：CCB 操作规范抽离 + claudemd-check 动态化

**完成内容**：CLAUDE.md 瘦身，CCB 操作细节抽到独立文件，claudemd-check skill 改为动态读取 CLAUDE.md 而非硬编码规则。

**具体操作**：
- 新建 `docs/ccb-protocol.md`：语言规则、任务派发流程、模型调度、Git 规则、Review 规则
- 精简 CLAUDE.md 的 CCB 部分（22 行 → 5 行），加指针到 ccb-protocol.md
- CLAUDE.md 必读文件新增第 4 项：`docs/ccb-protocol.md`
- 重写 `claudemd-check` skill：不再硬编码检查项，运行时读 CLAUDE.md 动态生成检查清单

**修改的文件**：
- 新增：`docs/ccb-protocol.md`
- 修改：`CLAUDE.md`、`.claude/skills/claudemd-check/SKILL.md`

---

## 2026-03-22 | M0 Task 6：最终验证通过

**完成内容**：M0 地基重建全部完成。8 项验证检查全部通过。

**验证清单**：
1. App 启动无报错 ✅
2. 19 张表存在（+ sqlite_sequence） ✅
3. 11 个 prompt 模板已种子化 ✅
4. 上传页面正常 ✅
5. PDF 阅读器渲染正常 ✅
6. OCR 进度条正常更新 ✅
7. 截图 AI 返回有意义回答 ✅
8. Prompt 模板渲染测试通过 ✅

**附带发现**：验证过程中发现截图问 AI 的 5 项改进需求（自动解释不等提问、英文回答中文内容、无进度反馈、MD 渲染、进度条精度），已归入 M5 任务清单。语言模式系统想法已 park 到 journal。

**修改的文件**：
- 修改：`docs/project_status.md`（M0 关闭，里程碑对齐 spec）、`docs/changelog.md`
- 新增：`docs/journal/2026-03-22-m0-verification.md`
- 修改：`docs/journal/INDEX.md`

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

## 2026-03-28 | Claude Code Hook 自动化系统 + Skill 更新

**完成内容**：第二次 brainstorming 落地——Claude Code hook 系统（H1-H7）+ 结构化派发 skill + claudemd-check 更新。

**具体操作**：
- H3: `file-boundary-guard.sh`（PreToolUse）— 编辑前拦截越界文件
- H1+H2: `post-edit-check.sh`（PostToolUse）— 编辑后自动 typecheck + console.log 检测
- H5+H6: `stop-counter.sh`（Stop）— 每 10 轮 git 状态检查，每 50 轮 compact 提醒
- H7: `pre-compact-check.sh`（PreCompact）— compact 前合规检查（含文件边界审查）
- H4: `structured-dispatch` skill — CCB 任务派发标准模板
- `.claude/settings.json` — 4 个 hook 事件接线
- `claudemd-check` skill 新增 Step 8（禁止事项全量检查）+ 更新输出格式

**修改的文件**：
- 新增：`scripts/hooks/file-boundary-guard.sh`、`scripts/hooks/post-edit-check.sh`、`scripts/hooks/stop-counter.sh`、`scripts/hooks/pre-compact-check.sh`、`.claude/settings.json`、`.claude/skills/structured-dispatch/SKILL.md`
- 修改：`.claude/skills/claudemd-check/SKILL.md`、`.gitignore`

**设计文档**：`docs/superpowers/specs/2026-03-28-claude-hooks-design.md`
**实施计划**：`docs/superpowers/plans/2026-03-28-claude-hooks-automation.md`

---

## 2026-03-28 | Session Init + Skill Chaining + Retrospective

**完成内容**：第三次 brainstorming 落地——session-init skill（上下文自动加载 + chain 路由）、retrospective skill（定期回顾）、6 个 skill chain 声明、CLAUDE.md 和 using-superpowers 更新。

**具体操作**：
- 新增 `session-init` skill：会话开始时自动读取项目状态/决策/日志/协议，评估当前位置，向用户汇报，注入 4 条 skill chain（Design/Execution/Dispatch/Closeout）
- 新增 `retrospective` skill：手动触发，分析 journal/memory/git 历史找模式，产出记忆草稿 + skill 改进建议 + journal 清理建议
- 6 个 skill 加 chain position 声明：brainstorming、writing-plans、executing-plans、verification-before-completion、structured-dispatch、requesting-code-review
- `using-superpowers` 加 `<SESSION-START>` 触发 + 用户级 skill 精简为 3 个
- `CLAUDE.md`「每次会话开始时」从手动读 4 文件改为调用 session-init（保留 fallback）
- `pre-compact-check.sh` 加 session-init 重跑提醒

**修改的文件**：
- 新增：`.claude/skills/session-init/SKILL.md`、`.claude/skills/retrospective/SKILL.md`
- 修改：`.claude/skills/using-superpowers/SKILL.md`、`.claude/skills/brainstorming/SKILL.md`、`.claude/skills/writing-plans/SKILL.md`、`.claude/skills/executing-plans/SKILL.md`、`.claude/skills/verification-before-completion/SKILL.md`、`.claude/skills/structured-dispatch/SKILL.md`、`.claude/skills/requesting-code-review/SKILL.md`、`CLAUDE.md`、`scripts/hooks/pre-compact-check.sh`

**设计文档**：`docs/superpowers/specs/2026-03-28-session-init-retrospective-design.md`
**实施计划**：`docs/superpowers/plans/2026-03-28-session-init-retrospective.md`
---

## 2026-03-28 | M1 Extractor AI 后端落地

**完成内容**: 完成 M1 后端前 3 个任务，覆盖 OCR 页标记、增强 extractor prompt 模板、三阶段 KP 提取服务，以及 4 个 module map/extract API 路由。

**修改文件**:
- 新增: `src/lib/services/kp-extraction-types.ts`, `src/lib/services/kp-extraction-service.ts`, `src/app/api/books/[bookId]/extract/route.ts`, `src/app/api/books/[bookId]/module-map/route.ts`, `src/app/api/books/[bookId]/module-map/confirm/route.ts`, `src/app/api/books/[bookId]/module-map/regenerate/route.ts`
- 修改: `src/app/api/books/route.ts`, `scripts/ocr_pdf.py`, `src/lib/db.ts`, `src/lib/prompt-templates.ts`, `src/lib/seed-templates.ts`, `src/lib/claude.ts`, `src/lib/mistakes.ts`, `src/app/api/books/[bookId]/status/route.ts`, `scripts/test-prompt-templates.ts`

---

## 2026-03-28 | M2: Coach AI - 后端实现 (Tasks 0-5)

- **T0: 状态与 schema 对齐**: 统一 `learning_status` 为 `unstarted`，为 `modules` 增加 `guide_json`，补充安全 migration，并允许 `notes_generated` 状态流转。
- **T1: Reading Notes API**: 新增 `GET/POST/DELETE /api/modules/[moduleId]/reading-notes`，使用 `handleRoute()` 返回统一 envelope。
- **T2: Q&A Generation API**: 新增 `POST /api/modules/[moduleId]/generate-questions`，读取 KPs、阅读笔记、截图问答历史，走 `coach/qa_generation` 模板并写入 `qa_questions`。
- **T3: Q&A Feedback API**: 新增 `POST /api/modules/[moduleId]/qa-feedback`，对单题答案调用 `coach/qa_feedback`，写入 `qa_responses`，并保留已答不可修改约束。
- **T4: Study Notes API**: 新增 `POST /api/modules/[moduleId]/generate-notes`，汇总 KPs、阅读笔记、Q&A 结果，调用 `coach/note_generation`，写入 `module_notes` 并推进到 `notes_generated`。
- **T5: Guide Template Refactor**: `guide` API 改为通过 `getPrompt('coach', 'pre_reading_guide', ...)` 取模板，`seedTemplates()` 对现有数据库补做 `coach`模板 upsert。

修改文件：
- `src/lib/db.ts`
- `src/lib/seed-templates.ts`
- `src/app/api/modules/[moduleId]/status/route.ts`
- `src/app/api/books/[bookId]/module-map/confirm/route.ts`
- `src/app/api/modules/[moduleId]/guide/route.ts`
- `.agents/API_CONTRACT.md`

新增文件：
- `src/app/api/modules/[moduleId]/reading-notes/route.ts`
- `src/app/api/modules/[moduleId]/generate-questions/route.ts`
- `src/app/api/modules/[moduleId]/qa-feedback/route.ts`
- `src/app/api/modules/[moduleId]/generate-notes/route.ts`

---

## 2026-03-29 | M2: Q&A Resume Support GET API

**完成内容**: 为 `GET /api/modules/[moduleId]/qa-feedback` 补齐已答记录查询能力，供前端在重新进入 Q&A 会话时恢复进度；同步更新 API contract。

**修改文件**:
- `src/app/api/modules/[moduleId]/qa-feedback/route.ts`
- `.agents/API_CONTRACT.md`

---

## 2026-03-29 | T0: Multi-Model Abstraction (Codex Tasks 0-6)

**完成内容**: 引入 Vercel AI SDK provider registry，新增 `src/lib/ai.ts`，将 12 个 AI 调用点从硬编码 Anthropic SDK 迁移到统一的 `generateText()` 接口，支持通过 `AI_MODEL` 在 Anthropic / Google / OpenAI-compatible provider 间切换；删除 `src/lib/claude.ts`，补充 `.env.example` 并在本地 `.env.local` 设置默认 `AI_MODEL=anthropic:claude-sonnet-4-6`。

**修改文件**:
- `package.json`
- `package-lock.json`
- `src/lib/ai.ts`
- `src/lib/services/kp-extraction-service.ts`
- `src/app/api/modules/route.ts`
- `src/app/api/modules/[moduleId]/qa-feedback/route.ts`
- `src/app/api/modules/[moduleId]/generate-questions/route.ts`
- `src/app/api/modules/[moduleId]/guide/route.ts`
- `src/app/api/modules/[moduleId]/generate-notes/route.ts`
- `src/app/api/modules/[moduleId]/evaluate/route.ts`
- `src/app/api/modules/[moduleId]/test-questions/route.ts`
- `src/app/api/modules/[moduleId]/questions/route.ts`
- `src/app/api/modules/[moduleId]/test-evaluate/route.ts`
- `src/app/api/conversations/[conversationId]/messages/route.ts`
- `src/app/api/books/[bookId]/screenshot-ask/route.ts`
- `.env.example`

**删除文件**:
- `src/lib/claude.ts`

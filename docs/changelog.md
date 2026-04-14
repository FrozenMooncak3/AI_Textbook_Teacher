# 变更日志（Changelog）

> 记录每次完成的功能和修改，包含日期、内容、涉及文件。
> 目的：Context 压缩后，新对话的 Claude 读这个文件可以知道"代码里现在有什么"。
> 规则：每完成一个功能或修改，必须在这里追加一条记录。

## 2026-04-15 | Research Capability — 新 skill + brainstorming 升级

**目的**：关键决策前不再凭训练记忆瞎说，改为显式调研流程，结果沉淀到 `docs/research/` 作为项目知识库。起因是 2026-04-14 云部署 OCR 决策时捏造了 Google Vision / Mistral OCR / Railway 定价被用户点破（"假装权威"）。

核心变更：
- **新 skill `research-before-decision`**（49946e9）：222 行 SKILL.md，含三级 triage（🟢 无 / 🟡 轻 / 🔴 重）、authority-weighted 源质量（S 级 = 6 条信号中满足 ≥3：持续产出 ≥5 年、机构联属、经典作品、被 S 级引用、方法论事件留名、keynote 记录）、10 步 run sequence、每维度 sub-agent 并行派发模板、5 问硬 gate（CLAUDE.md 现存格式，N/A 必须注明）、🔴/🟡 落盘文件模板
- **brainstorming skill 升级**（99ee882）：checklist 10→11 项，新增 step 5 "Research Trigger Check"（按 triage 决定 🟢/🟡/🔴）+ BS-1 增量写 spec 协议（7a skeleton / 7b 每决策 append / 7c final check），防止 compact 丢设计决策；process flow DOT 图加了 3 个新节点
- **CLAUDE.md**（03d206d）：在"Skill 使用"段补指针，把新 skill 接入 session-init 路由
- **memory 清理**：`feedback_research-before-recommendation.md` 压缩为历史事故记录（规则权威源切到 skill 文件），`project_research-capability-brainstorm.md` WIP 指针删除
- **设计资产**：spec `docs/superpowers/specs/2026-04-14-research-capability-design.md`（10 决策 D0-D9 + BS-1），plan `docs/superpowers/plans/2026-04-15-research-capability.md`（6 tasks），WIP state 文件保留作决策追溯

触发条件：brainstorming step 5 自动 triage；3+ 选项 / 难反悔 / 跨领域 / 用户明确要求 → 强制进调研流程。

---

## 2026-04-12 | Scanned PDF Advisory 清理

**里程碑收尾清理 2 条可修 Advisory**（其余 9 条按 spec 保留或已是改进，不动）：

- **Codex 277738d**：`kp-extraction-service.ts` 3 处 catch handler 的 `${String(error)}` 改用 `error instanceof Error ? error.message : String(error)` 模式，保留 Error stack
- **Gemini 40f895b**：`ProcessingPoller.tsx` 删除重写时遗留的未使用 `useRef` import

---

## 2026-04-12 | Scanned PDF Processing Upgrade — T1-T8 实现

**让扫描版 PDF 和文字版 PDF 走同一条渐进式处理管道，模块级文字一就绪就解锁"可阅读"状态**。

核心变更：
- **T1 DB schema**（fd257f5）：modules 表新增 `text_status`/`ocr_status`/`kp_extraction_status`、`page_start`/`page_end`；books 新增 `kp_extraction_status`；Docker Compose + init-db 支持 scanned-PDF 字段
- **T2 OCR Server — 页面分类**（19d92f0）：ocr_server.py 新增 `/classify-pdf`（识别 text/scanned/mixed 页）
- **T3 OCR Server — 文本提取**（3d78a48）：`/extract-text` 基于 pymupdf4llm，输出 Markdown + `--- PAGE N ---` 分页标记；scanned/mixed 页用 `[OCR_PENDING]` 占位
- **T4 OCR Server — 仅扫描页 OCR + Provider 抽象**（74ae59f）：`/ocr-pdf` 只处理 scanned/mixed 页；抽出 Provider 接口，PaddleOCR 为默认实现
- **T5 text-chunker 页范围追踪**（32b16a4）：chunker 基于 Markdown 标题切分，每个 chunk 带 page_start/page_end
- **T6 kp-extraction 按模块重写**（46f5a0e）：`extractModule(bookId, moduleId, moduleText, moduleName)` + `writeModuleResults`，module-scoped UPSERT + status 追踪
- **T7 API 路由**（b0c696c）：上传改为 4 步（classify → extract-text → 建模块 → fire-and-forget OCR）；`POST /api/books/[bookId]/extract?moduleId=N` 支持单模块重跑；新增 `GET /api/books/[bookId]/module-status` 返回每模块 text/ocr/kp 状态；`syncBookKpStatus` 汇总 precedence（completed > processing > failed > pending）
- **T8 前端模块级处理 UI**（25e97ba + cdc5481）：StatusBadge 新增 `processing`（脉冲动画）+ `readable`（"可以阅读"）；ProcessingPoller 改用 `/module-status`、每模块独立状态、404 回退旧接口；ActionHub 模块网格并行拉取 module-status、按 kpStatus/textStatus/ocrStatus 决定 badge 和可点击性

CCB 协作统计：Codex 7 任务（T1-T7）、Gemini 1 任务 + 1 次 fix（T8 违反 `any`/console 红线）、Claude 1 任务（T9 文档 + 验证）。本轮累计 Advisory 11 条（大多为命名差异或边缘 case，不阻塞）。

---

## 2026-04-10 | Page 1 Refinement — Multi-Column Dashboard 重写

**首页从单栏布局重写为 Stitch Multi-Column Dashboard 双栏布局**。

核心变更：
- **HomeContent.tsx 全面重写**：固定顶栏（搜索框+用户头像）+ 双栏布局（左栏：欢迎语+书网格+本周概览 bento 统计；右栏：ReviewButton+学习统计+最近动态 timeline）
- **CourseCard 增强**：新增 `icon`/`hoverStyle` props，渐变封面+右上角放大装饰图标（`text-black/[0.12]`）+左下角小学科图标，阴影从 `shadow-card` 改为双侧扩散 `shadow-[0_2px_20px_-2px_rgba(167,72,0,0.12)]`，hover 两种模式（shadow 阴影加深 / pedestal 底座椭圆模糊）
- **ReviewButton 空状态**：0 条待复习时显示"暂无待复习"提示，不再返回 null
- **FAB 缩小**：从 `w-16 h-16 bottom-24` 改为 `w-12 h-12 bottom-8`
- **3 条 MVP 决策停车**：扫描版 PDF 主功能、AI 教学环节、用户留存机制 → journal

---

## 2026-04-09 | Component Library — 33 组件落地 + 全页面重写

**从 Stitch 设计稿实现完整组件库，全部页面使用组件库重写**。

核心变更：
- **组件库建设**（T0-T5）：33 个 UI 组件写入 `src/components/ui/`，统一规范（data-slot、cn()、shadow tokens、直接 import）。L1 原子 16 个 + L1 组合 5 个 + L2 考试 4 个 + L2 其他 8 个
- **设计基础**（T0-T1）：`src/lib/utils.ts` cn() 工具函数（clsx + tailwind-merge），globals.css 8 个 shadow tokens + surface-bright 色值。npm 依赖：clsx、tailwind-merge、@radix-ui/react-radio-group、@radix-ui/react-switch
- **页面重写**（T6-T12）：auth（FormCard 登录/注册）、首页（AppSidebar + HeroCard + CourseCard）、Action Hub（HeroCard + ContentCard + StatusBadge）、Q&A（SplitPanel + MCOptionCard + FeedbackPanel）、考试（ExamTopBar + QuestionNavigator + FlagButton）、错题（FilterBar + MistakeCard + ToggleSwitch）、复习（BriefingCard + MasteryBars + FeedbackPanel variant='review'）、上传/模块学习/笔记页
- **旧组件清理**（T12）：删除 sidebar/*（4 文件）、SplitPanelLayout、FeedbackPanel（旧）、QuestionNavigator（旧）、ExamShell。root layout 移除 SidebarLayout 包裹
- **Bug 修复**：全站中文化（移除所有英文字符串）、KP 侧栏使用真实知识点名称、score 计算修正、console.error 清理

CCB 协作统计：Codex 1 任务（utils.ts）、Gemini 12 任务（组件+页面）、Claude 1 任务（docs），7 次 dispatch，2 次 fix dispatch，0 次 escalation。

---

## 2026-04-07 | M6-hotfix — OCR 管道修复 + 启动初始化

**修复 M6 审计发现的 4 个严重断裂**：

- **T1 OCR 管道迁移**（082e6ea）：`books/route.ts` 从 `spawn(python ocr_pdf.py)` 改为 HTTP POST 到 OCR 服务 `/ocr-pdf`；`ocr_server.py` 新增 `/ocr-pdf` 端点（Flask + 后台线程 + psycopg2 写 PostgreSQL）；`screenshot-ocr.ts` 默认端口统一为 8000；`Dockerfile.ocr` 添加 PyMuPDF/psycopg2-binary；`docker-compose.yml` OCR 服务增加 DATABASE_URL + uploads 卷；删除 `scripts/ocr_pdf.py`
- **T2 启动初始化**（aa813b5）：新建 `src/instrumentation.ts` 自动调用 `initDb()`（NEXT_RUNTIME 守卫）；移除 `docker-compose.yml` 中未使用的 `SESSION_SECRET`

CCB 协作：Codex 2 任务，0 retry，0 escalation。

---

## 2026-04-06 | M6 MVP Launch — 里程碑完成

**M6 完成**：11 个任务全部通过 review，从 SQLite 单用户本地应用升级为 PostgreSQL 多用户可部署产品。

核心变更：
- **PostgreSQL 迁移**（T1-T4）：db.ts 全量重写为异步 Pool + query helpers，48+ 文件 sync→async 转换，SQL `?` → `$N`
- **用户认证**（T5-T6）：bcrypt 密码哈希、crypto 会话令牌、HttpOnly cookie、邀请码注册、Next.js middleware、所有权 JOIN 链
- **大 PDF 分块**（T7）：text-chunker 标题检测 + 35K 字符切割 + 20 行 overlap，kp-merger Dice 去重，chunk-aware KP 提取流（含 1 次 fix：splitBySize 无限循环修复）
- **PDF 阅读器**（T8）：react-pdf-viewer 替换自研实现，内置缩放/搜索/书签/缩略图
- **安全加固**（T9）：3 个 API 路由添加 ownership guard，books.user_id NOT NULL，open redirect 修复，mojibake 修复
- **Docker 部署**（T10）：三容器 compose（app + PostgreSQL 16 + PaddleOCR），Next.js standalone，OCR 地址可配置
- **Docs + smoke test**（T11）：architecture.md 全量更新，project_status M6 完成

CCB 协作统计：Codex 8 任务、Gemini 2 任务、Claude 1 任务，共 27 advisory issues，1 次 retry（T7），0 次 escalation。

---

## 2026-04-04 | task-execution skill：统一执行引擎

- **新增 task-execution skill**: 统筹 dispatch→review→retry→close 全生命周期，替代手动串联 structured-dispatch 和 requesting-code-review
- **核心机制**: 5 阶段流程（初始化→派发→等待→审查→决策→收尾），circuit breaker（2 次重试后升级），质量门禁（Blocking/Advisory/Informational），状态账本（task-ledger.json）
- **review 分级**: Full Review（>2 文件/接口契约）、Spot Check（1-2 文件）、Auto-Pass（格式/重命名），支持自动升级
- **session 恢复**: git log 自动检测 agent 新提交，中断后无缝恢复
- **skill 协同更新**: session-init chain routing 重写，structured-dispatch/requesting-code-review 标记为 task-execution 子流程

修改文件：
- `.claude/skills/task-execution/SKILL.md` — 新建（454 行）
- `.claude/skills/session-init/SKILL.md` — chain routing + skill 手册更新
- `.claude/skills/structured-dispatch/SKILL.md` — chain position + model tier 更新
- `.claude/skills/requesting-code-review/SKILL.md` — review levels + chain position 更新
- `.claude/skills/requesting-code-review/code-reviewer.md` — severity taxonomy 统一
- `.gitignore` — 添加 `.ccb/task-ledger.json`
- `docs/superpowers/specs/2026-04-04-task-execution-design.md` — 设计文稿
- `docs/superpowers/plans/2026-04-04-task-execution-plan.md` — 实施计划

---

## 2026-04-04 | M5.5：交互体验优化 (Task 6)

- **截图对话框键盘支持**: 为 `AiChatDialog.tsx` 添加了全局 ESC 键监听，支持用户通过键盘快捷键快速关闭截图 AI 对话框。
- **资源清理**: 确保键盘监听器在组件卸载时正确移除，防止内存泄漏。

修改文件：
- `src/app/books/[bookId]/reader/AiChatDialog.tsx`

---

## 2026-04-04 | M5.5：LoadingState 组件与全站加载状态标准化 (Task 5)

- **新增 LoadingState 组件**: 创建 `src/components/LoadingState.tsx`，支持两种模式：
  - **Stage 模式**: 用于加载静态阶段，展示品牌蓝色旋转动画及说明文字。
  - **Progress 模式**: 用于展示百分比进度条（如 OCR 识别）。
- **全站适配**: 替换了仪表盘、模块地图、错题本、测试会话、复习会话及 Q&A 练习中的页级空旋转图标，为所有长时间加载过程补充了描述性文字（如"AI 正在为你生成试卷..."）。
- **交互规范**: 区分了页级加载与组件/按钮级加载，保留了按钮内的微型旋转图标，确保交互反馈的层次感。

修改文件：
- `src/components/LoadingState.tsx` — 新建
- `src/app/books/[bookId]/dashboard/page.tsx`
- `src/app/books/[bookId]/module-map/page.tsx`
- `src/app/books/[bookId]/mistakes/page.tsx`
- `src/app/books/[bookId]/modules/[moduleId]/mistakes/page.tsx`
- `src/app/books/[bookId]/modules/[moduleId]/test/TestSession.tsx`
- `src/app/books/[bookId]/modules/[moduleId]/review/ReviewSession.tsx`
- `src/app/books/[bookId]/modules/[moduleId]/qa/QASession.tsx`
- `src/app/books/[bookId]/modules/[moduleId]/NotesDisplay.tsx`

---

## 2026-04-04 | M5.5：自动化处理流与 OCR 进度优化 (Task 4)

- **ProcessingPoller 重写**: 彻底重写了 `ProcessingPoller.tsx` 组件，引入了三阶段自动处理流程：
  - **阶段 1 (OCR 进度)**: 基于后端返回的真实页码数据，展示实时 OCR 进度条。
  - **阶段 2 (自动触发提取)**: OCR 完成后，前端自动调用 `/api/books/[bookId]/extract` 启动知识点提取，无需用户手动点击。
  - **阶段 3 (状态同步)**: 轮询知识点提取状态，完成后自动通过 `router.refresh()` 刷新页面展示模块地图。
- **数据解包修复**: 修复了由于 API 采用 `handleRoute` 包装导致 `parse_status` 始终为 `undefined` 的关键 Bug。
- **鲁棒性增强**: 适配了 `ALREADY_COMPLETED` (409) 等冲突状态，确保用户重复进入页面或意外刷新后流程能正确继续。
- **ModuleMap 降级处理**: 将模块地图的生成按钮标签改为"手动重新生成模块地图"，作为自动提取失败或历史数据处理的兜底入口。

修改文件：
- `src/app/books/[bookId]/ProcessingPoller.tsx` — 核心逻辑重写
- `src/app/books/[bookId]/ModuleMap.tsx` — 按钮标签调整

---

## 2026-04-04 | M5.5：错误边界与白屏优化 (Task 3)

- **多层级错误边界**: 引入了三级 `error.tsx` 错误处理体系，确保任何代码崩溃都能被捕获并展示友好的中文错误提示。
  - **全局层**: `src/app/error.tsx` 处理顶层异常。
  - **教材层**: `src/app/books/[bookId]/error.tsx` 针对教材加载异常。
  - **模块层**: `src/app/books/[bookId]/modules/[moduleId]/error.tsx` 针对具体学习阶段异常。
- **全局 404 页面**: 新增 `src/app/not-found.tsx`，统一处理无效路由及未找到的数据实体。
- **鲁棒性审计**: 
  - 审计了所有服务端组件，确保 `db.get()` 结果均有 `notFound()` 校验。
  - 确认客户端组件（仪表盘、地图、错题本）已具备 API 异常状态的 UI 呈现逻辑。
- **用户体验**: 错误页面均提供"重试"与"返回"选项，彻底消除白屏现象。

修改文件：
- `src/app/error.tsx` — 新建
- `src/app/books/[bookId]/error.tsx` — 新建
- `src/app/books/[bookId]/modules/[moduleId]/error.tsx` — 新建
- `src/app/not-found.tsx` — 新建

---

## 2026-04-04 | M5.5：页面布局迁移与应用壳适配 (Task 2)

- **布局标准化**: 全量将页面容器从 `min-h-screen`/`h-screen` 迁移为 `min-h-full`/`h-full`，确保所有页面在侧边栏的独立滚动区域内正确渲染。
- **教材层级布局**: 新增 `src/app/books/[bookId]/layout.tsx`，为教材级联功能提供统一容器。
- **导航冗余清理**:
  - 移除首页顶部的系统日志链接（已整合至侧边栏底部）。
  - 移除教材详情页顶部的仪表盘与阅读器按钮（已整合至侧边栏二级导航）。
  - 移除模块详情页顶部的内联面包屑（已整合至侧边栏层级展示）。
- **细节修复**: 完善了 `ModuleMap.tsx` 的状态标签映射，补充了 `notes_generated` (笔记已生成) 状态。

修改文件：
- `src/app/books/[bookId]/layout.tsx` — 新建
- `src/app/page.tsx`
- `src/app/upload/page.tsx`
- `src/app/logs/page.tsx`
- `src/app/books/[bookId]/page.tsx`
- `src/app/books/[bookId]/dashboard/page.tsx`
- `src/app/books/[bookId]/module-map/page.tsx`
- `src/app/books/[bookId]/mistakes/page.tsx`
- `src/app/books/[bookId]/reader/PdfViewer.tsx`
- `src/app/books/[bookId]/modules/[moduleId]/page.tsx`
- `src/app/books/[bookId]/modules/[moduleId]/qa/page.tsx`
- `src/app/books/[bookId]/modules/[moduleId]/test/page.tsx`
- `src/app/books/[bookId]/modules/[moduleId]/mistakes/page.tsx`
- `src/app/books/[bookId]/ModuleMap.tsx`

---

## 2026-04-04 | M5.5：应用壳与导航重构 (Task 1)

- **应用壳架构 (App Shell)**: 引入了持久化的侧边栏导航，将应用从"独立页面集合"转变为具有统一体验的 Web App。
- **三层导航体系**:
  - **全局层**: 提供主页、上传教材等全局入口。
  - **教材层**: 自动识别 URL 中的 `bookId`，展示当前教材的阅读、地图、仪表盘及模块列表。
  - **模块层**: 在选中模块下自动展开 Q&A、测试及错题诊断等子入口。
- **响应式设计与修复**: 
  - **移动端优化**: 将悬浮的 Hamburger 按钮移至侧边栏外，解决移动端无法开启导航的问题。
  - **交互增强**: 增加 ESC 键关闭移动端侧边栏的监听。
  - **状态持久化**: 桌面端侧边栏展开（240px）与折叠（56px）状态通过 `localStorage` 同步。
- **细节打磨**:
  - 补充了模块展开后的"详情"入口。
  - 修正了导航图标，改为展示模块的序号（order_index）而非数据库 ID。
  - 统一了全站导航标签，适配产品规格书定义。
- **根布局集成**: 在 `src/app/layout.tsx` 中全量集成 `SidebarLayout`。

修改文件：
- `src/components/sidebar/SidebarProvider.tsx`
- `src/components/sidebar/Sidebar.tsx`
- `src/components/sidebar/SidebarLayout.tsx`
- `src/components/sidebar/SidebarToggle.tsx`
- `src/app/layout.tsx`

---

## 2026-04-03 | M5 热修复：截图问 AI 系统 prompt 重写

- **问题**：系统 prompt 规定"只根据提供的内容回答"，导致 AI 变成复读机，无法解释教材没写明的"为什么"。
- **修复**：重写 `SCREENSHOT_ASK_SYSTEM_PROMPT`，改为以教材为基础、结合自身知识解释概念，像老师一样教学生。

修改文件：
- `src/app/api/books/[bookId]/screenshot-ask/route.ts` — 重写系统 prompt

---

## 2026-04-03 | M5：AI 生成内容 Markdown 渲染全覆盖

- **全量迁移至 AIResponse**：审计全站 AI 生成内容，确保所有动态生成文本均使用 `<AIResponse>` 组件进行 Markdown 渲染。
- **覆盖位置**：
  - 读前指引（目标、核心重点、易错点）— `ModuleLearning.tsx`
  - 学习笔记 — `NotesDisplay.tsx`
  - 错题诊断（题目文本、正确答案、KP 描述、补救建议）— 模块级与书籍级 `mistakes/page.tsx`
  - 模块地图摘要 — `ModuleMap.tsx`
- **样式统一**：移除残留的原始文本渲染（`<p>`/`<div>` 直接包裹变量），统一采用 Tailwind Typography 规范。
- **清理**：确认项目中已无 `MarkdownRenderer` 组件引用。

修改文件：
- `src/app/books/[bookId]/modules/[moduleId]/ModuleLearning.tsx`
- `src/app/books/[bookId]/modules/[moduleId]/NotesDisplay.tsx`
- `src/app/books/[bookId]/modules/[moduleId]/mistakes/page.tsx`
- `src/app/books/[bookId]/mistakes/page.tsx`
- `src/app/books/[bookId]/ModuleMap.tsx`

---

## 2026-04-03 | M5：Mistakes schema 扩展 + screenshot assistant 模板修复

- **mistakes 表迁移**：为 `mistakes` 补充 `question_text`、`user_answer`、`correct_answer` 三个可空列，为后续错题本展示题干、作答和标准答案做准备。
- **assistant 模板修复**：将 `assistant/screenshot_qa` 的乱码 UTF-8 模板替换为干净中文文本，并保留 `{screenshot_text}`、`{user_question}`、`{conversation_history}` 三个运行时变量。
- **seed upsert 补齐**：`seedTemplates()` 现会对已有数据库中的 `assistant` 角色模板做 upsert，避免旧库继续保留乱码模板。
- **回归脚本**：新增 `scripts/test-m5-task1.mjs`，覆盖三条 migration、模板正文和 assistant upsert 分支。

修改文件：
- `src/lib/db.ts` — 新增 3 条 mistakes ALTER TABLE migration
- `src/lib/seed-templates.ts` — 修复 screenshot_qa 模板并补 assistant upsert
- `scripts/test-m5-task1.mjs` — 新增 M5-T1 回归脚本
- `docs/changelog.md` — 本条记录

---

## 2026-04-03 | M5：截图问 AI API 拆分

- **新增 OCR-only 接口**：创建 `POST /api/books/[bookId]/screenshot-ocr`，只负责接收截图、调用 PaddleOCR 服务并返回 `{ text, confidence }`，不再混入 AI 回答逻辑。
- **重写 screenshot-ask**：`POST /api/books/[bookId]/screenshot-ask` 改为接收 `{ image, text, question }`，切换到 `handleRoute()` 包装，响应变为 `{ success: true, data: { conversationId, answer } }`，并移除旧的 `extractedText` 字段。
- **prompt 模板接入**：移除 route 内硬编码用户 prompt，改为通过 `getPrompt('assistant', 'screenshot_qa', ...)` 生成提问上下文；系统 prompt 改为中文，并保留视觉输入给模型处理图表/公式。
- **共享 OCR 工具**：抽出 `src/lib/screenshot-ocr.ts` 复用 OCR 请求和 base64 归一化逻辑，避免新旧路由重复实现。
- **回归脚本**：新增 `scripts/test-m5-task3.mjs`，覆盖新路由存在性、handleRoute 包装、prompt 模板调用、共享 OCR utility 和响应形态。

修改文件：
- `src/lib/screenshot-ocr.ts` — 新增共享 OCR 工具
- `src/app/api/books/[bookId]/screenshot-ocr/route.ts` — 新增 OCR-only 路由
- `src/app/api/books/[bookId]/screenshot-ask/route.ts` — 改为两步流程中的 AI 提问路由
- `scripts/test-m5-task3.mjs` — 新增 M5-T3 回归脚本
- `docs/changelog.md` — 本条记录

---

## 2026-04-03 | M5：学习仪表盘与错题诊断中心

- **学习仪表盘 (Dashboard)**: 新增 `src/app/books/[bookId]/dashboard/page.tsx`。
  - **总览进度**: 展示教材完成百分比进度条。
  - **学习路径**: 模块列表及其当前学习状态（图标化展示）。
  - **复习计划**: 按日期排列的复习日程，过期任务红色高亮。
  - **测试记录**: 展示最近 10 次测试成绩及是否通过。
  - **错题概览**: 统计总错题数及各类错误分布，一键跳转错题本。
- **错题诊断中心 (Mistakes Center)**: 新增 `src/app/books/[bookId]/mistakes/page.tsx`。
  - **多维筛选**: 支持按模块、错误类型（知识盲点、程序失误等）、来源（测试、Q&A、复习）进行组合筛选。
  - **对比展示**: 清晰对比"你的回答"与"正确答案"，针对性纠错。
  - **AI 诊断**: 使用 `<AIResponse>` 组件渲染 AI 提供的深度诊断与补救建议。
- **入口集成**: 
  - 首页书架卡片新增"学习仪表盘"入口。
  - 教材详情页顶部新增"仪表盘"快捷链接。

修改文件：
- `src/app/books/[bookId]/dashboard/page.tsx` — 新建
- `src/app/books/[bookId]/mistakes/page.tsx` — 新建
- `src/app/page.tsx` — 首页入口集成
- `src/app/books/[bookId]/page.tsx` — 详情页入口集成

---

## 2026-04-03 | M5：复习与测试结果展示优化

- **复习结果增强**: 在 `ReviewSession.tsx` 中新增"正确答案"与"解析"区块，在 AI 评价后展示，帮助用户快速纠错。
- **测试结果增强**: 在 `TestSession.tsx` 的逐题反馈中，为所有题目（无论对错）增加"正确答案"与"解析"展示。
- **UI 组件统一**: 全面移除 `MarkdownRenderer`，改用基于 Tailwind Typography 的 `AIResponse` 组件渲染题目、评价与解析，确保视觉风格一致。
- **视觉风格**: 正确答案采用绿色（green-50）背景，解析采用蓝色（blue-50）背景，层次分明。

修改文件：
- `src/app/books/[bookId]/modules/[moduleId]/review/ReviewSession.tsx`
- `src/app/books/[bookId]/modules/[moduleId]/test/TestSession.tsx`

---

## 2026-04-03 | M5：截图问 AI 流程重构

- **重写 AiChatDialog**: 将截图问 AI 流程从"挂载即自动解释"改为两步走：OCR 识别 → 用户提问 → AI 回答。
- **状态机管理**: 引入 `ocr_processing | text_ready | asking | answered` 状态机，优化交互体验。
- **OCR 优先**: 挂载后首先调用 `/api/books/{bookId}/screenshot-ocr` 进行文字识别并展示。
- **Markdown 渲染**: 接入 `<AIResponse>` 组件，使 AI 的回答支持 Markdown 格式（标题、列表、表格等）。
- **API 适配**: 适配后端 `handleRoute` 包装后的 `{ success, data }` 响应格式，移除已废弃的 `extractedText` 字段处理。
- **持续对话**: 修复并保留了基于 `conversationId` 的追问功能。

修改文件：
- `src/app/books/[bookId]/reader/AiChatDialog.tsx` — 核心逻辑重写

---

## 2026-04-03 | M5：AIResponse 组件与 Markdown 渲染统一化

- **新增 AIResponse 组件**: 创建 `src/components/AIResponse.tsx`，集成 `react-markdown` 和 `remark-gfm`，使用 `@tailwindcss/typography` 的 `prose` 类实现标准化的 AI 内容渲染。
- **集成 Typography 插件**: 在 `src/app/globals.css` 中引入 `@plugin "@tailwindcss/typography"`，适配 Tailwind v4 架构。
- **依赖更新**: 安装 `remark-gfm` 和 `@tailwindcss/typography` 依赖。
- **验证与清理**: 在 `src/app/page.tsx` 中进行了组件渲染验证，确认支持标题、表格、加粗、代码块和列表，验证通过后已清理测试代码。

修改文件：
- `src/components/AIResponse.tsx` — 新增组件
- `src/app/globals.css` — 引入 typography 插件 (Tailwind v4)
- `package.json` — 新增依赖
- `docs/changelog.md` — 本条记录

---

## 2026-04-03 | M4 milestone-audit 执行

- 对 M4 复习系统执行 milestone-audit，验证 architecture.md 与代码一致性
- 审计 5 个类别（页面/API/DB/AI 角色/状态流）全部一致
- 发现 1 处缺漏：错题流转 error_type 约束未文档化（4 个合法值 + test/submit 缺归一化）
- 已补全 architecture.md 错题流转 section，标注 ⚠️

修改文件：
- `docs/architecture.md` — 补充 error_type 约束 + ⚠️ 标记
- `docs/journal/2026-04-03-m4-milestone-audit.md` — 审计报告
- `docs/journal/INDEX.md` — 新增审计条目

---

## 2026-04-03 | 工程流程：architecture.md 守护体系

- **milestone-audit skill**：里程碑收尾时按改动范围定向审计 architecture.md（6 类检查 + 报告格式），确保下个里程碑 brainstorming 基于准确的系统现状设计。
- **brainstorming 深度 review**：spec review 从冷 subagent 替换为带完整项目上下文的 agent，检查接口一致性/改动清单完整性/数据流连通/跨模块副作用/内部一致性 5 个维度。
- **Closeout Chain 扩展**：requesting-code-review → milestone-audit → claudemd-check → finishing-a-development-branch。
- **CLAUDE.md 强化**：新增"架构地图"段落 + 禁止事项加"不得跳过 milestone-audit"。
- **claudemd-check 强化**：Step 3 扩展检查 architecture.md + 新增里程碑审计检查项。
- **brainstorming 强化**：Step 1 改为 5 项明确读取列表 + HARD-GATE（发现不一致先修 architecture.md）。

修改文件：
- `.claude/skills/milestone-audit/SKILL.md` — 新建
- `.claude/skills/brainstorming/SKILL.md` — 读取列表 + HARD-GATE + review loop 重写
- `.claude/skills/brainstorming/spec-document-reviewer-prompt.md` — 深度 review agent 模板重写
- `.claude/skills/claudemd-check/SKILL.md` — 加检查项
- `.claude/skills/session-init/SKILL.md` — 触发表 + chain + skill 表
- `.claude/skills/requesting-code-review/SKILL.md` — Chain Position 同步
- `CLAUDE.md` — 架构地图段落 + 禁止事项
- `docs/journal/INDEX.md` — milestone-audit 从 parked 移到 resolved
- `docs/superpowers/specs/2026-04-03-milestone-audit-design.md` — 设计文稿
- `docs/superpowers/plans/2026-04-03-milestone-audit-plan.md` — 实施计划

---

## 2026-04-03 | M4：Review error_type 防御性归一化

- **错因标签归一化**：新增 `normalizeReviewErrorType()`，将 reviewer 返回的自由文本错因收敛到 `blind_spot / procedural / confusion / careless` 四个数据库允许值；合法值原样保留，模糊匹配失败时默认落到 `confusion`。
- **mistakes 写入兜底**：`POST /api/review/[scheduleId]/respond` 在答错时先归一化 `error_type` 再写 `mistakes`，避免因 AI 返回如 `concept_confusion`、`knowledge_gap` 之类标签触发表约束错误。
- **回归脚本扩展**：补充 error_type helper 存在性、合法值保留、模糊匹配和默认分支测试。

修改文件：
- `src/lib/review-question-utils.ts` — 新增 review mistake error_type 归一化工具
- `src/app/api/review/[scheduleId]/respond/route.ts` — mistakes 写入前使用归一化 error_type
- `scripts/test-review-route-fixes.mjs` — 新增 error_type 归一化回归覆盖
- `docs/changelog.md` — 本条记录

---

## 2026-04-03 | M4：Review 系统 Bug 修复

- **复习出题验证放宽**：抽出 `review-question-utils`，非单选题即使 AI 返回噪声 `options` 也会归一化为 `null` 后继续入库，不再整题跳过；单选题仍保持 4 个选项的严格校验。
- **复习评分预算提升**：`POST /api/review/[scheduleId]/respond` 改为使用 `8192` 的最小输出预算常量，避免 Gemini Flash 因 thinking tokens 挤占预算导致 JSON 截断。
- **回归脚本补齐**：新增 Node 测试脚本覆盖 validator 行为和 review scoring 输出预算，作为这两个 M4 bug 的回归保护。

修改文件：
- `src/lib/review-question-utils.ts` — 新增复习题目 validator + scoring token 常量
- `src/app/api/review/[scheduleId]/generate/route.ts` — 改为复用共享 validator，非单选题 options 噪声不再导致跳题
- `src/app/api/review/[scheduleId]/respond/route.ts` — scoring 输出预算提升到 8192
- `scripts/test-review-route-fixes.mjs` — 新增回归脚本
- `docs/changelog.md` — 本条记录

---

## 2026-04-02 | M4：复习系统

- **P 值方向修正**：低=好（1=已掌握，4=最弱），范围 1-4。test/submit P 值初始化简化为全对→P=2，有错→P=3
- **新增 2 张表**：review_questions（复习题目，含 cluster_id/kp_id/正确答案/解析）、review_responses（答题记录+AI反馈+错误类型）
- **reviewer prompt 升级**：review_generation 修正 P 值方向 + 加 {max_questions}/{recent_questions}；新增 review_scoring 评分模板
- **GET /api/review/due**：查询 status='pending' 且 due_date ≤ today 的复习调度
- **POST /api/review/[scheduleId]/generate**：按 cluster P 值分配题量（P=题数，上限 10，等比缩减），幂等（已有题返回下一道未答题），防御性 JSON 解析
- **POST /api/review/[scheduleId]/respond**：逐题 AI 评分（review_scoring prompt），写 review_responses，答错写 mistakes（source='review'，含 error_type/remediation）
- **POST /api/review/[scheduleId]/complete**：汇总 cluster 结果，P 值更新（全对→P-1，连错→P+1，首错→不变），P=1 跳级规则，创建下一轮调度，写 review_records
- **复习会话前端**：ReviewSession 组件（QA 模式：intro→答题→反馈→完成），支持 4 种题型，AI 反馈 Markdown 渲染，进度条，完成页含集群掌握情况
- **首页待复习按钮**：ReviewButton 组件，amber 风格，展开显示待复习模块列表

修改文件：
- `src/lib/db.ts` — 新增 review_questions/review_responses 表 + P 值 reset migration
- `src/lib/seed-templates.ts` — 修正 review_generation + 新增 review_scoring
- `src/app/api/modules/[moduleId]/test/submit/route.ts` — P 值初始化简化
- `src/app/api/review/due/route.ts` — 新建
- `src/app/api/review/[scheduleId]/generate/route.ts` — 新建
- `src/app/api/review/[scheduleId]/respond/route.ts` — 新建
- `src/app/api/review/[scheduleId]/complete/route.ts` — 新建
- `src/app/books/[bookId]/modules/[moduleId]/review/page.tsx` — 新建
- `src/app/books/[bookId]/modules/[moduleId]/review/ReviewSession.tsx` — 新建
- `src/app/ReviewButton.tsx` — 新建
- `src/app/page.tsx` — 集成 ReviewButton
- `docs/architecture.md` — 更新系统总图 + 新增复习系统契约
- `docs/project_status.md` — M4 标记完成
- `docs/changelog.md` — 本条记录

---

## 2026-04-02 | M3.5：里程碑衔接修复

- **测试通过触发复习调度**：`test/submit` 通过（≥80%）时自动创建 `review_schedule`（round=1, due=today+3天）+ 按 cluster 更新 P 值（全对涨、有错降，bounds 1-5）
- **删除冗余字段**：`clusters.next_review_date` 已删除，复习调度统一走 `review_schedule.due_date`
- **reviewer prompt 重写**：乱码 UTF-8 模板替换为正常中文，含 P 值出题策略 + `{recent_questions}` 去重占位符，已加入 seedTemplates upsert 循环

修改文件：
- `src/app/api/modules/[moduleId]/test/submit/route.ts` — 追加复习调度 + P 值更新
- `src/lib/db.ts` — 删除 next_review_date + migration
- `src/lib/seed-templates.ts` — 重写模板 + upsert 循环扩展
- `docs/architecture.md` — 移除 3 个 ⚠️ 标记，更新接口契约

---

## 2026-04-02 | 基础设施：架构地图系统

- **`docs/architecture.md` 新建**：两层架构文档——第一层系统总图（页面、API、DB 表、AI 角色、学习状态流），第二层接口契约（跨模块依赖 + ⚠️ 标记已知断裂点）
- **CLAUDE.md 禁止事项扩展**：里程碑完成时必须同步更新 `architecture.md`
- **session-init 读取列表扩展**：Step 1 新增 `docs/architecture.md` 读取
- **CCB 里程碑收尾清理**：`finishing-a-development-branch` 新增 Step 6 清理 `.ccb/inbox/`；`ccb-protocol.md` 新增 cleanup 命令

修改文件：
- `docs/architecture.md` — 新建
- `CLAUDE.md` — 禁止事项扩展
- `.claude/skills/session-init/SKILL.md` — 读取列表扩展
- `.claude/skills/finishing-a-development-branch/SKILL.md` — 新增 Step 6
- `docs/ccb-protocol.md` — lifecycle cleanup 扩展
- `docs/superpowers/specs/2026-04-02-architecture-map-design.md` — 设计文稿
- `docs/superpowers/plans/2026-04-02-architecture-map.md` — 实施计划

---

## 2026-04-02 | 基础设施：CCB 文件消息系统

- **替代 `ask` 命令**：所有 Claude↔Codex↔Gemini 通信改为"写文件到 `.ccb/inbox/` + 短 wezterm 通知"。解决了 `ask` 异步长消息静默失败的问题。
- **双向通信验证通过**：Claude→Codex、Claude→Gemini、Codex→Claude、Gemini→Claude 全部测试成功。
- **PowerShell 兼容**：Codex/Gemini 使用 `wezterm cli send-text --pane-id N --no-paste "msg\`r"` 位置参数形式发送通知。

修改文件：
- `docs/ccb-protocol.md` — 通信基础设施重写
- `AGENTS.md` — 完成报告改为文件消息协议
- `GEMINI.md` — 同上
- `.claude/skills/structured-dispatch/SKILL.md` — 派发流程更新
- `.claude/skills/session-init/SKILL.md` — 新增 inbox 扫描
- `.claude/skills/api-contract/SKILL.md` — 通知流程更新
- `.codex/skills/api-contract/SKILL.md` — 同上
- `.gitignore` — 新增 `.ccb/inbox/**` 忽略规则
- `docs/superpowers/specs/2026-04-02-ccb-file-messaging-design.md` — 设计文稿
- `docs/superpowers/plans/2026-04-02-ccb-file-messaging.md` — 实施计划

---

## 2026-04-01 | 前端：AI 评价 Markdown 渲染

- **MarkdownRenderer 组件**: 新增 `src/components/MarkdownRenderer.tsx`，使用 `react-markdown` 统一渲染 AI 反馈内容，严格遵循 `DESIGN_TOKENS.md` 视觉规范（slate 色系、rounded-xl、leading-relaxed）。
- **Q&A 评价渲染**: 改造 `QASession.tsx`，将即时反馈区域的纯文本渲染替换为 Markdown 渲染，支持加粗、列表、代码块等格式。
- **测试结果反馈渲染**: 改造 `TestSession.tsx`，将逐题反馈中的"解析"、"AI 评价"、"补救建议"全部替换为 Markdown 渲染，移除原有的 `whitespace-pre-wrap` 限制。

修改文件：
- `src/components/MarkdownRenderer.tsx` — 新增组件
- `src/app/books/[bookId]/modules/[moduleId]/qa/QASession.tsx` — 接入 Markdown
- `src/app/books/[bookId]/modules/[moduleId]/test/TestSession.tsx` — 接入 Markdown

---

## 2026-04-01 | M3 集成测试修复 — AI 代理 + JSON 解析

- **Next.js Turbopack 代理修复**: `next.config.ts` 添加 `serverExternalPackages`（undici + AI SDK 全链），防止 Turbopack 打包破坏原生模块
- **undici Response 流式兼容**: `ai.ts` 的 fetch wrapper 改为 `arrayBuffer()` 一次性读取再用全局 `Response` 重包装，修复 Turbopack 环境下流式读取截断
- **thinking tokens 上限**: `maxOutputTokens` 从 16384 提升到 65536，避免 Gemini 2.5 Flash thinking tokens 挤占输出空间
- **JSON 解析加固**: 剥离 markdown 代码块包裹；字符串内控制字符消毒（状态机区分结构性空白 vs 字符串内部）；单题验证失败跳过而非整体失败

修改文件：
- `next.config.ts` — serverExternalPackages 扩展
- `src/lib/ai.ts` — fetch wrapper arrayBuffer 重包装
- `src/app/api/modules/[moduleId]/test/generate/route.ts` — maxOutputTokens + parseGeneratedQuestions 加固 + 单题容错

---

## 2026-03-29 | Gemini Flash Smoke Test 通过

- **M2 完整流程验证**：阅读 → Q&A（出题+即时反馈）→ 笔记生成 → 完成，在 Gemini 2.5 Flash 免费档下全部跑通
- **笔记生成 token 修复**: generate-notes maxOutputTokens 4096→16384，修复中文笔记截断

修改文件：
- `src/app/api/modules/[moduleId]/generate-notes/route.ts`

---

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

---

## 2026-03-31 | M3: Examiner AI Backend Batch 1

**完成内容**: 为 M3 考官 AI 落地 batch 1 后端能力：新增 `test_questions.kp_ids` 安全迁移；替换 examiner 的 `test_generation` / `test_scoring` prompt 模板并接入 seed upsert；新增 `POST /api/modules/[moduleId]/test/generate` 用于按模块 KP 生成测试卷（支持未提交试卷缓存与 retake 清理）；新增 `GET /api/modules/[moduleId]/test` 用于返回当前测试状态、进行中试卷和历史记录。

**修改文件**:
- `src/lib/db.ts`
- `src/lib/seed-templates.ts`
- `src/app/api/modules/[moduleId]/test/generate/route.ts`
- `src/app/api/modules/[moduleId]/test/route.ts`

---

## 2026-03-31 | M3: Examiner AI Backend Batch 2

**完成内容**: 为 M3 考官 AI 落地 batch 2 后端能力：新增 `POST /api/modules/[moduleId]/test/submit`，实现单选自动判分、主观题 AI 评分、错题诊断、服务端总分/通过率计算，以及事务内联写入 `test_responses` / `mistakes` 并在通过时更新模块状态；重写 `GET /api/modules/[moduleId]/mistakes` 以适配新 schema；删除旧 Phase 1 的 `test-questions` / `test-evaluate` 路由。

**修改文件**:
- `src/app/api/modules/[moduleId]/test/submit/route.ts`
- `src/app/api/modules/[moduleId]/mistakes/route.ts`
- `docs/changelog.md`

**删除文件**:
- `src/app/api/modules/[moduleId]/test-questions/route.ts`
- `src/app/api/modules/[moduleId]/test-evaluate/route.ts`

---

## 2026-03-31 | M3: Examiner AI Frontend

**完成内容**: 重写测试页面和错题页面，适配 M3 新 API。TestSession 实现完整状态机（引导→生成→答题→提交→结果），单选 radio + 主观 textarea，80% 过关线醒目展示，3 次连续失败提示。错题页按已解决/未解决分组，error_type 颜色区分 + 补救建议。

**修复**: pass_rate 进度条 bug（后端返回百分比整数，前端多乘了 100）；page.tsx 移除 TypeScript `any`。

**修改文件**:
- `src/app/books/[bookId]/modules/[moduleId]/test/page.tsx`
- `src/app/books/[bookId]/modules/[moduleId]/test/TestSession.tsx`
- `src/app/books/[bookId]/modules/[moduleId]/mistakes/page.tsx`

---

## 2026-04-03 | M4: Review Generate Output Budget Hotfix

**完成内容**: 将 `POST /api/review/[scheduleId]/generate` 的 `maxOutputTokens` 从 `4096` 提升到 `65536`，避免 Gemini Flash 因 thinking tokens 占用预算导致 JSON 在流中被截断。

**修改文件**:
- `src/app/api/review/[scheduleId]/generate/route.ts`

---

## 2026-04-02 | M4: Review Session Completion API

**完成内容**: 新增 `POST /api/review/[scheduleId]/complete`，在单个事务内完成复习会话收尾：校验题目已全部作答、按 cluster 汇总正确率、更新 P 值与 `last_review_result`、写入 `review_records`、按跳级规则创建下一轮 `review_schedule`，并将当前 schedule 标记为 completed。

**修改文件**:
- `src/app/api/review/[scheduleId]/complete/route.ts`
- `.agents/API_CONTRACT.md`
---

## 2026-04-03 | M5: Review/Test Mistake Payload Completion

**完成内容**: 补全 `POST /api/review/[scheduleId]/respond` 的返回字段，新增 `correct_answer` 与 `explanation`；同时更新 review/test 两条错题写入路径，把 `question_text`、`user_answer`、`correct_answer` 一并写入 `mistakes`，使 M5-T1 新增列在后续接口中得到实际填充。

**修改文件**:
- `src/app/api/review/[scheduleId]/respond/route.ts`
- `src/app/api/modules/[moduleId]/test/submit/route.ts`
- `scripts/test-m5-task4.mjs`

---

## 2026-04-03 | M5: Dashboard Aggregate API + Book Mistakes API

**完成内容**: 新增 `GET /api/books/[bookId]/dashboard`，聚合书籍级学习进度、待复习、最近测试和错题分布；新增 `GET /api/books/[bookId]/mistakes`，支持按 `module`、`errorType`、`source` 过滤书级错题列表，并返回整本书范围的汇总统计。同步更新 `.agents/API_CONTRACT.md`，补齐新接口契约并修正 review respond 返回字段。

**修改文件**:
- `src/app/api/books/[bookId]/dashboard/route.ts`
- `src/app/api/books/[bookId]/mistakes/route.ts`
- `scripts/test-m5-task5.mjs`
- `.agents/API_CONTRACT.md`

---

## 2026-04-03 | M5 Hotfix: Screenshot Ask Teaching Prompt

**完成内容**: 重写 `SCREENSHOT_ASK_SYSTEM_PROMPT`，将截图问答助手从“只复述截图内容”调整为“以教材内容为基础并结合专业知识讲清楚为什么”，允许在教材说明不足时补充必要背景知识，同时保留同语种回答、Markdown 格式和按问题复杂度控制展开程度的要求。

**修改文件**:
- `src/app/api/books/[bookId]/screenshot-ask/route.ts`
- `scripts/test-m5-screenshot-prompt-hotfix.mjs`
---

## 2026-04-04 | M5.5: Normalize test/submit error_type with shared utility

**完成内容**: 在 `POST /api/modules/[moduleId]/test/submit` 中接入共享的 `normalizeReviewErrorType()`，替换 4 处原始 `'blind_spot'` fallback，使单选诊断、主观题结果和 `mistakes` 写入都统一落到 4 个标准 `error_type` 值上，并与 review 流程保持一致。

**修改文件**:
- `src/app/api/modules/[moduleId]/test/submit/route.ts`
- `scripts/test-m5.5-task7.mjs`

---

## 2026-04-06 | M6 MVP Launch: PostgreSQL foundation migration

**完成内容**: 将数据库基础层从同步 `better-sqlite3` 切换为异步 `pg`，新增 PostgreSQL `schema.sql` 定义 24 张表，并补充 `users`、`invite_codes`、`sessions` 三张认证基础表以及 `books.user_id` 外键；重写 `src/lib/db.ts` 为 `query`、`queryOne`、`run`、`insert`、`initDb` 和 `pool` 导出；同步更新 `.env.example` 为 `DATABASE_URL` 配置，并增加静态回归脚本覆盖依赖切换与 schema 结构要求。
**修改文件**:
- `package.json`
- `package-lock.json`
- `.env.example`
- `src/lib/db.ts`
- `src/lib/schema.sql`
- `scripts/test-m6-task1.mjs`

---

## 2026-04-06 | M6 MVP Launch: Async lib conversion for PostgreSQL helpers

**完成内容**: 将 `log.ts`、`prompt-templates.ts`、`mistakes.ts`、`book-service.ts`、`seed-templates.ts` 从同步 `getDb()` 调用迁移到异步 `query` / `queryOne` / `run`，统一替换为 PostgreSQL `$1...$n` 占位符，并补回 `initDb()` 在建表后执行 `seedTemplates()` 的初始化逻辑；新增静态回归脚本覆盖异步签名、helper 导入和模板播种调用。
**修改文件**:
- `src/lib/db.ts`
- `src/lib/log.ts`
- `src/lib/prompt-templates.ts`
- `src/lib/mistakes.ts`
- `src/lib/services/book-service.ts`
- `src/lib/seed-templates.ts`
- `scripts/test-m6-task2.mjs`

---

## 2026-04-06 | M6 MVP Launch: Books/conversations/logs routes to async PostgreSQL

**完成内容**: 将 books 分组、conversation messages 和 logs 共 16 个 API route 从同步 `getDb()` / `db.prepare()` 迁移为异步 `query` / `queryOne` / `run` / `insert`，补齐 `await logAction()`、`await getPrompt()`、`await bookService.list()` 等 Task 2 引入的异步调用，并新增静态回归脚本验证目标路由不再依赖旧的 SQLite 访问模式。
**修改文件**:
- `src/app/api/books/route.ts`
- `src/app/api/books/[bookId]/status/route.ts`
- `src/app/api/books/[bookId]/extract/route.ts`
- `src/app/api/books/[bookId]/pdf/route.ts`
- `src/app/api/books/[bookId]/toc/route.ts`
- `src/app/api/books/[bookId]/highlights/route.ts`
- `src/app/api/books/[bookId]/notes/route.ts`
- `src/app/api/books/[bookId]/module-map/route.ts`
- `src/app/api/books/[bookId]/module-map/confirm/route.ts`
- `src/app/api/books/[bookId]/module-map/regenerate/route.ts`
- `src/app/api/books/[bookId]/screenshot-ocr/route.ts`
- `src/app/api/books/[bookId]/screenshot-ask/route.ts`
- `src/app/api/books/[bookId]/dashboard/route.ts`
- `src/app/api/books/[bookId]/mistakes/route.ts`
- `src/app/api/conversations/[conversationId]/messages/route.ts`
- `src/app/api/logs/route.ts`
- `scripts/test-m6-task3.mjs`

## 2026-04-06 | M6 MVP Launch: Modules/review/qa routes + KP extraction service to async PostgreSQL

**Completed**: Migrated the modules/review/qa route batch and the DB-writing path in `kp-extraction-service.ts` from sync SQLite access to async PostgreSQL helpers, added the Task 4 regression script, fixed the `screenshot-ask` OCR fallback mojibake string, and added a temporary `getDb()` compatibility shim in `src/lib/db.ts` so untouched server pages can still build without editing forbidden `.tsx` files.
**Modified files**:
- `src/app/api/modules/route.ts`
- `src/app/api/modules/[moduleId]/status/route.ts`
- `src/app/api/modules/[moduleId]/guide/route.ts`
- `src/app/api/modules/[moduleId]/generate-questions/route.ts`
- `src/app/api/modules/[moduleId]/questions/route.ts`
- `src/app/api/modules/[moduleId]/qa-feedback/route.ts`
- `src/app/api/modules/[moduleId]/evaluate/route.ts`
- `src/app/api/modules/[moduleId]/generate-notes/route.ts`
- `src/app/api/modules/[moduleId]/reading-notes/route.ts`
- `src/app/api/modules/[moduleId]/test/route.ts`
- `src/app/api/modules/[moduleId]/test/generate/route.ts`
- `src/app/api/modules/[moduleId]/test/submit/route.ts`
- `src/app/api/modules/[moduleId]/mistakes/route.ts`
- `src/app/api/review/due/route.ts`
- `src/app/api/review/[scheduleId]/generate/route.ts`
- `src/app/api/review/[scheduleId]/respond/route.ts`
- `src/app/api/review/[scheduleId]/complete/route.ts`
- `src/app/api/qa/[questionId]/respond/route.ts`
- `src/app/api/books/[bookId]/screenshot-ask/route.ts`
- `src/lib/services/kp-extraction-service.ts`
- `src/lib/db.ts`
- `scripts/test-m6-task4.mjs`

## 2026-04-06 | M6 MVP Launch: Auth backend, invite codes, middleware, and user isolation

**Completed**: Added the M6 Task 5 auth backend with invite-code registration, session cookies, `/api/auth` endpoints, request middleware, and user ownership enforcement across books, modules, and review APIs. This also fixed the repeated `screenshot-ask` fallback mojibake in the prompt payload and added the invite-code seed script plus the Task 5 regression script.
**Modified files**:
- `package.json`
- `package-lock.json`
- `src/lib/auth.ts`
- `src/lib/handle-route.ts`
- `src/app/api/auth/register/route.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/auth/me/route.ts`
- `src/middleware.ts`
- `scripts/seed-invite-codes.ts`
- `src/app/api/books/route.ts`
- `src/app/api/books/[bookId]/status/route.ts`
- `src/app/api/books/[bookId]/extract/route.ts`
- `src/app/api/books/[bookId]/pdf/route.ts`
- `src/app/api/books/[bookId]/toc/route.ts`
- `src/app/api/books/[bookId]/highlights/route.ts`
- `src/app/api/books/[bookId]/notes/route.ts`
- `src/app/api/books/[bookId]/module-map/route.ts`
- `src/app/api/books/[bookId]/module-map/confirm/route.ts`
- `src/app/api/books/[bookId]/module-map/regenerate/route.ts`
- `src/app/api/books/[bookId]/screenshot-ocr/route.ts`
- `src/app/api/books/[bookId]/screenshot-ask/route.ts`
- `src/app/api/books/[bookId]/dashboard/route.ts`
- `src/app/api/books/[bookId]/mistakes/route.ts`
- `src/app/api/modules/route.ts`
- `src/app/api/modules/[moduleId]/status/route.ts`
- `src/app/api/modules/[moduleId]/guide/route.ts`
- `src/app/api/modules/[moduleId]/generate-questions/route.ts`
- `src/app/api/modules/[moduleId]/questions/route.ts`
- `src/app/api/modules/[moduleId]/qa-feedback/route.ts`
- `src/app/api/modules/[moduleId]/evaluate/route.ts`
- `src/app/api/modules/[moduleId]/generate-notes/route.ts`
- `src/app/api/modules/[moduleId]/reading-notes/route.ts`
- `src/app/api/modules/[moduleId]/test/route.ts`
- `src/app/api/modules/[moduleId]/test/generate/route.ts`
- `src/app/api/modules/[moduleId]/test/submit/route.ts`
- `src/app/api/modules/[moduleId]/mistakes/route.ts`
- `src/app/api/review/due/route.ts`
- `src/app/api/review/[scheduleId]/generate/route.ts`
- `src/app/api/review/[scheduleId]/respond/route.ts`
- `src/app/api/review/[scheduleId]/complete/route.ts`
- `scripts/test-m6-task5.mjs`
- `.agents/API_CONTRACT.md`

## 2026-04-06 | M6 MVP Launch: Large PDF chunking for KP extraction

**Completed**: Added chunked textbook extraction for large OCR texts by introducing a text chunker, a cross-chunk KP/module merger, and a multi-chunk extraction path in `kp-extraction-service.ts`. Large books now split around detected chapter/section headings when possible, fall back to overlapped size-based chunks when needed, log chunk-by-chunk progress, then merge deduplicated KPs and clusters before writing to the database. Added the Task 7 regression script for chunking and merge behavior.
**Modified files**:
- `src/lib/text-chunker.ts`
- `src/lib/kp-merger.ts`
- `src/lib/services/kp-extraction-service.ts`
- `scripts/test-m6-task7.mjs`

## 2026-04-06 | M6 MVP Launch: Chunker forward-progress hotfix

**Completed**: Fixed `splitBySize()` so the next window always advances even when long-line input makes overlap math stall, preventing the potential infinite loop flagged in the Task 7 follow-up dispatch. Added a regression case covering a single oversized 100K+ character line and verifying `chunkText()` terminates with multiple chunks.
**Modified files**:
- `src/lib/text-chunker.ts`
- `scripts/test-m6-task7.mjs`

## 2026-04-06 | M6 MVP Launch: Task 9 security and mojibake fixes

**Completed**: Added missing ownership/auth checks to the QA respond route, conversation follow-up route, and logs API; hardened the login redirect against external/open redirects; replaced the mojibake screenshot-ask prompt and fallback text with readable English strings; added `logs.user_id` plus scoped log writes for touched routes; and tightened `books.user_id` to `NOT NULL` in the PostgreSQL schema. Added a Task 9 regression script covering the required guard, schema, redirect, and string fixes.
**Modified files**:
- `src/app/api/qa/[questionId]/respond/route.ts`
- `src/app/api/conversations/[conversationId]/messages/route.ts`
- `src/app/api/logs/route.ts`
- `src/app/api/books/[bookId]/screenshot-ask/route.ts`
- `src/app/(auth)/login/page.tsx`
- `src/lib/log.ts`
- `src/lib/schema.sql`
- `scripts/test-m6-task9.mjs`

## 2026-04-06 | M6 MVP Launch: Task 10 deployment containerization

**Completed**: Added Docker deployment files for the Next.js app, PostgreSQL, and PaddleOCR service; switched Next.js production builds to standalone output; made both the OCR server and the app-side OCR client read host and port from environment variables with local-development defaults preserved; and added a Task 10 regression script covering the deployment contract.
**Modified files**:
- `Dockerfile`
- `Dockerfile.ocr`
- `docker-compose.yml`
- `.dockerignore`
- `next.config.ts`
- `scripts/ocr_server.py`
- `src/lib/screenshot-ocr.ts`
- `scripts/test-m6-task10.mjs`

## 2026-04-06 | Post-M6 hotfix: optional invite code on registration

**Completed**: Made registration accept email and password without an invite code while keeping invite code validation and usage-limit enforcement for non-empty codes. Updated the registration form to mark the invite code field as optional and added a regression script for the new behavior.
**Modified files**:
- `src/app/api/auth/register/route.ts`
- `src/app/(auth)/register/page.tsx`
- `scripts/test-m6-task11.mjs`

## 2026-04-06 | Post-M6 hotfix: raise book upload limit to 100MB

**Completed**: Raised the Next.js proxy request body limit for `/api/books` uploads from the default 10MB to 100MB by setting `experimental.proxyClientMaxBodySize` in the app config, preventing larger PDF uploads from failing before the route handler runs. Added a regression script that locks the 100MB config in place.
**Modified files**:
- `next.config.ts`
- `scripts/test-m6-task12.mjs`

## 2026-04-07 | Post-M6 hotfix: OCR service PDF pipeline migration

**Completed**: Replaced the broken local `spawn()` + SQLite PDF OCR path with a fire-and-forget HTTP call from `src/app/api/books/route.ts` to the OCR service, rewrote `scripts/ocr_server.py` to add background `/ocr-pdf` processing backed by PostgreSQL, aligned OCR defaults on port `8000`, updated Docker wiring so the OCR container can read uploaded PDFs and write DB progress, removed the obsolete `scripts/ocr_pdf.py`, and added regression coverage for the hotfix contract.
**Modified files**:
- `src/app/api/books/route.ts`
- `src/lib/screenshot-ocr.ts`
- `scripts/ocr_server.py`
- `Dockerfile.ocr`
- `docker-compose.yml`
- `scripts/test-m6-hotfix-ocr.mjs`
- `scripts/test-m6-task10.mjs`
- `.agents/API_CONTRACT.md`
- `docs/changelog.md`

**Deleted files**:
- `scripts/ocr_pdf.py`

## 2026-04-08 | UX redesign: add review briefing API and shared allocation utility

**Completed**: Extracted review question allocation logic into `src/lib/review-question-utils.ts`, added regression coverage for the shared allocation behavior, and implemented `GET /api/review/[scheduleId]/briefing` with existing review auth/route conventions. Verified the new endpoint and the non-AI `review/generate` resume path against a temporary PostgreSQL fixture, then cleaned the fixture data.
**Modified files**:
- `src/lib/review-question-utils.ts`
- `src/lib/review-question-utils.test.ts`
- `src/app/api/review/[scheduleId]/generate/route.ts`
- `src/app/api/review/[scheduleId]/briefing/route.ts`
- `docs/changelog.md`

---

## 2026-04-08 | UX Redesign T0: Amber Companion Design Foundation

**完成内容**: 建立了 "Amber Companion" 设计系统基础：
- **DESIGN.md**: 在项目根目录创建了符合 Stitch 标准的 9 段式设计规范文档，涵盖视觉主题、30+ 颜色 Token、字体层级、组件样式、布局原则及阴影系统。
- **Tailwind v4 Token 注入**: 重写了 `src/app/globals.css`，将所有设计 Token 注入 `@theme inline`，移除了旧的 slate/blue 变量，并添加了 `amber-glow` 渐变实用类。
- **Google Fonts & Icons**: 在 `src/app/layout.tsx` 中通过 `next/font/google` 引入了 `Plus Jakarta Sans` 和 `Be Vietnam Pro`，并通过 `<link>` 引入了 `Material Symbols Outlined`；同步更新了 `globals.css` 中的字体变量引用。
- **设计规范对齐**: 更新了 `.gemini/DESIGN_TOKENS.md` 以确保后续 AI 会话遵循新的暖橙色调规范。
- **验证**: 确认 `npm run dev` 启动正常，页面背景切换为奶油色 (#fefae8)，文字切换为深棕色 (#39382d)。

**修改文件**:
- 新增: `DESIGN.md`
- 修改: `src/app/globals.css`, `src/app/layout.tsx`, `.gemini/DESIGN_TOKENS.md`, `docs/changelog.md`

---

## 2026-04-08 | UX Redesign T1: 侧边栏简化与 Exam Mode 适配

**完成内容**: 将侧边栏导航重构为单层全局导航，并支持测试页面的全屏模式。
- **Sidebar 重构**: `Sidebar.tsx` 从 343 行简化为约 80 行。移除了所有书籍级（L2）和模块级（L3）导航，仅保留"首页中心"、"上传教材"、"系统日志"和"退出登录"四个核心入口。
- **Amber Token 适配**: 侧边栏全面采用 Amber Companion Token（`bg-surface-container-low`, `text-on-surface`, `bg-primary/10` 等），图标切换为 `Material Symbols Outlined`。
- **状态管理简化**: `SidebarProvider.tsx` 移除了 `isCollapsed` 桌面折叠状态及相关的 `localStorage` 持久化逻辑。
- **组件简化**: `SidebarToggle.tsx` 移除了桌面端的折叠按钮，仅保留移动端的汉堡菜单按钮。
- **Exam Mode 绕过**: `SidebarLayout.tsx` 新增逻辑，当路径包含 `/test` 时自动隐藏侧边栏，提供全屏沉浸式测试体验。同时将主内容区域背景色统一为 `bg-surface-container-low`。

**修改文件**:
- 修改: `src/components/sidebar/Sidebar.tsx`, `src/components/sidebar/SidebarProvider.tsx`, `src/components/sidebar/SidebarToggle.tsx`, `src/components/sidebar/SidebarLayout.tsx`, `docs/changelog.md`

---

## 2026-04-08 | UX Redesign T2: Action Hub 整合

**完成内容**: 将原有的模块地图（Module Map）和学习仪表盘（Dashboard）合并为全新的 "Action Hub" 教材落地页。
- **ActionHub.tsx**: 
  - 新增核心组件，聚合展示教材学习状态、复习计划、最近测试和错题统计。
  - 实现了带有动态 SVG 进度环的 Hero 区域，自动定位下一个待学习模块。
  - 采用卡片式布局展示课程大纲，支持语义化状态勋章（已完成、进行中、未开始）。
  - 集成了可折叠的"最近考试"记录面板。
- **页面重定向与清理**: 
  - 将 `/books/[bookId]/module-map` 和 `/books/[bookId]/dashboard` 重定向至 `/books/[bookId]`。
  - 删除了已废弃的 `ModuleMap.tsx` 组件。
- **视觉统一**: 
  - 升级 `ProcessingPoller.tsx` 采用 Amber Companion 设计 Token 和圆角规范。
  - 修复 `PdfViewer.tsx` 中的导航链接，使其跳转至新的 Action Hub。
- **数据流**: 全量接入 `GET /api/books/[bookId]/dashboard` 接口，实现单次请求驱动全页渲染。

**修改文件**:
- 新增: `src/app/books/[bookId]/ActionHub.tsx`
- 修改: `src/app/books/[bookId]/page.tsx`, `src/app/books/[bookId]/module-map/page.tsx`, `src/app/books/[bookId]/dashboard/page.tsx`, `src/app/books/[bookId]/ProcessingPoller.tsx`, `src/app/books/[bookId]/reader/PdfViewer.tsx`, `docs/changelog.md`
- 删除: `src/app/books/[bookId]/ModuleMap.tsx`

---

## 2026-04-08 | UX Redesign T3: 核心布局组件 SplitPanelLayout & FeedbackPanel

**完成内容**: 创建了两个核心共享组件，作为后续学习页面（Q&A、学习、复习）的基础构建块。
- **SplitPanelLayout.tsx**: 
  - 实现了左侧知识点导航栏（240px，支持桌面折叠和移动端抽屉模式）。
  - 知识点列表支持状态圆点（已完成、当前、待开始）及其对应的视觉特效。
  - 顶部集成面包屑导航条，支持多级跳转和当前位置展示。
  - 主内容区域提供 `feedbackSlot`（底部滑出反馈）和 `footerSlot`（吸底操作栏）插槽。
- **FeedbackPanel.tsx**: 
  - 实现了标准化的答题反馈面板，支持根据对错自动切换颜色（翡翠绿/错误红）和图标。
  - 集成 `AIResponse` 渲染 Markdown 格式的 AI 评价。
  - 采用 `amber-glow` 渐变按钮作为主操作项，并提供平滑的向上滑入动画。
- **Amber Token 适配**: 全部组件严格遵循 Amber Companion 设计规范，无 hardcoded 颜色。
- **类型安全**: 通过 `npx tsc --noEmit` 验证，无 TypeScript 错误。

**修改文件**:
- 新增: `src/components/SplitPanelLayout.tsx`, `src/components/FeedbackPanel.tsx`
- 修改: `docs/changelog.md`

---

## 2026-04-08 | UX Redesign T4: Q&A 模式重构与 Split Panel 集成

**完成内容**: 使用 `SplitPanelLayout` 和 `FeedbackPanel` 重构了 Q&A 练习模式。
- **QASession.tsx 重写**:
  - 集成了 `SplitPanelLayout` 作为基础布局，展示知识点侧边栏和多级面包屑。
  - 引入 `FeedbackPanel` 处理答题后的实时评分与 AI 反馈，支持平滑的滑出动画。
  - 新增分段式进度条（Segmented Progress Bar），实时展示答题进度与当前位置。
  - 针对 `scaffolded_mc` 类型实现了卡片式选项选择 UI，提升触控与点击体验。
  - 适配 Amber Companion 设计系统，全面使用设计 Token（如 `amber-glow`, `primary-fixed-dim` 等）。
- **流程与不变量**:
  - 严格遵守"已答题目不可修改"原则，提交后锁定输入。
  - 保留原有的一题一答、即时反馈逻辑。
  - 完整保留并优化了自动出题（Generate Questions）与进度恢复（Resume Progress）的数据交互逻辑。
- **关联更新**:
  - 更新 `ModuleLearning.tsx` 和相关 `page.tsx`，确保正确传递 `bookId` 和 `bookTitle` 等上下文信息。
  - 统一了模块学习页面的视觉风格，移除了旧有的 blue/gray 色调。

**修改文件**:
- 修改: `src/app/books/[bookId]/modules/[moduleId]/qa/page.tsx`, `src/app/books/[bookId]/modules/[moduleId]/qa/QASession.tsx`, `src/app/books/[bookId]/modules/[moduleId]/page.tsx`, `src/app/books/[bookId]/modules/[moduleId]/ModuleLearning.tsx`, `docs/changelog.md`

---

## 2026-04-08 | UX Redesign T5: 模块学习页 Split Panel 封装与链接修复

**完成内容**: 将模块学习主流程（阅读、指引、笔记）封装进 `SplitPanelLayout`，并修复了导航链接。
- **ModuleLearning.tsx 封装**:
  - 引入 `SplitPanelLayout` 作为学习页面的外层壳，统一了面包屑导航（[书名] > [模块名] 学习）。
  - 实现了基于 `learning_status` 的知识点状态推导：阅读阶段显示为"待开始"，Q&A 阶段显示为"进行中"，笔记及以后阶段显示为"已完成"。
  - 优化了加载与错误状态的视觉呈现，使其符合 Amber Companion 设计规范。
- **NotesDisplay.tsx 修复**:
  - 修正了"完成学习"后的跳转逻辑，从已废弃的 `/module-map` 改为跳转至新的 `/books/[bookId]` Action Hub。
- **视觉一致性**: 
  - 移除了所有残留的 `blue-` 和 `gray-` Tailwind 类，全面切换为 Amber Token。
  - 使用 `Material Symbols Outlined` 统一了所有图标。

**修改文件**:
- 修改: `src/app/books/[bookId]/modules/[moduleId]/ModuleLearning.tsx`, `src/app/books/[bookId]/modules/[moduleId]/NotesDisplay.tsx`, `docs/changelog.md`

---

## 2026-04-08 | Fix: 解决 ModuleLearning 嵌套布局与过渡态闪烁

**完成内容**: 修复了 T5 引入的两个关键布局问题。
- **防止嵌套布局**: 当模块处于 Q&A 阶段时，`ModuleLearning.tsx` 现在会直接返回 `QASession` 及其自带的 `SplitPanelLayout`，避免了双重侧边栏和双重面包屑的出现。
- **过渡态布局保持**: 将 `isTransitioning` 的加载状态移至 `SplitPanelLayout` 内部渲染，确保在 AI 出题等异步过程中，侧边栏和整体框架依然可见，解决了过渡时的界面闪烁问题。

**修改文件**:
- 修改: `src/app/books/[bookId]/modules/[moduleId]/ModuleLearning.tsx`, `docs/changelog.md`

---

## 2026-04-09 | UX Redesign T6: 全新测试模式（沉浸式全屏 + 自由跳转）

**完成内容**: 重构了模块测试体验，从传统的顺序答题改为支持自由跳转和标记复查的专业考试模式。
- **ExamShell.tsx 封装**: 实现了全屏沉浸式测试外壳，包含固定的顶部状态栏（模块名、测试进度条、题目计数器、退出按钮）。
- **QuestionNavigator.tsx**: 实现了底部的题目导航器，支持通过点击题号快速跳转，并能实时展示答题状态（已答、当前、已标记）。
- **TestSession.tsx 重写**:
  - **交互模型升级**: 改为一题一页模式，支持通过导航器或左右箭头自由切换题目。
  - **标记复查**: 新增题目标记功能（Flag），方便学生针对不确定的题目进行后续检查。
  - **进度持久化**: 接入 `localStorage` 自动保存答题进度和标记状态，防止页面刷新导致数据丢失。
  - **检查汇总页**: 在提交前提供汇总检查视图，直观展示未答题目和已标记题目，支持点击一键回跳。
- **视觉与规范**: 
  - 全面适配 Amber Companion 设计系统（奶油色背景、暖橙色主色调）。
  - **严守不变量 #3**: 彻底移除了测试界面的所有提示（Hint）、笔记入口及 Q&A 访问路径，确保盲测严肃性。
- **简化页面逻辑**: 更新 `test/page.tsx`，将布局管理权移交给 `ExamShell`。

**修改文件**:
- 新增: `src/components/QuestionNavigator.tsx`, `src/app/books/[bookId]/modules/[moduleId]/test/ExamShell.tsx`
- 修改: `src/app/books/[bookId]/modules/[moduleId]/test/TestSession.tsx`, `src/app/books/[bookId]/modules/[moduleId]/test/page.tsx`, `docs/changelog.md`

---

## 2026-04-09 | UX Redesign T8: 复习概览页与 Review Session 布局升级

**完成内容**: 为复习流程新增了引导概览页，并将复习过程封装进 `SplitPanelLayout`。
- **ReviewBriefing.tsx**:
  - 新增复习前置概览页，展示当前复习轮次、时间间隔、预计题量及时间。
  - 实现了基于知识集群的掌握分布图表（Mastered/Improving/Weak），帮助学生了解复习重点。
  - 采用 Amber Companion 风格的 Hero 图标与卡片设计。
- **ReviewSession.tsx 重构**:
  - 接入 `SplitPanelLayout` 和 `FeedbackPanel`，视觉风格与 Q&A 模式对齐。
  - 移除了冗余的 Intro 阶段（由 Briefing 页接管），实现无缝开启复习。
  - 升级了完成页视觉，直观展示正确率、集群掌握情况及下一轮复习计划。
- **路由与状态管理**:
  - 重构 `review/page.tsx` 为 Server Wrapper，预取书名与模块名以支持面包屑。
  - 引入 `ReviewPageClient.tsx` 管理 `briefing` -> `session` 的阶段转换。
- **视觉一致性**:
  - 全面使用 Amber Token（`amber-glow`, `bg-surface-container` 等），修正了所有指向 `/` 或 `/module-map` 的废弃链接。

**修改文件**:
- 新增: `src/app/books/[bookId]/modules/[moduleId]/review/ReviewBriefing.tsx`, `src/app/books/[bookId]/modules/[moduleId]/review/ReviewPageClient.tsx`
- 修改: `src/app/books/[bookId]/modules/[moduleId]/review/page.tsx`, `src/app/books/[bookId]/modules/[moduleId]/review/ReviewSession.tsx`, `docs/changelog.md`

---

## 2026-04-09 | UX Redesign T11: 全新首页（Amber Hero 风格 + 进度聚合）

**完成内容**: 重构了系统首页，提供基于书籍数量的动态布局，并集成了复习任务追踪。
- **页面重构 (src/app/page.tsx)**:
  - **Hero 模式**: 当用户仅有一本书时，展示巨幕 Hero 卡片，左侧显示书籍详情，右侧辅以动态圆环进度条（SVG Circle），直观展示总学习进度。
  - **Grid 模式**: 当用户有多本书时，展示响应式卡片网格，每张卡片均包含线性进度条和模块完成统计。
  - **空状态**: 针对新用户设计了引导式的空状态卡片，通过大图标和明确的 "上传教材" CTA 引导开始学习。
  - **数据增强**: 扩展了首页查询 SQL，实现了一次性聚合计算每本书的模块总数与已完成数。
- **复习提醒升级 (src/app/ReviewButton.tsx)**:
  - 将 `ReviewButton` 重构为 `ReviewDueBadge` 风格的折叠横幅。
  - 接入 Amber Token 和 Material Symbols，使用双栏网格展示待复习任务，支持快速跳转。
- **视觉一致性**: 
  - 全面移除 legacy 类名，适配 `bg-surface-container-low` 页面背景。
  - 修正了所有指向旧版 `/dashboard` 的链接，统一收口至 `/books/[bookId]` Action Hub。

**修改文件**:
- 修改: `src/app/page.tsx`, `src/app/ReviewButton.tsx`, `docs/changelog.md`

---

## 2026-04-09 | UX Redesign 里程碑完成 — Amber Companion 设计系统全覆盖

**UX Redesign 完成**：13 个任务（T0-T12），11 个 Gemini 前端任务 + 1 个 Codex 后端任务 + 1 个 Claude 文档任务。

核心变更：
- **T0 设计基础**（52163ad）：Tailwind v4 @theme inline tokens（Amber Companion 色板），Plus Jakarta Sans + Be Vietnam Pro 字体（next/font/google），Material Symbols Outlined 图标，amber-glow 渐变类
- **T1 侧栏简化**（ecbbb51）：三层导航→两层，Amber 视觉，/login /register /test 路由跳过侧栏
- **T2 Action Hub**（a7e40b0）：合并 module-map + dashboard 为 `/books/[bookId]`，进度概览 + 模块列表 + 复习入口
- **T3 共享组件**（5af7ef2, 97ce35b）：SplitPanelLayout（KP 侧栏 240px + 面包屑 + feedbackSlot + footerSlot）+ FeedbackPanel（滑入式答题反馈）
- **T4 QA 重写**（0e0f206）：QASession 迁移到 SplitPanelLayout + FeedbackPanel
- **T5 模块学习**（b205f06, 4902ea3）：ModuleLearning 迁移到 SplitPanelLayout shell
- **T6 考试模式**（c7bc043）：ExamShell 全屏容器 + QuestionNavigator 自由导航 + 标记题目 + localStorage 持久化 + 检查页 + 批量提交
- **T7 复习 Briefing API**（509e762）：`GET /api/review/[scheduleId]/briefing` → 轮次/间隔/掌握分布/集群列表
- **T8 复习前端**（993297b, 2f0dac2）：ReviewBriefing 画面 + ReviewSession 迁移到 SplitPanelLayout + FeedbackPanel
- **T9 错题本**（f673832）：两个错题页 Amber token 替换 + LoadingState Amber 风格
- **T10 认证页**（c6daf84）：登录/注册页 Amber 重写 + 全中文 UI + 邀请码 URL 自动填充
- **T11 首页**（32bb9c2, 6407aa1）：单书 Hero（SVG 进度环）/ 多书网格 / 空状态 + 复习提醒横幅

CCB 协作统计：Gemini 11 任务（4 次 retry），Codex 1 任务，Claude 1 任务。Advisory 累计 22 条。
---

## 2026-04-12 | Scanned PDF T1: schema + OCR foundation
Completed: Added scanned PDF page classification/count columns to `books`, module-level processing status columns to `modules`, and a backward-compatible migration block for existing rows. Updated the OCR image dependency list with `pymupdf4llm` and exposed OCR provider / Google OCR environment variables in compose.
Files: `src/lib/schema.sql`, `Dockerfile.ocr`, `docker-compose.yml`

---

## 2026-04-12 | Scanned PDF T2: page classification endpoint
Completed: Added `classify_page(page)` to detect `text` / `scanned` / `mixed` pages by character count and image coverage, and added `POST /classify-pdf` to classify all PDF pages and persist results into `books.page_classifications`, `books.text_pages_count`, and `books.scanned_pages_count`. Added a Python regression script covering the helper and endpoint behavior.
Files: `scripts/ocr_server.py`, `scripts/test-scanned-pdf-task2.py`

---

## 2026-04-12 | Scanned PDF T3: structured text extraction endpoint
Completed: Added optional `pymupdf4llm` import with `HAS_PYMUPDF4LLM` fallback and implemented `POST /extract-text` in the OCR server. The endpoint reads `books.page_classifications`, extracts only text pages with `--- PAGE N ---` markers, leaves `[OCR_PENDING]` placeholders for non-text pages, and writes the assembled content into `books.raw_text`. Added regression coverage for the Markdown path, fallback path, and missing-classification error.
Files: `scripts/ocr_server.py`, `scripts/test-scanned-pdf-task3.py`

---

## 2026-04-12 | Scanned PDF T4: scanned-only OCR processing
Completed: Added OCR provider abstraction with `OCR_PROVIDER`, `ocr_page_image()`, `paddle_ocr()`, and a Google Document AI stub that falls back to PaddleOCR. Added helpers to replace page placeholders and mark module OCR completion. Rewrote `process_pdf_ocr()` to use page classifications for scanned-only processing while keeping the legacy full-OCR fallback path for books without classifications. Added regression coverage for provider routing, helper behavior, and both new and legacy OCR processing flows.
Files: `scripts/ocr_server.py`, `scripts/test-scanned-pdf-task4.py`

---

## 2026-04-12 | Scanned PDF T5: page-aware text chunking
Completed: Updated `text-chunker.ts` to treat `--- PAGE N ---` lines as metadata instead of headings, added Markdown heading detection for `#`/`##`/`###`, stripped page markers from chunk text, and tracked `pageStart` / `pageEnd` on every chunk while preserving original `startLine` / `endLine`. Added regression coverage for short-text page metadata, Markdown heading chunking, and the no-page-marker-boundary behavior.
Files: `src/lib/text-chunker.ts`, `scripts/test-scanned-pdf-task5.mjs`

---

## 2026-04-12 | Scanned PDF T6: per-module KP extraction writes
Completed: Added `extractModule(bookId, moduleId, moduleText, moduleName)` to reuse the existing 3-stage extraction pipeline for a single module while tracking `modules.kp_extraction_status` through processing, completed, skipped, and failed paths. Added `writeModuleResults(moduleId, stage2)` to replace only the target module's clusters and knowledge points inside a transaction, collapse merged chunk results onto the single module row, and refresh `kp_count` / `cluster_count`. Added regression coverage for the new export, empty-module short circuit, failure handling, and module-scoped transactional writes.
Files: `src/lib/services/kp-extraction-service.ts`, `scripts/test-scanned-pdf-task6.mjs`

---

## 2026-04-12 | Scanned PDF T7: 4-step upload flow and module-level extraction APIs
Completed: Rewired `POST /api/books` for PDFs to run classify, extract-text, module creation, background OCR, and background module extraction orchestration. Added `syncBookKpStatus`, `getModuleText`, and `triggerReadyModulesExtraction` to keep book-level KP state aligned with per-module extraction. Replaced `POST /api/books/[bookId]/extract` with module-aware fire-and-forget behavior and added `GET /api/books/[bookId]/module-status` for OCR/KP progress polling. Updated the API contract and added regression coverage for the new service helpers and route shapes.
Files: `src/lib/services/kp-extraction-service.ts`, `src/app/api/books/route.ts`, `src/app/api/books/[bookId]/extract/route.ts`, `src/app/api/books/[bookId]/module-status/route.ts`, `.agents/API_CONTRACT.md`, `scripts/test-scanned-pdf-task6.mjs`, `scripts/test-scanned-pdf-task7.mjs`

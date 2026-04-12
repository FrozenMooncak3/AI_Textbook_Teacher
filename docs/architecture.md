# 系统架构

> 两层信息：系统总图（有什么）+ 接口契约（怎么接在一起）。
> 里程碑结束时必须更新，session 开始时必须读取。

---

## 系统总图

### 页面

```
/ (首页 Multi-Column Dashboard：AppSidebar + 固定顶栏(搜索+头像) + 双栏(CourseCard 网格+本周概览 / ReviewButton+统计+最近动态 timeline) + FAB)
├── /upload (上传 PDF：AppSidebar + ContentCard 拖拽区 + AmberButton)
├── /logs (系统日志)
└── /books/[bookId]
    ├── / (Action Hub：AppSidebar + HeroCard + ContentCard 模块列表 + StatusBadge + ProgressBar)
    ├── /reader (PDF 阅读器 + 截图问 AI：OCR→提问→回答两步流程)
    ├── /module-map → 重定向到 /books/[bookId]（已废弃）
    ├── /dashboard → 重定向到 /books/[bookId]（已废弃）
    ├── /mistakes (书级错题诊断本：AppSidebar + FilterBar + MistakeCard + ToggleSwitch + ResolvedCard)
    └── /modules/[moduleId]
        ├── / (模块学习：AppSidebar + Breadcrumb + ContentCard + StatusBadge + ProgressBar)
        ├── /qa (QA session：SplitPanel + KnowledgePointList + GlassHeader + MCOptionCard + FeedbackPanel)
        ├── /test (测试 session：ExamTopBar + MCOptionCard + QuestionNavigator + FlagButton)
        ├── /review?scheduleId=X (复习：ReviewBriefing(BriefingCard+MasteryBars) → ReviewSession(SplitPanel+FeedbackPanel))
        ├── /notes (学习笔记：ContentCard + Badge + AmberButton)
        └── /mistakes (错题页：Amber 风格)

App Shell:
├── src/app/layout.tsx → 纯 HTML shell（字体 + globals.css），无全局侧栏包裹
├── src/components/LoadingState.tsx → 共享加载组件（Amber 风格 spinner + progress）
├── src/app/error.tsx → 根级错误边界
├── src/app/books/[bookId]/error.tsx → 书级错误边界
├── src/app/books/[bookId]/modules/[moduleId]/error.tsx → 模块级错误边界
├── src/app/books/[bookId]/layout.tsx → 书级 layout（薄包装）
└── src/app/not-found.tsx → 全局 404 页面
└── /(auth) (route group + layout.tsx，FormCard 居中卡片)
    ├── /login (登录页：中文 UI + auto_stories 图标)
    └── /register (邀请码注册页：?code= URL 自动填充)

Design System（Amber Companion）:
├── src/app/globals.css → @theme inline Tailwind v4 tokens（色板 + 10 个 shadow tokens）
├── src/lib/utils.ts → cn() = twMerge(clsx(...))，所有组件使用
├── 字体：Plus Jakarta Sans（headline）+ Be Vietnam Pro（body）通过 next/font/google
├── 图标：Material Symbols Outlined（全局 <link>）
└── 主色：primary=#a74800，surface-container-low=#fefae8（cream）
```

### API 组

```
auth/               — register, login, logout, me
books/              — list/create
books/[bookId]/     — extract(+?moduleId=N), module-status, status, pdf, module-map(+confirm/regenerate), screenshot-ocr, screenshot-ask, notes, highlights, toc, dashboard, mistakes
modules/            — list
modules/[moduleId]/ — status, guide, generate-questions, qa-feedback, questions, reading-notes,
                      generate-notes, evaluate, test/generate, test/submit, test/, mistakes
review/due          — GET 待复习列表
review/[scheduleId]/ — generate, respond, complete, briefing
qa/[questionId]/    — respond (ownership guard: question→module→book→user)
conversations/      — messages (ownership guard: conversation→book→user)
logs/               — 系统日志（按 user_id 过滤）
```

### DB 表（24 张）

| 分类 | 表 |
|------|----|
| 认证数据 | users, invite_codes, sessions |
| 用户数据 | books, modules, conversations, messages, highlights, reading_notes, module_notes |
| 学习数据 | knowledge_points, clusters, qa_questions, qa_responses |
| 测试数据 | test_papers, test_questions, test_responses, mistakes |
| 复习数据 | review_schedule, review_records, review_questions, review_responses |
| 系统数据 | prompt_templates, logs |

### AI 角色（5 个）

| 角色 | 职责 |
|------|------|
| 提取器 (extractor) | KP 提取 + 模块地图 |
| 教练 (coach) | 读前指引 + QA 出题 + 反馈 + 笔记生成 |
| 考官 (examiner) | 测试出题 + 评分 + 错题诊断 |
| 复习官 (reviewer) | 复习出题 + 评分 + P 值更新 |
| 助手 (assistant) | 截图问 AI |

### 学习状态流

```
unstarted → reading → qa → notes_generated → testing → completed
```

---

## 接口契约

### 提取 → 学习

- KP 提取完成后写入 knowledge_points，同时创建 clusters 并关联 kp.cluster_id
- modules.kp_count 和 cluster_count 在提取时设置
- 教练出题依赖 knowledge_points.type 做题型映射：
  calculation → worked_example，其他 → scaffolded_mc/short_answer/comparison

### 学习 → 测试

- QA 全部完成 → 生成笔记 → learning_status='notes_generated' → 可进入测试
- 考官出题读 knowledge_points（同一张表、同一个 kp_id 体系）
- 考官读取 mistakes 表 is_resolved=0 的记录，优先覆盖对应 KP

### 测试 → 复习

- 测试通过（≥80%）时：设 learning_status='completed' + 创建 review_schedule（round=1, due=today+3天）+ 简单初始化 P 值（全对→P=2，有错→P=3）
- P 值方向：低=好（1=已掌握，4=最弱），范围 1-4
- 复习调度在 review_schedule 表（module 级），clusters 表不存储调度日期

### 复习系统（M4）

- **调度**：5 轮间隔 3/7/15/30/60 天，review_schedule 按 module 管理
- **出题**：generate 端点按 cluster P 值分配题量（P=题数，上限 10，等比缩减但每聚类至少 1 题），支持幂等重试（已有题直接返回下一道未答题）
- **答题**：respond 端点调用 reviewer AI 评分（review_scoring prompt），写 review_responses；答错写 mistakes（source='review'）
- **完成**：complete 端点汇总 cluster 结果，更新 P 值：
  - 全对 → P = max(1, P-1)，consecutive_correct += 1
  - 连续错（上轮也错）→ P = min(4, P+1)，consecutive_correct = 0
  - 首次错 → P 不变，consecutive_correct = 0
- **P=1 跳级**：所有 cluster P=1 且 consecutive_correct ≥ 3 → 跳过一个间隔级别
- **复习记录**：review_records 存每次每 cluster 的 p_value_before/after
- **Briefing API**：`GET /api/review/[scheduleId]/briefing` → `{ data: { scheduleId, moduleId, moduleName, reviewRound, intervalDays, estimatedQuestions, lastReviewDaysAgo, masteryDistribution: { mastered, improving, weak }, clusters: [...] } }`
- **前端（组件库更新）**：ReviewBriefing（SplitPanel + BriefingCard + MasteryBars）→ ReviewSession（SplitPanel + KnowledgePointList(activeColor='orange') + FeedbackPanel(variant='review')），首页 ReviewButton 显示待复习列表

### 错题流转

- mistakes 表 source 字段支持 'test'|'qa'|'review' 三个来源
- test/submit 写入（source='test'），review/respond 写入（source='review'），qa 来源未实现
- mistakes.kp_id 关联 knowledge_points，用于出题时优先覆盖
- mistakes.error_type 只允许 4 个值：blind_spot / procedural / confusion / careless
  - review/respond 和 test/submit 均使用 `normalizeReviewErrorType()` 做模糊归一化
  - normalizeReviewErrorType 位于 `src/lib/review-question-utils.ts`，null/unknown 默认返回 'confusion'

### prompt 模板

- seed-templates.ts 种子化：extractor×3, coach×4, examiner×2, reviewer×2, assistant×1
- extractor 模板是乱码 UTF-8，但功能正常（创建时就是这样写的）
- examiner 模板已用正常中文重写（M3）
- reviewer 模板：review_generation（出题）+ review_scoring（评分），均为正常中文（M4）
- assistant/screenshot_qa 模板已修复为干净中文，变量：{screenshot_text}, {user_question}, {conversation_history}（M5）
- ⚠️ screenshot-ask 路由的系统 prompt 和 fallback 已改为英文（M6，Codex 编码问题导致中文乱码）

### 截图问 AI（M5 改造）

- **两步流程**：Step 1 调 screenshot-ocr 获取文字 → Step 2 用户输入问题 → screenshot-ask 拼图+文字+问题发给 AI
- screenshot-ocr：`POST /api/books/[bookId]/screenshot-ocr` → `{ data: { text, confidence } }`
- screenshot-ask：`POST /api/books/[bookId]/screenshot-ask`，接收 `{ image, text, question }`，系统 prompt 硬编码在 route.ts，用户 prompt 通过 `getPrompt('assistant', 'screenshot_qa', ...)` 生成
- AI 调用使用 multipart message（image + text）支持视觉输入
- 响应：`{ data: { conversationId, answer } }`

### 仪表盘与书级错题（M5）

- **Dashboard API**：`GET /api/books/[bookId]/dashboard` → 聚合 book/modules/reviewsDue/recentTests/mistakesSummary
- **Mistakes API**：`GET /api/books/[bookId]/mistakes?module=&errorType=&source=` → 带筛选的错题列表 + 汇总
- mistakes 表新增 3 列（M5）：question_text, user_answer, correct_answer（均可空 TEXT）
- test/submit 和 review/respond 写 mistakes 时同时填充这 3 列

### AI 文本渲染（M5）

- 所有 AI 生成文本统一使用 `<AIResponse>` 组件渲染（react-markdown + remark-gfm + Tailwind Typography）
- 覆盖范围：QA 反馈、测试评分、复习反馈、截图问答、读前指引、学习笔记、模块摘要、错题诊断
- MarkdownRenderer 已删除，不再使用

### 组件库（Component Library，UX Redesign → 组件库里程碑）

所有 UI 组件位于 `src/components/ui/`，遵循统一规范：
- 每个组件必须有 `data-slot` 属性、`className?: string` prop、使用 `cn()` 合并样式
- 使用 shadow tokens（`shadow-card`、`shadow-cta` 等），禁止 `shadow-[...]` arbitrary values
- 直接 import（如 `from '@/components/ui/AmberButton'`），无 barrel exports

**L1 原子组件（16 个）**：
AmberButton（主操作按钮）、TextInput（表单输入）、Badge（标签/变体：primary/correct/incorrect/neutral）、StatusBadge（状态徽章：6 种状态）、ProgressBar（进度条）、UserAvatar（用户头像+姓名首字母）、DecorativeBlur（装饰模糊圆）、FAB（浮动操作按钮）、ContentCard（通用卡片容器）、FormCard（表单卡片：登录/注册）、Breadcrumb（面包屑导航）、GlassHeader（毛玻璃顶栏）、SegmentedProgress（分段进度条：correct/incorrect/current/unanswered）、StatCard（统计卡片：icon+value+label）、ProgressRing（SVG 进度环）、ChatBubble（对话气泡：ai/user 角色）

**L1 组合组件（5 个）**：
KnowledgePointList（知识点列表：done/active/pending 状态，activeColor 可配）、FeedbackPanel（答题反馈面板：variant qa/review/test，滑入动画）、SplitPanel（分栏布局：sidebar+content+feedbackSlot）、AppSidebar（全站侧栏：两层路由感知导航，ml-72 页面偏移）、CourseCard（课程卡片：渐变封面+学科图标装饰+进度条+hover 动效，shadow/pedestal 两种悬停模式）

**L2 考试专用（4 个）**：
ExamTopBar（考试顶栏：模块名+进度+退出）、MCOptionCard + MCOptionGroup（选择题选项：Radix Radio Group）、QuestionNavigator（底部题号导航：answered/current/flagged/unanswered）、FlagButton（标记按钮）

**L2 其他（8 个）**：
ToggleSwitch（开关：Radix Switch）、AIInsightBox（AI 洞察卡片）、FilterBar（多组筛选栏）、MistakeCard（错题卡片：展开/折叠）、ResolvedCard（已解决错题卡片）、MasteryBars（掌握度柱状图）、BriefingCard（复习简报卡片）、HeroCard（英雄卡片：大标题+装饰）

**已删除的旧组件**（被组件库替代）：
- `src/components/sidebar/*`（4 个文件）→ AppSidebar
- `src/components/SplitPanelLayout.tsx` → SplitPanel
- `src/components/FeedbackPanel.tsx` → ui/FeedbackPanel
- `src/components/QuestionNavigator.tsx` → ui/QuestionNavigator
- `src/app/.../test/ExamShell.tsx` → ExamTopBar

### App Shell 与导航

- **侧栏**：AppSidebar 组件（`src/components/ui/AppSidebar.tsx`），各页面独立引入，非全局包裹。两层路由感知导航（L1 全局 → L2 书级），Amber Companion 视觉
- **学习布局**：SplitPanel 组件（sidebar + content + feedbackSlot），用于 QA、复习 session
- **考试布局**：ExamTopBar 全屏模式（跳过侧栏），QuestionNavigator 底部自由导航
- **错误边界**：三级 error.tsx（根/书/模块）+ not-found.tsx
- **LoadingState**：共享加载组件（Amber 风格），stage 模式 + progress 模式
- **Design System**：Amber Companion — Tailwind v4 @theme inline tokens + 10 shadow tokens + cn() 工具函数

### 上传自动化流程（M5.5）

- **ProcessingPoller 三阶段**：OCR 进度条（真实页码）→ 自动触发 KP 提取 → router.refresh 显示模块地图
- **关键修复**：API 响应需 `json.data` 解包（handleRoute wrapper），kp_extraction_status 值为 `completed`/`failed`
- 处理 409 ALREADY_COMPLETED / ALREADY_PROCESSING 边界情况
- 上传后零手动点击：PDF → OCR → KP 提取 → 模块地图全自动

### 数据库（M6）

- **PostgreSQL**（pg 驱动），从 SQLite（better-sqlite3）迁移
- 异步查询帮手：`query<T>`, `queryOne<T>`, `run`, `insert`（自动 RETURNING id）
- 连接池：`Pool({ connectionString: process.env.DATABASE_URL })`
- Schema：`src/lib/schema.sql`（24 表），`initDb()` 启动时自动建表 + 种子模板

### 认证系统（M6）

- **注册**：邀请码 + 邮箱 + 密码，bcryptjs 12 轮哈希，invite_codes FOR UPDATE 防并发
- **登录**：验证密码 → crypto.randomBytes(32) 会话令牌 → HttpOnly cookie（30 天）
- **中间件**：`src/middleware.ts` edge runtime，公开路径 /login, /register, /api/auth/*，其余需 cookie
- **所有权链**：requireUser → requireBookOwner → requireModuleOwner → requireReviewScheduleOwner（JOIN 链验证）
- **数据隔离**：books.user_id NOT NULL，所有 API 按 user_id 过滤

### 大 PDF 分块（M6 + Scanned PDF 升级）

- **text-chunker.ts**：标题检测（Markdown `# / ## / ###`、Chapter N, 第N章, 编号节, 全大写）→ 按标题边界分组 → 每 chunk 带 `pageStart/pageEnd`（基于 `--- PAGE N ---` 标记）→ 超大段按 35K 字符切割（20 行 overlap）
- **kp-merger.ts**：多 chunk KP 提取后合并，Dice 系数 bigram 相似度去重（阈值 0.8），kp_code 重编号
- **kp-extraction-service.ts**：
  - 老接口 `extractKPs(bookId)` — 整书提取 + merge
  - 新接口 `extractModule(bookId, moduleId, moduleText, moduleName)` — 模块级 UPSERT + module-scoped DELETE + `syncBookKpStatus` 汇总
  - 新接口 `triggerReadyModulesExtraction(bookId)` — 扫所有 `text_status='ready' AND ocr_status IN ('done','skipped')` 的模块逐个 fire-and-forget
  - 新辅助 `getModuleText(bookId, pageStart, pageEnd)` — 基于 `--- PAGE N ---` 标记切片 raw_text

### PDF 阅读器（M6）

- **react-pdf-viewer**：`@react-pdf-viewer/core` + `@react-pdf-viewer/default-layout`
- 内置功能：缩放、搜索、书签、缩略图、页码导航
- pdfjs-dist@3.11.174 Worker（CDN）
- ScreenshotOverlay + AiChatDialog 保持不变

### PDF OCR 管道（Scanned PDF 升级 2026-04-12）

**4 步上传流程**（替代原单步 `/ocr-pdf`）：
1. **classify**：`POST /classify-pdf { pdf_path, book_id }` → 逐页分类（text/scanned/mixed），写入 `books.page_classifications`
2. **extract-text**：`POST /extract-text { pdf_path, book_id }` → 基于 pymupdf4llm 提取所有 text/mixed 页的 Markdown 文本，scanned 页用 `[OCR_PENDING]` 占位，页间用 `--- PAGE N ---` 标记分隔，写入 `books.raw_text`
3. **建模块**：`books/route.ts` 对 rawText 调用 `chunkText()` → 每个 chunk 带 `pageStart/pageEnd` → 插入 modules 表（`text_status='ready'`, `ocr_status=nonTextPages>0?'pending':'skipped'`, `kp_extraction_status='pending'`）
4. **fire-and-forget OCR**：只对非纯文字 PDF 调用 `/ocr-pdf`，后台处理 scanned/mixed 页；同时调用 `triggerReadyModulesExtraction(bookId)` 并行触发已就绪模块的 KP 提取

**OCR 服务端点**（scripts/ocr_server.py）：
- `/classify-pdf` — 页面分类
- `/extract-text` — pymupdf4llm 提取 Markdown
- `/ocr-pdf` — 只处理 scanned/mixed 页（提取后替换 `[OCR_PENDING]` 占位）
- `/ocr` — 单图 OCR（截图问 AI 使用）
- **Provider 抽象**：PaddleOCR 为默认 provider，接口可换

**进度更新**：`books.ocr_current_page`/`ocr_total_pages` 书级；模块级 text_status/ocr_status/kp_extraction_status 独立追踪

**parse_status 取值**：`pending` → `processing` → `done` / `error`
**kp_extraction_status 取值（books + modules 都有）**：`pending` → `processing` → `completed` / `failed`

### 渐进式处理（Scanned PDF 2026-04-12）

**设计目标**：文字页先解锁阅读，扫描页后台 OCR 不阻塞；模块一就绪就可用。

**模块级状态三元组**（modules 表）：
- `text_status`: `pending`（等 OCR）| `ready`（文本可读）
- `ocr_status`: `pending` | `processing` | `done` | `skipped` | `failed`
- `kp_extraction_status`: `pending` | `processing` | `completed` | `failed`

**书级汇总**（`syncBookKpStatus(bookId)` 优先级）：
- 所有模块 `completed` → `completed`
- 有模块 `processing` → `processing`
- 有模块 `failed`（且无 processing）→ `failed`
- 否则 → `pending`

**API 契约**：
- `GET /api/books/[bookId]/module-status` → `{ bookId, parseStatus, kpExtractionStatus, ocrCurrentPage, ocrTotalPages, modules: [{ id, title, orderIndex, textStatus, ocrStatus, kpStatus, pageStart, pageEnd }] }`
- `POST /api/books/[bookId]/extract` → 触发所有 text_status='ready' 且 ocr_status 为 'done'/'skipped' 的模块（202 fire-and-forget）
- `POST /api/books/[bookId]/extract?moduleId=N` → 单模块重跑

**前端渲染**：
- `ProcessingPoller` 轮询 module-status（4s）→ 所有模块 kpStatus='completed' 且 parseStatus='done' 时调 `router.refresh()`
- `ActionHub` 模块网格并行拉 dashboard + module-status，按三元组决定 badge 和可点击性：
  - `kpStatus=completed` → `completed`/`in-progress`/`not-started` badge，跳转 `/modules/[id]`
  - `textStatus=ready`, `kpStatus` in (pending, processing) → `readable` badge，跳转 `/reader`
  - `ocrStatus=processing` → `processing` badge（脉冲），不可点击
  - `textStatus=pending` → `locked` badge，不可点击
- 404 回退：老书（无模块级字段）自动降级到 `/api/books/[bookId]/status` 单条进度条

### 启动初始化（M6-hotfix 修复）

- `src/instrumentation.ts` → Next.js 启动钩子，调用 `initDb()`
- `initDb()` 读 `schema.sql`（CREATE TABLE IF NOT EXISTS）+ `seedTemplates()`（幂等 UPSERT）
- 保护条件：`NEXT_RUNTIME === 'nodejs'`，避免 Edge runtime 导入 pg

### 部署架构（M6 + Scanned PDF 升级 2026-04-12）

- **三容器 Docker Compose**：app（Next.js standalone）+ db（PostgreSQL 16）+ ocr（PaddleOCR + PyMuPDF + psycopg2 + pymupdf4llm）
- **环境变量**：
  - **App**：`DATABASE_URL`, `ANTHROPIC_API_KEY`, `AI_MODEL`, `OCR_SERVER_HOST`, `OCR_SERVER_PORT`
  - **OCR**：`OCR_PROVIDER`（默认 `paddle`，可切 `google`）, `GOOGLE_CLOUD_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS`（仅 google provider 需要）, `DATABASE_URL`
- **持久化卷**：pgdata（数据库）+ uploads（用户 PDF，app 和 ocr 共享）
- **OCR 通信**：app → `http://${OCR_SERVER_HOST}:${OCR_SERVER_PORT}/{classify-pdf,extract-text,ocr-pdf,ocr}`，本地默认 127.0.0.1:8000
- **副产品字段**：`books.text_pages_count` / `scanned_pages_count` 由 OCR 的 classify 阶段填入，TypeScript 代码目前未消费（云上可用于成本监控）

**⚠️ 上云部署约束**（下个里程碑「云部署」brainstorm 入口）：
- OCR server 内存需求 ≥ 1GB（PaddleOCR 模型加载）；首次启动需下载模型，冷启动慢
- `uploads` volume 共享依赖：若 app 与 ocr 分开部署（跨主机），PDF 文件传递方式需重设计（URL / 对象存储 / 流式上传）
- OCR server 端点当前无认证，Docker 内网可用；暴露到公网必须加 auth 或放 VPC 内
- `DATABASE_URL` 被 app 和 ocr 两侧都直连，Neon pooler 连接数限制要考虑

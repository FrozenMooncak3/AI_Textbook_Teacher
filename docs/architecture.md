# 系统架构

> 两层信息：系统总图（有什么）+ 接口契约（怎么接在一起）。
> 里程碑结束时必须更新，session 开始时必须读取。

---

## 系统总图

### 页面

```
/ (首页：书目列表 + 待复习按钮)
├── /upload (上传 PDF)
├── /logs (系统日志)
└── /books/[bookId]
    ├── / (书详情：ProcessingPoller 或 ModuleMap)
    ├── /reader (PDF 阅读器 + 截图问 AI：OCR→提问→回答两步流程)
    ├── /module-map (模块地图)
    ├── /dashboard (学习仪表盘：进度/复习/测试/错题四宫格)
    ├── /mistakes (书级错题诊断本：多维筛选)
    └── /modules/[moduleId]
        ├── / (模块学习：指引→阅读→QA→笔记)
        ├── /qa (QA session)
        ├── /test (测试 session)
        ├── /review?scheduleId=X (复习 session)
        └── /mistakes (错题页)

App Shell (M5.5):
├── src/app/layout.tsx → 包裹 SidebarLayout
├── src/components/sidebar/SidebarProvider.tsx → 侧栏状态 Context（展开/折叠/移动端）
├── src/components/sidebar/Sidebar.tsx → 三层路由感知导航（全局→书→模块）
├── src/components/sidebar/SidebarLayout.tsx → flex h-screen: sidebar + main(flex-1 overflow-auto)
├── src/components/sidebar/SidebarToggle.tsx → 移动端汉堡菜单 + 桌面端折叠按钮
├── src/components/LoadingState.tsx → 共享加载组件（stage 模式 / progress 模式）
├── src/app/error.tsx → 根级错误边界
├── src/app/books/[bookId]/error.tsx → 书级错误边界
├── src/app/books/[bookId]/modules/[moduleId]/error.tsx → 模块级错误边界
├── src/app/books/[bookId]/layout.tsx → 书级 layout（薄包装）
└── src/app/not-found.tsx → 全局 404 页面
└── /(auth) (route group + layout.tsx)
    ├── /login (登录页)
    └── /register (邀请码注册页)
```

### API 组

```
auth/               — register, login, logout, me
books/              — list/create
books/[bookId]/     — extract, status, pdf, module-map(+confirm/regenerate), screenshot-ocr, screenshot-ask, notes, highlights, toc, dashboard, mistakes
modules/            — list
modules/[moduleId]/ — status, guide, generate-questions, qa-feedback, questions, reading-notes,
                      generate-notes, evaluate, test/generate, test/submit, test/, mistakes
review/due          — GET 待复习列表
review/[scheduleId]/ — generate, respond, complete
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
- **前端**：ReviewSession 组件（QA 模式），首页 ReviewButton 显示待复习列表

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

### App Shell 与导航（M5.5）

- **侧栏导航**：SidebarLayout 包裹 root layout，`flex h-screen overflow-hidden`。侧栏固定左侧，内容区 `flex-1 overflow-auto` 独立滚动
- **三层导航**：L1 全局（首页/上传）→ L2 书级（阅读/地图/仪表盘/错题）→ L3 模块级（学习/QA/测试/错题），路由感知自动展开
- **移动端**：< 1024px 侧栏隐藏，汉堡菜单触发 overlay。ESC / backdrop 关闭
- **折叠状态**：localStorage 持久化，折叠时显示图标 + hover tooltip
- **页面布局**：所有页面使用 `min-h-full`（不再使用 `min-h-screen`），唯一 `h-screen` 在 SidebarLayout
- **错误边界**：三级 error.tsx（根/书/模块）+ not-found.tsx，捕获所有未处理异常，显示中文友好提示
- **LoadingState**：共享加载组件，stage 模式（spinner + 描述文字）和 progress 模式（进度条），替代所有页面级裸 spinner

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

### 大 PDF 分块（M6）

- **text-chunker.ts**：标题检测（Chapter N, 第N章, 编号节, 全大写）→ 按标题边界分组 → 超大段按 35K 字符切割（20 行 overlap）
- **kp-merger.ts**：多 chunk KP 提取后合并，Dice 系数 bigram 相似度去重（阈值 0.8），kp_code 重编号
- **kp-extraction-service.ts**：单 chunk 直走，多 chunk 逐 chunk 提取 → mergeChunkResults → 写 DB

### PDF 阅读器（M6）

- **react-pdf-viewer**：`@react-pdf-viewer/core` + `@react-pdf-viewer/default-layout`
- 内置功能：缩放、搜索、书签、缩略图、页码导航
- pdfjs-dist@3.11.174 Worker（CDN）
- ScreenshotOverlay + AiChatDialog 保持不变

### PDF OCR 管道（⚠️ M6 断裂 — 待修复）

- **现状（已坏）**：`books/route.ts` spawn 本地 Python 进程 `ocr_pdf.py`，传 `--db-path data/app.db`（SQLite）
- **问题**：① `ocr_pdf.py` 用 sqlite3 写结果，PostgreSQL 收不到 ② Docker 容器没有 Python/scripts ③ 端口默认值不一致（screenshot-ocr.ts=9876, ocr_server.py=8000）
- **目标架构**：upload → 调用 OCR HTTP 服务（复用 ocr 容器的 /ocr-pdf 端点）→ OCR 服务处理完整 PDF → 通过 PostgreSQL 写回结果
- **parse_status 实际值**：`pending` → `processing` → `done` → `error`（注意不是 completed/failed）

### 启动初始化（⚠️ M6 断裂 — 待修复）

- `initDb()` 定义在 `src/lib/db.ts` 但无调用入口
- 新数据库 prompt_templates 为空，所有 AI 功能不可用
- 需要 Next.js `instrumentation.ts` 或等效启动钩子

### 部署架构（M6）

- **三容器 Docker Compose**：app（Next.js standalone）+ db（PostgreSQL 16）+ ocr（PaddleOCR）
- **环境变量**：DATABASE_URL, ANTHROPIC_API_KEY, AI_MODEL, OCR_SERVER_HOST, OCR_SERVER_PORT
- **持久化卷**：pgdata（数据库）+ uploads（用户 PDF）
- **OCR 通信**：app → `http://${OCR_SERVER_HOST}:${OCR_SERVER_PORT}/ocr`，本地默认 127.0.0.1:8000
- ⚠️ `docker-compose.yml` 残留未使用的 `SESSION_SECRET` 环境变量

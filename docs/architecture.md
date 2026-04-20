# 系统架构

> 两层信息：系统总图（有什么）+ 接口契约（怎么接在一起）。
> 里程碑结束时必须更新，session 开始时必须读取。

---

## 0. 摘要卡

> brainstorming skill 默认只读这一章；详细内容按需查后续章节。

### 页面结构
`/` 首页 Dashboard | `/upload` 上传 | `/books/[bookId]` Action Hub + `/reader` + `/mistakes`
`/modules/[moduleId]` 学习 + `/activate` + `/teach` + `/teaching-complete` + `/qa` + `/test` + `/review?scheduleId=X` + `/notes` + `/mistakes`
Auth: `/login` `/register`（邀请码）| App Shell: 3 级 error.tsx + AppSidebar + LoadingState

### DB 表（26 张）
| 分类 | 表 |
|------|----|
| 认证 | users, invite_codes, sessions |
| 用户 | books, modules, conversations, messages, highlights, reading_notes, module_notes |
| 学习 | knowledge_points, clusters, qa_questions, qa_responses, **teaching_sessions** |
| 测试 | test_papers, test_questions, test_responses, mistakes |
| 复习 | review_schedule, review_records, review_questions, review_responses |
| 付费 | **user_subscriptions** |
| 系统 | prompt_templates, logs |

### 核心 API
- `POST /api/books` — PDF 上传 → R2 存储 → OCR classify → extract-text → 建模块 → KP 提取
- `GET /api/books/[id]/module-status` — 模块级三元组状态（text/ocr/kp）
- `POST /api/books/[id]/extract` — 手动触发 KP 提取（全书或 ?moduleId=N）
- `POST /api/books/[id]/switch-mode` — 书级 teaching/full 模式切换（M4）
- `POST /api/books/[id]/modules/[mid]/reset-and-start` — 重置 + 启动教学（M4）
- `GET /api/books/[id]/pdf` — 302 redirect 到 R2 presigned URL（1h TTL）
- `POST /api/ocr/callback` — Cloud Run OCR 回调端点（Bearer `OCR_SERVER_TOKEN`，middleware 豁免 session 鉴权）；3 事件类型 progress / page_result / module_complete
- `POST /api/teaching-sessions` — 创建教学会话，返回 sessionId + TranscriptV1（M4）
- `POST /api/teaching-sessions/[sid]/messages` — 教学对话推进（含 Zod + retry + 409 struggling_frozen）（M4）
- `GET /api/modules/[id]/clusters` — 获取模块 clusters + KP（M4）
- `PATCH /api/modules/[id]/status` — 学习状态迁移（M4 扩展 8 状态）
- `POST /api/modules/[id]/start-qa` — taught → qa_in_progress 切换（M4）
- `POST /api/modules/[id]/generate-questions` — 教练出 QA 题
- `POST /api/modules/[id]/test/generate` — 考官出测试题
- `POST /api/review/[scheduleId]/generate` — 复习官出复习题
- `GET /api/review/due` — 待复习列表

### AI 角色（6 个）
extractor（KP 提取 + 模块地图）| **teacher（5 阶段 Q&A 教学：factual/conceptual/procedural/analytical/evaluative）** | coach（指引 + QA + 反馈 + 笔记）| examiner（测试 + 评分 + 诊断）| reviewer（复习 + P 值）| assistant（截图问 AI）

### 部署
生产：Vercel Hobby + Neon Postgres(us-east-1) + Cloudflare R2 + Cloud Run OCR (us-central1, Google Vision, IAM-only)
本地：Docker Compose 三容器（app + db + ocr；ocr 走 Google Vision 需挂 GCP SA key）

### ⚠️ 核心约束
- 🚨 Vercel Hobby 请求体 4.5MB 上限阻塞 >4.5MB PDF 上传 — 修复已归停车场 T2（presigned URL 直传 R2）
- OCR 鉴权双层：Vercel → Cloud Run 用 `X-App-Token` + Google ID token（`OCR_REQUIRE_IAM_AUTH=true`）；Cloud Run → Vercel callback 用 `Authorization: Bearer OCR_SERVER_TOKEN`
- Cloud Run OCR 不连 DB，只调 Vision API + 回调 Vercel；DB 写操作全部在 Next.js `/api/ocr/callback` 里
- 大 PDF 分块阈值 35K 字符（20 行 overlap）
- P 值方向：低=好（1=已掌握，4=最弱）
- 学习流（Full 模式 / 阅读）：unstarted → reading → qa → notes_generated → testing → completed
- 学习流（Teaching 模式 / 教学）：unstarted → taught → qa_in_progress → qa → notes_generated → testing → completed
- **内部信号护城河**：`kp.type`/`kp.importance`/`kp.detailed_content`/`kp.ocr_quality` 永远服务端保留，UI / API 响应禁止暴露（M4 moat 硬约束，dispatch 必 grep 校验）

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
        ├── /activate (Phase 0 启动教学：AppSidebar + ContentCard + ObjectivesList + AmberButton CTA → POST teaching-sessions)
        ├── /teach (教学对话：AppSidebar + Breadcrumb + ContentCard + ChatBubble + ProgressBar + AmberButton; 5 阶段 teacher AI 逐 cluster 推进)
        ├── /teaching-complete (教学完成中页：AppSidebar + Breadcrumb + ContentCard 庆祝 + KP 回顾 + AmberButton → POST start-qa → /qa)
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
books/[bookId]/     — extract(+?moduleId=N), module-status, status, pdf, module-map(+confirm/regenerate), screenshot-ocr, screenshot-ask, notes, highlights, toc, dashboard, mistakes,
                      switch-mode（M4），modules/[moduleId]/reset-and-start（M4）
modules/            — list
modules/[moduleId]/ — status（M4 扩展 8 状态），guide, generate-questions, qa-feedback, questions, reading-notes,
                      generate-notes, evaluate, test/generate, test/submit, test/, mistakes,
                      clusters（M4），start-qa（M4）
teaching/           — （M4）teaching-sessions (POST 创建), teaching-sessions/[sid]/messages (POST 推进对话)
review/due          — GET 待复习列表
review/[scheduleId]/ — generate, respond, complete, briefing
qa/[questionId]/    — respond (ownership guard: question→module→book→user)
conversations/      — messages (ownership guard: conversation→book→user)
logs/               — 系统日志（按 user_id 过滤）
```

### DB 表（26 张）

| 分类 | 表 |
|------|----|
| 认证数据 | users, invite_codes, sessions |
| 用户数据 | books, modules, conversations, messages, highlights, reading_notes, module_notes |
| 学习数据 | knowledge_points, clusters, qa_questions, qa_responses, **teaching_sessions**（M4） |
| 测试数据 | test_papers, test_questions, test_responses, mistakes |
| 复习数据 | review_schedule, review_records, review_questions, review_responses |
| 付费数据 | **user_subscriptions**（M4 预埋 free/premium，新注册默认 premium） |
| 系统数据 | prompt_templates（M4 新增 `model TEXT NULL` 列）, logs |

### AI 角色（6 个）

| 角色 | 职责 |
|------|------|
| 提取器 (extractor) | KP 提取 + 模块地图 |
| **教师 (teacher, M4)** | **5 阶段一对一教学：teach_factual / teach_conceptual / teach_procedural / teach_analytical / teach_evaluative；TranscriptV1 信封 + Zod 输出 + retryWithBackoff + struggling 冻结机制** |
| 教练 (coach) | 读前指引 + QA 出题 + 反馈 + 笔记生成 |
| 考官 (examiner) | 测试出题 + 评分 + 错题诊断 |
| 复习官 (reviewer) | 复习出题 + 评分 + P 值更新 |
| 助手 (assistant) | 截图问 AI |

### 学习状态流（8 状态，2 入口）

```
Full 模式（阅读）：unstarted → reading → qa → notes_generated → testing → completed
Teaching 模式（教学，M4）：unstarted → taught → qa_in_progress → qa → notes_generated → testing → completed
合法迁移表（VALID_TRANSITIONS，src/app/api/modules/[moduleId]/status/route.ts）：
  unstarted: [reading, taught]
  reading: [qa]
  taught: [qa_in_progress]
  qa_in_progress: [qa, notes_generated]
  qa: [notes_generated]
  notes_generated: [testing, completed]
  testing: [completed]
  completed: []
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

### 教学系统（M4）

**定位**：Teaching mode = 付费墙护城河，MVP 全用户默认 premium，未来仅需改 `canUseTeaching()`。

**模式切换**：
- 书级 `books.learning_mode`（default `'full'`, CHECK in `('full','teaching')`）+ `books.preferred_learning_mode`（nullable，用户偏好）
- `POST /api/books/[bookId]/switch-mode { mode }` 切换书级模式；`POST /api/books/[bookId]/modules/[moduleId]/reset-and-start` 重置模块 + 创建教学会话

**teaching_sessions 表**：
- 独立表（UUID PK, gen_random_uuid），字段 `module_id / cluster_id / user_id / transcript JSONB / depth / started_at / completed_at`
- transcript DEFAULT 是 TranscriptV1 完整信封（见下），非空数组

**TranscriptV1 信封**（`src/lib/teaching-types.ts`）：
```jsonc
{
  "version": 1,
  "state": {
    "depth": "full" | "light",        // full=5 阶段, light=3 阶段（importance=1）
    "currentKpId": number | null,      // 当前 KP
    "coveredKpIds": number[],          // 已覆盖
    "strugglingStreak": number,        // struggling 连续次数（0-3）
    "startedAt": ISO8601 | null,
    "lastActiveAt": ISO8601 | null,
    "tokensInTotal": number,
    "tokensOutTotal": number
  },
  "messages": Array<{
    "role": "user" | "assistant",
    "content": string,
    "stage"?: "teach_factual" | "teach_conceptual" | "teach_procedural" | "teach_analytical" | "teach_evaluative",
    "kpId"?: number,
    "status"?: "teaching" | "ready_to_advance" | "struggling",
    "ts": ISO8601
  }>
}
```

**5 阶段教学法**（teacher 角色）：
- factual（事实记忆）→ conceptual（概念理解）→ procedural（程序化）→ analytical（分析推理）→ evaluative（评价综合）
- Prompt 模板在 `prompt_templates` 表（role='teacher', stage=上述 5 值），seed 见 `src/lib/seed-templates.ts`
- 每条 teacher 模板可设 `model` 列覆盖默认模型（如 sonnet-4-6）；NULL → 回退 `AI_MODEL` env

**Zod 输出校验**（`src/lib/teacher-prompts.ts`）：
- `TeacherOutputSchema` 严格校验 AI 响应：`{ message: string, status: 'teaching'|'ready_to_advance'|'struggling', nextStage?: string }`
- `.refine()` 约束 `status=ready_to_advance` 必须搭配有效 `nextStage`
- 解析失败抛 ValidationError，由路由 catch 返回 5xx

**重试 + 错误分类**（`src/lib/retry.ts`）：
- `retryWithBackoff()` 指数退避（基础 500ms，2 倍，上限 4 次，jitter ±20%）
- 分类 `classifyError()`：`retryable`（429 / 503 / ETIMEDOUT / ECONNRESET / SSE 断流） vs `fatal`
- 仅 retryable 走 backoff，fatal 直接抛

**Struggling 冻结机制**：
- teacher AI 返回 `status='struggling'` 时 strugglingStreak++
- 连续 3 次 struggling → 路由返回 HTTP **409 STRUGGLING_FROZEN**，前端锁按钮显示 "建议先回去读原文" CTA → 用户需主动 reset-and-start
- `status='ready_to_advance'` 或成功进入下一 KP → strugglingStreak 清零

**Tier → 模型映射**（`src/lib/teacher-model.ts`）：
- `resolveTeacherModel(tier, template)` → 优先 template.model → 否则按 tier（premium=sonnet-4-6, free=haiku-4-5） → 兜底 `AI_MODEL` env
- 整合到 `src/lib/ai.ts` provider registry（anthropic + openai + google + xai）

**API 契约**：
- `POST /api/teaching-sessions { moduleId, clusterId? }` → 创建 session（owner + mode='teaching' 双校验），返回 `{ sessionId, transcript: TranscriptV1 }`
- `POST /api/teaching-sessions/[sid]/messages { content }` → 发对话，返回 `{ message, status, nextStage?, coveredKpIds }`；错误 409 STRUGGLING_FROZEN / 429 / 503（retryable）/ 500（fatal）
- `GET /api/modules/[moduleId]/clusters` → `{ clusters: [{ id, cluster_name, kps: [{ id, section_name }] }] }`（SELECT 白名单剔除 kp.type / importance / detailed_content / ocr_quality）
- `POST /api/modules/[moduleId]/start-qa` → 校验 `learning_status='taught'` → 转 `qa_in_progress`，返回 `{ qaSessionId, redirectUrl }`（⚠️ 当前 redirectUrl 是 stale `/modules/${id}/qa`，前端须改用 canonical `/books/${bookId}/modules/${moduleId}/qa`，已归技术债，M5 开始时修或 milestone-audit 后补丁）

**前端流程**：
- `/activate` Phase 0：展示模块信息 + ObjectivesList + CTA → `POST teaching-sessions` → `router.push /teach`
- `/teach`：双 useEffect（init + cancelled flag + hasInitialized ref 防 strict mode 双 fire）；handleSend 走 409/429/503 分支；cluster 推进时重建 session；完成全部 cluster → `PATCH status=taught` → `router.push /teaching-complete`
- `/teaching-complete`：庆祝页 + KP 回顾（SELECT 仅 id + section_name）+ CTA → `POST start-qa` → `router.push /books/${bookId}/modules/${moduleId}/qa`（忽略 API stale redirectUrl）

**内部信号护城河**（硬约束）：
- `knowledge_points.type` / `knowledge_points.importance` / `knowledge_points.detailed_content` / `knowledge_points.ocr_quality` **永远不出现在前端 props、API 响应、DOM render**
- M4 所有 dispatch 强制包含 grep 校验 4 字段 0 hits

**新增依赖**：
- `zod`（TeacherOutputSchema 严格解析）
- `gen_random_uuid()` 依赖 pgcrypto extension（已在 schema.sql 启用）

### 错题流转

- mistakes 表 source 字段支持 'test'|'qa'|'review' 三个来源
- test/submit 写入（source='test'），review/respond 写入（source='review'），qa 来源未实现
- mistakes.kp_id 关联 knowledge_points，用于出题时优先覆盖
- mistakes.error_type 只允许 4 个值：blind_spot / procedural / confusion / careless
  - review/respond 和 test/submit 均使用 `normalizeReviewErrorType()` 做模糊归一化
  - normalizeReviewErrorType 位于 `src/lib/review-question-utils.ts`，null/unknown 默认返回 'confusion'

### prompt 模板

- seed-templates.ts 种子化：extractor×3, coach×4, examiner×2, reviewer×2, assistant×1, **teacher×5（M4）**
- extractor 模板是乱码 UTF-8，但功能正常（创建时就是这样写的）
- examiner 模板已用正常中文重写（M3）
- reviewer 模板：review_generation（出题）+ review_scoring（评分），均为正常中文（M4）
- assistant/screenshot_qa 模板已修复为干净中文，变量：{screenshot_text}, {user_question}, {conversation_history}（M5）
- ⚠️ screenshot-ask 路由的系统 prompt 和 fallback 已改为英文（M6，Codex 编码问题导致中文乱码）
- **teacher 5 模板（M4）**：teach_factual / teach_conceptual / teach_procedural / teach_analytical / teach_evaluative；每条模板可通过 `prompt_templates.model TEXT NULL` 字段覆盖默认模型（teacher 模板默认 `anthropic:claude-sonnet-4-6`）
- **prompt_templates.model 字段**：`src/lib/prompt-templates.ts` 的 `getPromptTemplate()` 返回 model；`src/lib/ai.ts` 的 `resolveModel(template)` 逐级回退 template.model → tier 映射 → `AI_MODEL` env

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

**L2 其他（9 个）**：
ToggleSwitch（开关：Radix Switch）、AIInsightBox（AI 洞察卡片）、FilterBar（多组筛选栏）、MistakeCard（错题卡片：展开/折叠）、ResolvedCard（已解决错题卡片）、MasteryBars（掌握度柱状图）、BriefingCard（复习简报卡片）、HeroCard（英雄卡片：大标题+装饰）、**Modal（M4 通用弹窗：Amber Companion 风格，scrim + center card，用于 ModeSwitchDialog）**

**M4 教学专用组件（顶层非 ui/，3 组）**：
- `src/components/BookTOC/index.tsx` + `BookTOCItem.tsx`（书目录：guide / base 两模式，支持 `isBlocked` 锁态 + ring + badge）
- `src/components/ObjectivesList.tsx`（Phase 0 学习目标列表：SELECT 仅 section_name，moat 合规）
- `src/components/ModeSwitch/ModeSwitchDialog.tsx`（模式切换确认弹窗：基于 Modal + AmberButton，接 `POST /api/books/[bookId]/switch-mode`）

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

### PDF OCR 管道（Scanned PDF 2026-04-12 + Cloud Run 异步回调 2026-04-19）

**4 步上传流程**：
1. **classify**：`POST /classify-pdf { r2_object_key, book_id }` → 逐页分类（text/scanned/mixed），响应 `{ pages, text_count, scanned_count, mixed_count, total_pages }`，Next.js 写入 `books.page_classifications` + `text_pages_count` + `scanned_pages_count`（scanned + mixed）
2. **extract-text**：`POST /extract-text { r2_object_key, book_id, classifications }` → pymupdf4llm 提取 text/mixed 页 Markdown，scanned 页 `[OCR_PENDING]` 占位，`--- PAGE N ---` 分隔；Next.js 把 raw_text 写回 `books.raw_text`
3. **建模块**：`books/route.ts` 对 rawText 调用 `chunkText()` → 每 chunk 带 `pageStart/pageEnd` → 插入 modules 表（`text_status='ready'`, `ocr_status=nonTextPages>0?'pending':'skipped'`, `kp_extraction_status='pending'`）
4. **async OCR**：只对非纯文字 PDF 调用 `/ocr-pdf { r2_object_key, book_id, classifications }`，Cloud Run 立即返回 202 `{status:'accepted'}`，后台 Vision OCR + 三事件回调；同时 Next.js 并行 `triggerReadyModulesExtraction(bookId)` 触发已就绪模块 KP

**OCR 服务端点**（scripts/ocr_server.py，Cloud Run 部署）：
- `/classify-pdf` — 页面分类（`_require_bearer`）
- `/extract-text` — pymupdf4llm 提取 Markdown（`_require_bearer`，body 必带 classifications 列表替代 DB 查询）
- `/ocr-pdf` — 异步 Google Vision OCR（`_require_bearer`，Threading + 三事件回调到 `NEXT_CALLBACK_URL`）
- `/ocr` — 单图 OCR（`_require_bearer`，入参 `{ image_base64 }` — 截图问 AI 使用）
- `/health` — 未鉴权（Cloud Run probe 保留）
- **Provider**：`OCR_PROVIDER=google`（默认且唯一，PaddleOCR/numpy/preprocess 管道已移除）

**Cloud Run → Vercel 回调契约**（`/api/ocr/callback`，Bearer `OCR_SERVER_TOKEN`）：
- `progress`：`{ event:'progress', book_id, module_id?, pages_done, pages_total }` → `UPDATE books SET ocr_current_page, ocr_total_pages, parse_status='processing'`
- `page_result`：`{ event:'page_result', book_id, module_id, page_number, text }` → 在 `books.raw_text` 中字符串 replace `[OCR_PENDING]` 占位
- `module_complete`：`{ event:'module_complete', book_id, module_id, status, error? }` → `module_id=0` 时批量把 `ocr_status='processing'` 模块翻成 done/error 并设 `books.parse_status`；`module_id>0` 时更新单模块，若该书所有模块都 done/skipped 自动 `parse_status='done'`

**middleware 豁免**：`src/middleware.ts` 精确匹配 `pathname === '/api/ocr/callback'` 跳过 session cookie 鉴权，让路由自己的 Bearer 鉴权接管（原 prefix `/api/auth/` 不覆盖 OCR 回调导致 smoke test 阻塞，已修 commit 6d918d0）

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

### 部署架构（云部署阶段 1 完成 2026-04-16，阶段 2 完成 2026-04-19）

**生产环境（Vercel + Neon + R2 + Cloud Run）**：
- **前端/API**：Vercel Hobby（Next.js standalone）— 自动 CI/CD on push to master
- **数据库**：Neon Serverless Postgres（us-east-1）— Vercel Integration 自动注入 `DATABASE_URL`，Preview 环境自动 DB branch
- **文件存储**：Cloudflare R2 bucket `ai-textbook-pdfs` — S3 兼容 API，对象路径 `books/{bookId}/original.pdf`，CORS 允许 Vercel 域名 + localhost
- **PDF 服务**：`/api/books/[bookId]/pdf` → 302 redirect 到 R2 presigned URL（1h TTL），绕开 Vercel 4.5MB 响应限制
- **OCR**：Cloud Run 服务 `ai-textbook-ocr` @ us-central1，URL `https://ai-textbook-ocr-408273773864.us-central1.run.app`，IAM-only（禁止未鉴权调用），Google Vision API 调用，Cloud Build GitHub trigger `includedFiles=scripts/**,Dockerfile.ocr,requirements.txt` 自动 CD
- **Sentry**：OCR 服务可选 DSN（`SENTRY_DSN` 未设时 print 不崩），环境标签 `SENTRY_ENVIRONMENT`

**本地开发环境（Docker Compose）**：
- **三容器**：app（Next.js standalone）+ db（PostgreSQL 16）+ ocr（Google Vision + PyMuPDF + pymupdf4llm + boto3 + requests + sentry-sdk）
- **OCR 本地运行需挂 GCP SA key**（volume mount `/app/gcp-sa-key.json` + `GOOGLE_APPLICATION_CREDENTIALS`），或以 `OCR_REQUIRE_IAM_AUTH=false` 跳过 IAM
- **持久化卷**：pgdata（数据库）+ uploads（仅本地遗留，新上传走 R2）

**环境变量（生产 Vercel）**：
- **Neon 自动注入**：`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `POSTGRES_*`
- **手动配置**：`ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `AI_MODEL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `OCR_SERVER_URL`, `OCR_SERVER_TOKEN`, `GCP_SA_KEY_JSON`, `OCR_REQUIRE_IAM_AUTH=true`, `NEXT_CALLBACK_URL`

**环境变量（Cloud Run OCR 服务）**：
- `OCR_PROVIDER=google`, `OCR_SERVER_TOKEN`, `NEXT_CALLBACK_URL`, `SENTRY_DSN`（可选）, `SENTRY_ENVIRONMENT`, `R2_*`, `GOOGLE_APPLICATION_CREDENTIALS`（由 SA 绑定自动注入）

**环境变量（本地 Docker）**：
- **App**：`DATABASE_URL`, `ANTHROPIC_API_KEY`, `AI_MODEL`, `OCR_SERVER_URL=http://ocr:8000`, `OCR_SERVER_TOKEN`, `OCR_REQUIRE_IAM_AUTH=false`, `NEXT_CALLBACK_URL=http://app:3000/api/ocr/callback`, `R2_*`
- **OCR**：`OCR_PROVIDER=google`, `OCR_SERVER_TOKEN`, `NEXT_CALLBACK_URL=http://app:3000/api/ocr/callback`, `R2_*`, `GOOGLE_APPLICATION_CREDENTIALS=/app/gcp-sa-key.json`

**OCR 通信（鉴权双层）**：
- **Vercel → Cloud Run**：`src/lib/ocr-auth.ts` `buildOcrHeaders()` 生成两个头 — `X-App-Token: $OCR_SERVER_TOKEN`（应用层）+ `Authorization: Bearer <Google ID token>`（IAM，仅 `OCR_REQUIRE_IAM_AUTH=true` 时生成；通过 `google-auth-library` 用 `GCP_SA_KEY_JSON` 服务账号铸造）
- **Cloud Run → Vercel**：`_post_callback()` 发 `Authorization: Bearer $OCR_SERVER_TOKEN`（Vercel 端无 IAM，middleware 豁免 `/api/ocr/callback` 后由路由 `requireBearer` 校验）
- **入参**：PDF 端点只接受 `r2_object_key`（legacy `pdf_path` 已拆除），`/ocr` 接受 `image_base64`
- **副产品字段**：`books.text_pages_count` / `scanned_pages_count` 由 classify 阶段填入

**⚠️ 阶段 3 待办**：
- 自定义域名（Cloudflare Registrar + Vercel CNAME）
- 监控全量接入（Sentry Next.js 前端 + Vercel Analytics 仪表盘）
- Secrets 管理（当前 `GCP_SA_KEY_JSON` 明文存 Vercel env，应迁 Secret Manager 或 Vercel Encrypted Env 升级）
- 🚨 PDF 上传 presigned URL 直传 R2（绕过 Vercel 4.5MB body 上限，阻塞 >4.5MB 扫描 PDF，已归停车场 T2 基础设施）

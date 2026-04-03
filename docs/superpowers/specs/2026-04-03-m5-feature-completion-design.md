# M5 设计文稿：功能补完

> 让 MVP 从"能跑"变成"能用"。修正已有功能的缺陷，补全缺失的展示页面。

---

## 1. 范围

### M5 包含（本文档）

| # | 任务 | 类型 |
|---|------|------|
| 1 | 截图问AI流程拆分（OCR→用户提问→AI回答） | 功能修正 |
| 2 | 截图问AI语言匹配（用内容语言回答） | 功能修正 |
| 3 | 截图处理进度反馈（分阶段 loading） | UX修正 |
| 4 | AI回复Markdown渲染（跨功能） | UX修正 |
| 5 | OCR进度条精度优化 | UX修正 |
| 6 | 评分后显示正确答案（复习+测试） | 功能缺失补全 |
| 7 | 书级仪表盘页面 | 新页面 |
| 8 | 错题本页面 | 新页面 |

### M5.5 不含（已停车）

- QA/复习时旁边看原文
- 笔记查看/导出
- 预生成答案解析（提速）
- 复习出题KP覆盖率优化
- Dashboard日历视图
- 模块阅读选文字问AI
- 侧边栏导航壳（全局布局重构）

### 数据库

需要 1 处 schema 变更：mistakes 表增加 `question_text`、`user_answer`、`correct_answer` 三列（见 Section 6.2）。

---

## 2. 截图问AI改造（任务 1-3, 5）

### 2.1 当前问题

- `screenshot-ask` API 收到截图后直接调 AI 自动解释（`buildScreenshotPrompt()` 写死 "Explain the passage"），用户无法提问
- prompt 全英文，AI 默认英文回答
- OCR + AI 是同步请求，无进度反馈

### 2.2 改后流程

```
用户截图框选
  → 前端调 screenshot-ocr API
  → 显示「识别中...」
  → OCR 完成，前端显示识别出的文字
  → 用户在输入框写问题
  → 前端调 screenshot-ask API（传文字 + 问题）
  → 显示「AI 思考中...」
  → AI 回答（用内容语言）
```

### 2.3 API 设计

**新增：`POST /api/books/[bookId]/screenshot-ocr`**

请求：
```json
{
  "image": "base64 encoded image"
}
```

响应：
```json
{
  "text": "OCR 识别出的文字"
}
```

逻辑：只调 PaddleOCR HTTP 服务（localhost:9876），不调 AI。

**修改：`POST /api/books/[bookId]/screenshot-ask`**

请求（改）：
```json
{
  "image": "base64 encoded image",
  "text": "OCR 识别出的文字",
  "question": "用户的问题"
}
```

响应（不变）：
```json
{
  "answer": "AI 的回答（Markdown 格式）",
  "conversationId": "..."
}
```

逻辑：接收 image + text + question。AI 同时看到原始截图（处理图表/公式等视觉内容）和 OCR 文字（提供可搜索的文本上下文），回答用户的具体问题。

**向后兼容**：旧的"只传 image 自动解释"模式不再支持。前端必须先调 screenshot-ocr 拿到文字，再调 screenshot-ask 传三个参数。破坏性变更，但只有内部前端调用。

### 2.4 Prompt 变更

当前 `screenshot-ask/route.ts` 中有硬编码的 `buildScreenshotPrompt()` 和 `systemPrompt`，**未使用** prompt 模板系统。需要两步修改：

1. **route.ts**：移除硬编码 prompt，改用 `getPrompt('assistant', 'screenshot_qa')` 调用模板系统
2. **seed-templates.ts**：更新 assistant 模板内容为：

```
你是一个教材学习助手。用户会给你一段教材内容（文字+截图），并提出问题。
规则：
1. 只根据提供的内容回答，不要编造内容之外的信息
2. 用与教材内容相同的语言回答（中文内容用中文，英文内容用英文）
3. 回答要清晰、有条理，使用 Markdown 格式
```

### 2.5 前端变更

PDF 阅读器截图流程改为两步状态机：

```
idle → capturing → ocr_processing → text_ready → asking → answered
```

- `ocr_processing`：显示「识别中...」+ 旋转动画
- `text_ready`：显示 OCR 文字 + 问题输入框 + 发送按钮
- `asking`：显示「AI 思考中...」
- `answered`：显示 AI 回答（用 AIResponse 组件渲染 Markdown）

OCR 进度条精度（任务 5）：在 `ocr_processing` 状态下优化进度条显示，与 PaddleOCR 服务的实际处理阶段对齐。

---

## 3. AI 回复 Markdown 渲染（任务 4）

### 3.1 方案

引入 `react-markdown` + `remark-gfm` 插件。创建通用 `<AIResponse>` 组件，所有 AI 文字输出统一使用。

### 3.2 组件接口

```tsx
interface AIResponseProps {
  content: string;        // AI 返回的 Markdown 文本
  className?: string;     // 外层样式
}
```

### 3.3 影响范围

以下位置的 AI 输出需替换为 `<AIResponse>`：

| 位置 | 当前展示方式 |
|------|-------------|
| QA 反馈 | 纯文本 |
| 测试评分反馈 | 纯文本 |
| 复习评分反馈 | 纯文本 |
| 截图问AI回答 | 纯文本 |
| 学习笔记 | 纯文本 |
| 读前指引 | 纯文本 |

### 3.4 样式

使用 Tailwind `prose` 类（`@tailwindcss/typography` 插件）统一 Markdown 排版。暗色模式用 `prose-invert`。

---

## 4. 评分后显示正确答案（任务 6）

### 4.1 当前状态

- 复习：`review_questions` 表有 `correct_answer` 和 `explanation` 字段，出题时 AI 生成并写入
- 测试：`test_questions` 表有类似字段
- **测试 submit API 已经返回** `correct_answer` 和 `explanation`（在 results 数组中），只需前端展示
- **复习 respond API 未返回**这些字段，需要后端修改

### 4.2 变更

**复习 respond API**（`POST /api/review/[scheduleId]/respond`）：

响应增加字段（注意：实际响应使用 `data` 信封，字段名为 `ai_feedback` 而非 `feedback`）：
```json
{
  "data": {
    "is_correct": true,
    "score": 8,
    "ai_feedback": "AI 反馈...",
    "correct_answer": "正确答案文本",
    "explanation": "答案解析文本",
    "has_next": true,
    "next_question": { ... }
  }
}
```

实现：respond 逻辑中，从 review_questions 表查出 correct_answer 和 explanation，加入响应。

**测试 submit API**（`POST /api/modules/[moduleId]/test/submit`）：

**无需后端修改**——已返回 correct_answer 和 explanation。只需前端读取并展示。

### 4.3 前端变更

评分反馈展示区域增加：
- 「正确答案」区块（绿色背景/边框区分）
- 「解析」区块（用 AIResponse 组件渲染 Markdown）
- 展示顺序：用户答案 → AI 评分反馈 → 正确答案 → 解析

---

## 5. 书级仪表盘（任务 7）

### 5.1 路由

`/books/[bookId]/dashboard`

### 5.2 API

**新增：`GET /api/books/[bookId]/dashboard`**

响应：
```json
{
  "book": {
    "id": 1,
    "title": "书名",
    "totalModules": 10,
    "completedModules": 6
  },
  "modules": [
    {
      "id": 1,
      "title": "模块名",
      "orderIndex": 1,
      "learningStatus": "completed",
      "qaProgress": { "total": 8, "answered": 8 },
      "testScore": 85,
      "testPassed": true
    }
  ],
  "reviewsDue": [
    {
      "scheduleId": 1,
      "moduleId": 1,
      "moduleTitle": "模块名",
      "dueDate": "2026-04-05",
      "round": 2,
      "isOverdue": false
    }
  ],
  "recentTests": [
    {
      "moduleId": 1,
      "moduleTitle": "模块名",
      "score": 85,
      "passed": true,
      "completedAt": "2026-04-01T10:00:00"
    }
  ],
  "mistakesSummary": {
    "total": 12,
    "byType": {
      "blind_spot": 4,
      "procedural": 3,
      "confusion": 3,
      "careless": 2
    }
  }
}
```

实现：一个聚合查询端点，从 modules、review_schedule、test_papers、mistakes 四张表查询，按 bookId 过滤。

### 5.3 UI 板块

```
┌─────────────────────────────────────────────┐
│ 📖 [书名]                                   │
│ 整体进度：████████░░ 60%（6/10 模块完成）      │
├──────────────────────┬──────────────────────┤
│ 📋 学习进度           │ 🔄 待复习             │
│ 模块1 ✅ completed    │ 模块3 — 明天到期       │
│ 模块2 ✅ completed    │ 模块5 — 3天后          │
│ 模块3 📝 qa          │                      │
│ 模块4 ⬜ unstarted   │                      │
├──────────────────────┼──────────────────────┤
│ 📊 测试成绩           │ ❌ 错题快照            │
│ 模块1: 85分 ✅        │ 共 12 题              │
│ 模块2: 70分 ❌        │ 盲点4 程序3 混淆3 粗心2│
│                      │ [查看错题本 →]         │
└──────────────────────┴──────────────────────┘
```

- 学习进度：每个模块显示状态图标 + 名称，点击可跳转到该模块
- 待复习：按到期时间排序，过期的红色高亮，点击进入复习 session
- 测试成绩：最近测试结果，通过绿色/未通过红色
- 错题快照：总数 + 按类型分布，点击跳转错题本

### 5.4 入口

- 首页 (`/`) 书目卡片增加「仪表盘」按钮
- 书详情页 (`/books/[bookId]`) 顶部增加入口

---

## 6. 错题本（任务 8）

### 6.1 路由

`/books/[bookId]/mistakes`

### 6.2 API

**新增：`GET /api/books/[bookId]/mistakes`**

查询参数：
- `module`（可选）：按模块过滤
- `errorType`（可选）：按错误类型过滤（blind_spot/procedural/confusion/careless）
- `source`（可选）：按来源过滤（test/review）

响应：
```json
{
  "mistakes": [
    {
      "id": 1,
      "moduleTitle": "模块名",
      "questionText": "题目内容",
      "userAnswer": "用户答案",
      "correctAnswer": "正确答案",
      "errorType": "blind_spot",
      "diagnosis": "AI 诊断文本",
      "remedy": "AI 补救建议",
      "source": "test",
      "kpTitle": "关联知识点名称",
      "createdAt": "2026-04-01T10:00:00"
    }
  ],
  "summary": {
    "total": 12,
    "byType": { "blind_spot": 4, "procedural": 3, "confusion": 3, "careless": 2 },
    "byModule": [{ "moduleId": 1, "moduleTitle": "模块名", "count": 5 }]
  }
}
```

实现：JOIN mistakes + knowledge_points + modules 表，按 bookId（通过 modules.book_id）过滤。

### 6.4 Schema 变更

mistakes 表新增 3 列：

```sql
ALTER TABLE mistakes ADD COLUMN question_text TEXT;
ALTER TABLE mistakes ADD COLUMN user_answer TEXT;
ALTER TABLE mistakes ADD COLUMN correct_answer TEXT;
```

均为可空（已有数据不受影响）。新写入的错题必须填充这三个字段。

**写入时机**（修改现有 INSERT 逻辑）：
- `test/submit`（source='test'）：从 test_questions + test_responses 获取题目、用户答案、正确答案
- `review/respond`（source='review'）：从 review_questions + 用户提交的答案获取

### 6.3 UI

- 顶部：错题总数 + 过滤栏（模块下拉、错误类型标签、来源标签）
- 列表：每张错题卡片展示题目、用户答案 vs 正确答案、错误类型标签、AI 诊断和补救建议
- 诊断和补救用 `<AIResponse>` 组件渲染 Markdown
- 按时间倒序排列

---

## 7. 变更清单

### 新增文件

| 文件 | 角色 | 说明 |
|------|------|------|
| `src/app/api/books/[bookId]/screenshot-ocr/route.ts` | Codex | OCR-only API |
| `src/app/api/books/[bookId]/dashboard/route.ts` | Codex | 仪表盘聚合 API |
| `src/app/api/books/[bookId]/mistakes/route.ts` | Codex | 书级错题 API |
| `src/components/AIResponse.tsx` | Gemini | 通用 Markdown 渲染组件 |
| `src/app/books/[bookId]/dashboard/page.tsx` | Gemini | 仪表盘页面 |
| `src/app/books/[bookId]/mistakes/page.tsx` | Gemini | 错题本页面 |

### 修改文件

| 文件 | 角色 | 变更 |
|------|------|------|
| `src/app/api/books/[bookId]/screenshot-ask/route.ts` | Codex | 改为接收 image+text+question，移除硬编码 prompt，改用 getPrompt() |
| `src/app/api/review/[scheduleId]/respond/route.ts` | Codex | 响应增加 correct_answer + explanation；mistakes INSERT 增加三字段 |
| `src/app/api/modules/[moduleId]/test/submit/route.ts` | Codex | mistakes INSERT 增加 question_text/user_answer/correct_answer 三字段 |
| `src/lib/prompt-templates/seed-templates.ts` | Codex | assistant prompt 改中文 + 语言匹配指令 |
| `src/lib/db.ts` | Codex | mistakes 表 schema 增加 3 列 |
| `src/app/books/[bookId]/reader/AiChatDialog.tsx` | Gemini | 截图流程改两步状态机（核心组件） |
| `src/app/books/[bookId]/reader/page.tsx` | Gemini | 配合 AiChatDialog 改动 |
| `src/app/page.tsx` | Gemini | 书目卡片加仪表盘入口 |
| 所有 AI 输出展示组件 | Gemini | 替换为 AIResponse 组件 |

### 新增依赖

| 包 | 用途 |
|----|------|
| `react-markdown` | Markdown 渲染 |
| `remark-gfm` | GitHub 风格 Markdown（表格、删除线等） |
| `@tailwindcss/typography` | prose 排版样式 |

---

## 8. 与 architecture.md 的关系

### 新增页面路由
```
/books/[bookId]/dashboard   (新)
/books/[bookId]/mistakes    (新)
```

### 新增 API
```
books/[bookId]/screenshot-ocr   (新)
books/[bookId]/dashboard        (新)
books/[bookId]/mistakes         (新)
```

### 修改的接口契约

- screenshot-ask：入参改为 image+text+question（三参数），hardcoded prompt 迁移到模板系统
- review/respond：响应增加 correct_answer + explanation
- test/submit：无响应变更（已返回），但 mistakes INSERT 增加三字段
- mistakes 表：新增 question_text, user_answer, correct_answer 三列

里程碑完成后需同步更新 architecture.md 中的系统总图（页面、API 组）和接口契约。

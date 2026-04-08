# UX 重设计 — 最终 Design Spec

> Chain 文件：`docs/superpowers/specs/2026-04-07-ux-redesign-chain.md`
> Design Tokens：`docs/superpowers/specs/design-tokens.md`
> Stitch HTML：`wireframe/stitch/code/*.html`（11 个文件）

---

## 1. 概览

### 范围

| 纳入 | 说明 |
|------|------|
| DESIGN.md 输出 | Stitch 9 段标准格式，所有页面实现的基础 |
| 11 页视觉重设计 | 应用 Amber Companion 设计系统 |
| Action Hub 合并 | module-map + dashboard → `/books/[bookId]` |
| 测试页跳题/Flag/导航 | 纯前端改造，后端零改动 |
| 复习 briefing 屏 | 1 个新 GET 端点 + 前端启动屏 |
| Tailwind v4 token 注入 | `globals.css` 的 `@theme` 配置 |
| 侧栏简化 | 三层 → 单层 |

### 不做（延后）

| 项目 | 原因 |
|------|------|
| 忘记密码 | 需邮件基础设施（Resend/SendGrid），难以反悔的选型 |
| 邮箱验证页 | 依赖忘记密码的邮件基础设施 |
| PDF 阅读器视觉重做 | M6 已替换为 react-pdf-viewer，功能已解决，视觉后续迭代 |

### 目标

- 从"程序员做的工具"升级为"有设计感的学习产品"
- 减少页面跳转（3 页合 1）
- 为 Stitch MCP 工作流打通最后一环（DESIGN.md → 一键重新生成）

### 产品不变量检查

| 不变量 | 新设计如何保证 |
|--------|--------------|
| #1 必须读完原文才能进 QA | Split Panel 学习流程不变（guide→reading→qa），无跳过按钮 |
| #2 QA 已答不可修改 | QASession 核心逻辑不变，只改 UI 布局 |
| #3 测试禁看笔记/QA | Exam Mode 全屏无侧栏，**Stitch 生成的 hint 必须删除** |
| #4 80% 过关硬规则 | test/submit 后端逻辑不变 |
| #5 一次一题+即时反馈 | QA 保持一题一答，反馈改为底部滑出面板（题目仍可见） |

---

## 2. 设计系统基础

### 2.1 DESIGN.md

基于 `design-tokens.md` 已有内容，按 Stitch 标准 9 段格式输出一份 `DESIGN.md`：

| 章节 | 内容来源 |
|------|---------|
| Visual Theme | chain 文件"暖橙色调 + cream 背景"描述 |
| Color Palette | design-tokens.md 全部颜色 token（30+） |
| Typography | Plus Jakarta Sans (headline/label) + Be Vietnam Pro (body)，完整层级表 |
| Component Stylings | 从 Stitch HTML 提取：按钮、卡片、输入框、badge、进度条样式 |
| Layout Principles | chain 文件设计决策：Split Panel、Action Hub、全屏 Exam |
| Depth & Elevation | design-tokens.md 阴影系统（5 级） |
| Do's & Don'ts | 审阅报告中的删除项：无游戏化、无 MVP 外功能、名字统一 |
| Responsive Behavior | 侧栏 240px 固定 + 移动端 overlay；测试页全屏无侧栏 |
| Agent Prompt Guide | Gemini 实现指引：用 Tailwind 类名引用 token，不硬编码颜色值 |

文件位置：`DESIGN.md`（项目根目录，Stitch MCP 可直接读取）

### 2.2 Tailwind v4 Token 注入

项目使用 Tailwind v4（CSS 配置），当前 `globals.css`：

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}
```

改为：

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

@theme inline {
  /* === Core Colors === */
  --color-primary: #a74800;
  --color-primary-container: #ff7a23;
  --color-primary-fixed: #ff7a23;
  --color-primary-fixed-dim: #f06c0b;
  --color-primary-dim: #943f00;
  --color-on-primary: #ffffff;
  --color-on-primary-container: #3f1700;

  /* === Secondary === */
  --color-secondary: #9b5100;
  --color-secondary-container: #ffc69d;
  --color-on-secondary: #ffffff;
  --color-on-secondary-container: #703900;

  /* === Tertiary === */
  --color-tertiary: #845d00;
  --color-tertiary-container: #febb28;
  --color-tertiary-fixed: #febb28;
  --color-tertiary-fixed-dim: #efad16;
  --color-on-tertiary: #ffffff;
  --color-on-tertiary-container: #563b00;

  /* === Error === */
  --color-error: #be2d06;
  --color-error-container: #f95630;
  --color-on-error: #ffffff;
  --color-on-error-container: #520c00;

  /* === Surface === */
  --color-surface: #fffbff;
  --color-surface-container-lowest: #ffffff;
  --color-surface-container-low: #fefae8;
  --color-surface-container: #f8f4e2;
  --color-surface-container-high: #f2eedb;
  --color-surface-container-highest: #ece9d4;
  --color-surface-variant: #ece9d4;
  --color-surface-dim: #e7e3ce;

  /* === On Surface === */
  --color-on-surface: #39382d;
  --color-on-surface-variant: #666558;
  --color-outline: #838174;
  --color-outline-variant: #bcb9ab;
  --color-inverse-surface: #0f0f06;
  --color-inverse-primary: #f77113;

  /* === Fonts === */
  --font-headline: "Plus Jakarta Sans", sans-serif;
  --font-body: "Be Vietnam Pro", sans-serif;
  --font-label: "Plus Jakarta Sans", sans-serif;

  /* === Border Radius === */
  --radius: 1rem;
  --radius-lg: 2rem;
  --radius-xl: 3rem;
  --radius-full: 9999px;
}
```

Google Fonts 在 `layout.tsx` 的 `<head>` 中引入：
```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Be+Vietnam+Pro:wght@300;400;500;600&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet">
```

Token 使用示例：`bg-primary`、`text-on-surface`、`font-headline`、`rounded-lg`。

---

## 3. 逐页设计

### 3.1 Homepage（首页）

| 属性 | 值 |
|------|-----|
| **路由** | `/` |
| **当前文件** | `src/app/page.tsx` (server, 67L), `src/app/ReviewButton.tsx` (client, 88L) |
| **Stitch 参考** | `wireframe/stitch/code/homepage.html` |
| **API** | `GET /api/books`, `GET /api/review/due` |
| **后端变更** | 无 |

**布局**：
- 侧栏（Sidebar 全局导航）+ 内容区
- 顶部：产品名 + 用户 greeting
- **单书模式**（books.length === 1）：大号 hero 卡片（封面渐变 + 进度环 + "继续学习"按钮）
- **多书模式**（books.length > 1）：紧凑卡片网格（每张卡片显示书名 + 进度百分比 + 状态 badge）
- **空状态**：居中引导上传
- 待复习提醒融入 hero 卡片或独立行动提醒条

**组件树**：
```
page.tsx (server)
├── 顶栏（产品名 + greeting）
├── ReviewBanner（待复习提醒，融入页面顶部）
├── [单书] HeroBookCard（大号封面 + 进度环 + CTA）
├── [多书] BookGrid > BookCard[]（紧凑卡片）
└── [空] EmptyState（引导上传）
```

**审阅清理**：删 "Level 12 Researcher"、"Upgrade to Pro"、游戏化元素。

---

### 3.2 Action Hub（书首页 — 合并 module-map + dashboard）

| 属性 | 值 |
|------|-----|
| **路由** | `/books/[bookId]` |
| **当前文件** | `src/app/books/[bookId]/page.tsx` (72L), `ProcessingPoller.tsx` (146L), `ModuleMap.tsx` (136L), `module-map/page.tsx` (407L), `dashboard/page.tsx` (302L) |
| **Stitch 参考** | `wireframe/stitch/code/action-hub.html` |
| **API** | `GET /api/books/[bookId]/dashboard`（已返回全部数据）, `GET /api/books/[bookId]/status`（OCR 阶段） |
| **后端变更** | 无 |

**布局**（parse_status=done 时）：
- **Hero CTA 区**：进度环（`completedModules/totalModules`）+ "继续学习 [模块名]" 大按钮 + 进度摘要
  - "继续学习"目标 = `modules` 数组中第一个 `learningStatus !== 'completed'` 的模块（前端 derive）
- **行动提醒卡片**（横排 2 张）：
  - "X 个复习待完成" ← `reviewsDue.length`，点击跳转第一个到期的复习
  - "X 道错题" ← `mistakesSummary.total`，点击跳转 `/books/[bookId]/mistakes`
- **模块状态网格**：卡片网格，每张显示：
  - 模块名 + 序号
  - 状态 badge（未开始/阅读中/QA/测试中/已完成）用语义色
  - QA 进度（如 "5/12"）或测试分数
  - 点击跳转 `/books/[bookId]/modules/[moduleId]`
- 底部折叠区：最近考试成绩（可选，默认折叠）

**布局**（parse_status=processing 时）：
- 显示 ProcessingPoller（视觉更新为 Amber 风格进度条，逻辑不变）

**布局**（parse_status=error 时）：
- 错误提示卡片 + 重试按钮（现有逻辑，视觉更新）

**组件树**：
```
page.tsx (server) — 查 book + parse_status
├── [processing] ProcessingPoller（改造视觉）
├── [error] ErrorCard
└── [done] ActionHub (client)
    ├── HeroCTA（进度环 + 继续学习按钮）
    ├── ActionCards（复习提醒 + 错题提醒）
    ├── ModuleGrid > ModuleCard[]（状态网格）
    └── [折叠] RecentTests
```

**数据来源映射**：
| UI 元素 | dashboard API 字段 |
|---------|-------------------|
| 进度环百分比 | `book.completedModules / book.totalModules` |
| 继续学习目标 | `modules[].learningStatus` → 前端找第一个非 completed |
| 复习提醒数 | `reviewsDue.length` |
| 错题数 | `mistakesSummary.total` |
| 模块卡片状态 | `modules[].learningStatus` |
| 模块 QA 进度 | `modules[].qaProgress.answered / total` |
| 模块测试分 | `modules[].testScore` |
| 最近考试 | `recentTests[]` |

**路由重定向**：
- `GET /books/[bookId]/module-map` → 301 redirect → `/books/[bookId]`
- `GET /books/[bookId]/dashboard` → 301 redirect → `/books/[bookId]`

实现方式：在 `module-map/page.tsx` 和 `dashboard/page.tsx` 中替换为 `redirect()` 调用。

---

### 3.3 Split Panel（Q&A / 模块学习 / 复习共享布局）

这是一个**共享布局组件**，被 3 个页面复用。

**布局结构**：
```
┌──────────────────────────────────────────────┐
│ 面包屑：书名 > 模块 N > [阶段名]              │
├──────────┬───────────────────────────────────┤
│ KP 列表   │ 内容区                              │
│ (240px)  │                                     │
│          │ [题目/阅读/指引 内容]                  │
│ ● KP 1 ✓ │                                     │
│ ● KP 2 → │                                     │
│ ● KP 3   │                                     │
│ ● KP 4   │                                     │
│          ├─────────────────────────────────────┤
│          │ 反馈面板（底部 40%，答题后滑出）        │
│ [折叠]   │                                     │
├──────────┴─────────────────────────────────────┤
│ 底部操作栏：[上一题] 进度 3/12 [提交/下一题]       │
└────────────────────────────────────────────────┘
```

**SplitPanelLayout.tsx** props：
```typescript
interface SplitPanelProps {
  breadcrumbs: { label: string; href?: string }[]
  knowledgePoints: { id: number; code: string; name: string; status: 'done' | 'current' | 'pending' }[]
  onKpClick?: (kpId: number) => void
  children: React.ReactNode          // 右侧内容区
  feedbackSlot?: React.ReactNode     // 底部反馈面板（答题后出现）
  footerSlot?: React.ReactNode       // 底部操作栏
}
```

**KP 列表**：
- 每个 KP 显示：状态圆点（emerald=done, orange=current, gray=pending）+ KP code + 名称
- 点击 KP 跳转到对应题目（QA 模式）或对应段落（阅读模式）
- 可折叠按钮收起左栏，给内容区更多空间
- 移动端默认收起，顶部有按钮展开为 overlay

**反馈面板（FeedbackPanel.tsx）**：
- 答题后从底部滑出，占内容区高度的 40%
- 显示：正确/错误 badge + 分数 + AI 解析
- 使用 `<AIResponse>` 渲染 AI 内容
- "下一题"按钮在面板内
- 题目仍在上方可见（可对照）

---

### 3.4 Q&A Mode

| 属性 | 值 |
|------|-----|
| **路由** | `/books/[bookId]/modules/[moduleId]/qa` |
| **当前文件** | `qa/page.tsx` (63L), `qa/QASession.tsx` (301L) |
| **Stitch 参考** | `wireframe/stitch/code/qa-mode.html` |
| **API** | `GET /api/modules/[moduleId]/questions`, `POST /api/qa/[questionId]/respond` |
| **后端变更** | 无 |

使用 SplitPanelLayout 壳。右侧内容区：
- 顶部：题型 badge（Short Answer / Scaffolded MC / Worked Example / Comparison）+ 分段进度条
- 中部：题目文本（`<AIResponse>` 渲染）
- 底部输入：
  - Short Answer / Comparison → textarea
  - Scaffolded MC → 选项卡片
  - Worked Example → 分步输入
- 提交后 → FeedbackPanel 从底部滑出

**核心逻辑不变**：一题一答 + 即时反馈，已答不可改。只是 UI 从居中单列变成 Split Panel + 底部反馈。

**KP 状态推导**：QASession 以 question 粒度追踪进度（`responses` 按 question_id 记录）。每个 question 有 `kp_id` 字段。KP 列表状态按以下逻辑从 question 列表 derive：
- `done`：该 KP 关联的所有 question 都已有 response
- `current`：该 KP 关联的 question 中有一道是当前正在回答的
- `pending`：该 KP 关联的 question 全部未答
- 实现方式：从 `GET /api/modules/[moduleId]/questions` 返回的 question 列表中按 `kp_id` 分组，对照 `responses` 状态着色。不需要新 API。

**审阅清理**：删 "+15 XP"、"Key Term Mastery"、"Community" 图标。

---

### 3.5 Module Learning（指引 → 阅读 → QA → 笔记）

| 属性 | 值 |
|------|-----|
| **路由** | `/books/[bookId]/modules/[moduleId]` |
| **当前文件** | `page.tsx` (62L), `ModuleLearning.tsx` (363L) |
| **Stitch 参考** | `wireframe/stitch/code/qa-mode.html`（共享 Split Panel） |
| **API** | 现有全部 module API |
| **后端变更** | 无 |

同样使用 SplitPanelLayout 壳。右侧内容区根据 `learning_status` 切换：

| 阶段 | 右侧内容 | KP 列表状态 |
|------|---------|------------|
| `unstarted` → 指引 | AI 生成的读前指引（`<AIResponse>`） | 全灰 |
| `reading` | 原文文本 + 笔记输入 | 全灰 |
| `qa` | 跳转到 `/qa` 路由 | 根据答题进度着色 |
| `notes_generated` | AI 生成的学习笔记 + "进入测试"按钮 | 全绿 |
| `testing` / `completed` | 已完成提示 + 测试/错题入口 | 全绿 |

---

### 3.6 Exam Mode（测试页）

| 属性 | 值 |
|------|-----|
| **路由** | `/books/[bookId]/modules/[moduleId]/test` |
| **当前文件** | `test/page.tsx` (107L), `test/TestSession.tsx` (483L) |
| **Stitch 参考** | `wireframe/stitch/code/test-exam.html` |
| **API** | `POST /api/modules/[moduleId]/test/generate`（返回全部题目）, `POST /api/modules/[moduleId]/test/submit`（批量提交） |
| **后端变更** | 无（test/generate 已返回全部题目，test/submit 已支持批量） |

**布局**：全屏无侧栏。SidebarLayout 增加路由判断：

```typescript
// SidebarLayout.tsx
const isExamMode = pathname.includes('/test')
if (pathname === '/login' || pathname === '/register' || isExamMode) {
  return <>{children}</>
}
```

**结构**：
```
┌──────────────────────────────────────────────┐
│ 顶栏：EXAM MODE badge │ 模块名 │ 计时器 │ 交卷 │
├──────────────────────────────────────────────┤
│                                              │
│ 题目区（居中 max-w-3xl）                       │
│ 题型 badge + 题目文本                          │
│ 选项卡片 / 输入框                              │
│                                              │
├──────────────────────────────────────────────┤
│ QuestionNavigator：                          │
│ [1●] [2●] [3○] [4○] [5🚩] ... [10○] [检查页] │
└──────────────────────────────────────────────┘
```

**交互模型（vs 当前）**：

| 维度 | 当前 | 新设计 |
|------|------|--------|
| 答题顺序 | 强制顺序 | **自由跳题** |
| 提交方式 | 每题单独提交 | **全部答完后批量提交** |
| 导航 | 无 | **底部数字导航条** |
| 标记 | 无 | **Flag for Review**（🚩） |
| 进度保存 | 不保存 | **localStorage 暂存答案**（刷新不丢） |
| 检查页 | 无 | **交卷前检查页**（未答题 / 已标记题汇总） |
| 计时器 | 无 | **显示用时**（不强制限时） |

**数字导航条（QuestionNavigator.tsx）**：
- 每题一个圆点/方块
- 状态色：已答 = `primary-fixed-dim`（橙），未答 = `surface-variant`（灰），当前 = `tertiary-container`（金），已标记 = 🚩 图标
- 点击跳转到对应题目

**Flag 状态**：React state + localStorage，不持久化到后端。

**答案暂存**：`localStorage.setItem(`test_${paperId}_answers`, JSON.stringify(answers))`，每次答题自动保存，交卷后清除。

**paperId 可用时机**：`paperId` 来自两个途径：(1) 服务端 props `inProgressPaperId`（已有未完成试卷时），(2) `POST test/generate` 返回的 `data.paper_id`（新生成时）。localStorage 读取必须在 paperId 确定后执行，否则 key 为 undefined 导致答案丢失。

**test/submit 响应格式**（供 Gemini 参考）：
```json
{
  "success": true,
  "data": {
    "paper_id": number,
    "total_score": number,       // 0-100 整数
    "pass_rate": number,         // 0-100 整数（非 0-1 浮点）
    "is_passed": boolean,
    "results": [{ "question_id": number, "is_correct": boolean, "score": number, ... }]
  }
}
```

**检查页**：交卷按钮点击后显示：
- 已答 N/M 题
- 未答题号列表（可点击跳转）
- 已标记题号列表（可点击跳转）
- "确认交卷" / "返回检查" 按钮

**提交**：确认交卷 → `POST test/submit` → 显示成绩（pass/fail + 分数 + 错题列表），UI 与当前结果展示类似但用 Amber 风格。

**产品不变量 #3 强制**：
- 无侧栏（已通过 SidebarLayout 路由判断移除）
- **无 hint 按钮**（Stitch HTML 中有，必须删）
- 无笔记/QA 入口

---

### 3.7 Mistake Notebook（错题本）

| 属性 | 值 |
|------|-----|
| **路由** | `/books/[bookId]/mistakes`（书级）, `/books/[bookId]/modules/[moduleId]/mistakes`（模块级） |
| **当前文件** | `books/[bookId]/mistakes/page.tsx` (264L), `modules/[moduleId]/mistakes/page.tsx` (206L) |
| **Stitch 参考** | `wireframe/stitch/code/mistakes.html` |
| **API** | `GET /api/books/[bookId]/mistakes`, `GET /api/modules/[moduleId]/mistakes` |
| **后端变更** | 无 |

两个页面共享一套视觉风格，区别在于数据范围。

**布局**：
- 顶部筛选栏：模块下拉（仅书级）+ 错误类型 tag 筛选 + 来源 tag 筛选 + "只看未解决" toggle
- 错题卡片列表：
  - 卡片头部：错误类型 badge + 来源 badge + 日期
  - 题目文本
  - 答案对比（你的回答 vs 正确答案，红/绿双栏）
  - AI 诊断与补救建议（可展开/折叠）
- 空状态：庆祝图标 + "没有错题"

**审阅清理**：删 "The Illuminated Companion" 导航、"+ Add Mistake" 按钮。

---

### 3.8 Review（复习启动屏 + 答题中）

| 属性 | 值 |
|------|-----|
| **路由** | `/books/[bookId]/modules/[moduleId]/review?scheduleId=X` |
| **当前文件** | `review/page.tsx` (25L), `review/ReviewSession.tsx` (400L) |
| **Stitch 参考** | `wireframe/stitch/code/review-start.html`, `review-session.html` |
| **API** | **新增** `GET /api/review/[scheduleId]/briefing`, 现有 `POST review/generate`, `POST review/respond`, `POST review/complete` |
| **后端变更** | 1 个新 GET 端点 |

**两阶段 UI**：

**阶段 1：Briefing 屏（ReviewBriefing.tsx）**

调用 `GET /api/review/[scheduleId]/briefing` 获取数据，显示：
- 轮次信息："第 N 轮复习 · 间隔 X 天"
- 模块名
- 预估题数
- Mastery Distribution：KP 掌握分布图（P=1 mastered/绿, P=2 improving/蓝, P=3-4 weak/橙）
- 上次复习："X 天前完成"
- "开始复习" 大按钮

**阶段 2：答题中**

使用 SplitPanelLayout 壳（与 QA Mode 相同），复用 FeedbackPanel。

**审阅清理**：删 "Flashcards"、"Resources" 导航。

---

### 3.9 Login + Register

| 属性 | 值 |
|------|-----|
| **路由** | `/login`, `/register` |
| **当前文件** | `(auth)/login/page.tsx` (106L), `(auth)/register/page.tsx` (125L) |
| **Stitch 参考** | `login.html`, `register.html` |
| **API** | 现有 auth API |
| **后端变更** | 无 |

**共同改动**：
- 背景色：`surface-container-low`（cream）
- 卡片：白色 `rounded-xl`，Amber 阴影
- 按钮：`amber-glow` 渐变
- Logo：产品图标（替换 "RK"）
- **全部文案改中文**（当前全英文）
- 输入框：`rounded-lg border-outline-variant focus:ring-primary`

**Register 额外**：
- 邀请码支持 URL 参数 `?code=XXX` 自动填充
- 有邀请码时显示 badge "邀请码已激活"

---

## 4. 侧栏重设计

### 当前实现

`Sidebar.tsx` (343L)：三层导航
- L1: 首页、上传（全局）
- L2: 阅读原文、模块地图、仪表盘、错题本（书级，在 `/books/[bookId]` 下展开）
- L3: 学习、Q&A、测试、错题诊断（模块级，在 `/modules/[moduleId]` 下展开）

### 新设计

只保留 L1 全局导航：

```
┌─────────────────┐
│ [Logo] AI 教材精学 │
├─────────────────┤
│ 🏠 首页           │
│ ☁️ 上传教材        │
├─────────────────┤
│                 │
│  （留白）         │
│                 │
├─────────────────┤
│ 📊 系统日志       │
│ 🚪 退出登录       │
└─────────────────┘
```

- 固定宽度 240px，不支持折叠（简化代码，减少状态管理）
- 移动端（<1024px）：隐藏，汉堡菜单触发 overlay
- Logo 使用 `amber-glow` 渐变圆角方块 + 白色 "AI" 文字
- 图标使用 Material Symbols Outlined（与 Stitch 一致）
- `SidebarLayout.tsx` 增加测试页豁免：`pathname.includes('/test')` 时不渲染侧栏

**删除的代码**：
- L2 书级导航（阅读/模块地图/仪表盘/错题）→ 由 Action Hub 承担
- L3 模块级导航（学习/QA/测试/错题）→ 由 Split Panel 面包屑承担
- 模块列表加载逻辑（`fetchModules`）
- 折叠状态管理（`isCollapsed` + localStorage）
- SidebarProvider 简化（删除 `isCollapsed` state）

---

## 5. API 变更

### 新增：`GET /api/review/[scheduleId]/briefing`

```
请求：GET /api/review/[scheduleId]/briefing
认证：requireUser → requireReviewScheduleOwner

响应 200：
{
  "success": true,
  "data": {
    "scheduleId": number,
    "moduleId": number,
    "moduleName": string,
    "reviewRound": number,           // 第几轮
    "intervalDays": number,          // 本轮间隔天数（3/7/15/30/60）
    "estimatedQuestions": number,    // 预估题数
    "lastReviewDaysAgo": number | null,  // 上次复习距今天数，首轮为 null
    "masteryDistribution": {
      "mastered": number,   // P=1 的 cluster 数
      "improving": number,  // P=2
      "weak": number        // P=3-4
    },
    "clusters": {
      "id": number,
      "name": string,
      "currentP": number,
      "kpCount": number
    }[]
  }
}

响应 404：schedule 不存在或不属于当前用户
```

**数据来源**：
- `review_schedule.review_round` → `reviewRound`
- 硬编码间隔 `[3,7,15,30,60]` + `round` → `intervalDays`
- `buildAllocations()` 逻辑（已存在于 `review/generate/route.ts`）→ `estimatedQuestions`
- `clusters.current_p_value` → `masteryDistribution` + `clusters[]`
- 查上一轮 completed schedule → `lastReviewDaysAgo`
- JOIN `modules` → `moduleName`
- **无 schema 变更**

**Codex 实现注意**：`buildAllocations()` 函数当前是 `review/[scheduleId]/generate/route.ts` 的局部函数（未导出）。briefing 端点需要复用此逻辑计算 `estimatedQuestions`。Codex 应将 `buildAllocations()` 提取到 `src/lib/review-question-utils.ts`（该文件已有 `normalizeReviewErrorType`），然后在 generate 和 briefing 两个 route 中共同引用。

---

## 6. 路由变更汇总

| 当前路由 | 操作 | 说明 |
|---------|------|------|
| `/` | 重写 | Hero 卡片 |
| `/books/[bookId]` | 重写 | Action Hub |
| `/books/[bookId]/module-map` | **删除 → redirect** | `redirect('/books/${bookId}')` |
| `/books/[bookId]/dashboard` | **删除 → redirect** | `redirect('/books/${bookId}')` |
| `/books/[bookId]/reader` | 不变 | 本次不动 |
| `/books/[bookId]/modules/[moduleId]` | 重写 | Split Panel |
| `/books/[bookId]/modules/[moduleId]/qa` | 重写 | Q&A Mode |
| `/books/[bookId]/modules/[moduleId]/test` | 重写 | Exam Mode |
| `/books/[bookId]/modules/[moduleId]/review` | 重写 | Briefing + Session |
| `/books/[bookId]/modules/[moduleId]/mistakes` | 视觉重写 | Amber 风格 |
| `/books/[bookId]/mistakes` | 视觉重写 | Amber 风格 |
| `/login` | 视觉重写 | Amber + 中文 |
| `/register` | 视觉重写 | Amber + 中文 |

---

## 7. 组件变更清单

### 新建

| 组件 | 文件路径 | 职责 |
|------|---------|------|
| ActionHub | `src/app/books/[bookId]/ActionHub.tsx` | 书落地页（Hero + 行动卡片 + 模块网格） |
| SplitPanelLayout | `src/components/SplitPanelLayout.tsx` | 共享壳（KP 侧栏 + 内容 + 反馈 + 底栏） |
| FeedbackPanel | `src/components/FeedbackPanel.tsx` | 底部滑出反馈面板 |
| QuestionNavigator | `src/components/QuestionNavigator.tsx` | 测试页数字导航条 |
| ReviewBriefing | `src/app/books/[bookId]/modules/[moduleId]/review/ReviewBriefing.tsx` | 复习启动屏 |
| ExamShell | `src/app/books/[bookId]/modules/[moduleId]/test/ExamShell.tsx` | 全屏考试容器 |

### 重写

| 组件 | 改动摘要 |
|------|---------|
| `page.tsx`（首页） | 灰蓝列表 → Amber hero 卡片 |
| `books/[bookId]/page.tsx` | 简单路由分发 → Action Hub 入口 |
| `QASession.tsx` | 居中单列 → Split Panel + FeedbackPanel |
| `TestSession.tsx` | 顺序答题 → 自由跳题 + Navigator + Flag + 批量提交 |
| `ReviewSession.tsx` | 直接答题 → Briefing + Split Panel |
| `ModuleLearning.tsx` | 居中单列 → Split Panel 壳 |
| `Sidebar.tsx` | 三层 343L → 单层 ~80L |
| `SidebarLayout.tsx` | 增加测试页路由豁免 |
| `globals.css` | 注入全部 Amber Companion token |
| `layout.tsx` | 引入 Google Fonts（使用 `next/font/google` 而非 `<link>` 标签，与现有 Geist 方式一致，避免 FOUT） |
| `login/page.tsx` | 蓝色英文 → Amber 中文 |
| `register/page.tsx` | 蓝色英文 → Amber 中文 + URL 邀请码 |
| `mistakes/page.tsx`（书级） | 蓝灰 → Amber 风格 + 更新 "返回仪表盘" 链接为 `/books/${bookId}` |
| `mistakes/page.tsx`（模块级） | 蓝灰 → Amber 风格 |

### 受路由重定向影响的文件（硬编码链接需更新）

以下文件包含指向 `/module-map` 或 `/dashboard` 的硬编码链接，虽然 301 redirect 可兜底，但应直接更新链接以避免多余跳转：

| 文件 | 当前链接 | 改为 |
|------|---------|------|
| `src/app/books/[bookId]/modules/[moduleId]/ModuleLearning.tsx` | `router.push('/books/${bookId}/module-map')` | `router.push('/books/${bookId}')` |
| `src/app/books/[bookId]/reader/PdfViewer.tsx` | `router.push('/books/${bookId}/module-map')` | `router.push('/books/${bookId}')` |
| `src/app/books/[bookId]/mistakes/page.tsx` | `<Link href={/books/${bookId}/dashboard}>` | `<Link href={/books/${bookId}}>` |
| `src/app/page.tsx`（首页） | `href={/books/${book.id}/dashboard}` | 首页整体重写，自然更新 |

> 注意：这些文件本身在 spec 中已列为"重写"或"视觉重写"，但明确列出链接更新避免遗漏。

### 删除

| 组件 | 原因 |
|------|------|
| `module-map/page.tsx` (407L) | 并入 Action Hub，路由改为 redirect |
| `dashboard/page.tsx` (302L) | 并入 Action Hub，路由改为 redirect |
| `ModuleMap.tsx` (136L) | 被 Action Hub 模块网格取代 |
| `SidebarProvider.tsx` 中 `isCollapsed` 逻辑 | 侧栏不再支持折叠 |
| `SidebarToggle.tsx` 桌面端折叠按钮 | 只保留移动端汉堡菜单功能 |

### 保留

| 组件 | 原因 |
|------|------|
| `ProcessingPoller.tsx` | OCR 阶段仍需要，仅改视觉 token |
| `AIResponse.tsx` | 纯渲染组件，不受视觉重设计影响 |
| `LoadingState.tsx` | 仅改视觉 token |

---

## 8. 审阅清理项汇总（来自第 2.5 次审阅报告）

### 全局

| 问题 | 处理方式 |
|------|---------|
| 游戏化元素（Level/XP/Streak/Daily Goal） | 所有页面实现时不做 |
| App 名字不统一（Illuminated Companion/Scholar/学伴/RK） | 统一为 **AI 教材精学老师** |
| 导航不统一（部分 icon-only，部分展开） | 统一展开 240px 带文字 |
| MVP 外功能（Community/Flashcards/Resources/Companion Insight） | 不做 |

### 逐页

| 页面 | 清理项 |
|------|--------|
| Homepage | 删 "Level 12 Researcher"、"Upgrade to Pro" |
| Action Hub | 删 "Companion Insight" 面板、"New Entry"、"View Syllabus" |
| Login | 换 logo（"RK" → 产品图标）、删英文 copyright |
| Register | 换 logo |
| Forgot Password | 顶部 "学伴 Companion" → 不做（整页延后） |
| Q&A Mode | 删 "+15 XP"、"Key Term Mastery"、"Community" 图标、侧栏改展开 |
| Exam Mode | **删底部 hint**（产品不变量 #3） |
| Mistakes | 删 "The Illuminated Companion" 导航、"+ Add Mistake" |
| Review Start | 删 "Flashcards"、"Resources" 导航 |
| Review Session | 同 Q&A：侧栏展开 + 删游戏化 |

---

## 9. 实施顺序（大方向）

| 批次 | 内容 | 执行者 | 依赖 |
|------|------|--------|------|
| **T0** | DESIGN.md + globals.css token 注入 + Google Fonts | Gemini | 无 |
| **T1** | Sidebar 简化 + SidebarLayout 测试页豁免 | Gemini | T0 |
| **T2** | Action Hub（合并 module-map + dashboard） | Gemini | T0, T1 |
| **T3** | SplitPanelLayout + FeedbackPanel（共享组件） | Gemini | T0 |
| **T4** | Q&A Mode（QASession 改造） | Gemini | T3 |
| **T5** | Module Learning（ModuleLearning 改造） | Gemini | T3 |
| **T6** | Exam Mode（TestSession 重写 + ExamShell + Navigator） | Gemini | T0, T1 |
| **T7** | Review briefing API | Codex | 无 |
| **T8** | Review（Briefing + Session 改造） | Gemini | T3, T7 |
| **T9** | Mistake Notebook 视觉更新（书级 + 模块级） | Gemini | T0 |
| **T10** | Login + Register 视觉重写 | Gemini | T0 |
| **T11** | Homepage 重写 | Gemini | T0, T1 |
| **T12** | 全局验证 + ProcessingPoller/LoadingState 视觉更新 + docs 更新（architecture.md 新 API + 路由变更 + changelog.md + project_status.md） | Claude | T0-T11 |

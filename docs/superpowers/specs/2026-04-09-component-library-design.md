# 组件库设计 Spec — 从 Stitch 提取积木块

> 日期：2026-04-09
> 状态：待确认
> 前置：UX Redesign 完成但视觉不达标，根因是 DESIGN.md 描述式规范无法约束实现

---

## 1. 问题与目标

### 问题

上一轮 UX Redesign 给 Gemini 的是描述式规范（DESIGN.md：token 名 + 文字说明），Gemini 把 Stitch HTML 当"灵感"自己写 CSS，导致最终效果与 Stitch 设计严重偏离。Code review 只查逻辑不看视觉，问题未被发现。

### 目标

从 Stitch HTML 中**逐字提取**组件代码，建立 React 组件库（`src/components/ui/`）。Gemini 拼装页面时只 import 组件，不自己写样式。

### 成功标准

- 每个页面打开后，肉眼看不出与 Stitch 截图的差异
- Gemini 的页面代码中不出现硬编码的 Tailwind 颜色/圆角/阴影类（全部来自组件）

---

## 2. 两层架构

```
┌─────────────────────────────────────────┐
│           页面（Page）                    │
│   import L1 通用组件 + L2 模式组件        │
│   只负责：数据获取、状态管理、组件拼装      │
└──────────┬──────────────┬───────────────┘
           │              │
    ┌──────▼──────┐ ┌────▼────────┐
    │  Layer 1    │ │  Layer 2    │
    │  通用地基    │ │  模式专用    │
    │  21 块      │ │  12 块      │
    │  全站复用    │ │  特定场景    │
    └─────────────┘ └─────────────┘
```

**Layer 1（通用地基）**：从 page0（style-tile）及跨页面共性中提取，所有页面都可使用。
**Layer 2（模式专用）**：从特定页面中提取该模式独有的组件，只在对应场景使用。

---

## 3. Layer 1 — 通用地基（21 块）

### 3.1 AppSidebar

- **来源**：page0 (style-tile.html) + page2 (action-hub.html)
- **关键 CSS**：`w-72 bg-gradient-to-r from-[#fefae8] to-[#fffbff] rounded-r-[32px] shadow-xl shadow-orange-900/5`，导航项 `flex items-center gap-3 p-3 rounded-xl hover:bg-primary/5`
- **用途**：首页、Action Hub、错题本、复习启动。**不用于** Q&A 和复习答题（这两个页面用 SplitPanel 内置的 KP 侧栏代替）、考试模式（全屏无侧栏）、登录/注册（无侧栏）
- **Props**：`activeRoute`, `bookTitle?`（书内页面显示书名）
- **注意**：始终展开带文字，不做 icon-only 收缩态。Stitch 的 qa-mode 和 mistakes 页面用了 icon-only 窄导航（w-20/w-[56px]），但之前 brainstorm 已决定统一为展开式，所以不提取窄版本

### 3.2 ContentCard

- **来源**：page0 (style-tile.html)
- **关键 CSS**：`bg-surface-container-lowest rounded-3xl p-8 shadow-[0_40px_40px_-15px_rgba(167,72,0,0.06)] border border-outline-variant/10`
- **用途**：通用卡片容器，全站使用
- **Props**：`children`, `className?`（允许扩展）

### 3.3 AmberButton

- **来源**：page0 (style-tile.html)
- **关键 CSS**：`amber-glow text-white font-bold py-4 px-8 rounded-full shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all`
- **Auth 页变体**：登录/注册页使用 `rounded-lg` 而非 `rounded-full`（login.html:131, register.html:152）
- **用途**：所有主要 CTA 按钮
- **Props**：`children`, `onClick`, `disabled?`, `fullWidth?`, `size?: 'sm' | 'md' | 'lg'`, `rounded?: 'full' | 'lg'`（默认 `'full'`）
- **渐变定义**：`.amber-glow { background: linear-gradient(135deg, #a74800 0%, #ff7a23 100%) }`

### 3.4 TextInput

- **来源**：page3 (login.html)
- **关键 CSS**：`w-full bg-surface-container-low border-none rounded-lg py-4 px-5 focus:ring-2 focus:ring-primary/20 focus:bg-surface-bright transition-all`
- **用途**：登录、注册、忘记密码表单
- **Props**：`label`, `placeholder`, `type`, `value`, `onChange`, `endIcon?`（如密码可见性切换）
- **依赖**：需要在 globals.css 中添加 `surface-bright` token（当前缺失）

### 3.5 Badge

- **来源**：page0 (style-tile.html)
- **关键 CSS**：`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider`
- **用途**：状态标记、分类标签
- **Props**：`children`, `variant: 'primary' | 'success' | 'error' | 'warning' | 'info'`
- **变体色**：primary → `bg-primary-container text-on-primary-container`，success → `bg-emerald-100 text-emerald-700`，error → `bg-error/10 text-error`，warning → `bg-tertiary-container/20 text-tertiary`

### 3.6 ProgressBar

- **来源**：page0 (style-tile.html)
- **关键 CSS**：容器 `h-2 w-full bg-surface-container rounded-full overflow-hidden`，填充 `h-full rounded-full transition-all`
- **用途**：书卡片进度、Q&A 进度、模块完成度
- **Props**：`value: number`（0-100），`color?: 'primary' | 'emerald' | 'blue'`

### 3.7 Breadcrumb

- **来源**：page2 (action-hub.html)
- **关键 CSS**：`flex items-center gap-2 text-on-surface-variant text-sm`，分隔符 `material-symbols-outlined text-xs chevron_right`
- **用途**：所有学习页面顶部导航路径
- **Props**：`items: { label: string, href?: string }[]`

### 3.8 UserAvatar

- **来源**：page0 (style-tile.html)
- **关键 CSS**：`w-10 h-10 rounded-full border-2 border-primary-container object-cover`
- **用途**：侧栏底部、顶栏右侧
- **Props**：`src?`, `name`（无图片时显示首字母）

### 3.9 GlassHeader

- **来源**：page6 (qa-mode.html) + review-session.html
- **关键 CSS**：`bg-surface-bright/80 backdrop-blur-xl`（qa-mode）或 `rgba(255,251,255,0.8) backdrop-filter: blur(24px)`（review-session），**无 shadow**，底部用 `border-b border-outline-variant/10` 分隔
- **用途**：Q&A、考试、复习的顶部栏
- **Props**：`children`（内容由各页面自定义）

### 3.10 KnowledgePointList

- **来源**：page6 (qa-mode.html) + review-session.html
- **关键 CSS**：列表项 `flex items-center gap-3 p-3 rounded-xl`，圆点 `w-2 h-2 rounded-full`（emerald=完成, gray=未开始）
- **当前项（两种配色）**：
  - Q&A 模式：`bg-blue-50 border border-blue-100/50 shadow-sm`，圆点 `bg-blue-500`，文字 `text-blue-900`
  - 复习模式：`bg-orange-100 ring-1 ring-primary/20`，圆点 `bg-orange-500 animate-pulse`
- **用途**：Q&A 左侧栏、复习左侧栏
- **Props**：`items: { name: string, status: 'done' | 'active' | 'pending', progress?: string }[]`, `onItemClick?`, `activeColor?: 'blue' | 'orange'`（默认 `'blue'`）

### 3.11 SegmentedProgress

- **来源**：page6 (qa-mode.html)
- **关键 CSS**：`flex gap-1.5 h-1.5`，每段 `flex-1 rounded-full`，颜色按状态：primary=已答, emerald=正确, error=错误, surface-container=未答
- **用途**：Q&A 顶部、考试顶部、复习顶部
- **Props**：`segments: { status: 'correct' | 'incorrect' | 'answered' | 'unanswered' | 'current' }[]`

### 3.12 StatusBadge

- **来源**：page1 (homepage.html)
- **关键 CSS**：`px-4 py-1.5 rounded-full`，Completed → `bg-emerald-100 text-emerald-700`，In Progress → `bg-primary-container/20 text-primary`，Not Started → `bg-surface-container text-on-surface-variant`
- **用途**：模块状态、书卡片状态
- **Props**：`status: 'completed' | 'in-progress' | 'not-started' | 'locked'`
- **与 Badge 的区别**：StatusBadge 是固定的学习状态语义，Badge 是通用标签

### 3.13 FormCard

- **来源**：page3 (login.html)
- **关键 CSS**：`bg-surface-container-lowest rounded-xl p-10 shadow-[0_40px_40px_0_rgba(167,72,0,0.06)] w-full max-w-[420px]`
- **用途**：登录、注册、忘记密码的表单容器
- **Props**：`children`, `title`, `subtitle?`

### 3.14 ProgressRing

- **来源**：page2 (action-hub.html)
- **关键 CSS**：SVG `w-40 h-40 viewBox="0 0 160 160"`（需补 viewBox，Stitch 原版遗漏），背景环 `stroke="currentColor" stroke-width="12" fill="none" opacity="0.1"`，进度环 `stroke-dasharray="440" stroke-dashoffset={440 - 440 * value / 100}`，中心文字 `text-3xl font-black font-headline`
- **用途**：Action Hub 进度展示
- **Props**：`value: number`（0-100），`label?: string`

### 3.15 FeedbackPanel

- **来源**：page6 (qa-mode.html) + review-session.html
- **Q&A 变体（qa-mode.html:250）**：`absolute bottom-0 left-0 w-full h-[40%] bg-emerald-50 border-t-4 border-emerald-500 shadow-[0_-20px_50px_rgba(0,0,0,0.05)] z-30 p-10`，纵向布局（标题 → 解析 → 下一题按钮）
- **复习变体（review-session.html:228）**：非 absolute，`bg-emerald-50 border-l-[6px] border-emerald-600 p-8 shadow-[0_-10px_30px_rgba(0,0,0,0.03)]`，横向 flex 布局（icon + 内容 + 按钮），按钮用 `bg-indigo-600`（非 amber-glow）
- **错误态**：`bg-red-50 border-t-4 border-error`（Q&A）/ `bg-red-50 border-l-[6px] border-error`（复习）
- **用途**：Q&A 即时反馈、复习即时反馈
- **Props**：`isCorrect: boolean`, `explanation: string`, `onNext: () => void`, `variant?: 'qa' | 'review'`（默认 `'qa'`）
- **动画**：Q&A 变体从底部滑入；复习变体原位渐显

### 3.16 StatCard

- **来源**：page1 (homepage.html)
- **关键 CSS**：大数字 `text-5xl font-black font-headline text-tertiary`，标签 `text-sm text-on-surface-variant`
- **用途**：首页待复习数、Action Hub 待复习/错题数、复习启动屏统计
- **Props**：`value: string | number`, `label: string`, `icon?: string`, `onClick?`

### 3.17 SplitPanel

- **来源**：page6 (qa-mode.html) + review-session.html
- **关键 CSS**：
  - Q&A 版：左栏 `w-[280px] bg-surface-container-low h-full flex flex-col z-30`（无 border-r，因为左边还有 AppSidebar），右栏 `flex-1 bg-surface overflow-y-auto`
  - 复习版：左栏 `w-[280px] bg-surface-container-low flex flex-col h-full border-r border-outline-variant/15`，右栏同上
- **用途**：Q&A 学习、复习答题、复习启动
- **Props**：`sidebar: ReactNode`, `content: ReactNode`, `feedbackSlot?: ReactNode`, `showBorder?: boolean`（默认 `true`）
- **注意**：替换现有 SplitPanelLayout.tsx

### 3.18 ChatBubble

- **来源**：page0 (style-tile.html)
- **关键 CSS**：用户消息 `bg-surface-container-lowest p-5 rounded-2xl rounded-tl-none`，AI 消息 `bg-primary/5 p-5 rounded-2xl rounded-tr-none border border-primary/10`
- **用途**：AI 对话界面
- **Props**：`role: 'user' | 'ai'`, `children`

### 3.19 FAB

- **来源**：page0 (style-tile.html)
- **关键 CSS**：`fixed bottom-24 right-8 w-16 h-16 bg-primary rounded-full shadow-[0_40px_40px_-15px_rgba(167,72,0,0.4)] hover:scale-110 active:scale-95 transition-transform`
- **用途**：首页上传按钮
- **Props**：`icon: string`, `onClick`, `label?: string`

### 3.20 DecorativeBlur

- **来源**：多个页面共有
- **关键 CSS**：`absolute w-96 h-96 bg-primary-container/10 rounded-full blur-3xl opacity-50 pointer-events-none`
- **用途**：全站背景氛围装饰
- **Props**：`position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'`

### 3.21 CourseCard

- **来源**：page0 (style-tile.html) + page1 (homepage.html) + Stitch Multi-Column Dashboard
- **关键 CSS**：`rounded-3xl shadow-course` + 渐变封面 `bg-gradient-to-br h-32` + 装饰图标（右上角放大 `text-[100px] text-black/[0.12]` + 左下角小图标 `text-white/50`），hover 用 `shadow-course-hover`
- **用途**：首页书目卡片
- **Props**：`title`, `progress: number`, `lastStudied?: string`, `badges?: { label: string; color: string }[]`, `gradient?: string`, `icon?: string`（学科图标，默认 menu_book）, `hoverStyle?: 'shadow' | 'pedestal'`, `onClick`, `className?`
- **hover**：外层 `<div className="relative group">`，shadow 模式 `group-hover:-translate-y-2 + 加深阴影`，pedestal 模式用椭圆 blur div
- **组合**：内部使用 ProgressBar

---

## 4. Layer 2 — 模式专用（12 块）

### 4.1 ExamTopBar

- **来源**：page7 (test-exam.html)
- **关键 CSS**：`fixed top-0 w-full z-50 bg-amber-50/80 backdrop-blur-xl shadow-[0_40px_40px_0_rgba(167,72,0,0.06)]`，EXAM MODE 标签 `bg-primary-container text-on-primary-container px-3 py-1 rounded-full text-xs font-bold font-label uppercase tracking-wider`
- **用途**：考试模式顶栏
- **Props**：`moduleTitle`, `currentQuestion`, `totalQuestions`, `onExit`
- **包含**：SegmentedProgress（L1）

### 4.2 MCOptionCard

- **来源**：page7 (test-exam.html)
- **关键 CSS**：默认 `w-full flex items-center gap-4 p-5 rounded-lg bg-surface-container hover:bg-surface-variant`，选中 `border-2 border-primary-fixed-dim bg-secondary-container/30`，字母圆 `w-10 h-10 rounded-full bg-surface-container-lowest border border-outline-variant flex items-center justify-center font-bold`
- **用途**：考试选择题、Q&A 选择题
- **Props**：`label: string`（A/B/C/D），`text: string`, `selected: boolean`, `onClick`, `showResult?: 'correct' | 'incorrect'`

### 4.3 QuestionNavigator

- **来源**：page7 (test-exam.html)
- **关键 CSS**：`fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-2xl shadow-[0_-8px_40px_rgba(167,72,0,0.08)] rounded-t-[32px]`，数字圆点：已答 `bg-primary-fixed-dim text-white`，当前 `ring-2 ring-primary`，未答 `bg-surface-container`，标记 `bg-tertiary-container`
- **用途**：考试模式底部导航
- **Props**：`questions: { status: 'answered' | 'current' | 'unanswered' | 'flagged' }[]`, `onSelect`, `onPrev`, `onNext`

### 4.4 FlagButton

- **来源**：page7 (test-exam.html)
- **关键 CSS**：`material-symbols-outlined` + `font-variation-settings: 'FILL' 1`（标记时填充），`text-tertiary`
- **用途**：考试模式标记题目
- **Props**：`flagged: boolean`, `onClick`

### 4.5 FilterBar

- **来源**：page8 (mistakes.html)
- **关键 CSS**：`bg-surface-container-low rounded-3xl p-6`，药片 `px-4 py-1.5 rounded-full text-sm font-semibold cursor-pointer`，选中 `bg-surface-container-lowest text-primary border border-primary/10 hover:bg-primary/5`，未选 `bg-surface-container-lowest text-on-surface-variant`
- **用途**：错题本筛选
- **Props**：`groups: { label: string, options: string[] }[]`, `selected: Record<string, string[]>`, `onChange`

### 4.6 MistakeCard

- **来源**：page8 (mistakes.html)
- **关键 CSS**：`bg-surface-container-lowest rounded-3xl p-8 shadow-[0_16px_48px_rgba(167,72,0,0.1)] border-l-[6px] border-error`，答案对比两列 `grid grid-cols-2 gap-6`，你的答案 `bg-error/5 rounded-2xl p-5`，正确答案 `bg-emerald-50 rounded-2xl p-5`
- **用途**：错题本展开态
- **Props**：`mistake: MistakeData`, `expanded: boolean`, `onToggle`, `onResolve`, `onPractice`
- **内部组合**：AIInsightBox（L2）

### 4.7 BriefingCard

- **来源**：page9 (review-start.html)
- **关键 CSS**：`bg-surface-container-lowest rounded-3xl p-10 shadow-[0_40px_80px_-30px_rgba(167,72,0,0.08)]`，统计格 `grid grid-cols-2 gap-6`，每格数字 `text-xl font-extrabold text-on-surface font-headline`
- **用途**：复习启动屏
- **Props**：`questions: number`, `estTime: string`, `lastReview: string`, `schedule: string`, `round: number`, `onStart`
- **内部组合**：AmberButton（L1）、MasteryBars（L2）

### 4.8 MasteryBars

- **来源**：page9 (review-start.html)
- **关键 CSS**：`bg-surface-container-low rounded-2xl p-6`，Mastered 条 `bg-emerald-500`，Improving 条 `bg-blue-500`，Weak 条 `bg-orange-400`，百分比 `text-sm font-bold`
- **用途**：复习启动屏掌握度分布
- **Props**：`data: { label: string, count: number, percentage: number, color: 'emerald' | 'blue' | 'orange' }[]`

### 4.9 AIInsightBox

- **来源**：page8 (mistakes.html)
- **关键 CSS**：`bg-surface-container rounded-2xl p-6 flex gap-4 items-start`，图标框 `bg-primary-container p-3 rounded-xl shadow-lg`
- **用途**：错题本 AI 诊断
- **Props**：`title: string`, `content: string`

### 4.10 HeroCard

- **来源**：page2 (action-hub.html)
- **关键 CSS**：基于 ContentCard + ProgressRing + "继续学习" AmberButton + Reviews/Mistakes 快捷入口 StatCard
- **用途**：Action Hub 顶部
- **Props**：`progress: number`, `currentModule: string`, `reviewsDue: number`, `mistakesCount: number`, `onContinue`, `onReview`, `onMistakes`
- **组合**：内部使用 ContentCard + ProgressRing + AmberButton + StatCard

### 4.11 ToggleSwitch

- **来源**：page8 (mistakes.html)
- **关键 CSS**：`relative w-12 h-6 rounded-full`，开 `bg-emerald-600`，关 `bg-surface-container-high`，滑块 `w-4 h-4 bg-white rounded-full transition-transform`，开时 `translate-x-6`
- **用途**：错题本"只看未解决"
- **Props**：`checked: boolean`, `onChange`, `label?: string`

### 4.12 ResolvedCard

- **来源**：page8 (mistakes.html)
- **关键 CSS**：`bg-surface-dim/30 rounded-3xl p-6 opacity-70 grayscale-[0.3] border-l-[6px] border-emerald-500/50`
- **用途**：错题本已解决态
- **Props**：`mistake: MistakeData`, `onReopen`

---

## 5. 页面组装映射

每个页面 = L1 地基 + L2 模式积木，页面代码只负责数据获取和状态管理。

| 页面 | L1 组件 | L2 组件 |
|------|---------|---------|
| **登录** | FormCard, TextInput, AmberButton, DecorativeBlur | — |
| **注册** | FormCard, TextInput, AmberButton, Badge, DecorativeBlur | — |
| **忘记密码** | FormCard, TextInput, AmberButton, DecorativeBlur | — |
| **首页（Multi-Column Dashboard）** | AppSidebar, CourseCard, ProgressBar, FAB, ReviewButton | 固定顶栏（搜索+头像）+ 双栏（书网格+本周概览 / 复习+统计+最近动态） |
| **Action Hub** | AppSidebar, Breadcrumb, ProgressRing, StatCard, ContentCard, DecorativeBlur | HeroCard |
| **Q&A 学习** | SplitPanel, KnowledgePointList, GlassHeader, SegmentedProgress, FeedbackPanel, Breadcrumb, Badge | MCOptionCard |
| **考试模式** | GlassHeader, SegmentedProgress, Badge | ExamTopBar, MCOptionCard, QuestionNavigator, FlagButton |
| **错题本** | AppSidebar, Breadcrumb, Badge | FilterBar, MistakeCard, AIInsightBox, ToggleSwitch, ResolvedCard |
| **复习启动** | AppSidebar, SplitPanel, KnowledgePointList, AmberButton | BriefingCard, MasteryBars |
| **复习答题** | SplitPanel, KnowledgePointList, GlassHeader, SegmentedProgress, FeedbackPanel | MCOptionCard |
| **上传页** | AppSidebar, ContentCard, AmberButton | —（简单页面，无专用组件） |
| **模块学习主页** | AppSidebar, Breadcrumb, ContentCard, StatusBadge, ProgressBar | —（复用通用组件） |

---

## 6. 文件结构

```
src/components/ui/
├── AppSidebar.tsx
├── ContentCard.tsx
├── AmberButton.tsx
├── TextInput.tsx
├── Badge.tsx
├── ProgressBar.tsx
├── Breadcrumb.tsx
├── UserAvatar.tsx
├── GlassHeader.tsx
├── KnowledgePointList.tsx
├── SegmentedProgress.tsx
├── StatusBadge.tsx
├── FormCard.tsx
├── ProgressRing.tsx
├── FeedbackPanel.tsx
├── StatCard.tsx
├── SplitPanel.tsx
├── ChatBubble.tsx
├── FAB.tsx
├── DecorativeBlur.tsx
├── CourseCard.tsx
├── ExamTopBar.tsx
├── MCOptionCard.tsx
├── QuestionNavigator.tsx
├── FlagButton.tsx
├── FilterBar.tsx
├── MistakeCard.tsx
├── BriefingCard.tsx
├── MasteryBars.tsx
├── AIInsightBox.tsx
├── HeroCard.tsx
├── ToggleSwitch.tsx
└── ResolvedCard.tsx
```

**导入方式**：直接路径 import（`import AmberButton from '@/components/ui/AmberButton'`），不使用 barrel export。AI 生成代码更明确、更不易出错。

---

## 7. 前置修复（在组件提取之前）

以下问题必须先解决，否则组件无法正确工作：

| # | 问题 | 修复方式 |
|---|------|---------|
| 1 | `surface-bright` token 缺失 | 在 globals.css `@theme inline` 中添加 |
| 2 | 阴影 token 缺失（硬编码 rgba 出现 12 次） | 在 globals.css `@theme inline` 中添加 8 个 `--shadow-*` token |
| 3 | `cn()` 工具函数缺失 | 安装 `clsx` + `tailwind-merge`，创建 `src/lib/utils.ts` |
| 4 | ActionHub SVG ProgressRing 缺少 `viewBox` | 提取为 ProgressRing 组件时修复 |
| 5 | ModuleLearning.tsx 缺少 `testing` 状态 | 在 LearningStatus type 中添加 |
| 6 | TestSession score 格式不确定（0-1 vs 0-100） | 查询 API 确认后统一 |
| 7 | NotesDisplay.tsx 完全未迁移（旧 bg-white/slate/blue 样式） | 用新组件库重写 |

### 阴影 token 清单

在 `globals.css` `@theme inline {}` 中添加：

```css
--shadow-card: 0 40px 40px -15px rgba(167, 72, 0, 0.06);
--shadow-card-lg: 0 40px 80px -30px rgba(167, 72, 0, 0.08);
--shadow-header: 0 40px 40px 0 rgba(167, 72, 0, 0.06);
--shadow-bottom-nav: 0 -8px 40px rgba(167, 72, 0, 0.08);
--shadow-cta: 0 20px 25px -5px rgba(167, 72, 0, 0.1);
--shadow-fab: 0 40px 40px -15px rgba(167, 72, 0, 0.4);
--shadow-feedback: 0 -20px 50px rgba(0, 0, 0, 0.05);
--shadow-mistake: 0 16px 48px rgba(167, 72, 0, 0.1);
```

组件代码中用 `shadow-card` 替代 `shadow-[0_40px_40px_-15px_rgba(167,72,0,0.06)]`。

### cn() 工具函数

```ts
// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## 8. 实施原则

### 提取规则

1. **逐字复制**：从 Stitch HTML 中复制 CSS 类到 React 组件，不改不优化
2. **Props 最小化**：只暴露页面拼装时真正需要变化的属性
3. **不做抽象**：不搞 `variant` 枚举过度泛化，宁可有 AmberButton 和 Badge 两个组件也不做一个 `Button` 带 10 种 variant
4. **组合优于继承**：HeroCard 内部使用 ContentCard + ProgressRing + AmberButton，不继承 ContentCard
5. **每个组件必须使用 cn()**：接受 `className?` prop，用 `cn(baseClasses, className)` 合并。确保页面可微调布局而不破坏内部视觉
6. **每个组件加 data-slot**：根元素加 `data-slot="component-name"`（kebab-case），方便调试和父组件定位
7. **阴影用 token**：组件代码中禁止出现 `shadow-[...]` arbitrary value，全部使用 `@theme` 中定义的阴影 token（`shadow-card`、`shadow-header` 等）
8. **直接 import**：`import AmberButton from '@/components/ui/AmberButton'`，不使用 barrel export

### Headless 原语（仅 2 个组件）

| 组件 | 包 | 理由 |
|------|---|------|
| MCOptionCard（选项组） | `@radix-ui/react-radio-group`（3KB） | radio group 语义 + 键盘导航 + a11y |
| ToggleSwitch | `@radix-ui/react-switch`（2KB） | switch 角色 + a11y |

Radix 包在组件内部使用，页面代码看不到 Radix——只看到 `<MCOptionCard>` 和 `<ToggleSwitch>`。
其余 31 个组件不用 headless 库，原生 HTML 语义足够。

### Dispatch 规则

1. **Gemini 只拼装不设计**：组件代码由 spec 给定，Gemini 负责 import + 传 props + 管状态
2. **Review 必须比对截图**：code review 时必须对比 Stitch PNG 与实际效果
3. **一个组件一个 PR**（或按页面分批），不要一次性全做
4. **Dispatch 必须包含 FORBIDDEN 清单**：禁止 `rgba()`、`shadow-[...]`、`#xxx` 硬编码、`bg-[...]` 颜色值
5. **缺组件时停下报告**：Gemini 发现需要的视觉元素不在组件库中时，不自创，停下来报告

### 删除清单

Stitch 中出现但**不进组件库**的元素：
- 游戏化：Daily Goal, Streak, XP, Level, Key Term Mastery
- 错误名称：The Illuminated Companion, The Scholar, 学伴 Companion, RK logo
- MVP 外功能：Community, Flashcards, Resources, Companion Insight, Upgrade to Pro, Add Mistake
- 考试 hint：底部提示灯泡（违反产品不变量 #3）

---

## 9. Stitch 源文件索引

| 组件来源 | Stitch HTML 文件 | Stitch 截图 |
|---------|-----------------|------------|
| page0 — 设计系统 | `wireframe/stitch/code/style-tile.html` | `wireframe/stitch/page0.png` |
| page1 — 首页 | `wireframe/stitch/code/homepage.html` | `wireframe/stitch/page1.png` |
| page2 — Action Hub | `wireframe/stitch/code/action-hub.html` | `wireframe/stitch/page2.png` |
| page3 — 登录 | `wireframe/stitch/code/login.html` | `wireframe/stitch/page3.png` |
| page4 — 注册 | `wireframe/stitch/code/register.html` | `wireframe/stitch/page4.png` |
| page5 — 忘记密码 | `wireframe/stitch/code/forgot-password.html` | `wireframe/stitch/page5.png` |
| page6 — Q&A | `wireframe/stitch/code/qa-mode.html` | `wireframe/stitch/page6.png` |
| page7 — 考试 | `wireframe/stitch/code/test-exam.html` | `wireframe/stitch/page7.png` |
| page8 — 错题本 | `wireframe/stitch/code/mistakes.html` | `wireframe/stitch/page8.png` |
| page9 — 复习启动 | `wireframe/stitch/code/review-start.html` | `wireframe/stitch/page9.png` |
| page10 — 复习答题 | `wireframe/stitch/code/review-session.html` | （无单独截图） |

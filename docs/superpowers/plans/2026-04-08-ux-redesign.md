---
date: 2026-04-08
topic: UX重设计Amber Companion
type: plan
status: resolved
keywords: [UX, redesign, Amber-Companion, design-system, pages]
---

# UX 重设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply Amber Companion design system across 11 pages, merge 3 pages into Action Hub, add test skip/flag navigation, add review briefing screen.

**Architecture:** Frontend-heavy overhaul (11 Gemini tasks) + 1 Codex backend task (review briefing API) + 1 Claude docs task. Shared `SplitPanelLayout` component is the centerpiece — reused by Q&A, Module Learning, and Review pages. All visual changes driven by Tailwind v4 `@theme` tokens in `globals.css`.

**Tech Stack:** Next.js 15 (App Router), React, Tailwind CSS v4, `next/font/google`, Material Symbols Outlined icons

**Spec:** `docs/superpowers/specs/2026-04-08-ux-redesign-spec.md`

---

## Dependency Graph

```
T0 (Design Foundation) ──┬──→ T1 (Sidebar) ──→ T2 (Action Hub)
                         │                  ──→ T6 (Exam Mode)
                         │                  ──→ T11 (Homepage)
                         ├──→ T3 (SplitPanel + FeedbackPanel) ──→ T4 (QA Mode)
                         │                                     ──→ T5 (Module Learning)
                         │                                     ──→ T8 (Review Frontend)
                         ├──→ T9 (Mistakes)
                         └──→ T10 (Auth Pages)

T7 (Review Briefing API) ──→ T8 (Review Frontend)

T0-T11 ──→ T12 (Verification + Docs)
```

**Parallelism opportunity:** T7 (Codex) can run simultaneously with any Gemini task.

---

## Task 0: Design Foundation — DESIGN.md + Tailwind Tokens + Fonts

**Executor:** Gemini [轻档]
**Depends on:** None

**Files:**
- Create: `DESIGN.md` (project root)
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

**Stitch reference:** `wireframe/stitch/code/style-tile.html`
**Token source:** `docs/superpowers/specs/design-tokens.md`

- [ ] **Step 1: Create `DESIGN.md`** in project root following Stitch 9-section format:
  1. **Visual Theme** — warm orange + cream, "friendly learning companion" aesthetic
  2. **Color Palette** — all 30+ tokens from `design-tokens.md` with hex values + semantic roles
  3. **Typography** — Plus Jakarta Sans (headline/label, weights 400-800) + Be Vietnam Pro (body, weights 300-600), full hierarchy table (h1-h6, body, caption, label sizes)
  4. **Component Stylings** — buttons (amber-glow gradient CTA, outline secondary), cards (white rounded-xl with orange-tinted shadow), inputs (rounded-lg, outline-variant border, primary focus ring), badges (rounded-full, semantic colors), progress bars (primary-fixed-dim fill, surface-variant track)
  5. **Layout Principles** — Split Panel (240px sidebar + content), Action Hub (hero + grid), Exam Mode (full screen no sidebar), sidebar fixed 240px
  6. **Depth & Elevation** — 5-level shadow system from design-tokens.md
  7. **Do's & Don'ts** — DO: use token class names (bg-primary), consistent 中文 UI text, Material Symbols Outlined icons. DON'T: hardcode hex colors, add gamification (XP/levels/streaks), add MVP-external features (community/flashcards), use English UI text
  8. **Responsive Behavior** — sidebar overlay on mobile (<1024px), exam mode full screen all breakpoints, cards stack on mobile
  9. **Agent Prompt Guide** — "Reference Tailwind classes from @theme tokens. Never hardcode colors. App name is 'AI 教材精学老师'. All UI text in Chinese."

- [ ] **Step 2: Rewrite `src/app/globals.css`** — replace current `@theme inline` block with full Amber Companion tokens. Exact CSS is in spec Section 2.2. Remove old `--background`/`--foreground` CSS vars, remove `prefers-color-scheme: dark` media query (not supported in this design), update `body` to use `font-body` and `bg-surface-container-low`/`text-on-surface`.

- [ ] **Step 3: Update `src/app/layout.tsx`** — replace Geist font imports with `next/font/google` for Plus Jakarta Sans (`Plus_Jakarta_Sans`) and Be Vietnam Pro (`Be_Vietnam_Pro`). Add Material Symbols Outlined via `<link>` in metadata (icons don't benefit from `next/font`). Set CSS variables for the fonts and reference them in globals.css `@theme`.

- [ ] **Step 4: Verify** — run `npm run dev`, open any page, confirm: cream background, orange accents visible in existing blue elements won't match but that's expected — tokens are loaded and available via Tailwind classes.

- [ ] **Step 5: Commit and push**
```bash
git add DESIGN.md src/app/globals.css src/app/layout.tsx
git commit -m "feat(ux): add DESIGN.md + Amber Companion Tailwind v4 tokens + Google Fonts"
git push origin master
```

---

## Task 1: Sidebar Simplification

**Executor:** Gemini [标准档]
**Depends on:** T0

**Files:**
- Modify: `src/components/sidebar/Sidebar.tsx` (currently 343L → target ~80L)
- Modify: `src/components/sidebar/SidebarLayout.tsx` (currently 32L)
- Modify: `src/components/sidebar/SidebarProvider.tsx`
- Modify: `src/components/sidebar/SidebarToggle.tsx`

**Stitch reference:** Sidebar from any Stitch HTML file (e.g., `wireframe/stitch/code/homepage.html` left panel)

- [ ] **Step 1: Simplify `Sidebar.tsx`** — delete all L2 (book-level) and L3 (module-level) navigation. Keep ONLY:
  - Logo: `amber-glow` gradient rounded-lg square with white "AI" text + "AI 教材精学" label
  - Nav items: 首页 (`/`, icon: `home`), 上传教材 (`/upload`, icon: `cloud_upload`)
  - Footer items: 系统日志 (`/logs`, icon: `analytics`), 退出登录 (button, icon: `logout`)
  - Fixed width 240px, no collapse support
  - Use Material Symbols Outlined icons (add `<span className="material-symbols-outlined">icon_name</span>`)
  - Apply Amber tokens: `bg-surface-container-low` sidebar background, `text-on-surface` text, `bg-primary/10` active item background, `text-primary` active text
  - Delete: `books` state, `modules` state, `fetchBooks`, `fetchModules`, all L2/L3 NavItems, `isCollapsed` checks

- [ ] **Step 2: Simplify `SidebarProvider.tsx`** — remove `isCollapsed` state and `toggleCollapsed`. Keep only `isMobileOpen` / `setIsMobileOpen` for mobile overlay.

- [ ] **Step 3: Simplify `SidebarToggle.tsx`** — remove desktop collapse button. Keep only mobile hamburger menu button (three-line icon for `<1024px`).

- [ ] **Step 4: Update `SidebarLayout.tsx`** — add exam mode bypass:
  ```tsx
  const pathname = usePathname()
  const isExamMode = pathname.includes('/test')
  if (pathname === '/login' || pathname === '/register' || isExamMode) {
    return <>{children}</>
  }
  ```
  Also update the wrapper div to use Amber tokens: `bg-surface-container-low` instead of `bg-gray-50`.

- [ ] **Step 5: Verify** — run dev server, navigate to `/`, confirm sidebar shows only 4 items (首页, 上传, 日志, 登出). Navigate to any `/test` route and confirm no sidebar. Mobile (<1024px): sidebar hidden, hamburger opens overlay.

- [ ] **Step 6: Commit and push**
```bash
git add src/components/sidebar/
git commit -m "feat(ux): simplify sidebar to global-only navigation + exam mode bypass"
git push origin master
```

---

## Task 2: Action Hub (Merge module-map + dashboard)

**Executor:** Gemini [重档]
**Depends on:** T0, T1

**Files:**
- Create: `src/app/books/[bookId]/ActionHub.tsx`
- Modify: `src/app/books/[bookId]/page.tsx`
- Modify: `src/app/books/[bookId]/module-map/page.tsx` (replace with redirect)
- Modify: `src/app/books/[bookId]/dashboard/page.tsx` (replace with redirect)
- Delete: `src/app/books/[bookId]/ModuleMap.tsx` (136L, replaced by ActionHub)
- Modify: `src/app/books/[bookId]/ProcessingPoller.tsx` (visual token update only)
- Modify: `src/app/books/[bookId]/reader/PdfViewer.tsx` (update hardcoded `/module-map` link to `/books/${bookId}`)

**Stitch reference:** `wireframe/stitch/code/action-hub.html`
**API:** `GET /api/books/[bookId]/dashboard` — returns `{ book, modules[], reviewsDue[], recentTests[], mistakesSummary }`

- [ ] **Step 1: Create `ActionHub.tsx`** (client component) with these sections:
  - **Hero CTA**: circular progress ring (`completedModules/totalModules` percentage), "继续学习 [module.title]" gradient button (target = first module where `learningStatus !== 'completed'`), text summary "X/Y 模块已完成"
  - **Action Cards** (horizontal row of 2): "X 个复习待完成" card (links to first reviewDue item's review URL), "X 道错题" card (links to `/books/${bookId}/mistakes`)
  - **Module Grid**: card grid, each card shows: order number (amber-glow circle), title, status badge (semantic colors: emerald=completed, orange=in-progress, gray=unstarted), QA progress "5/12" or test score, click → `/books/${bookId}/modules/${moduleId}`
  - **Recent Tests** (collapsible, default collapsed): last 3 test results with score and pass/fail badge
  - Use `GET /api/books/[bookId]/dashboard` for ALL data (see spec Section 3.2 data mapping table)
  - Apply all Amber tokens: `bg-surface-container-low` page bg, `bg-surface-container-lowest` cards, `shadow-sm shadow-orange-900/5` card shadow, `amber-glow` gradient for CTA

- [ ] **Step 2: Update `page.tsx`** (server component) — keep ProcessingPoller branch for `parse_status === 'processing'`, keep error branch, replace ModuleMap with `<ActionHub bookId={book.id} />` for done state. Delete `ModuleMap` import.

- [ ] **Step 3: Replace `module-map/page.tsx`** content with server-side redirect:
  ```tsx
  import { redirect } from 'next/navigation'
  export default async function ModuleMapRedirect({ params }: { params: Promise<{ bookId: string }> }) {
    const { bookId } = await params
    redirect(`/books/${bookId}`)
  }
  ```

- [ ] **Step 4: Replace `dashboard/page.tsx`** with same redirect pattern.

- [ ] **Step 5: Delete `ModuleMap.tsx`** (136L).

- [ ] **Step 6: Update `ProcessingPoller.tsx`** — replace blue/gray colors with Amber tokens (`bg-primary-fixed-dim` progress bar, `text-on-surface` text, `bg-surface-container` card background).

- [ ] **Step 7: Update `PdfViewer.tsx`** — change `router.push('/books/${bookId}/module-map')` to `router.push('/books/${bookId}')`.

- [ ] **Step 8: Verify** — navigate to `/books/1`, confirm Action Hub renders with hero + action cards + module grid. Navigate to `/books/1/module-map` and `/books/1/dashboard`, confirm redirect to `/books/1`.

- [ ] **Step 9: Commit and push**
```bash
git add src/app/books/
git commit -m "feat(ux): merge module-map + dashboard into Action Hub"
git push origin master
```

---

## Task 3: SplitPanelLayout + FeedbackPanel (Shared Components)

**Executor:** Gemini [标准档]
**Depends on:** T0

**Files:**
- Create: `src/components/SplitPanelLayout.tsx`
- Create: `src/components/FeedbackPanel.tsx`

**Stitch reference:** `wireframe/stitch/code/qa-mode.html` (Split Panel structure + bottom feedback panel)

- [ ] **Step 1: Create `SplitPanelLayout.tsx`** — shared layout shell:
  ```tsx
  interface SplitPanelProps {
    breadcrumbs: { label: string; href?: string }[]
    knowledgePoints: { id: number; code: string; name: string; status: 'done' | 'current' | 'pending' }[]
    onKpClick?: (kpId: number) => void
    children: React.ReactNode
    feedbackSlot?: React.ReactNode
    footerSlot?: React.ReactNode
  }
  ```
  - Left panel (240px, collapsible): KP list with status dots (emerald=done glow, primary-fixed-dim=current, surface-variant=pending). Each KP: dot + code + name. Click calls `onKpClick`.
  - Collapse button hides left panel, gives content full width.
  - Mobile (<1024px): left panel hidden by default, button to show as overlay.
  - Right panel: `{children}` + `{feedbackSlot}` (absolute positioned bottom 40% when present) + `{footerSlot}` (sticky bottom bar).
  - Breadcrumb bar at top spanning full width.
  - Apply Amber tokens throughout.

- [ ] **Step 2: Create `FeedbackPanel.tsx`** — bottom slide-up panel:
  ```tsx
  interface FeedbackPanelProps {
    visible: boolean
    isCorrect: boolean
    score?: number
    content: string      // AI feedback markdown
    onNext: () => void
    nextLabel?: string   // default "下一题"
  }
  ```
  - Animated slide from bottom, occupies 40% of content area height.
  - Header: green check or red X icon + "正确!"/"再想想" + score badge.
  - Body: `<AIResponse content={content} />` for AI feedback.
  - Footer: gradient "下一题" button.
  - Backdrop does NOT close the panel (must click "下一题").

- [ ] **Step 3: Verify** — these are library components with no route. Verify by importing into an existing page temporarily or checking TypeScript compilation passes with `npx tsc --noEmit`.

- [ ] **Step 4: Commit and push**
```bash
git add src/components/SplitPanelLayout.tsx src/components/FeedbackPanel.tsx
git commit -m "feat(ux): add SplitPanelLayout + FeedbackPanel shared components"
git push origin master
```

---

## Task 4: Q&A Mode (QASession Rewrite)

**Executor:** Gemini [重档]
**Depends on:** T3

**Files:**
- Modify: `src/app/books/[bookId]/modules/[moduleId]/qa/page.tsx`
- Modify: `src/app/books/[bookId]/modules/[moduleId]/qa/QASession.tsx` (301L → rewrite)

**Stitch reference:** `wireframe/stitch/code/qa-mode.html`
**API:** `GET /api/modules/[moduleId]/questions`, `POST /api/qa/[questionId]/respond`

- [ ] **Step 1: Update `qa/page.tsx`** — pass `bookTitle` and `bookId` props to QASession for breadcrumbs. Remove inline breadcrumb div (SplitPanelLayout handles it).

- [ ] **Step 2: Rewrite `QASession.tsx`** using `SplitPanelLayout`:
  - **KP status derivation**: from the questions list, group by `kp_id`. For each KP: if all questions answered → `done`, if current question's kp_id matches → `current`, else → `pending`.
  - **Breadcrumbs**: `[书名, /books/${bookId}] > [模块 N Q&A]`
  - **Content area**: question type badge (Short Answer/Scaffolded MC/Worked Example/Comparison) + segmented progress bar + question text via `<AIResponse>` + input area (textarea for short answer, option cards for MC, step inputs for worked example)
  - **FeedbackPanel**: after submit, show with `isCorrect`, `score`, AI feedback `content`. "下一题" advances to next question.
  - **Footer slot**: `[上一题 (disabled)] 进度 3/12 [提交]`
  - Core logic UNCHANGED: one question at a time, immediate feedback, answered questions cannot be modified.
  - **Audit cleanup**: no XP, no "Key Term Mastery", no Community icons.

- [ ] **Step 3: Verify** — navigate to a module with QA status, confirm Split Panel renders with KP sidebar, questions display correctly, feedback slides up from bottom after answering.

- [ ] **Step 4: Commit and push**
```bash
git add src/app/books/[bookId]/modules/[moduleId]/qa/
git commit -m "feat(ux): rewrite QA Mode with Split Panel + bottom feedback"
git push origin master
```

---

## Task 5: Module Learning (Split Panel Shell)

**Executor:** Gemini [标准档]
**Depends on:** T3

**Files:**
- Modify: `src/app/books/[bookId]/modules/[moduleId]/page.tsx`
- Modify: `src/app/books/[bookId]/modules/[moduleId]/ModuleLearning.tsx` (363L → rewrite)
- Modify: `src/app/books/[bookId]/modules/[moduleId]/NotesDisplay.tsx` (link fix: `/module-map` → `/books/${bookId}`)

**Stitch reference:** `wireframe/stitch/code/qa-mode.html` (shared Split Panel)

- [ ] **Step 1: Update `page.tsx`** — pass `bookTitle` and `bookId` to ModuleLearning for breadcrumbs.

- [ ] **Step 2: Rewrite `ModuleLearning.tsx`** using `SplitPanelLayout`:
  - Breadcrumbs: `[书名, /books/${bookId}] > [模块 N 学习]`
  - KP list: all pending (gray) during guide/reading stages. Colored during QA (derived from question progress). All green when notes_generated/completed.
  - Right content switches by `learning_status`:
    - `unstarted`: "生成指引" button → loading → AI guide via `<AIResponse>`
    - `reading`: original text display + notes textarea
    - `qa`: redirect to `/qa` route
    - `notes_generated`: AI notes via `<AIResponse>` + "进入测试" button linking to `/test`
    - `testing`/`completed`: completion summary + links to test/mistakes
  - **Link fix**: all `router.push` to `/module-map` → change to `/books/${bookId}`
  - Apply Amber tokens throughout.

- [ ] **Step 2.5: Fix `NotesDisplay.tsx`** — update `router.push(/books/${bookId}/module-map)` (line ~62) to `router.push(/books/${bookId})`.

- [ ] **Step 3: Verify** — navigate to a module, confirm Split Panel renders, learning stages display correctly.

- [ ] **Step 4: Commit and push**
```bash
git add src/app/books/[bookId]/modules/[moduleId]/page.tsx src/app/books/[bookId]/modules/[moduleId]/ModuleLearning.tsx
git commit -m "feat(ux): rewrite Module Learning with Split Panel layout"
git push origin master
```

---

## Task 6: Exam Mode (TestSession Rewrite)

**Executor:** Gemini [重档]
**Depends on:** T0, T1

**Files:**
- Create: `src/app/books/[bookId]/modules/[moduleId]/test/ExamShell.tsx`
- Create: `src/components/QuestionNavigator.tsx`
- Modify: `src/app/books/[bookId]/modules/[moduleId]/test/page.tsx`
- Modify: `src/app/books/[bookId]/modules/[moduleId]/test/TestSession.tsx` (483L → rewrite)

**Stitch reference:** `wireframe/stitch/code/test-exam.html`
**API:** `POST /api/modules/[moduleId]/test/generate` (returns all questions), `POST /api/modules/[moduleId]/test/submit` (batch submit, returns `{ total_score: 0-100, pass_rate: 0-100, is_passed: boolean, results[] }`)

- [ ] **Step 1: Create `QuestionNavigator.tsx`** — bottom navigation bar:
  - Row of numbered circles/squares, one per question
  - Status colors: answered=`primary-fixed-dim`, unanswered=`surface-variant`, current=`tertiary-container`, flagged=🚩 icon overlay
  - Click jumps to that question
  - "检查页" button at end

- [ ] **Step 2: Create `ExamShell.tsx`** — full-screen exam container (no sidebar thanks to T1 SidebarLayout bypass):
  - Top bar: "EXAM MODE" badge (`bg-primary text-on-primary`), module name, elapsed timer (display only, no enforcement), "交卷" button
  - Content area: centered `max-w-3xl`
  - Bottom: `QuestionNavigator`

- [ ] **Step 3: Rewrite `TestSession.tsx`** — new interaction model:
  - **State**: `answers: Record<questionId, string>`, `flags: Set<questionId>`, `currentIndex: number`, `phase: 'answering' | 'review' | 'submitted'`
  - **Free navigation**: click QuestionNavigator or prev/next buttons to jump between questions
  - **Answer persistence**: `localStorage.setItem(`test_${paperId}_answers`, JSON.stringify(answers))` on every change. Read on mount (paperId from `inProgressPaperId` prop or `test/generate` response).
  - **Flag**: toggle 🚩 on current question, stored in React state + localStorage
  - **Review page** (phase='review'): shows summary — N/M answered, unanswered question list (clickable), flagged question list (clickable), "确认交卷"/"返回检查" buttons
  - **Submit**: `POST test/submit` with `{ paper_id, answers: [{question_id, user_answer}] }`. Show results with Amber styling.
  - **INVARIANT #3**: NO hint button, NO notes access, NO QA access. Delete any hint UI from Stitch reference.

- [ ] **Step 4: Update `test/page.tsx`** — remove inline breadcrumbs (ExamShell has its own top bar). Pass required props.

- [ ] **Step 5: Verify** — navigate to a testable module's `/test`, confirm full-screen layout, jump between questions, flag questions, submit and see results. Confirm NO sidebar visible. Confirm NO hint button.

- [ ] **Step 6: Commit and push**
```bash
git add src/app/books/[bookId]/modules/[moduleId]/test/ src/components/QuestionNavigator.tsx
git commit -m "feat(ux): rewrite Exam Mode with skip/flag/navigator + full screen"
git push origin master
```

---

## Task 7: Review Briefing API

**Executor:** Codex [标准档]
**Depends on:** None (can run in parallel with any Gemini task)

**Files:**
- Create: `src/app/api/review/[scheduleId]/briefing/route.ts`
- Modify: `src/lib/review-question-utils.ts` (extract `buildAllocations` here)
- Modify: `src/app/api/review/[scheduleId]/generate/route.ts` (import `buildAllocations` from shared lib)

**Spec reference:** Section 5 — full API contract

- [ ] **Step 1: Extract `buildAllocations`** — move the `buildAllocations()` function (currently local in `generate/route.ts` lines 102-140) and its types (`ClusterRow`, `AllocationRow`, `MAX_QUESTIONS`) to `src/lib/review-question-utils.ts`. Export them. Update `generate/route.ts` to import from the shared lib.

- [ ] **Step 2: Verify generate still works** — `curl -X POST http://localhost:3000/api/review/1/generate` should still return questions (or 409 if already generated). No behavioral change.

- [ ] **Step 3: Create `briefing/route.ts`** — `GET` handler:
  ```
  1. requireUser + requireReviewScheduleOwner
  2. Query review_schedule → reviewRound
  3. Map round to intervalDays: [3,7,15,30,60][round-1] || 60
  4. JOIN modules → moduleName
  5. Query clusters for this module → compute masteryDistribution (P=1→mastered, P=2→improving, P>=3→weak)
  6. Call buildAllocations(clusters) → sum counts → estimatedQuestions
  7. Query previous completed schedule for same module → compute lastReviewDaysAgo
  8. Return response per spec Section 5 contract
  ```
  Use `handleRoute` wrapper (consistent with all other API routes).

- [ ] **Step 4: Test** — `curl http://localhost:3000/api/review/1/briefing` should return JSON with all fields. Test with invalid scheduleId → 404.

- [ ] **Step 5: Commit and push**
```bash
git add src/app/api/review/[scheduleId]/briefing/ src/lib/review-question-utils.ts src/app/api/review/[scheduleId]/generate/route.ts
git commit -m "feat(ux): add review briefing API + extract buildAllocations to shared lib"
git push origin master
```

---

## Task 8: Review (Briefing Screen + Session Rewrite)

**Executor:** Gemini [标准档]
**Depends on:** T3, T7

**Files:**
- Create: `src/app/books/[bookId]/modules/[moduleId]/review/ReviewBriefing.tsx`
- Modify: `src/app/books/[bookId]/modules/[moduleId]/review/page.tsx`
- Modify: `src/app/books/[bookId]/modules/[moduleId]/review/ReviewSession.tsx` (400L → rewrite)

**Stitch reference:** `wireframe/stitch/code/review-start.html` + `review-session.html`
**API:** `GET /api/review/[scheduleId]/briefing` (new from T7), existing review APIs

- [ ] **Step 1: Create `ReviewBriefing.tsx`** — startup screen:
  - Fetch `GET /api/review/[scheduleId]/briefing`
  - Display: "第 N 轮复习 · 间隔 X 天" header, module name, estimated question count, mastery distribution (horizontal bar or dot chart: emerald=mastered, blue=improving, orange=weak), "上次复习 X 天前" (or "首次复习" if null), "开始复习" amber-glow gradient button
  - **Audit cleanup**: no Flashcards, no Resources navigation

- [ ] **Step 2: Update `review/page.tsx`** — add state to switch between briefing and session phases. Initial phase = 'briefing'. After "开始复习" click → phase = 'session'.

- [ ] **Step 3: Rewrite `ReviewSession.tsx`** using `SplitPanelLayout`:
  - Same structure as Q&A Mode (Task 4): KP sidebar, question + input, FeedbackPanel
  - Breadcrumbs: `[书名] > [模块 N 复习 第 X 轮]`
  - Core review logic unchanged (generate → respond → complete)

- [ ] **Step 4: Verify** — navigate to a module with due review, confirm briefing screen appears first with mastery data, click "开始复习" transitions to Split Panel session.

- [ ] **Step 5: Commit and push**
```bash
git add src/app/books/[bookId]/modules/[moduleId]/review/
git commit -m "feat(ux): add review briefing screen + rewrite review session with Split Panel"
git push origin master
```

---

## Task 9: Mistake Notebook Visual Update

**Executor:** Gemini [轻档]
**Depends on:** T0

**Files:**
- Modify: `src/app/books/[bookId]/mistakes/page.tsx` (264L)
- Modify: `src/app/books/[bookId]/modules/[moduleId]/mistakes/page.tsx` (206L)

**Stitch reference:** `wireframe/stitch/code/mistakes.html`

- [ ] **Step 1: Update book-level `mistakes/page.tsx`**:
  - Replace all gray/blue/red Tailwind classes with Amber tokens
  - Page bg: `bg-surface-container-low`, cards: `bg-surface-container-lowest`, shadows: `shadow-sm shadow-orange-900/5`
  - Error type badges: use semantic colors (error for blind_spot, tertiary for procedural, secondary for confusion, outline for careless)
  - Filter buttons: active=`bg-primary text-on-primary`, inactive=`bg-surface-container-lowest text-on-surface-variant`
  - Answer comparison: user answer `bg-error-container/10 border-error`, correct answer `bg-emerald-50 border-emerald-200`
  - **Link fix**: change `<Link href={/books/${bookId}/dashboard}>` breadcrumb to `<Link href={/books/${bookId}}>`
  - **Audit cleanup**: no "The Illuminated Companion", no "+ Add Mistake"

- [ ] **Step 2: Update module-level `mistakes/page.tsx`** — same visual token replacement. Update "返回模块地图" link from `/module-map` to `/books/${bookId}`.

- [ ] **Step 3: Update `src/components/LoadingState.tsx`** — replace blue spinner/progress colors with Amber tokens (`border-primary` spinner, `bg-surface-container` background, `text-on-surface-variant` text).

- [ ] **Step 4: Verify** — navigate to both mistakes pages, confirm Amber styling, confirm links point to Action Hub not old routes. Check any loading state is Amber-colored.

- [ ] **Step 5: Commit and push**
```bash
git add src/app/books/[bookId]/mistakes/ src/app/books/[bookId]/modules/[moduleId]/mistakes/ src/components/LoadingState.tsx
git commit -m "feat(ux): apply Amber Companion tokens to mistake notebook + LoadingState"
git push origin master
```

---

## Task 10: Login + Register Visual Rewrite

**Executor:** Gemini [轻档]
**Depends on:** T0

**Files:**
- Modify: `src/app/(auth)/login/page.tsx` (106L)
- Modify: `src/app/(auth)/register/page.tsx` (125L)
- Modify: `src/app/(auth)/layout.tsx` (if exists, for centered layout)

**Stitch reference:** `wireframe/stitch/code/login.html`, `register.html`

- [ ] **Step 1: Rewrite `login/page.tsx`**:
  - Background: `bg-surface-container-low` (cream)
  - Card: `bg-surface-container-lowest rounded-xl shadow-lg shadow-orange-900/5`
  - Logo: amber-glow gradient square with "AI" + "AI 教材精学老师" text
  - All labels and text in Chinese: "邮箱", "密码", "登录", "还没有账号？立即注册"
  - Submit button: `amber-glow` gradient, `text-on-primary`, `rounded-full`
  - Input focus: `focus:ring-primary focus:border-primary`
  - Error message: `bg-error-container/10 text-error border-error/20`

- [ ] **Step 2: Rewrite `register/page.tsx`**:
  - Same visual style as login
  - All text Chinese: "邮箱", "密码（至少8位）", "显示名称（可选）", "邀请码（可选）", "注册", "已有账号？去登录"
  - Add URL parameter auto-fill: `const searchParams = useSearchParams(); const urlCode = searchParams.get('code')` → pre-fill invite code input + show badge "邀请码已激活" when present
  - Wrap in `<Suspense>` for `useSearchParams` (already done in login, need same pattern)

- [ ] **Step 3: Verify** — navigate to `/login` and `/register`, confirm Amber styling, Chinese text, no sidebar. Test `/register?code=TEST123` confirms auto-fill.

- [ ] **Step 4: Commit and push**
```bash
git add src/app/(auth)/
git commit -m "feat(ux): rewrite auth pages with Amber Companion + Chinese UI"
git push origin master
```

---

## Task 11: Homepage Rewrite

**Executor:** Gemini [标准档]
**Depends on:** T0, T1

**Files:**
- Modify: `src/app/page.tsx` (67L → rewrite)
- Modify: `src/app/ReviewButton.tsx` (88L → integrate into page or rewrite)

**Stitch reference:** `wireframe/stitch/code/homepage.html`
**API:** `GET /api/books`, `GET /api/review/due`

- [ ] **Step 1: Rewrite `page.tsx`**:
  - **Single book mode** (books.length === 1): hero card with amber-glow gradient accent, book title large, circular progress ring, "继续学习" CTA button, review due count badge
  - **Multi book mode** (books.length > 1): compact card grid, each card shows book title + progress percentage + status
  - **Empty state**: centered illustration area + "上传你的第一本教材" + upload button
  - Review due indicator integrated into page (not separate ReviewButton component)
  - Top bar: "AI 教材精学老师" + greeting
  - **No links to `/dashboard`** (old route) — book cards link to `/books/${bookId}` (Action Hub)
  - Apply all Amber tokens

- [ ] **Step 2: Update or remove `ReviewButton.tsx`** — if review logic is fully integrated into the homepage, delete the standalone component. If still useful as a reusable widget, update its visual tokens.

- [ ] **Step 3: Verify** — navigate to `/`, confirm hero card (single book) or grid (multi book), Amber styling, review indicator visible if reviews due.

- [ ] **Step 4: Commit and push**
```bash
git add src/app/page.tsx src/app/ReviewButton.tsx
git commit -m "feat(ux): rewrite homepage with Amber hero card + review integration"
git push origin master
```

---

## Task 12: Verification + Visual Polish + Docs Update

**Executor:** Claude
**Depends on:** T0-T11 all complete

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/project_status.md`
- Modify: `docs/changelog.md`

- [ ] **Step 1: Verify all pages** — dispatch Gemini for smoke test, navigate through complete user flow:
  1. `/login` → Amber + Chinese ✓
  2. `/` → Homepage hero card ✓
  3. `/books/1` → Action Hub with progress + modules ✓
  4. `/books/1/modules/1` → Split Panel learning ✓
  5. `/books/1/modules/1/qa` → Q&A with KP sidebar + feedback panel ✓
  6. `/books/1/modules/1/test` → Full screen exam, no sidebar, navigator ✓
  7. `/books/1/modules/1/review?scheduleId=1` → Briefing → Session ✓
  8. `/books/1/mistakes` → Amber mistakes ✓
  9. `/books/1/module-map` → Redirects to `/books/1` ✓
  10. `/books/1/dashboard` → Redirects to `/books/1` ✓

- [ ] **Step 2: Check product invariants**:
  - #1: Can't skip reading phase ✓
  - #2: Can't modify answered QA questions ✓
  - #3: No notes/QA access during test, no hint button ✓
  - #4: 80% pass threshold unchanged ✓
  - #5: One question + immediate feedback in QA ✓

- [ ] **Step 3: Update `docs/architecture.md`**:
  - Add `GET /api/review/[scheduleId]/briefing` to API 组
  - Update 页面 section: remove standalone module-map and dashboard pages, add redirect notes
  - Note Action Hub as the new book landing page
  - Note SplitPanelLayout as shared component
  - Note ExamShell full-screen layout

- [ ] **Step 4: Update `docs/project_status.md`** — add UX redesign milestone as completed.

- [ ] **Step 5: Update `docs/changelog.md`** — add UX redesign entry with all changes.

- [ ] **Step 6: Commit and push all docs**
```bash
git add docs/
git commit -m "docs: UX redesign milestone complete — architecture + status + changelog"
git push origin master
```

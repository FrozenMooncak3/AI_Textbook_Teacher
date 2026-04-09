# Stitch Prompts — AI Textbook Teacher UX Redesign

> 使用说明：
> - Stitch 一次最多 5 个页面，分两批生成
> - 第一批（Batch 1）：首页 + Action Hub + 登录 + 注册 + 忘记密码
> - 第二批（Batch 2）：Q&A 学习页 + 测试页 + 错题本 + 复习启动屏 + 邮箱验证
> - 每个 prompt 独立复制粘贴到 Stitch
> - **先生成 Page 0（设计系统），再生成其他页面时在 Stitch 同一个 project 里继续**

---

## Page 0: Design System Foundation

> 中文说明：这不是一个页面，而是在 Stitch 的第一个 prompt 中建立整体视觉风格。后续所有页面在同一个 Stitch project 里生成，自动继承这套风格。

```
Create a design system for an educational web application called "AI Textbook Teacher" (AI 教材精学老师). This is a serious, focused learning tool for university students — not a gamified app.

Visual identity: Clean, professional, and calm. Think Notion meets Coursera — generous white space, clear typography hierarchy, subtle shadows. The aesthetic should feel trustworthy and scholarly, encouraging deep focus.

Design tokens:
- Font: Geist Sans (or Inter as fallback)
- Primary color: blue-600 (#2563eb) for interactive elements and CTAs
- Background: gray-50 (#f9fafb) for page background, white (#ffffff) for cards and content areas
- Cards: rounded-2xl corners, shadow-sm, 1px border in gray-100 (#f3f4f6)
- Status colors: emerald-500 (#10b981) for completed, blue-500 (#3b82f6) for reading/in-progress, indigo-500 (#6366f1) for Q&A, amber-500 (#f59e0b) for testing, slate-400 (#94a3b8) for not started
- Error/wrong: red-500 (#ef4444), Success/correct: emerald-500
- Text: gray-900 for headings, gray-600 for body, gray-400 for muted/placeholder
- Spacing: 16px base unit, 24px card padding, 32px section gaps

Layout system:
- Left sidebar: 240px expanded, 56px collapsed (icon-only), fixed position. Contains app-level navigation only: Home, Upload, Settings icons. The sidebar has a white background with a subtle right border.
- Main content area: flex-1 with overflow-auto, max-width 1200px centered for content pages
- Responsive: mobile-first, sidebar collapses to bottom tab bar on screens < 1024px

Generate a style tile showing: color palette, typography scale (h1-h4, body, caption), button styles (primary, secondary, ghost), card component, badge/tag styles for the 5 status colors, and a sample input field.
```

---

## Batch 1: Entry Pages

### Page 1: Homepage — Book Library

> 中文说明：用户登录后看到的首页。显示所有已上传的教材，卡片网格布局。只有 1 本书时用大号 hero 卡片。

```
Homepage for a textbook learning app. The user sees all their uploaded textbooks here.

Layout:
- Top: Simple header with app name "AI 教材精学老师" on the left, user avatar dropdown on the right
- Left: App sidebar (240px, already defined in design system — show it collapsed to 56px with icons)
- Main content area with a greeting: "Welcome back, Sean" and subtitle "Continue where you left off"

Book grid:
- 3 columns on desktop, 2 on tablet, 1 on mobile
- Each book card contains:
  - Top section: book cover thumbnail (use a gradient placeholder with the book title overlaid in white text, since PDFs don't have cover images). Use different gradient colors for each book (blue, purple, teal).
  - Book title (bold, truncated to 2 lines)
  - A thin progress bar showing learning completion (e.g., 45% with emerald fill)
  - "Last studied: 2 days ago" in gray-400 caption text
  - Small badges: "3 reviews due" in amber, "5 mistakes" in red (only show if non-zero)

Show 3 sample books:
1. "Macroeconomics: Principles and Policy" — 45% progress, 3 reviews due
2. "Introduction to Psychology" — 12% progress, no badges
3. "Financial Accounting Standards" — 78% progress, 5 mistakes

Special case: If there's only ONE book, show it as a large hero card spanning full width — bigger cover area, more detail visible, prominent "Continue Learning" button.

Bottom right corner: floating action button with "+" icon for uploading a new textbook. Blue-600 background, white icon, rounded-full, shadow-lg.

The overall feel should be calm and organized — a personal bookshelf, not a marketplace.
```

### Page 2: Action Hub — Book Landing Page

> 中文说明：点击一本书后的落地页。用户一眼就知道该做什么。合并了原来的模块地图和仪表盘。

```
Book landing page called "Action Hub" — the user clicked on "Macroeconomics: Principles and Policy" from the homepage. This page answers: "What should I do next?"

Layout (top to bottom):

1. Hero CTA Section (top, full-width card with blue-50 background):
   - Left side: circular progress ring (large, ~120px) showing 45% overall completion in emerald
   - Center: "Continue Learning" heading with the current module name below: "Module 3: Market Equilibrium"
   - Right side: large blue-600 primary button "Continue Learning →"
   - Below the button: "Chapter 3, Q&A phase — 4 questions remaining" in gray-500

2. Action Reminder Cards (horizontal row of 2-3 cards):
   - "Reviews Due" card: amber-50 background, amber icon, number "3" large, "3 knowledge points need review today" subtitle, clickable
   - "Mistakes to Review" card: red-50 background, red icon, number "5", "5 unresolved mistakes across 2 modules" subtitle, clickable
   - (Optional) "Tests Available" card: indigo-50 background, if any modules are ready for testing

3. Module Status Grid (main content area):
   - Section heading: "All Modules" with a count "(8 modules)"
   - Grid of module cards, 2 columns on desktop, 1 on mobile
   - Each module card shows:
     - Module number and title (e.g., "Module 1: Introduction to Economics")
     - Status badge in top-right corner using status colors (Completed ✓ / Reading / Q&A / Testing / Not Started)
     - If completed: score "92%" in emerald
     - If in progress: mini progress indicator showing current step
     - If not started: gray/slate styling, subtle

   Sample modules:
   - Module 1: "Introduction to Economics" — Completed, 92%
   - Module 2: "Supply and Demand" — Completed, 85%
   - Module 3: "Market Equilibrium" — In Progress (Q&A phase), blue badge
   - Module 4: "Government Policy" — Not Started, slate
   - Module 5: "International Trade" — Not Started, slate

4. Bottom Section (collapsible):
   - "Recent Test Scores" — small table or card row showing last 3 test results with date, module, score

Breadcrumb at very top: "Home > Macroeconomics: Principles and Policy"

Feel: dashboard-like but action-oriented. The hero CTA should be the dominant visual element — the user's eye goes there first.
```

### Page 3: Login Page

> 中文说明：登录页面。居中卡片，简洁专业。全中文界面。

```
Login page for the textbook learning app. Clean, centered, professional.

Layout:
- Full-page gray-50 background
- No sidebar (auth pages are outside the main app shell)
- Centered card (max-width 420px), white background, rounded-2xl, shadow-lg, generous padding (40px)

Card content (top to bottom):
- App logo/icon at top center (use a simple book + sparkle icon in blue-600)
- App name: "AI 教材精学老师" in gray-900, text-xl, font-semibold
- Subtitle: "用 AI 帮你真正学扎实" in gray-500, text-sm
- 32px gap
- Form fields (Chinese labels):
  - "邮箱" — email input with placeholder "your@email.com"
  - "密码" — password input with show/hide toggle icon, placeholder "输入密码"
- "忘记密码?" link aligned right below password field, text-sm, blue-600
- 24px gap
- "登录" primary button — full width, blue-600, white text, rounded-xl, py-3, font-medium
- 16px gap
- Divider line with "or" text centered (for future social login — just show the divider)
- 16px gap
- "还没有账号? 注册" text centered, "注册" in blue-600 as a link

Bottom of page (outside card): "© 2026 AI 教材精学老师" in gray-400, text-xs

Feel: minimal, trustworthy, calm. Similar to Notion or Linear's login page — no visual noise.
```

### Page 4: Registration Page

> 中文说明：注册页面。和登录页视觉一致，多几个字段。邀请码通过 URL 参数传入，有的话显示一个小徽章。

```
Registration page — same visual style as the login page. Centered card on gray-50 background.

Card content (top to bottom):
- Same app logo and name as login page
- Subtitle: "创建你的学习账号" in gray-500
- 32px gap
- Form fields (Chinese labels):
  - "显示名称" — text input, placeholder "你的昵称"
  - "邮箱" — email input, placeholder "your@email.com"
  - "密码" — password input with show/hide toggle, placeholder "至少 8 位"
  - Below password: inline validation hints in gray-400 text-xs: "至少 8 个字符，包含字母和数字"
  - "确认密码" — password input, placeholder "再次输入密码"
- If an invite code was provided via URL (show this state): a small badge above the form saying "✓ 邀请码已应用" in emerald-500 with emerald-50 background, rounded-full, text-xs
- 24px gap
- "注册" primary button — full width, blue-600
- 16px gap
- "已有账号? 登录" text centered, "登录" as blue-600 link

The card should be slightly taller than login but maintain the same width and visual rhythm. All spacing and styling matches the login page exactly.
```

### Page 5: Forgot Password Page

> 中文说明：忘记密码页面。输入邮箱 → 发送重置链接。以及发送后的确认状态。

```
Forgot password page — same centered card style as login/register pages.

Show TWO states of this page:

State 1 — Email input:
- App logo and name (same as login)
- Heading: "重置密码" in gray-900, text-lg
- Description: "输入你的注册邮箱，我们将发送重置链接" in gray-500, text-sm
- 24px gap
- "邮箱" input field, placeholder "your@email.com"
- 16px gap
- "发送重置链接" primary button, full width, blue-600
- 16px gap
- "← 返回登录" link in gray-500, text-sm, centered

State 2 — Confirmation (after sending):
- Same card, but form is replaced with:
  - A large mail icon (or checkmark in a circle) in blue-600, centered
  - "重置链接已发送" heading in gray-900
  - "请检查 s***@email.com 的收件箱" in gray-500 (masked email)
  - "没收到? 重新发送" link in blue-600, text-sm
  - "返回登录" secondary button (outlined, not filled)

Both states in the same card dimensions. Transition between states should feel smooth.
```

---

## Batch 2: Learning Flow Pages

### Page 6: Module Learning — Q&A Mode (Split Panel)

> 中文说明：模块学习页的 Q&A 答题状态。左侧 KP 目录可折叠，右侧一题一屏 + 底部滑出反馈。这是核心学习页面模板，阅读和复习也复用此布局。

```
Module learning page with a split panel layout. The user is in Q&A mode, answering questions one at a time.

Layout:
- App sidebar on far left (collapsed to 56px, icon-only)
- Split panel takes the remaining width:

Left panel (280px, collapsible):
- Header: "Module 3: Market Equilibrium" in bold
- Subheader: "Knowledge Points" in gray-500
- Scrollable list of knowledge points (KPs), each as a row:
  - KP icon (small colored dot): emerald if all questions answered correctly, blue if in progress, slate if not started
  - KP title (e.g., "3.1 Price Mechanism", "3.2 Demand Curves", "3.3 Supply Shifts")
  - Small count: "2/3" (answered/total questions)
- Current KP is highlighted with blue-50 background
- Collapse button at top-right of left panel (chevron icon)
- Bottom of left panel: "Module Progress" section with a mini progress bar and "6/12 questions completed"

Right panel (flex-1, main content area):
- Top bar: breadcrumb "Macroeconomics > Module 3 > Q&A" and a segmented progress bar showing 6 of 12 segments filled (blue-500)
- Question card (centered, max-width 680px):
  - Question number: "Question 7 of 12" in gray-400
  - KP tag: "Knowledge Point: 3.3 Supply Shifts" as a small indigo badge
  - Question text: "When the cost of raw materials increases, what happens to the supply curve and why? Explain using the concept of production costs." in gray-900, text-lg
  - Question type badge: "Short Answer" in gray-200 rounded tag
  - Answer input: large textarea with placeholder "Type your answer here..." (for short answer) OR multiple choice options as selectable cards (show the textarea version)
  - "Submit Answer" button, blue-600, aligned right

- Bottom feedback panel (shown in "correct answer" state — this slides up from bottom after submission):
  - Takes bottom ~40% of the right panel
  - Emerald-50 background with emerald-600 left border (4px)
  - Top: checkmark icon + "Correct" in emerald-600, bold
  - Body: AI explanation text in gray-700 — "Your answer correctly identifies that an increase in raw material costs shifts the supply curve leftward. This is because higher production costs reduce the quantity supplied at every price point..."
  - Bottom: "Next Question →" button in blue-600

Show this page with the feedback panel open (post-answer state) so the user can see how the split between question and feedback looks.
```

### Page 7: Test Page — Exam Mode

> 中文说明：模块测试页。全屏无侧栏，考试氛围。支持跳题、标记、提交前检查。

```
Module test page in exam mode. This is visually distinct from the Q&A learning page — it should feel focused and formal, like taking an exam.

Layout:
- NO sidebar (hidden during test mode)
- NO left panel (full-width content)
- Full-width layout with max-width 800px centered content

Top bar (fixed, white background, shadow-sm):
- Left: "Module 3: Test" with an amber-500 badge "Exam Mode"
- Center: segmented progress bar — 10 segments, some filled (answered), some empty (unanswered), one highlighted (current). Use blue for answered, gray for unanswered, amber for current.
- Right: "Question 4 / 10" counter and an "Exit Test" button (ghost style, gray-500, with a warning icon)

Question area (centered):
- Question type: "Multiple Choice" badge in gray-200
- Question text large and clear
- Sample question: "Which of the following best describes what happens to equilibrium price when demand increases while supply remains constant?"
- Four answer options as selectable cards (A, B, C, D):
  - Each option is a card with rounded-xl border, hover shows blue-100 background
  - Selected option has blue-600 border and blue-50 background with a filled radio icon
  - A: "Price decreases" B: "Price increases" C: "Price stays the same" D: "Price becomes indeterminate"

Bottom navigation bar (fixed bottom):
- Left: "← Previous" button (ghost)
- Center: question navigator — row of numbered circles (1-10), clickable:
  - Filled blue circle = answered
  - Empty gray circle = unanswered  
  - Orange circle with flag = flagged for review
  - Current question has a ring outline
- Right: "Next →" button (ghost), OR "Review & Submit" button (primary, blue-600) if on last question

Also show a small "Flag for Review" toggle near the question — a bookmark/flag icon that turns amber when active.

Feel: clean, focused, slightly more serious than the Q&A page. The amber accent color differentiates it from blue Q&A mode.
```

### Page 8: Mistakes Page — Book Level

> 中文说明：书级错题本。卡片列表 + 筛选栏 + 展开详情。默认只显示未解决的。

```
Mistakes review page at the book level. Shows all mistakes across all modules for one textbook.

Layout:
- App sidebar (collapsed, 56px)
- Main content area (max-width 960px, centered)

Top section:
- Breadcrumb: "Home > Macroeconomics > Mistakes"
- Page title: "Mistake Notebook (错题本)" with a count badge "12 unresolved"
- Filter bar below title — horizontal row of filter chips:
  - "Error Type" dropdown: All / Blind Spot (知识盲区) / Procedural (步骤错误) / Confusion (概念混淆) / Careless (粗心)
  - "Source" dropdown: All / Q&A / Test / Review
  - "Module" dropdown: All / Module 1 / Module 2 / Module 3...
  - Toggle switch on the right: "Show unresolved only" (default: ON, emerald toggle)

Mistake list (vertical stack of cards):
Show 3 sample mistakes, one expanded:

Card 1 (collapsed):
- Left: red-500 vertical accent bar (4px)
- Error type badge: "Blind Spot" in red-100 text-red-700 rounded tag
- Source badge: "Test" in amber-100 text-amber-700 rounded tag
- Question text (truncated to 1 line): "Explain the difference between GDP and GNP..."
- Module name: "Module 2: National Income" in gray-400
- Date: "2 days ago" in gray-400
- Right: chevron down icon to expand

Card 2 (EXPANDED — show this one fully open):
- Same header as collapsed but with chevron pointing up
- Expanded section below:
  - "Your Answer" section with red-50 background: the user's wrong answer text
  - "Correct Answer" section with emerald-50 background: the model answer
  - "AI Diagnosis" section: explanation of why the answer was wrong, what concept was misunderstood
  - Bottom row: "Practice Similar →" button (secondary, outlined) + "Mark as Resolved ✓" button (ghost, gray)

Card 3 (collapsed, but RESOLVED — grayed out):
- Gray-100 background, all text in gray-400
- "Resolved ✓" badge in emerald replacing the error type badge
- Visible only when "Show unresolved only" toggle is OFF

Feel: organized reference material. Dense but scannable. The color-coded badges make it easy to spot patterns in mistake types.
```

### Page 9: Review Session — Start Screen + In-Session

> 中文说明：复习会话。先显示一个启动屏（概览信息），然后进入和 Q&A 类似的答题流程。显示轮次信息。

```
Review session page — show TWO states:

State 1 — Session Start Screen (before starting):
- Same split panel layout as Q&A page
- Left panel shows the KPs being reviewed with their mastery levels
- Right panel has a centered "session briefing" card:
  - Icon: a refresh/cycle icon in indigo-500 (review color)
  - Heading: "Review Session — Round 2" in gray-900
  - Subheading: "Module 3: Market Equilibrium" in gray-500
  - Info grid (2x2):
    - "Questions": "6" (number of questions this round)
    - "Est. Time": "~8 min"
    - "Last Review": "3 days ago"
    - "Schedule": "Day 7 of 3/7/15/30/60" (showing where in the spaced repetition schedule this falls, with "Day 7" highlighted)
  - KP mastery summary: 3 small bars showing "Mastered: 2 | Improving: 3 | Weak: 1" with emerald/blue/amber colors
  - "Start Review →" primary button, large, indigo-500 (using review color instead of blue)
  - "Back to Module" ghost link below

State 2 — In-Session (answering a question):
- Same layout as Q&A page (Page 6) but with these differences:
  - Progress bar at top uses indigo-500 instead of blue-500
  - "Review Session" label instead of "Q&A"
  - After answering, the feedback panel includes an extra line: "Mastery: Improving ↑" or "Mastery: Needs Practice ↓" with corresponding emerald/amber color
  - Left panel KPs show mastery indicators (small colored dots: emerald/blue/amber) instead of answered counts

Keep the overall feel consistent with Q&A but with the indigo accent to visually distinguish review from first-time learning.
```

### Page 10: Email Verification Page

> 中文说明：注册后的邮箱验证页面。告诉用户去查收邮件。

```
Email verification page — shown after a new user registers. Same centered card style as login/register.

Card content:
- App logo and name at top (same as auth pages)
- Large mail icon centered, in blue-600 (or an animated envelope illustration)
- Heading: "验证你的邮箱" in gray-900, text-lg
- Body text: "我们已向 sean@example.com 发送了验证链接。请点击链接完成注册。" in gray-500
- 24px gap
- "打开邮箱" primary button (links to Gmail/Outlook based on email domain — just show a generic button)
- 16px gap
- "没收到邮件?" section:
  - "检查垃圾邮件文件夹" in gray-400, text-sm
  - "重新发送验证邮件" link in blue-600, text-sm
- 32px gap
- "← 返回登录" link in gray-500

The page should feel like a friendly pause — not an error state. Use warm colors and a clear next-step CTA.
```

---

## Usage Instructions for Stitch

### Batch 1 生成步骤
1. 打开 stitch.withgoogle.com，新建 project
2. 第一个 prompt：复制 **Page 0 (Design System)** 的内容
3. 在生成的设计系统基础上，依次添加 Page 1-5
4. 每个页面生成后检查是否满意，不满意可以用 follow-up prompt 微调
5. 最终导出：截图 + 下载 React + Tailwind 代码 + design.md

### Batch 2 生成步骤
1. 在同一个 Stitch project 中继续（保持设计系统一致）
2. 依次添加 Page 6-10
3. 同样导出截图 + 代码 + design.md

### 微调 Tips（来自 Stitch Prompt Guide）
- 每次只改一两个地方，不要大改
- 用具体的 UI 术语："Change the primary button to rounded-full" 而不是 "make it rounder"
- 颜色要说具体值："Change to #2563eb" 而不是 "make it more blue"
- 如果生成的不对，截图保存当前好的版本，再 iterate

---

## Design System Reference

供第三次 brainstorm 对照用：

| Token | Value |
|-------|-------|
| Font | Geist Sans / Inter |
| Primary | blue-600 #2563eb |
| Background | gray-50 #f9fafb |
| Card BG | white #ffffff |
| Card border | gray-100 #f3f4f6 |
| Card radius | rounded-2xl (16px) |
| Card shadow | shadow-sm |
| Status: completed | emerald-500 #10b981 |
| Status: reading | blue-500 #3b82f6 |
| Status: qa | indigo-500 #6366f1 |
| Status: testing | amber-500 #f59e0b |
| Status: not started | slate-400 #94a3b8 |
| Error/wrong | red-500 #ef4444 |
| Success/correct | emerald-500 #10b981 |
| Review accent | indigo-500 #6366f1 |
| Sidebar width | 240px / 56px collapsed |
| Content max-width | 1200px (list) / 800px (quiz) / 420px (auth) |

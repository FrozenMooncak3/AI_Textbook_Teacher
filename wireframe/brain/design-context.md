# Design Context — AI 教辅精学

Generated: 2026-04-07

## App Overview
AI-powered textbook learning app. Users upload PDFs, system breaks them into modules with knowledge points, then guides structured learning: reading → Q&A → testing → review → mistake diagnosis.

## Target Platform
Both (responsive) — desktop-first web app, will migrate to mobile app later

## Layout Patterns
- Primary: Left sidebar (240px expanded, 56px collapsed) + main content (flex-1 overflow-auto)
- Container widths: max-w-2xl (672px) for narrow pages, max-w-6xl (1152px) for dashboards
- Cards: rounded-2xl border border-gray-100 bg-white shadow-sm
- Grid: grid-cols-1 lg:grid-cols-2 for dashboard sections

## Navigation
- Left sidebar: 3-layer (L1 global → L2 book-level → L3 module-level)
- L1: Home, Upload
- L2: Reader, Module Map, Dashboard, Mistakes (when inside a book)
- L3: Learn, Q&A, Test, Mistakes (when inside a module)
- Mobile: sidebar hidden, hamburger menu overlay

## Color Palette
- Primary: blue-600 (#2563eb), hover blue-700
- Background: gray-50, white
- Borders: gray-100, gray-200
- Text: gray-900 (primary), gray-600 (secondary), gray-400 (tertiary)
- Status colors:
  - Unstarted: slate-100/slate-500
  - Reading: blue-50/blue-600 (with pulse)
  - Q&A: indigo-50/indigo-600
  - Notes: purple-50/purple-600
  - Testing: amber-50/amber-600
  - Completed: emerald-50/emerald-600
- Error: red-600, red-50
- Review/Warning: amber-500, amber-50

## Typography
- Font: Geist Sans (system fallback: -apple-system, BlinkMacSystemFont, Segoe UI)
- h1: text-2xl font-bold/semibold
- h2: text-sm font-black uppercase tracking-widest
- Body: text-sm
- Labels: text-xs, text-[10px] for badges
- Weights: font-black (900), bold (700), semibold (600), medium (500)

## Page Types
### Homepage (book list)
- Grid of book cards with title, date, upload status
- Upload button prominent

### Book Detail
- Book title header + processing status OR module list
- ProcessingPoller shows OCR progress

### Module Learning
- Step-by-step: Guide → Reading → Q&A → Notes → Test
- Single module view with status tracking

### Dashboard
- 4-section grid: Learning Path, Review Schedule, Test Scores, Mistakes Summary
- Each section is a white card with header + scrollable content

### PDF Reader
- Full-height viewer with top toolbar
- Screenshot-to-AI overlay functionality

## Component Patterns
- Cards: bg-white rounded-2xl shadow-sm border border-gray-100
- Buttons primary: bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg
- Buttons secondary: border border-gray-300 text-gray-700 hover:bg-gray-50
- Status badges: text-[10px] px-2 py-0.5 rounded-full font-bold border
- Progress bars: bg-gray-100 rounded-full h-2/h-3 with blue-600 fill
- Loading: spinner (border-2 border-blue-600 border-t-transparent animate-spin)

## Interaction Patterns
- Hover: cards lift with border-blue-200 hover:bg-blue-50/30
- Active nav: bg-blue-50 text-blue-700 with left accent bar
- Transitions: transition-all duration-200
- Accordion: expandable module sections with rotate-180 chevron

## Responsive
- Mobile-first Tailwind with lg: breakpoint for sidebar
- Content padding: px-4 consistent
- Sidebar: -translate-x-full lg:translate-x-0

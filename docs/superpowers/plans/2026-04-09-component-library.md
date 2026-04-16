---
date: 2026-04-09
topic: 组件库从Stitch提取实施
type: plan
status: resolved
keywords: [component-library, Stitch, React, CSS, extraction]
---

# Component Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract exact CSS from Stitch HTML into 33 React components (`src/components/ui/`), then rewrite all pages to use them — so the app looks identical to Stitch designs.

**Architecture:** Two-layer component library (21 universal L1 + 12 mode-specific L2) in `src/components/ui/`. Pages only import and assemble components; no hardcoded Tailwind color/shadow/radius classes in page code. Existing components (sidebar/*, SplitPanelLayout, FeedbackPanel, QuestionNavigator, ExamShell) are replaced.

**Tech Stack:** Next.js 15 App Router, React, Tailwind CSS v4 with `@theme inline` tokens, Material Symbols Outlined icons, Plus Jakarta Sans + Be Vietnam Pro fonts.

**Key dependencies:** `clsx` + `tailwind-merge` (cn utility), `@radix-ui/react-radio-group` (MCOptionCard), `@radix-ui/react-switch` (ToggleSwitch).

**Spec:** `docs/superpowers/specs/2026-04-09-component-library-design.md`

**Architecture guide:** `docs/superpowers/specs/frontend-architecture-guide.md`

**Stitch HTML source:** `wireframe/stitch/code/*.html` — component CSS must be copied verbatim from these files.

**Visual reference:** `wireframe/stitch/page*.png` — every page must match its screenshot.

### Component Pattern (applies to ALL components in Tasks 1-5)

Every component must follow this pattern:

```tsx
import { cn } from '@/lib/utils'

interface ComponentProps {
  // ... props from spec
  className?: string  // ALWAYS include
}

export default function Component({ className, ...props }: ComponentProps) {
  return (
    <div
      data-slot="component-name"  // kebab-case, ALWAYS include
      className={cn("...stitch-css-classes...", className)}
    >
      {/* ... */}
    </div>
  )
}
```

- Use `cn()` for className merging (import from `@/lib/utils`)
- Add `data-slot` on root element
- Accept `className?` prop
- Use shadow tokens (`shadow-card`) not arbitrary values (`shadow-[...]`)
- Import components directly: `import X from '@/components/ui/X'` (no barrel export)

---

## Task 0: Prerequisites — tokens, utilities, dependencies

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/lib/utils.ts`
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Add missing tokens to globals.css**

In `src/app/globals.css`, inside `@theme inline { ... }`, add:

```css
  /* Missing color token */
  --color-surface-bright: #fffdf5;

  /* Shadow tokens — extracted from Stitch HTML, replacing all hardcoded rgba shadows */
  --shadow-card: 0 40px 40px -15px rgba(167, 72, 0, 0.06);
  --shadow-card-lg: 0 40px 80px -30px rgba(167, 72, 0, 0.08);
  --shadow-header: 0 40px 40px 0 rgba(167, 72, 0, 0.06);
  --shadow-bottom-nav: 0 -8px 40px rgba(167, 72, 0, 0.08);
  --shadow-cta: 0 20px 25px -5px rgba(167, 72, 0, 0.1);
  --shadow-fab: 0 40px 40px -15px rgba(167, 72, 0, 0.4);
  --shadow-feedback: 0 -20px 50px rgba(0, 0, 0, 0.05);
  --shadow-mistake: 0 16px 48px rgba(167, 72, 0, 0.1);
```

- [ ] **Step 2: Install dependencies**

```bash
npm install clsx tailwind-merge @radix-ui/react-radio-group @radix-ui/react-switch
```

- `clsx` + `tailwind-merge`: cn() utility for safe className merging
- `@radix-ui/react-radio-group`: MCOptionCard a11y (3KB)
- `@radix-ui/react-switch`: ToggleSwitch a11y (2KB)

- [ ] **Step 3: Create cn() utility**

```ts
// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 4: Create `src/components/ui/` directory**

```bash
mkdir -p src/components/ui
```

No barrel export (index.ts). Components are imported directly by path.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/lib/utils.ts package.json package-lock.json
git commit -m "chore: add shadow tokens, cn() utility, and a11y dependencies"
```

---

## Task 1: L1 Atomic Components — Batch A (8 components)

**Files:** Create all in `src/components/ui/`
- `AmberButton.tsx`, `TextInput.tsx`, `Badge.tsx`, `StatusBadge.tsx`
- `ProgressBar.tsx`, `UserAvatar.tsx`, `DecorativeBlur.tsx`, `FAB.tsx`

**Stitch reference:** `wireframe/stitch/code/style-tile.html` (AmberButton, Badge, ProgressBar, UserAvatar, FAB), `wireframe/stitch/code/login.html` (TextInput), `wireframe/stitch/code/homepage.html` (StatusBadge)

**Spec reference:** Sections 3.3–3.6, 3.8, 3.12, 3.19, 3.20

- [ ] **Step 1: Create AmberButton.tsx**

```tsx
'use client'

interface AmberButtonProps {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  fullWidth?: boolean
  size?: 'sm' | 'md' | 'lg'
  rounded?: 'full' | 'lg'
  type?: 'button' | 'submit'
  className?: string
}

export default function AmberButton({
  children, onClick, disabled, fullWidth, size = 'md', rounded = 'full', type = 'button', className = ''
}: AmberButtonProps) {
  const sizeClasses = {
    sm: 'py-2 px-5 text-sm',
    md: 'py-4 px-8',
    lg: 'py-5 px-10 text-lg',
  }
  const roundedClass = rounded === 'full' ? 'rounded-full' : 'rounded-lg'

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`amber-glow text-white font-bold ${sizeClasses[size]} ${roundedClass} shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 2: Create TextInput.tsx**

```tsx
'use client'

import { useState } from 'react'

interface TextInputProps {
  label: string
  placeholder?: string
  type?: string
  value: string
  onChange: (value: string) => void
  endIcon?: React.ReactNode
}

export default function TextInput({ label, placeholder, type = 'text', value, onChange, endIcon }: TextInputProps) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword && showPassword ? 'text' : type

  return (
    <div>
      <label className="block text-sm font-medium text-on-surface mb-2">{label}</label>
      <div className="relative">
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-surface-container-low border-none rounded-lg py-4 px-5 text-on-surface placeholder:text-on-surface-variant/50 focus:ring-2 focus:ring-primary/20 focus:bg-surface-bright transition-all outline-none"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-xl">
              {showPassword ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        )}
        {endIcon && !isPassword && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">{endIcon}</div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create Badge.tsx**

```tsx
interface BadgeProps {
  children: React.ReactNode
  variant?: 'primary' | 'success' | 'error' | 'warning' | 'info'
}

const variantClasses = {
  primary: 'bg-primary-container text-on-primary-container',
  success: 'bg-emerald-100 text-emerald-700',
  error: 'bg-error/10 text-error',
  warning: 'bg-tertiary-container/20 text-tertiary',
  info: 'bg-surface-container text-on-surface-variant',
}

export default function Badge({ children, variant = 'primary' }: BadgeProps) {
  return (
    <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${variantClasses[variant]}`}>
      {children}
    </span>
  )
}
```

- [ ] **Step 4: Create StatusBadge.tsx**

```tsx
interface StatusBadgeProps {
  status: 'completed' | 'in-progress' | 'not-started' | 'locked'
}

const config = {
  'completed': { label: '已完成', className: 'bg-emerald-100 text-emerald-700' },
  'in-progress': { label: '进行中', className: 'bg-primary-container/20 text-primary' },
  'not-started': { label: '未开始', className: 'bg-surface-container text-on-surface-variant' },
  'locked': { label: '未解锁', className: 'bg-surface-container text-on-surface-variant/50' },
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { label, className } = config[status]
  return <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${className}`}>{label}</span>
}
```

- [ ] **Step 5: Create ProgressBar.tsx**

```tsx
interface ProgressBarProps {
  value: number
  color?: 'primary' | 'emerald' | 'blue'
}

const colorClasses = {
  primary: 'bg-primary',
  emerald: 'bg-emerald-500',
  blue: 'bg-blue-500',
}

export default function ProgressBar({ value, color = 'primary' }: ProgressBarProps) {
  return (
    <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${colorClasses[color]}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}
```

- [ ] **Step 6: Create UserAvatar.tsx**

```tsx
interface UserAvatarProps {
  src?: string
  name: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
}

export default function UserAvatar({ src, name, size = 'md' }: UserAvatarProps) {
  const initials = name.slice(0, 2).toUpperCase()
  return src ? (
    <img src={src} alt={name} className={`${sizeClasses[size]} rounded-full border-2 border-primary-container object-cover`} />
  ) : (
    <div className={`${sizeClasses[size]} rounded-full border-2 border-primary-container bg-primary-container/20 text-primary font-bold flex items-center justify-center`}>
      {initials}
    </div>
  )
}
```

- [ ] **Step 7: Create DecorativeBlur.tsx**

```tsx
interface DecorativeBlurProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  color?: 'primary' | 'secondary'
}

const positionClasses = {
  'top-left': '-top-24 -left-24',
  'top-right': '-top-24 -right-24',
  'bottom-left': '-bottom-24 -left-24',
  'bottom-right': '-bottom-24 -right-24',
}

export default function DecorativeBlur({ position = 'top-right', color = 'primary' }: DecorativeBlurProps) {
  const colorClass = color === 'primary' ? 'bg-primary-container/10' : 'bg-secondary-container/10'
  return (
    <div className={`absolute ${positionClasses[position]} w-96 h-96 ${colorClass} rounded-full blur-3xl opacity-50 pointer-events-none`} />
  )
}
```

- [ ] **Step 8: Create FAB.tsx**

```tsx
'use client'

interface FABProps {
  icon: string
  onClick: () => void
  label?: string
}

export default function FAB({ icon, onClick, label }: FABProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed bottom-24 right-8 w-16 h-16 bg-primary rounded-full shadow-[0_12px_40px_rgba(167,72,0,0.3)] hover:scale-110 active:scale-95 transition-transform flex items-center justify-center text-white z-40"
    >
      <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
    </button>
  )
}
```

- [ ] **Step 9: Commit**

```bash
git add src/components/ui/
git commit -m "feat(ui): add L1 atomic components batch A — AmberButton, TextInput, Badge, StatusBadge, ProgressBar, UserAvatar, DecorativeBlur, FAB"
```

---

## Task 2: L1 Atomic Components — Batch B (8 components)

**Files:** Create all in `src/components/ui/`
- `ContentCard.tsx`, `FormCard.tsx`, `Breadcrumb.tsx`, `GlassHeader.tsx`
- `SegmentedProgress.tsx`, `StatCard.tsx`, `ProgressRing.tsx`, `ChatBubble.tsx`

**Stitch reference:** `wireframe/stitch/code/style-tile.html` (ContentCard, ChatBubble), `wireframe/stitch/code/login.html` (FormCard), `wireframe/stitch/code/action-hub.html` (Breadcrumb, ProgressRing), `wireframe/stitch/code/qa-mode.html` (GlassHeader, SegmentedProgress), `wireframe/stitch/code/homepage.html` (StatCard)

**Spec reference:** Sections 3.2, 3.7, 3.9, 3.11, 3.13, 3.14, 3.16, 3.18

- [ ] **Step 1: Create ContentCard.tsx**

```tsx
interface ContentCardProps {
  children: React.ReactNode
  className?: string
}

export default function ContentCard({ children, className = '' }: ContentCardProps) {
  return (
    <div className={`bg-surface-container-lowest rounded-3xl p-8 shadow-[0_40px_40px_-15px_rgba(167,72,0,0.06)] border border-outline-variant/10 ${className}`}>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Create FormCard.tsx**

```tsx
interface FormCardProps {
  children: React.ReactNode
  title: string
  subtitle?: string
}

export default function FormCard({ children, title, subtitle }: FormCardProps) {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-10 shadow-[0_40px_40px_0_rgba(167,72,0,0.06)] w-full max-w-[420px]">
      <h1 className="text-2xl font-headline font-bold text-on-surface text-center">{title}</h1>
      {subtitle && <p className="text-on-surface-variant text-center mt-2">{subtitle}</p>}
      <div className="mt-8">{children}</div>
    </div>
  )
}
```

- [ ] **Step 3: Create Breadcrumb.tsx**

```tsx
import Link from 'next/link'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-2 text-on-surface-variant text-sm">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span className="material-symbols-outlined text-xs">chevron_right</span>}
          {item.href ? (
            <Link href={item.href} className="hover:text-primary transition-colors">{item.label}</Link>
          ) : (
            <span className="text-on-surface font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
```

- [ ] **Step 4: Create GlassHeader.tsx**

```tsx
interface GlassHeaderProps {
  children: React.ReactNode
}

export default function GlassHeader({ children }: GlassHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-outline-variant/10" style={{ backgroundColor: 'rgba(255, 251, 255, 0.8)', backdropFilter: 'blur(24px)' }}>
      {children}
    </header>
  )
}
```

- [ ] **Step 5: Create SegmentedProgress.tsx**

```tsx
type SegmentStatus = 'correct' | 'incorrect' | 'answered' | 'unanswered' | 'current'

interface SegmentedProgressProps {
  segments: { status: SegmentStatus }[]
}

const statusColors: Record<SegmentStatus, string> = {
  correct: 'bg-emerald-500',
  incorrect: 'bg-error',
  answered: 'bg-primary',
  unanswered: 'bg-surface-container',
  current: 'bg-primary-fixed-dim',
}

export default function SegmentedProgress({ segments }: SegmentedProgressProps) {
  return (
    <div className="flex gap-1.5 h-1.5">
      {segments.map((seg, i) => (
        <div key={i} className={`flex-1 rounded-full ${statusColors[seg.status]}`} />
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Create StatCard.tsx**

```tsx
'use client'

interface StatCardProps {
  value: string | number
  label: string
  icon?: string
  onClick?: () => void
}

export default function StatCard({ value, label, icon, onClick }: StatCardProps) {
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper
      onClick={onClick}
      className={`flex items-center gap-4 ${onClick ? 'cursor-pointer hover:bg-surface-container-low rounded-2xl p-4 transition-colors' : ''}`}
    >
      {icon && (
        <span className="material-symbols-outlined text-3xl text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>
          {icon}
        </span>
      )}
      <div>
        <div className="text-5xl font-black font-headline text-tertiary">{value}</div>
        <div className="text-sm text-on-surface-variant">{label}</div>
      </div>
    </Wrapper>
  )
}
```

- [ ] **Step 7: Create ProgressRing.tsx**

```tsx
interface ProgressRingProps {
  value: number
  label?: string
}

export default function ProgressRing({ value, label }: ProgressRingProps) {
  const circumference = 2 * Math.PI * 70 // r=70
  const offset = circumference - (circumference * Math.min(100, Math.max(0, value))) / 100

  return (
    <div className="relative w-40 h-40">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="none" className="text-primary/10" />
        <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="none"
          className="text-primary" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black font-headline text-on-surface">{value}%</span>
        {label && <span className="text-xs text-on-surface-variant">{label}</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Create ChatBubble.tsx**

```tsx
interface ChatBubbleProps {
  role: 'user' | 'ai'
  children: React.ReactNode
}

export default function ChatBubble({ role, children }: ChatBubbleProps) {
  return role === 'user' ? (
    <div className="bg-surface-container-lowest p-5 rounded-2xl rounded-tl-none">{children}</div>
  ) : (
    <div className="bg-primary/5 p-5 rounded-2xl rounded-tr-none border border-primary/10">{children}</div>
  )
}
```

- [ ] **Step 9: Commit**

```bash
git add src/components/ui/
git commit -m "feat(ui): add L1 atomic components batch B — ContentCard, FormCard, Breadcrumb, GlassHeader, SegmentedProgress, StatCard, ProgressRing, ChatBubble"
```

---

## Task 3: L1 Composite Components (5 components)

These depend on Task 1/2 atomics.

**Files:** Create in `src/components/ui/`
- `KnowledgePointList.tsx`, `FeedbackPanel.tsx`, `SplitPanel.tsx`, `AppSidebar.tsx`, `CourseCard.tsx`

**Stitch reference:** `wireframe/stitch/code/qa-mode.html` (KnowledgePointList, FeedbackPanel, SplitPanel), `wireframe/stitch/code/review-session.html` (FeedbackPanel review variant, SplitPanel border variant), `wireframe/stitch/code/action-hub.html` (AppSidebar), `wireframe/stitch/code/homepage.html` (CourseCard)

**Spec reference:** Sections 3.1, 3.10, 3.15, 3.17, 3.21

- [ ] **Step 1: Create KnowledgePointList.tsx**

```tsx
'use client'

interface KPItem {
  name: string
  status: 'done' | 'active' | 'pending'
  progress?: string
}

interface KnowledgePointListProps {
  items: KPItem[]
  onItemClick?: (index: number) => void
  activeColor?: 'blue' | 'orange'
}

const dotColors = { done: 'bg-emerald-500', pending: 'bg-surface-container-high' }
const activeStyles = {
  blue: { bg: 'bg-blue-50 border border-blue-100/50 shadow-sm', dot: 'bg-blue-500', text: 'text-blue-900' },
  orange: { bg: 'bg-orange-100 ring-1 ring-primary/20', dot: 'bg-orange-500 animate-pulse', text: 'text-on-surface' },
}

export default function KnowledgePointList({ items, onItemClick, activeColor = 'blue' }: KnowledgePointListProps) {
  return (
    <div className="flex flex-col gap-1">
      {items.map((item, i) => {
        const isActive = item.status === 'active'
        const active = activeStyles[activeColor]
        return (
          <button
            key={i}
            onClick={() => onItemClick?.(i)}
            className={`flex items-center justify-between p-3 rounded-xl transition-colors text-left ${
              isActive ? active.bg : 'hover:bg-surface-container-low'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${isActive ? active.dot : dotColors[item.status] || dotColors.pending}`} />
              <span className={`text-sm font-medium ${isActive ? active.text : 'text-on-surface'}`}>{item.name}</span>
            </div>
            {item.progress && <span className="text-xs text-on-surface-variant">{item.progress}</span>}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create FeedbackPanel.tsx**

```tsx
'use client'

import AmberButton from './AmberButton'

interface FeedbackPanelProps {
  isCorrect: boolean
  explanation: string
  onNext: () => void
  variant?: 'qa' | 'review'
  nextLabel?: string
}

export default function FeedbackPanel({ isCorrect, explanation, onNext, variant = 'qa', nextLabel = '下一题 →' }: FeedbackPanelProps) {
  if (variant === 'review') {
    const borderColor = isCorrect ? 'border-emerald-600' : 'border-error'
    const bgColor = isCorrect ? 'bg-emerald-50' : 'bg-red-50'
    const icon = isCorrect ? 'check_circle' : 'cancel'
    const iconColor = isCorrect ? 'text-emerald-600' : 'text-error'
    return (
      <div className={`${bgColor} border-l-[6px] ${borderColor} p-8 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] rounded-2xl`}>
        <div className="flex items-start gap-4">
          <span className={`material-symbols-outlined text-2xl ${iconColor}`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
          <div className="flex-1">
            <h3 className="font-headline font-bold text-lg text-on-surface mb-2">{isCorrect ? '回答正确！' : '回答有误'}</h3>
            <p className="text-on-surface-variant text-sm leading-relaxed">{explanation}</p>
          </div>
          <button onClick={onNext} className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-full hover:bg-indigo-700 transition-colors shrink-0">
            {nextLabel}
          </button>
        </div>
      </div>
    )
  }

  // QA variant — absolute positioned bottom panel
  const borderColor = isCorrect ? 'border-emerald-500' : 'border-error'
  const bgColor = isCorrect ? 'bg-emerald-50' : 'bg-red-50'
  return (
    <div className={`absolute bottom-0 left-0 w-full h-[40%] ${bgColor} border-t-4 ${borderColor} shadow-[0_-20px_50px_rgba(0,0,0,0.05)] z-30 p-10 flex flex-col`}>
      <div className="flex items-center gap-3 mb-4">
        <span className={`material-symbols-outlined text-2xl ${isCorrect ? 'text-emerald-600' : 'text-error'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
          {isCorrect ? 'check_circle' : 'cancel'}
        </span>
        <h3 className="font-headline font-bold text-xl">{isCorrect ? '回答正确！' : '回答有误'}</h3>
      </div>
      <p className="text-on-surface-variant leading-relaxed flex-1 overflow-y-auto">{explanation}</p>
      <div className="mt-4 flex justify-end">
        <AmberButton onClick={onNext}>{nextLabel}</AmberButton>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create SplitPanel.tsx**

```tsx
interface SplitPanelProps {
  sidebar: React.ReactNode
  content: React.ReactNode
  feedbackSlot?: React.ReactNode
  showBorder?: boolean
}

export default function SplitPanel({ sidebar, content, feedbackSlot, showBorder = true }: SplitPanelProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className={`w-[280px] bg-surface-container-low flex flex-col h-full shrink-0 ${showBorder ? 'border-r border-outline-variant/15' : ''}`}>
        {sidebar}
      </aside>
      <main className="flex-1 bg-surface overflow-y-auto relative">
        {content}
        {feedbackSlot}
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Create AppSidebar.tsx**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import UserAvatar from './UserAvatar'

interface NavItem {
  icon: string
  label: string
  href: string
}

interface AppSidebarProps {
  userName: string
  userAvatar?: string
  navItems: NavItem[]
  bookTitle?: string
}

export default function AppSidebar({ userName, userAvatar, navItems, bookTitle }: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-screen w-72 bg-gradient-to-r from-[#fefae8] to-[#fffbff] rounded-r-[32px] shadow-xl shadow-orange-900/5 z-40 flex flex-col py-6">
      {/* Logo */}
      <div className="px-6 mb-6">
        <h1 className="text-lg font-headline font-bold text-primary">AI 教材精学老师</h1>
        {bookTitle && <p className="text-xs text-on-surface-variant mt-1 truncate">{bookTitle}</p>}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-on-surface-variant hover:bg-primary/5'
              }`}
            >
              <span className="material-symbols-outlined text-xl" style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                {item.icon}
              </span>
              <span className="text-sm">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-6 pt-4 border-t border-outline-variant/10">
        <div className="flex items-center gap-3">
          <UserAvatar name={userName} src={userAvatar} />
          <span className="text-sm font-medium text-on-surface truncate">{userName}</span>
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 5: Create CourseCard.tsx**

```tsx
'use client'

import ProgressBar from './ProgressBar'

interface CourseCardProps {
  title: string
  progress: number
  lastStudied?: string
  badges?: { label: string, color: string }[]
  gradient?: string
  onClick: () => void
}

export default function CourseCard({ title, progress, lastStudied, badges, gradient = 'from-violet-500 to-purple-600', onClick }: CourseCardProps) {
  return (
    <button
      onClick={onClick}
      className="bg-surface-container-lowest rounded-3xl shadow-[0_40px_40px_-15px_rgba(167,72,0,0.06)] border border-outline-variant/10 overflow-hidden text-left group hover:-translate-y-1 transition-transform w-full"
    >
      {/* Gradient cover */}
      <div className={`h-32 bg-gradient-to-br ${gradient} relative`}>
        {badges?.map((badge, i) => (
          <span key={i} className={`absolute top-3 ${i === 0 ? 'left-3' : 'right-3'} px-3 py-1 rounded-full text-xs font-bold text-white ${badge.color}`}>
            {badge.label}
          </span>
        ))}
      </div>
      {/* Content */}
      <div className="p-6">
        <h3 className="font-headline font-bold text-on-surface mb-3 line-clamp-2">{title}</h3>
        <div className="mb-2 flex items-center justify-between text-xs text-on-surface-variant">
          <span>完成度</span>
          <span>{progress}%</span>
        </div>
        <ProgressBar value={progress} />
        {lastStudied && (
          <p className="text-xs text-on-surface-variant mt-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">schedule</span>
            {lastStudied}
          </p>
        )}
      </div>
    </button>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/
git commit -m "feat(ui): add L1 composite components — KnowledgePointList, FeedbackPanel, SplitPanel, AppSidebar, CourseCard"
```

---

## Task 4: L2 Exam Components (4 components)

**Files:** Create in `src/components/ui/`
- `ExamTopBar.tsx`, `MCOptionCard.tsx`, `QuestionNavigator.tsx`, `FlagButton.tsx`

**Stitch reference:** `wireframe/stitch/code/test-exam.html` — open this file and cross-reference every CSS class.

**Spec reference:** Sections 4.1–4.4

- [ ] **Step 1: Create ExamTopBar.tsx**

```tsx
'use client'

import SegmentedProgress from './SegmentedProgress'

interface ExamTopBarProps {
  moduleTitle: string
  currentQuestion: number
  totalQuestions: number
  segments: { status: 'correct' | 'incorrect' | 'answered' | 'unanswered' | 'current' }[]
  onExit: () => void
}

export default function ExamTopBar({ moduleTitle, currentQuestion, totalQuestions, segments, onExit }: ExamTopBarProps) {
  return (
    <header data-slot="exam-top-bar" className={cn("fixed top-0 w-full z-50 bg-amber-50/80 backdrop-blur-xl shadow-header", className)}>
      <div className="px-8 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h1 className="font-headline font-bold text-on-surface">{moduleTitle}</h1>
            <span className="bg-primary-container text-on-primary-container px-3 py-1 rounded-full text-xs font-bold font-label uppercase tracking-wider">考试模式</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-sm align-middle mr-1" style={{ fontVariationSettings: "'FILL' 1" }}>quiz</span>
              第 {currentQuestion} / {totalQuestions} 题
            </span>
            <button onClick={onExit} className="text-error text-sm font-medium flex items-center gap-1 hover:underline">
              <span className="material-symbols-outlined text-sm">warning</span>
              退出测试
            </button>
          </div>
        </div>
        <SegmentedProgress segments={segments} />
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Create MCOptionCard.tsx**

Uses `@radix-ui/react-radio-group` internally for a11y (keyboard nav, ARIA radio semantics).
Pages use `<MCOptionGroup>` wrapper + `<MCOptionCard>` items. Radix is hidden inside — pages never import Radix directly.

```tsx
'use client'

import * as RadioGroup from '@radix-ui/react-radio-group'
import { cn } from '@/lib/utils'

interface MCOptionCardProps {
  label: string
  text: string
  value: string
  showResult?: 'correct' | 'incorrect'
  disabled?: boolean
  className?: string
}

export function MCOptionCard({ label, text, value, showResult, disabled, className }: MCOptionCardProps) {
  const isCorrect = showResult === 'correct'
  const isIncorrect = showResult === 'incorrect'

  return (
    <RadioGroup.Item
      value={value}
      disabled={disabled}
      data-slot="mc-option-card"
      className={cn(
        'group w-full flex items-center gap-4 p-5 rounded-lg transition-all',
        isCorrect ? 'bg-emerald-50 border-2 border-emerald-500' :
        isIncorrect ? 'bg-red-50 border-2 border-error' :
        'bg-surface-container hover:bg-surface-variant data-[state=checked]:border-2 data-[state=checked]:border-primary-fixed-dim data-[state=checked]:bg-secondary-container/30',
        disabled && 'pointer-events-none',
        className
      )}
    >
      <div className={cn(
        'w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0',
        isCorrect ? 'bg-emerald-500 text-white' :
        isIncorrect ? 'bg-error text-white' :
        'bg-surface-container-lowest border border-outline-variant group-data-[state=checked]:bg-primary-fixed-dim group-data-[state=checked]:text-white group-data-[state=checked]:border-none'
      )}>
        {isCorrect ? (
          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
        ) : isIncorrect ? (
          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>close</span>
        ) : (
          label
        )}
      </div>
      <span className="text-left text-on-surface">{text}</span>
    </RadioGroup.Item>
  )
}

// Wrapper for a group of MCOptionCards — handles selection state + keyboard nav
interface MCOptionGroupProps {
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  children: React.ReactNode
  className?: string
}

export function MCOptionGroup({ value, onValueChange, disabled, children, className }: MCOptionGroupProps) {
  return (
    <RadioGroup.Root
      data-slot="mc-option-group"
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      className={cn('flex flex-col gap-3', className)}
    >
      {children}
    </RadioGroup.Root>
  )
}
```

**Page usage:**
```tsx
import { MCOptionGroup, MCOptionCard } from '@/components/ui/MCOptionCard'

<MCOptionGroup value={selected} onValueChange={setSelected}>
  <MCOptionCard value="A" label="A" text="Option text..." />
  <MCOptionCard value="B" label="B" text="Option text..." />
</MCOptionGroup>
```

- [ ] **Step 3: Create QuestionNavigator.tsx**

```tsx
'use client'

interface QuestionStatus { status: 'answered' | 'current' | 'unanswered' | 'flagged' }

interface QuestionNavigatorProps {
  questions: QuestionStatus[]
  onSelect: (index: number) => void
  onPrev: () => void
  onNext: () => void
}

const dotStyles = {
  answered: 'bg-primary-fixed-dim text-white',
  current: 'bg-surface-container-lowest ring-2 ring-primary text-primary font-bold',
  unanswered: 'bg-surface-container text-on-surface-variant',
  flagged: 'bg-tertiary-container text-on-tertiary-container',
}

export default function QuestionNavigator({ questions, onSelect, onPrev, onNext }: QuestionNavigatorProps) {
  return (
    <div data-slot="question-navigator" className={cn("fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-2xl shadow-bottom-nav rounded-t-[32px] z-50 px-8 py-4", className)}>
      <div className="flex items-center justify-between max-w-3xl mx-auto">
        <button onClick={onPrev} className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
          <span className="text-sm">上一题</span>
        </button>

        <div className="flex items-center gap-2">
          {questions.map((q, i) => (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className={`w-9 h-9 rounded-full text-xs flex items-center justify-center transition-all ${dotStyles[q.status]}`}
            >
              {q.status === 'flagged' ? (
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>
              ) : (
                i + 1
              )}
            </button>
          ))}
        </div>

        <button onClick={onNext} className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors">
          <span className="text-sm">下一题</span>
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create FlagButton.tsx**

```tsx
'use client'

interface FlagButtonProps {
  flagged: boolean
  onClick: () => void
}

export default function FlagButton({ flagged, onClick }: FlagButtonProps) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-tertiary transition-colors">
      <span
        className="material-symbols-outlined text-xl text-tertiary"
        style={{ fontVariationSettings: flagged ? "'FILL' 1" : "'FILL' 0" }}
      >
        flag
      </span>
      <span>{flagged ? '已标记' : '标记复查'}</span>
    </button>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/
git commit -m "feat(ui): add L2 exam components — ExamTopBar, MCOptionCard, QuestionNavigator, FlagButton"
```

---

## Task 5: L2 Mistakes + Review + Hub Components (8 components)

**Files:** Create in `src/components/ui/`
- `FilterBar.tsx`, `MistakeCard.tsx`, `AIInsightBox.tsx`, `ToggleSwitch.tsx`, `ResolvedCard.tsx`
- `BriefingCard.tsx`, `MasteryBars.tsx`, `HeroCard.tsx`

**Stitch reference:** `wireframe/stitch/code/mistakes.html` (FilterBar, MistakeCard, AIInsightBox, ToggleSwitch, ResolvedCard), `wireframe/stitch/code/review-start.html` (BriefingCard, MasteryBars), `wireframe/stitch/code/action-hub.html` (HeroCard)

**Spec reference:** Sections 4.5–4.12

- [ ] **Step 1: Create ToggleSwitch.tsx**

Uses `@radix-ui/react-switch` internally for a11y (role="switch", aria-checked, keyboard toggle).

```tsx
'use client'

import * as Switch from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  className?: string
}

export default function ToggleSwitch({ checked, onChange, label, className }: ToggleSwitchProps) {
  return (
    <label data-slot="toggle-switch" className={cn("flex items-center gap-3 cursor-pointer", className)}>
      <Switch.Root
        checked={checked}
        onCheckedChange={onChange}
        className={cn(
          'relative w-12 h-6 rounded-full transition-colors',
          checked ? 'bg-emerald-600' : 'bg-surface-container-high'
        )}
      >
        <Switch.Thumb className={cn(
          'block w-4 h-4 bg-white rounded-full transition-transform',
          checked ? 'translate-x-7' : 'translate-x-1'
        )} />
      </Switch.Root>
      {label && <span className="text-sm text-on-surface">{label}</span>}
    </label>
  )
}
```

- [ ] **Step 2: Create AIInsightBox.tsx**

```tsx
interface AIInsightBoxProps {
  title: string
  content: string
}

export default function AIInsightBox({ title, content }: AIInsightBoxProps) {
  return (
    <div className="bg-surface-container rounded-2xl p-6 flex gap-4 items-start">
      <div className="bg-primary-container p-3 rounded-xl shadow-lg shrink-0">
        <span className="material-symbols-outlined text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
      </div>
      <div>
        <h4 className="font-headline font-bold text-on-surface mb-1">{title}</h4>
        <p className="text-sm text-on-surface-variant leading-relaxed">{content}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create FilterBar.tsx**

```tsx
'use client'

interface FilterGroup {
  label: string
  key: string
  options: string[]
}

interface FilterBarProps {
  groups: FilterGroup[]
  selected: Record<string, string[]>
  onChange: (key: string, value: string) => void
}

export default function FilterBar({ groups, selected, onChange }: FilterBarProps) {
  return (
    <div className="bg-surface-container-low rounded-3xl p-6 flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.key} className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider shrink-0">{group.label}</span>
          {group.options.map((opt) => {
            const isSelected = selected[group.key]?.includes(opt)
            return (
              <button
                key={opt}
                onClick={() => onChange(group.key, opt)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-surface-container-lowest text-primary border border-primary/10'
                    : 'bg-surface-container-lowest text-on-surface-variant hover:bg-primary/5'
                }`}
              >
                {opt}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create MistakeCard.tsx**

```tsx
'use client'

import AIInsightBox from './AIInsightBox'
import Badge from './Badge'

interface MistakeData {
  id: number
  question: string
  yourAnswer: string
  correctAnswer: string
  errorType: string
  source: string
  module: string
  diagnosis: string
  loggedAt: string
}

interface MistakeCardProps {
  mistake: MistakeData
  expanded: boolean
  onToggle: () => void
  onResolve: () => void
  onPractice: () => void
}

export default function MistakeCard({ mistake, expanded, onToggle, onResolve, onPractice }: MistakeCardProps) {
  return (
    <div
      className={`bg-surface-container-lowest rounded-3xl border-l-[6px] border-error transition-shadow ${
        expanded ? 'p-8 shadow-[0_16px_48px_rgba(167,72,0,0.1)]' : 'p-6 shadow-[0_4px_24px_rgba(167,72,0,0.04)] hover:shadow-[0_12px_32px_rgba(167,72,0,0.08)] cursor-pointer'
      }`}
      onClick={!expanded ? onToggle : undefined}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="error">{mistake.errorType}</Badge>
          <Badge variant="primary">{mistake.source}</Badge>
          <span className="text-xs text-on-surface-variant">{mistake.module}</span>
        </div>
        <button onClick={onToggle} className="text-on-surface-variant hover:text-primary">
          <span className="material-symbols-outlined">{expanded ? 'expand_less' : 'expand_more'}</span>
        </button>
      </div>

      <h3 className="font-headline font-bold text-on-surface mt-3 line-clamp-2">{mistake.question}</h3>
      <p className="text-xs text-on-surface-variant mt-1">{mistake.loggedAt}</p>

      {expanded && (
        <>
          {/* Answer comparison */}
          <div className="grid grid-cols-2 gap-6 mt-6">
            <div className="bg-error/5 rounded-2xl p-5">
              <p className="text-xs font-bold text-error mb-2 uppercase">✕ 你的答案</p>
              <p className="text-sm text-on-surface">{mistake.yourAnswer}</p>
            </div>
            <div className="bg-emerald-50 rounded-2xl p-5">
              <p className="text-xs font-bold text-emerald-700 mb-2 uppercase">✓ 正确答案</p>
              <p className="text-sm text-on-surface">{mistake.correctAnswer}</p>
            </div>
          </div>

          {/* AI Diagnosis */}
          <div className="mt-6">
            <AIInsightBox title="AI 诊断" content={mistake.diagnosis} />
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <button onClick={onResolve} className="flex items-center gap-2 px-6 py-3 rounded-full border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors">
              <span className="material-symbols-outlined text-lg">check_circle</span>
              标记已解决
            </button>
            <button onClick={onPractice} className="flex items-center gap-2 px-6 py-3 rounded-full border border-primary text-primary hover:bg-primary/5 transition-colors">
              <span className="material-symbols-outlined text-lg">exercise</span>
              练习类似题
            </button>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create ResolvedCard.tsx**

```tsx
interface ResolvedCardProps {
  question: string
  module: string
  resolvedAt: string
  onReopen: () => void
}

export default function ResolvedCard({ question, module, resolvedAt, onReopen }: ResolvedCardProps) {
  return (
    <div className="bg-surface-dim/30 rounded-3xl p-6 opacity-70 grayscale-[0.3] border-l-[6px] border-emerald-500/50">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-emerald-600 font-bold">✓ 已解决 · {module}</p>
          <h3 className="font-headline font-medium text-on-surface mt-1 line-clamp-1">{question}</h3>
          <p className="text-xs text-on-surface-variant mt-1">{resolvedAt}</p>
        </div>
        <button onClick={onReopen} className="text-on-surface-variant hover:text-primary">
          <span className="material-symbols-outlined text-lg">refresh</span>
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create MasteryBars.tsx**

```tsx
interface MasteryItem {
  label: string
  count: number
  percentage: number
  color: 'emerald' | 'blue' | 'orange'
}

interface MasteryBarsProps {
  data: MasteryItem[]
}

const barColors = { emerald: 'bg-emerald-500', blue: 'bg-blue-500', orange: 'bg-orange-400' }
const labelColors = { emerald: 'text-emerald-700', blue: 'text-blue-700', orange: 'text-orange-700' }

export default function MasteryBars({ data }: MasteryBarsProps) {
  return (
    <div className="bg-surface-container-low rounded-2xl p-6">
      <h4 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-4">掌握度分布</h4>
      <div className="flex flex-col gap-4">
        {data.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-sm font-bold ${labelColors[item.color]}`}>{item.label}: {item.count}</span>
              <span className="text-sm font-bold text-on-surface-variant">{item.percentage}%</span>
            </div>
            <div className="h-3 bg-surface-container rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${barColors[item.color]}`} style={{ width: `${item.percentage}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Create BriefingCard.tsx**

```tsx
'use client'

import AmberButton from './AmberButton'
import MasteryBars from './MasteryBars'

interface BriefingCardProps {
  questions: number
  estTime: string
  lastReview: string
  schedule: string
  round: number
  masteryData: { label: string, count: number, percentage: number, color: 'emerald' | 'blue' | 'orange' }[]
  onStart: () => void
}

export default function BriefingCard({ questions, estTime, lastReview, schedule, round, masteryData, onStart }: BriefingCardProps) {
  return (
    <div className="bg-surface-container-lowest rounded-3xl p-10 shadow-[0_40px_80px_-30px_rgba(167,72,0,0.08)] max-w-lg mx-auto">
      {/* Icon */}
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center">
          <span className="material-symbols-outlined text-4xl text-indigo-600" style={{ fontVariationSettings: "'FILL' 1" }}>refresh</span>
        </div>
      </div>

      <h2 className="text-2xl font-headline font-bold text-center text-on-surface">复习 — 第 {round} 轮</h2>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-6 mt-8">
        {[
          { label: '题数', value: questions },
          { label: '预计时间', value: estTime },
          { label: '上次复习', value: lastReview },
          { label: '间隔', value: schedule },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="text-xs text-on-surface-variant uppercase tracking-wider">{stat.label}</p>
            <p className="text-xl font-extrabold text-on-surface font-headline mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Mastery */}
      <div className="mt-8">
        <MasteryBars data={masteryData} />
      </div>

      {/* CTA */}
      <div className="mt-8">
        <AmberButton fullWidth onClick={onStart}>开始复习 →</AmberButton>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Create HeroCard.tsx**

```tsx
'use client'

import ContentCard from './ContentCard'
import ProgressRing from './ProgressRing'
import AmberButton from './AmberButton'

interface HeroCardProps {
  progress: number
  currentModule: string
  reviewsDue: number
  mistakesCount: number
  onContinue: () => void
  onReview: () => void
  onMistakes: () => void
}

export default function HeroCard({ progress, currentModule, reviewsDue, mistakesCount, onContinue, onReview, onMistakes }: HeroCardProps) {
  return (
    <ContentCard className="flex items-center gap-10">
      <ProgressRing value={progress} label="完成" />
      <div className="flex-1">
        <p className="text-xs text-on-surface-variant uppercase tracking-wider font-label">学习路径</p>
        <h2 className="text-2xl font-headline font-bold text-on-surface mt-1">继续学习</h2>
        <p className="text-on-surface-variant mt-1">{currentModule}</p>
        <div className="mt-4">
          <AmberButton onClick={onContinue}>继续学习 →</AmberButton>
        </div>
      </div>
      <div className="flex flex-col gap-4 shrink-0">
        <button onClick={onReview} className="flex items-center gap-3 p-4 rounded-2xl bg-tertiary-container/10 hover:bg-tertiary-container/20 transition-colors">
          <span className="material-symbols-outlined text-2xl text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>refresh</span>
          <div>
            <p className="text-2xl font-black font-headline text-tertiary">{reviewsDue}</p>
            <p className="text-xs text-on-surface-variant">待复习</p>
          </div>
        </button>
        <button onClick={onMistakes} className="flex items-center gap-3 p-4 rounded-2xl bg-error/5 hover:bg-error/10 transition-colors">
          <span className="material-symbols-outlined text-2xl text-error" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
          <div>
            <p className="text-2xl font-black font-headline text-error">{mistakesCount}</p>
            <p className="text-xs text-on-surface-variant">错题</p>
          </div>
        </button>
      </div>
    </ContentCard>
  )
}
```

- [ ] **Step 9: Commit**

```bash
git add src/components/ui/
git commit -m "feat(ui): add L2 components — FilterBar, MistakeCard, AIInsightBox, ToggleSwitch, ResolvedCard, BriefingCard, MasteryBars, HeroCard"
```

---

## Task 6: Auth Pages Rewrite

Rewrite login, register, forgot-password using L1 components. Remove all hardcoded styles.

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/register/page.tsx`
- Modify: `src/app/(auth)/layout.tsx`

**Visual reference:** `wireframe/stitch/page3.png` (login), `wireframe/stitch/page4.png` (register)

**Components to use:** FormCard, TextInput, AmberButton, DecorativeBlur

- [ ] **Step 1: Read current auth page code**

Read `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`, `src/app/(auth)/layout.tsx` to understand current structure and state management.

- [ ] **Step 2: Rewrite login page**

Replace all hardcoded Tailwind color/shadow/radius with component imports:

```tsx
import { FormCard, TextInput, AmberButton, DecorativeBlur } from '@/components/ui'
```

Page structure: `DecorativeBlur` backgrounds → centered `FormCard` → `TextInput` fields → `AmberButton` (rounded='lg', fullWidth) → links.

Preserve all existing state management (form state, error handling, API calls). Only replace the JSX/styling.

- [ ] **Step 3: Rewrite register page**

Same approach. Keep invite code logic, form validation. Replace JSX with FormCard + TextInput + AmberButton + Badge (for invite code badge).

- [ ] **Step 4: Rewrite forgot-password page**

Same approach as login/register. Replace hardcoded styles with FormCard + TextInput + AmberButton + DecorativeBlur. Two states: input form + confirmation (email sent). Reference `wireframe/stitch/page5.png`.

- [ ] **Step 5: Update auth layout**

Auth layout should provide: warm cream background `bg-[#fefae8] min-h-screen`, centered content, DecorativeBlur elements.

- [ ] **Step 6: Visual comparison**

Open login/register pages in browser. Compare side-by-side with `wireframe/stitch/page3.png` and `wireframe/stitch/page4.png`. Fix any discrepancies.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(ui): rewrite auth pages with component library"
```

---

## Task 7: Homepage + Action Hub Rewrite

**Files:**
- Modify: `src/app/page.tsx` (homepage)
- Modify: `src/app/books/[bookId]/page.tsx` (Action Hub)

**Visual reference:** `wireframe/stitch/page1.png` (homepage), `wireframe/stitch/page2.png` (Action Hub)

**Components:** AppSidebar, CourseCard, StatCard, StatusBadge, FAB, DecorativeBlur, HeroCard, ProgressRing, Breadcrumb, ContentCard

- [ ] **Step 1: Read current homepage and Action Hub code**

- [ ] **Step 2: Rewrite homepage**

Replace hardcoded cards/progress with CourseCard, StatCard, FAB. Use AppSidebar. Add `ml-72` to main content (sidebar width offset). Three modes: single-book hero, multi-book grid, empty state.

- [ ] **Step 3: Rewrite Action Hub**

Replace hardcoded hero section with HeroCard. Replace module list cards with ContentCard + StatusBadge. Use Breadcrumb for navigation path.

- [ ] **Step 4: Visual comparison with page1.png and page2.png**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(ui): rewrite homepage + Action Hub with component library"
```

---

## Task 8: Q&A Page Rewrite

**Files:**
- Modify: `src/app/books/[bookId]/modules/[moduleId]/qa/QASession.tsx`

**Visual reference:** `wireframe/stitch/page6.png`

**Components:** SplitPanel, KnowledgePointList, GlassHeader, SegmentedProgress, FeedbackPanel, Breadcrumb, Badge, MCOptionCard

- [ ] **Step 1: Read current QASession.tsx**

Note existing state management, API calls, question flow logic. These must be preserved.

- [ ] **Step 2: Replace layout with SplitPanel**

Replace current SplitPanelLayout import with new SplitPanel. Wire KnowledgePointList into sidebar slot. Wire question content + FeedbackPanel into content/feedback slots.

- [ ] **Step 3: Replace feedback rendering with FeedbackPanel (variant='qa')**

- [ ] **Step 4: Replace MC options with MCOptionCard (if applicable)**

- [ ] **Step 5: Add GlassHeader with Breadcrumb + SegmentedProgress**

- [ ] **Step 6: Fix known bugs**

- Remove "Product Invariant" debug text visible to users
- Fix KP sidebar showing generic "知识点 1" — pass actual KP names from API
- Remove empty onKpClick handler or wire to actual scroll

- [ ] **Step 7: Visual comparison with page6.png**

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(ui): rewrite Q&A page with component library"
```

---

## Task 9: Exam Page Rewrite

**Files:**
- Modify: `src/app/books/[bookId]/modules/[moduleId]/test/TestSession.tsx`
- Delete: `src/app/books/[bookId]/modules/[moduleId]/test/ExamShell.tsx` (replaced by ExamTopBar)

**Visual reference:** `wireframe/stitch/page7.png`

**Components:** ExamTopBar, MCOptionCard, QuestionNavigator, FlagButton, GlassHeader, SegmentedProgress, Badge

- [ ] **Step 1: Read current TestSession.tsx and ExamShell.tsx**

Note 5 stages: intro/generating/answering/review/submitting/results. Preserve all stage logic.

- [ ] **Step 2: Replace ExamShell wrapper with ExamTopBar**

ExamShell.tsx is deleted. TestSession directly uses ExamTopBar at top + QuestionNavigator at bottom. Add `pt-20 pb-24` padding (top bar height + bottom nav height).

- [ ] **Step 3: Replace MC option rendering with MCOptionCard**

- [ ] **Step 4: Wire FlagButton into question header**

- [ ] **Step 5: Wire QuestionNavigator with question state**

- [ ] **Step 6: Fix known bugs**

- Remove English strings ("Test Passed/Failed", "Pass Rate", "Subjective Answer Area") → 全中文
- Remove `console.error` in production code
- Remove "Product Invariant" debug text
- Fix `ModuleLearning.tsx` missing 'testing' status (blank page on refresh)

- [ ] **Step 7: Visual comparison with page7.png**

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(ui): rewrite exam page with component library, delete ExamShell"
```

---

## Task 10: Mistakes Page Rewrite

**Files:**
- Modify: `src/app/books/[bookId]/mistakes/page.tsx` (or relevant component)

**Visual reference:** `wireframe/stitch/page8.png`

**Components:** AppSidebar, Breadcrumb, FilterBar, MistakeCard, AIInsightBox, ToggleSwitch, ResolvedCard, Badge

- [ ] **Step 1: Read current mistakes page code**

- [ ] **Step 2: Replace layout — AppSidebar + main content area**

- [ ] **Step 3: Add FilterBar with error type / source / module groups**

- [ ] **Step 4: Replace mistake list with MistakeCard + ResolvedCard**

- [ ] **Step 5: Add ToggleSwitch for "只看未解决"**

- [ ] **Step 6: Visual comparison with page8.png**

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(ui): rewrite mistakes page with component library"
```

---

## Task 11: Review Pages Rewrite

**Files:**
- Modify: `src/app/books/[bookId]/modules/[moduleId]/review/ReviewBriefing.tsx`
- Modify: `src/app/books/[bookId]/modules/[moduleId]/review/ReviewSession.tsx`
- Modify: `src/app/books/[bookId]/modules/[moduleId]/review/ReviewPageClient.tsx`

**Visual reference:** `wireframe/stitch/page9.png` (briefing)

**Components:** SplitPanel, KnowledgePointList (activeColor='orange'), GlassHeader, SegmentedProgress, FeedbackPanel (variant='review'), BriefingCard, MasteryBars, MCOptionCard, AmberButton

- [ ] **Step 1: Read current review page code**

Note ReviewBriefing → ReviewSession phase switch in ReviewPageClient.

- [ ] **Step 2: Rewrite ReviewBriefing with BriefingCard**

Replace current briefing layout with SplitPanel (KP list in sidebar) + BriefingCard (in content area). Wire mastery data from API.

- [ ] **Step 3: Rewrite ReviewSession with SplitPanel + FeedbackPanel(variant='review')**

Use KnowledgePointList with `activeColor='orange'`. Use FeedbackPanel review variant (border-left, horizontal layout).

- [ ] **Step 4: Fix known bugs**

- Fix fake KP sidebar data ("Q1/复习题目 1") → use actual KP names from API
- Fix score*100 potential bug (check if API returns 0-1 or 0-100)
- Fix "of 3/7/15/30/60" English text → 全中文
- Fix missing fetchData in useEffect deps
- Remove "Product Invariant" debug text

- [ ] **Step 5: Visual comparison with page9.png**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(ui): rewrite review pages with component library"
```

---

## Task 12: Sidebar Migration + Old Component Cleanup

**Files:**
- Modify: `src/app/layout.tsx` — remove old SidebarLayout, integrate AppSidebar
- Delete: `src/components/sidebar/Sidebar.tsx`
- Delete: `src/components/sidebar/SidebarProvider.tsx`
- Delete: `src/components/sidebar/SidebarLayout.tsx`
- Delete: `src/components/sidebar/SidebarToggle.tsx`
- Delete: `src/components/SplitPanelLayout.tsx` (replaced by SplitPanel)
- Delete: `src/components/FeedbackPanel.tsx` (replaced by ui/FeedbackPanel)
- Delete: `src/components/QuestionNavigator.tsx` (replaced by ui/QuestionNavigator)
- Modify: `src/app/books/[bookId]/modules/[moduleId]/notes/NotesDisplay.tsx` — migrate from old styles
- Modify: `src/app/upload/page.tsx` — rewrite with AppSidebar + ContentCard + AmberButton
- Modify: `src/app/books/[bookId]/modules/[moduleId]/page.tsx` — rewrite module learning main with AppSidebar + Breadcrumb + ContentCard + StatusBadge + ProgressBar

- [ ] **Step 1: Grep for all imports of old components**

```bash
grep -r "from.*components/sidebar" src/ --include="*.tsx" --include="*.ts"
grep -r "from.*SplitPanelLayout" src/ --include="*.tsx"
grep -r "from.*components/FeedbackPanel" src/ --include="*.tsx"
grep -r "from.*components/QuestionNavigator" src/ --include="*.tsx"
grep -r "ExamShell" src/ --include="*.tsx"
```

- [ ] **Step 2: Update all remaining imports to use new ui/ components**

Any file still importing old components → switch to `@/components/ui` imports.

- [ ] **Step 3: Delete old component files**

- [ ] **Step 4: Rewrite NotesDisplay.tsx**

Current NotesDisplay uses old bg-white/slate/blue styles. Rewrite using ContentCard and Amber Companion tokens.

- [ ] **Step 5: Rewrite Upload page**

Simple page: AppSidebar + main content with ContentCard (file drop zone) + AmberButton (upload CTA). Replace any hardcoded styles.

- [ ] **Step 6: Rewrite Module Learning main page**

Use AppSidebar + Breadcrumb + ContentCard for each learning step (指引/阅读/QA/笔记) + StatusBadge for step status + ProgressBar for module completion.

- [ ] **Step 7: Update layout.tsx**

Remove SidebarLayout wrapper. AppSidebar is now rendered inside each page that needs it (homepage, Action Hub, mistakes, etc.), not in root layout. Root layout should be clean: just fonts + globals.

- [ ] **Step 6: Verify no broken imports**

```bash
npm run build
```

Fix any TypeScript/import errors.

- [ ] **Step 7: Commit**

```bash
git commit -m "chore(ui): remove old sidebar/SplitPanelLayout/FeedbackPanel/QuestionNavigator, migrate NotesDisplay"
```

---

## Task 13: Visual Verification + Lint Check + Docs Update

**Files:**
- Modify: `docs/architecture.md` — update component list
- Modify: `docs/project_status.md` — update milestone status
- Modify: `docs/changelog.md` — add entry

- [ ] **Step 1: Lint check — no hardcoded values in components**

Run grep checks to verify no arbitrary shadows/colors leaked through:

```bash
# Should return 0 matches (excluding globals.css)
grep -rn 'rgba(' src/components/ui/ src/app/ --include='*.tsx'
grep -rn 'shadow-\[' src/components/ui/ src/app/ --include='*.tsx'
grep -rn '#[0-9a-fA-F]\{3,8\}' src/components/ui/ --include='*.tsx'
```

Fix any violations found.

- [ ] **Step 2: Full visual walkthrough (Glance MCP if available, otherwise manual)**

Compare every page with corresponding Stitch PNG:
- Login → page3.png
- Register → page4.png
- Homepage → page1.png
- Action Hub → page2.png
- Q&A → page6.png
- Exam → page7.png
- Mistakes → page8.png
- Review Briefing → page9.png
- Review Session → (compare with page6.png layout)

If Glance MCP is configured: use `browser_navigate` + `browser_screenshot` + `visual_compare` for automated comparison.
Otherwise: screenshot each page manually and compare side-by-side.

Flag discrepancies.

- [ ] **Step 3: Fix any visual discrepancies found**

- [ ] **Step 4: Verify component patterns**

Spot-check 5 random components for:
- [ ] `data-slot` attribute on root element
- [ ] `className?` prop with `cn()` merging
- [ ] Shadow tokens used (not arbitrary values)
- [ ] Direct import path (not barrel)

- [ ] **Step 5: Update architecture.md**

Replace the "App Shell" and "Design System" sections with the new component library structure (src/components/ui/ with 33 components, two-layer architecture, cn() utility, shadow tokens).

- [ ] **Step 6: Update project_status.md and changelog.md**

- [ ] **Step 7: Final commit**

```bash
git commit -m "docs: update architecture + status for component library milestone"
```

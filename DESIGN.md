# Design System: Amber Companion

> This is the official design foundation for AI 教材精学老师. 
> All components and pages must strictly adhere to these tokens and principles.
> This project uses **Tailwind CSS v4** with CSS-based configuration.

---

## 1. Visual Theme
- **Aesthetic**: Warm orange + cream "Amber Companion" look.
- **Vibe**: Friendly learning companion, tactile, digital, and supportive.
- **Inspiration**: Material 3 color system with a custom warm palette.
- **Base Colors**: Deep amber (#a74800) for primary actions, cream (#fefae8) for backgrounds.

---

## 2. Color Palette
All colors are defined as Tailwind tokens in `globals.css`. Never use hardcoded hex values.

### Core (Primary)
- `primary`: `#a74800` (Main interaction, active states)
- `primary-container`: `#ff7a23` (CTA gradients, large button backgrounds)
- `primary-fixed`: `#ff7a23`
- `primary-fixed-dim`: `#f06c0b` (Progress bars completed, answered dots)
- `primary-dim`: `#943f00` (Dark variant)
- `on-primary`: `#ffffff` (Text on primary)
- `on-primary-container`: `#3f1700` (Text on primary container)

### Secondary
- `secondary`: `#9b5100` (Secondary interactions)
- `secondary-container`: `#ffc69d` (Secondary backgrounds)
- `on-secondary`: `#ffffff`
- `on-secondary-container`: `#703900`

### Tertiary (Flag/Review)
- `tertiary`: `#845d00` (Review, reminders, flags)
- `tertiary-container`: `#febb28` (Flag backgrounds, active question highlight)
- `tertiary-fixed`: `#febb28`
- `tertiary-fixed-dim`: `#efad16`
- `on-tertiary`: `#ffffff`
- `on-tertiary-container`: `#563b00`

### Surface & Background
- `surface`: `#fffbff` (General background)
- `surface-container-lowest`: `#ffffff` (White cards)
- `surface-container-low`: `#fefae8` (Sidebar background, body background)
- `surface-container`: `#f8f4e2` (Card/panel base)
- `surface-container-high`: `#f2eedb` (Deep cards)
- `surface-container-highest`: `#ece9d4` (Deepest cards)
- `surface-variant`: `#ece9d4` (Unfinished progress tracks)
- `surface-dim`: `#e7e3ce` (Disabled states)

### On Surface (Text & Outlines)
- `on-surface`: `#39382d` (Main body text)
- `on-surface-variant`: `#666558` (Labels, helper text)
- `outline`: `#838174` (Standard borders)
- `outline-variant`: `#bcb9ab` (Faint borders)
- `inverse-surface`: `#0f0f06`
- `inverse-primary`: `#f77113`

### Error
- `error`: `#be2d06` (Error text, wrong answers)
- `error-container`: `#f95630` (Error backgrounds)
- `on-error`: `#ffffff`

### Semantic States (Extra)
- **Completed/Mastered**: `bg-emerald-100 text-emerald-800`
- **In Progress**: `bg-orange-100 text-orange-800`
- **Improving**: `bg-blue-100 text-blue-700`
- **Weak**: `bg-orange-100 text-orange-700`

---

## 3. Typography
- **Headlines & Labels**: `Plus Jakarta Sans`
- **Body Text**: `Be Vietnam Pro`

### Hierarchy
- **h1**: `2.25rem` (36px), font-extrabold (800)
- **h2**: `1.875rem` (30px), font-bold (700)
- **h3**: `1.5rem` (24px), font-semibold (600)
- **h4**: `1.25rem` (20px), font-semibold (600)
- **body**: `1rem` (16px), font-normal (400)
- **caption**: `0.875rem` (14px), font-normal (400)
- **label**: `0.75rem` (12px), font-medium (500)

---

## 4. Component Stylings

### Buttons
- **Amber Glow (CTA)**: `linear-gradient(135deg, #a74800 0%, #ff7a23 100%)`, white text, `rounded-full`, `shadow-xl shadow-orange-700/10`.
- **Outline (Secondary)**: `border-2 border-outline-variant/30`, `on-surface` text, `rounded-full`, hover `bg-surface-container`.
- **Ghost**: `text-on-surface-variant`, hover `text-primary`, `transition-colors`.

### Cards
- **Base**: `bg-surface-container-lowest`, `rounded-xl`, `shadow-sm shadow-orange-900/5`, border `border-outline-variant/10`.
- **Large/Elevated**: `rounded-[40px]`, `shadow-[0_40px_80px_-30px_rgba(167,72,0,0.08)]`.

### Inputs
- **Style**: `bg-surface-container-lowest`, `rounded-lg`, border `outline-variant`, focus `primary` ring.

### Badges
- **Style**: `rounded-full`, semantic colors, `px-3 py-1`, `text-xs font-bold`.

### Progress Bars
- **Track**: `bg-surface-variant`
- **Fill**: `bg-primary-fixed-dim`

---

## 5. Layout Principles
- **Standard**: 240px fixed sidebar + flexible content area.
- **Split Panel**: Sidebar (240px) + Knowledge Point Panel (240px) + Content. Used for Learning, Q&A, and Review modes.
- **Exam Mode**: Full-screen focus mode. No sidebar, no navigation, centered content.

---

## 6. Depth & Elevation
- **Card Default**: `shadow-sm shadow-orange-900/5`
- **CTA Button**: `shadow-xl shadow-orange-700/10`
- **Top Bar**: `shadow-[0_40px_40px_0_rgba(167,72,0,0.06)]`
- **Bottom Nav**: `shadow-[0_-8px_40px_rgba(167,72,0,0.08)]`
- **Large Card**: `shadow-[0_40px_80px_-30px_rgba(167,72,0,0.08)]`

---

## 7. Do's & Don'ts
- **DO**: Use Tailwind token class names (`bg-primary`, `text-on-surface`).
- **DO**: Keep all UI text in Chinese.
- **DO**: Use Material Symbols Outlined icons.
- **DON'T**: Hardcode hex colors in components.
- **DON'T**: Add gamification (XP/levels/streaks) unless specified.
- **DON'T**: Add features outside MVP scope (community, flashcards).
- **DON'T**: Use English for UI text.

---

## 8. Responsive Behavior
- **Desktop (>=1024px)**: Fixed sidebar (240px).
- **Mobile (<1024px)**: Sidebar becomes an overlay/drawer.
- **Exam Mode**: Full screen on all breakpoints.
- **Cards**: Stack vertically on mobile.

---

## 9. Agent Prompt Guide
- Reference Tailwind classes from `@theme` tokens. Never hardcode colors.
- App name is **"AI 教材精学老师"**.
- All UI text in Chinese.
- Icons: Use Material Symbols Outlined with `<span className='material-symbols-outlined'>icon_name</span>`.
- Default icon settings: `font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24`.
- For filled icons: `style={{ fontVariationSettings: "'FILL' 1" }}`.

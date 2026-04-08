# Design Tokens (Amber Companion)

> Gemini MUST read this file before any frontend work.
> These tokens define the visual baseline. Follow them strictly.
> DO NOT use the old slate/blue tokens.

## Color System (Amber Companion)

| Role | Token | Usage |
|------|-------|-------|
| Body background | `bg-surface-container-low` | `#fefae8` |
| Sidebar background | `bg-surface-container-low` | `#fefae8` |
| Page底色 | `bg-surface` | `#fffbff` |
| Card background | `bg-surface-container-lowest` | `#ffffff` |
| Primary text | `text-on-surface` | `#39382d` |
| Label text | `text-on-surface-variant` | `#666558` |
| Main action | `bg-primary` / `amber-glow` | `#a74800` |
| Secondary action | `border-2 border-outline-variant/30` | |
| Active highlight | `bg-tertiary-container` | `#febb28` |

## Typography

| Role | Classes |
|------|---------|
| Headings | `font-headline` (Plus Jakarta Sans) |
| Body | `font-body` (Be Vietnam Pro) |
| Labels | `font-label` (Plus Jakarta Sans) |

## Border Radius

| Element | Token |
|---------|-------|
| Default | `rounded` (1rem) |
| Large | `rounded-lg` (2rem) |
| XL | `rounded-xl` (3rem) |
| Pill | `rounded-full` (9999px) |

---

## Rules
1. **Never hardcode hex colors**. Use Tailwind classes (`bg-primary`, `text-on-surface`).
2. **All UI text must be in Chinese**.
3. **Use Material Symbols Outlined** for icons.
4. **App Name**: "AI 教材精学老师"

# Design Tokens

> Gemini MUST read this file before any frontend work.
> These tokens define the visual baseline. Follow them strictly.
> Do NOT mix in alternative color families, radii, or spacing values.

---

## Color System

All grays use the **slate** family. Do NOT use `gray-*`.

| Role | Token | Usage |
|------|-------|-------|
| Page background | `bg-slate-50` | Every page's outermost wrapper |
| Card background | `bg-white` | Cards, modals, panels |
| Primary text | `text-slate-900` | Headings, body text |
| Secondary text | `text-slate-500` | Descriptions, helper text, timestamps |
| Muted text | `text-slate-400` | Breadcrumbs, placeholders, disabled labels |
| Border | `border-slate-200` | Card borders, dividers, input borders |
| Primary action | `bg-blue-600 hover:bg-blue-700 text-white` | Main CTAs, primary buttons |
| Primary accent text | `text-blue-600` | Links, active states, interactive labels |
| Error | `text-red-600`, `bg-red-50 border-red-200` | Error messages, alerts |
| Warning | `text-amber-700`, `bg-amber-50 border-amber-200` | Warnings, cautions |
| Success | `text-green-600`, `bg-green-50 border-green-200` | Success messages, completion states |
| Info | `text-blue-700`, `bg-blue-50 border-blue-200` | Info boxes, tips |

## Typography

| Role | Classes |
|------|---------|
| Page title | `text-2xl font-bold text-slate-900` |
| Section heading | `text-lg font-semibold text-slate-900` |
| Card title | `text-base font-semibold text-slate-900` |
| Body text | `text-sm text-slate-900` |
| Secondary text | `text-sm text-slate-500` |
| Label / meta | `text-xs text-slate-400` |
| Tiny badge | `text-[10px] font-bold` |

## Border Radius

| Element | Token |
|---------|-------|
| Page-level card / modal | `rounded-2xl` |
| Standard card / content section | `rounded-xl` |
| Buttons, inputs, small cards | `rounded-lg` |
| Badges, pills, spinners | `rounded-full` |

## Spacing

Use Tailwind's 4px increment system. Standard patterns:

| Context | Token |
|---------|-------|
| Page wrapper | `px-4 py-8` or `px-4 py-10` |
| Card internal padding | `p-5` or `p-6` |
| Section gap (vertical) | `space-y-6` |
| Item gap (in a list) | `gap-3` or `gap-4` |
| Compact inline spacing | `gap-2` |

## Container Widths

| Page type | Token |
|-----------|-------|
| Narrow (upload, single-focus) | `max-w-md mx-auto` |
| Standard (learning, test, home) | `max-w-2xl mx-auto` |
| Wide (module map, dashboard) | `max-w-4xl mx-auto` |

## Buttons

### Primary (main CTA)
```
bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl
transition-colors disabled:opacity-50 disabled:cursor-not-allowed
```

### Secondary (alternative action)
```
border border-slate-300 text-slate-700 font-medium py-2.5 px-4 rounded-lg
hover:bg-slate-50 transition-colors
```

### Danger (destructive action)
```
bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-4 rounded-lg
transition-colors
```

### Small / inline
```
text-sm font-medium py-1.5 px-3 rounded-lg
```

## Cards

### Standard card
```
bg-white rounded-xl border border-slate-200 p-5
```

### Elevated card (modal, overlay)
```
bg-white rounded-2xl border border-slate-200 p-6 shadow-sm
```

### Interactive list item
```
bg-white rounded-lg border border-slate-200 px-4 py-3
hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer
```

## Alert boxes

```
bg-{color}-50 border border-{color}-200 rounded-xl p-4 text-{color}-700
```
Where `{color}` = blue (info), red (error), amber (warning), green (success).

## States

| State | Visual treatment |
|-------|-----------------|
| Hover (interactive) | `hover:bg-slate-50` or `hover:border-blue-300` |
| Active / selected | `border-blue-500 bg-blue-50` |
| Disabled | `opacity-50 cursor-not-allowed` |
| Loading | Blue spinner: `border-2 border-blue-600 border-t-transparent rounded-full animate-spin` |

## Transitions

All interactive elements: `transition-colors` (default) or `transition-all` (when border/shadow also changes).
Duration: Tailwind default (150ms). Do NOT use custom `duration-*` unless animating progress bars.

---

## Rules

1. **No `gray-*`** — use `slate-*` for all neutral colors
2. **No raw hex** — use Tailwind color tokens only
3. **No emoji as icons** — use Heroicons or Lucide SVG icons
4. **No shadow-lg on cards** — cards use `shadow-sm` or no shadow; only elevated modals get shadow
5. **Consistent radius** — match the element type to the radius table above
6. **One primary CTA per view** — secondary actions use the secondary button style

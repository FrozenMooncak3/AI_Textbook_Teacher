---
name: ui-ux-pro-max
description: "UI/UX design intelligence for web applications. 99 UX guidelines across 10 categories (accessibility, interaction, performance, style, layout, typography, animation, forms, navigation, charts), common professional UI rules, and pre-delivery checklist. Adapted for Next.js + React + Tailwind CSS."
---

# UI/UX Pro Max - Design Intelligence

Comprehensive design guide for web applications. Contains 99 UX guidelines across 10 priority-ranked categories, common professional UI rules, and a pre-delivery checklist. Adapted from [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) for our Next.js + React + Tailwind CSS stack.

## When to Apply

This Skill should be used when the task involves **UI structure, visual design decisions, interaction patterns, or user experience quality control**.

### Must Use

- Designing new pages or major page sections
- Creating or refactoring UI components (buttons, modals, forms, tables, cards, etc.)
- Choosing color schemes, typography, spacing, or layout systems
- Reviewing UI code for user experience, accessibility, or visual consistency
- Implementing navigation structures, animations, or responsive behavior

### Skip

- Pure backend/API logic
- Database or schema work
- Non-visual scripts or automation

**Decision criteria**: If the task will change how a feature **looks, feels, moves, or is interacted with**, use this Skill.

## Our Stack Constraints

- **Tailwind CSS only** — no MUI, Ant Design, shadcn/ui, or other UI libraries
- **No emoji as icons** — use SVG icons (Heroicons, Lucide) or Tailwind-compatible icon sets
- **Web-first** — these guidelines focus on desktop/tablet/mobile web, not native apps
- **Educational app context** — prioritize readability, focus management, and minimal distraction

---

## Rule Categories by Priority

| Priority | Category | Impact | Key Checks (Must Have) | Anti-Patterns (Avoid) |
|----------|----------|--------|------------------------|------------------------|
| 1 | Accessibility | CRITICAL | Contrast 4.5:1, Alt text, Keyboard nav, Aria-labels | Removing focus rings, Icon-only buttons without labels |
| 2 | Touch & Interaction | CRITICAL | Min size 44x44px, 8px+ spacing, Loading feedback | Reliance on hover only, Instant state changes (0ms) |
| 3 | Performance | HIGH | WebP/AVIF, Lazy loading, Reserve space (CLS < 0.1) | Layout thrashing, Cumulative Layout Shift |
| 4 | Style Selection | HIGH | Match product type, Consistency, SVG icons (no emoji) | Mixing flat & skeuomorphic randomly, Emoji as icons |
| 5 | Layout & Responsive | HIGH | Mobile-first breakpoints, Viewport meta, No horizontal scroll | Horizontal scroll, Fixed px container widths, Disable zoom |
| 6 | Typography & Color | MEDIUM | Base 16px, Line-height 1.5, Semantic color tokens | Text < 12px body, Gray-on-gray, Raw hex in components |
| 7 | Animation | MEDIUM | Duration 150-300ms, Motion conveys meaning, Spatial continuity | Decorative-only animation, Animating width/height, No reduced-motion |
| 8 | Forms & Feedback | MEDIUM | Visible labels, Error near field, Helper text, Progressive disclosure | Placeholder-only label, Errors only at top, Overwhelm upfront |
| 9 | Navigation Patterns | HIGH | Predictable back, Deep linking, Clear hierarchy | Overloaded nav, Broken back behavior, No deep links |
| 10 | Charts & Data | LOW | Legends, Tooltips, Accessible colors | Relying on color alone to convey meaning |

---

## Quick Reference

### 1. Accessibility (CRITICAL)

- `color-contrast` - Minimum 4.5:1 ratio for normal text (large text 3:1)
- `focus-states` - Visible focus rings on interactive elements (2-4px)
- `alt-text` - Descriptive alt text for meaningful images
- `aria-labels` - aria-label for icon-only buttons
- `keyboard-nav` - Tab order matches visual order; full keyboard support
- `form-labels` - Use label with for attribute
- `skip-links` - Skip to main content for keyboard users
- `heading-hierarchy` - Sequential h1-h6, no level skip
- `color-not-only` - Don't convey info by color alone (add icon/text)
- `reduced-motion` - Respect prefers-reduced-motion; reduce/disable animations when requested
- `escape-routes` - Provide cancel/back in modals and multi-step flows
- `keyboard-shortcuts` - Preserve system and a11y shortcuts; offer keyboard alternatives for drag-and-drop

### 2. Touch & Interaction (CRITICAL)

- `touch-target-size` - Min 44x44px; extend hit area beyond visual bounds if needed
- `touch-spacing` - Minimum 8px gap between touch targets
- `hover-vs-tap` - Use click/tap for primary interactions; don't rely on hover alone
- `loading-buttons` - Disable button during async operations; show spinner or progress
- `error-feedback` - Clear error messages near problem
- `cursor-pointer` - Add cursor-pointer to clickable elements
- `tap-delay` - Use touch-action: manipulation to reduce 300ms delay
- `press-feedback` - Visual feedback on press (opacity change, scale, color shift)
- `gesture-alternative` - Don't rely on gesture-only interactions; always provide visible controls for critical actions
- `no-precision-required` - Avoid requiring pixel-perfect clicks on small icons or thin edges

### 3. Performance (HIGH)

- `image-optimization` - Use WebP/AVIF, responsive images (srcset/sizes), lazy load non-critical assets
- `image-dimension` - Declare width/height or use aspect-ratio to prevent layout shift (CLS)
- `font-loading` - Use font-display: swap/optional to avoid invisible text (FOIT)
- `font-preload` - Preload only critical fonts; avoid overusing preload on every variant
- `critical-css` - Prioritize above-the-fold CSS
- `lazy-loading` - Lazy load non-hero components via dynamic import / route-level splitting
- `bundle-splitting` - Split code by route/feature (Next.js dynamic) to reduce initial load and TTI
- `third-party-scripts` - Load third-party scripts async/defer; audit and remove unnecessary ones
- `reduce-reflows` - Avoid frequent layout reads/writes; batch DOM reads then writes
- `content-jumping` - Reserve space for async content to avoid layout jumps (CLS)
- `virtualize-lists` - Virtualize lists with 50+ items to improve memory efficiency and scroll performance
- `progressive-loading` - Use skeleton screens / shimmer instead of long blocking spinners for >1s operations
- `debounce-throttle` - Use debounce/throttle for high-frequency events (scroll, resize, input)

### 4. Style Selection (HIGH)

- `style-match` - Match style to product type and audience
- `consistency` - Use same style across all pages
- `no-emoji-icons` - Use SVG icons (Heroicons, Lucide), not emojis
- `effects-match-style` - Shadows, blur, radius aligned with chosen style
- `state-clarity` - Make hover/pressed/disabled states visually distinct while staying on-style
- `elevation-consistent` - Use a consistent elevation/shadow scale for cards, sheets, modals
- `dark-mode-pairing` - Design light/dark variants together to keep brand, contrast, and style consistent
- `icon-style-consistent` - Use one icon set/visual language (stroke width, corner radius) across the product
- `blur-purpose` - Use blur to indicate background dismissal (modals, sheets), not as decoration
- `primary-action` - Each screen should have only one primary CTA; secondary actions visually subordinate

### 5. Layout & Responsive (HIGH)

- `viewport-meta` - width=device-width initial-scale=1 (never disable zoom)
- `mobile-first` - Design mobile-first, then scale up to tablet and desktop
- `breakpoint-consistency` - Use systematic breakpoints (375 / 768 / 1024 / 1440)
- `readable-font-size` - Minimum 16px body text on mobile (avoids iOS auto-zoom)
- `line-length-control` - Mobile 35-60 chars per line; desktop 60-75 chars
- `horizontal-scroll` - No horizontal scroll on mobile; ensure content fits viewport width
- `spacing-scale` - Use 4px/8px incremental spacing system (Tailwind default)
- `container-width` - Consistent max-width on desktop (max-w-6xl / 7xl)
- `z-index-management` - Define layered z-index scale (e.g. 0 / 10 / 20 / 40 / 100 / 1000)
- `fixed-element-offset` - Fixed navbar/bottom bar must reserve safe padding for underlying content
- `scroll-behavior` - Avoid nested scroll regions that interfere with the main scroll experience
- `viewport-units` - Prefer min-h-dvh over 100vh on mobile
- `content-priority` - Show core content first on mobile; fold or hide secondary content
- `visual-hierarchy` - Establish hierarchy via size, spacing, contrast - not color alone

### 6. Typography & Color (MEDIUM)

- `line-height` - Use 1.5-1.75 for body text
- `line-length` - Limit to 65-75 characters per line
- `font-pairing` - Match heading/body font personalities
- `font-scale` - Consistent type scale (e.g. 12 14 16 18 24 32)
- `contrast-readability` - Darker text on light backgrounds (e.g. slate-900 on white)
- `weight-hierarchy` - Use font-weight to reinforce hierarchy: Bold headings (600-700), Regular body (400), Medium labels (500)
- `color-semantic` - Define semantic color tokens (primary, secondary, error, surface) not raw hex in components
- `color-dark-mode` - Dark mode uses desaturated / lighter tonal variants, not inverted colors
- `color-accessible-pairs` - Foreground/background pairs must meet 4.5:1 (AA) or 7:1 (AAA)
- `color-not-decorative-only` - Functional color (error red, success green) must include icon/text
- `truncation-strategy` - Prefer wrapping over truncation; when truncating use ellipsis and provide full text via tooltip/expand
- `number-tabular` - Use tabular/monospaced figures for data columns, prices, and timers to prevent layout shift
- `whitespace-balance` - Use whitespace intentionally to group related items and separate sections

### 7. Animation (MEDIUM)

- `duration-timing` - Use 150-300ms for micro-interactions; complex transitions <=400ms; avoid >500ms
- `transform-performance` - Use transform/opacity only; avoid animating width/height/top/left
- `loading-states` - Show skeleton or progress indicator when loading exceeds 300ms
- `excessive-motion` - Animate 1-2 key elements per view max
- `easing` - Use ease-out for entering, ease-in for exiting; avoid linear for UI transitions
- `motion-meaning` - Every animation must express a cause-effect relationship, not just be decorative
- `state-transition` - State changes (hover / active / expanded / collapsed / modal) should animate smoothly, not snap
- `continuity` - Page/screen transitions should maintain spatial continuity
- `exit-faster-than-enter` - Exit animations shorter than enter (~60-70% of enter duration)
- `stagger-sequence` - Stagger list/grid item entrance by 30-50ms per item
- `interruptible` - Animations must be interruptible; user interaction cancels in-progress animation
- `no-blocking-animation` - Never block user input during an animation; UI must stay interactive
- `scale-feedback` - Subtle scale (0.95-1.05) on press for tappable cards/buttons
- `motion-consistency` - Unify duration/easing tokens globally; all animations share the same rhythm
- `layout-shift-avoid` - Animations must not cause layout reflow or CLS; use transform for position changes

### 8. Forms & Feedback (MEDIUM)

- `input-labels` - Visible label per input (not placeholder-only)
- `error-placement` - Show error below the related field
- `submit-feedback` - Loading then success/error state on submit
- `required-indicators` - Mark required fields (e.g. asterisk)
- `empty-states` - Helpful message and action when no content
- `toast-dismiss` - Auto-dismiss toasts in 3-5s
- `confirmation-dialogs` - Confirm before destructive actions
- `input-helper-text` - Provide persistent helper text below complex inputs, not just placeholder
- `disabled-states` - Disabled elements use reduced opacity (0.38-0.5) + cursor change + semantic attribute
- `progressive-disclosure` - Reveal complex options progressively; don't overwhelm users upfront
- `inline-validation` - Validate on blur (not keystroke); show error only after user finishes input
- `input-type-keyboard` - Use semantic input types (email, tel, number) to trigger the correct mobile keyboard
- `password-toggle` - Provide show/hide toggle for password fields
- `undo-support` - Allow undo for destructive or bulk actions (e.g. "Undo delete" toast)
- `success-feedback` - Confirm completed actions with brief visual feedback (checkmark, toast, color flash)
- `error-recovery` - Error messages must include a clear recovery path (retry, edit, help link)
- `multi-step-progress` - Multi-step flows show step indicator or progress bar; allow back navigation
- `error-clarity` - Error messages must state cause + how to fix (not just "Invalid input")
- `field-grouping` - Group related fields logically (fieldset/legend or visual grouping)
- `focus-management` - After submit error, auto-focus the first invalid field
- `error-summary` - For multiple errors, show summary at top with anchor links to each field
- `destructive-emphasis` - Destructive actions use semantic danger color (red) and are visually separated from primary actions
- `toast-accessibility` - Toasts must not steal focus; use aria-live="polite" for screen reader announcement
- `contrast-feedback` - Error and success state colors must meet 4.5:1 contrast ratio

### 9. Navigation Patterns (HIGH)

- `back-behavior` - Back navigation must be predictable and consistent; preserve scroll/state
- `deep-linking` - All key screens must be reachable via URL for sharing and bookmarking
- `nav-label-icon` - Navigation items should have both icon and text label; icon-only nav harms discoverability
- `nav-state-active` - Current location must be visually highlighted (color, weight, indicator) in navigation
- `nav-hierarchy` - Primary nav vs secondary nav must be clearly separated
- `modal-escape` - Modals and sheets must offer a clear close/dismiss affordance
- `search-accessible` - Search must be easily reachable; provide recent/suggested queries
- `breadcrumb-web` - Use breadcrumbs for 3+ level deep hierarchies to aid orientation
- `state-preservation` - Navigating back must restore previous scroll position, filter state, and input
- `overflow-menu` - When actions exceed available space, use overflow/more menu instead of cramming
- `adaptive-navigation` - Large screens prefer sidebar; small screens use bottom/top nav
- `navigation-consistency` - Navigation placement must stay the same across all pages
- `avoid-mixed-patterns` - Don't mix multiple navigation paradigms at the same hierarchy level
- `modal-vs-navigation` - Modals must not be used for primary navigation flows
- `focus-on-route-change` - After page transition, move focus to main content region for screen reader users
- `persistent-nav` - Core navigation must remain reachable from deep pages
- `destructive-nav-separation` - Dangerous actions (delete, logout) visually and spatially separated from normal nav items

### 10. Charts & Data (LOW)

- `chart-type` - Match chart type to data type (trend - line, comparison - bar, proportion - pie/donut)
- `color-guidance` - Use accessible color palettes; avoid red/green only pairs for colorblind users
- `data-table` - Provide table alternative for accessibility; charts alone are not screen-reader friendly
- `pattern-texture` - Supplement color with patterns, textures, or shapes so data is distinguishable without color
- `legend-visible` - Always show legend; position near the chart, not detached below a scroll fold
- `tooltip-on-interact` - Provide tooltips/data labels on hover showing exact values
- `axis-labels` - Label axes with units and readable scale
- `responsive-chart` - Charts must reflow or simplify on small screens
- `empty-data-state` - Show meaningful empty state when no data exists, not a blank chart
- `loading-chart` - Use skeleton or shimmer placeholder while chart data loads
- `large-dataset` - For 1000+ data points, aggregate or sample; provide drill-down for detail
- `number-formatting` - Use locale-aware formatting for numbers, dates, currencies
- `no-pie-overuse` - Avoid pie/donut for >5 categories; switch to bar chart for clarity
- `contrast-data` - Data lines/bars vs background >=3:1; data text labels >=4.5:1
- `sortable-table` - Data tables must support sorting with aria-sort indicating current sort state
- `data-density` - Limit information density per chart to avoid cognitive overload

---

## Common Rules for Professional UI

### Icons & Visual Elements

| Rule | Do | Don't |
|------|-----|-------|
| No Emoji as Icons | Use SVG icons (Heroicons, Lucide) | Emojis for navigation, settings, or system controls |
| Vector-Only Assets | Use SVG that scale cleanly and support theming | Raster PNG icons that blur or pixelate |
| Stable Interaction States | Use color, opacity, or elevation transitions for press states | Layout-shifting transforms that move surrounding content |
| Consistent Icon Sizing | Define icon sizes as design tokens (w-4, w-5, w-6) | Mixing arbitrary sizes randomly |
| Stroke Consistency | Use consistent stroke width within the same visual layer | Mixing thick and thin strokes |
| Touch Target Minimum | Minimum 44x44px interactive area (use padding if icon is smaller) | Small icons without expanded click area |

### Interaction

| Rule | Do | Don't |
|------|-----|-------|
| Click feedback | Provide clear pressed feedback (opacity/elevation) within 80-150ms | No visual response on click |
| Animation timing | Keep micro-interactions around 150-300ms with natural easing | Instant transitions or slow animations (>500ms) |
| Accessibility focus | Ensure focus order matches visual order and labels are descriptive | Unlabeled controls or confusing focus traversal |
| Disabled state clarity | Use disabled semantics, reduced emphasis, and no click action | Controls that look clickable but do nothing |
| Touch target minimum | Keep click areas >=44x44px | Tiny click targets or icon-only hit areas without padding |

### Light/Dark Mode Contrast

| Rule | Do | Don't |
|------|-----|-------|
| Text contrast (light) | Maintain body text contrast >=4.5:1 against light surfaces | Low-contrast gray body text |
| Text contrast (dark) | Maintain primary text contrast >=4.5:1 on dark surfaces | Dark mode text that blends into background |
| Border visibility | Ensure separators are visible in both themes | Theme-specific borders disappearing in one mode |
| Token-driven theming | Use Tailwind semantic color tokens mapped per theme | Hardcoded per-screen hex values |
| Scrim and modal legibility | Modal scrim strong enough to isolate foreground (typically 40-60% black) | Weak scrim that leaves background competing |

### Layout & Spacing

| Rule | Do | Don't |
|------|-----|-------|
| Consistent content width | Keep predictable max-width per breakpoint | Mixing arbitrary widths between screens |
| 4/8px spacing rhythm | Use Tailwind's consistent spacing system (p-2, p-4, gap-4, gap-8) | Random spacing with no rhythm |
| Readable text measure | max-w-prose or max-w-2xl for long-form text | Full-width paragraphs on large screens |
| Section spacing hierarchy | Define clear vertical rhythm tiers (space-y-4/6/8/12) | Similar UI levels with inconsistent spacing |
| Scroll and fixed coexistence | Add padding/margin so lists are not hidden behind fixed bars | Scroll content obscured by sticky headers/footers |

---

## Pre-Delivery Checklist

Before delivering UI code, verify these items:

### Visual Quality
- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from a consistent icon family and style
- [ ] Pressed/hover state visuals do not shift layout bounds
- [ ] Semantic Tailwind color classes used consistently (no ad-hoc hardcoded colors)

### Interaction
- [ ] All clickable elements provide clear hover/active feedback
- [ ] Click targets meet minimum size (>=44x44px)
- [ ] Micro-interaction timing stays in 150-300ms range
- [ ] Disabled states are visually clear and non-interactive
- [ ] Tab order matches visual order; interactive labels are descriptive

### Contrast & Color
- [ ] Primary text contrast >=4.5:1
- [ ] Secondary text contrast >=3:1
- [ ] Error and success state colors meet 4.5:1 contrast ratio
- [ ] Color is not the only indicator (add icon/text for states)

### Layout
- [ ] No horizontal scroll on mobile
- [ ] Verified on 375px (small phone), 768px (tablet), 1440px (desktop)
- [ ] Scroll content not hidden behind fixed/sticky bars
- [ ] 4/8px spacing rhythm maintained across components
- [ ] Long-form text measure remains readable (max-w-prose)

### Accessibility
- [ ] All meaningful images/icons have alt text or aria-label
- [ ] Form fields have visible labels, hints, and clear error messages
- [ ] Heading hierarchy is sequential (h1-h6, no level skip)
- [ ] Focus rings visible on all interactive elements
- [ ] prefers-reduced-motion respected

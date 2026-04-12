---
name: frontend-design
description: "Frontend design decision-making skill. Auto-triggers when designing new frontend features, pages, or components. Scans component library and architecture guide to determine whether existing components suffice or new Stitch designs are needed."
---

# Frontend Design Skill

Guide frontend design decisions by checking existing component inventory, referencing the architecture guide, and producing actionable specs.

## When to Activate

- Designing a new page or feature that has UI
- Adding or modifying visual components
- Receiving a new frontend requirement from the user
- Before dispatching frontend work to Gemini
- When the user asks "how should this look" or "what components do I need"

## Process

### Step 1: Read Knowledge Base

Read these files to understand current state:

| File | Purpose |
|------|---------|
| `docs/superpowers/specs/frontend-architecture-guide.md` | Architecture decisions, token system, tool choices |
| `docs/superpowers/specs/2026-04-09-component-library-design.md` | Component inventory (33 components, props, CSS) |
| `docs/architecture.md` | System architecture, page list, API contracts |
| `src/app/globals.css` | Current design tokens (@theme inline block) |

### Step 2: Inventory Check

Scan the component library to answer:

1. **What components exist?** Check `src/components/ui/` for implemented components
2. **What components are specced but not built?** Cross-reference spec vs actual files
3. **Does the current inventory cover the new requirement?**

Produce a brief inventory report:

```
Component Inventory:
- Implemented: [list]
- Specced but not built: [list]
- Needed for this feature: [list]
- Gap: [what's missing, if anything]
```

### Step 3: Decision Fork

```
Is the requirement covered by existing components?
  ├─ YES → Step 4A: Assembly Spec
  ├─ PARTIALLY → Step 4B: Extend + Assemble
  └─ NO → Step 4C: New Design Needed
```

### Step 4A: Assembly Spec (existing components suffice)

Produce a page assembly spec:

```markdown
## Page: [name]
### Components Used
- ComponentA — props: { ... }
- ComponentB — props: { ... }

### Layout
[Describe how components are arranged — grid, flex, stacking order]

### Data Flow
[Where does the data come from? API route, server component, client state?]

### Interactions
[What happens on click, submit, navigate?]
```

This spec goes directly to Gemini via dispatch.

### Step 4B: Extend + Assemble (minor additions needed)

When existing components need small additions (new prop, new variant):

1. Document the component change needed
2. Check if the change aligns with the architecture guide (Section 1)
3. Check: does this create a new token need? (Section 2)
4. Produce both a component update spec AND an assembly spec

### Step 4C: New Design Needed (no existing components cover this)

When entirely new visual elements are needed:

1. **Check Stitch**: Can we generate a new screen in Stitch for this?
   - Use `mcp__stitch__list_screens` to see existing screens
   - If a similar screen exists, consider adapting it
   - If not, describe what Stitch should generate

2. **Design new components following the architecture guide**:
   - Token system compliance (Section 2)
   - Headless vs styled decision (Section 3, use the decision framework)
   - Visual fidelity assurance (Section 4)

3. **Write a component spec** following the format in `2026-04-09-component-library-design.md`:
   - Source HTML file
   - Key CSS (exact Tailwind classes)
   - Props definition
   - Usage context

4. **Transition**: Invoke brainstorming skill for full design discussion if the scope is large

### Step 5: Dispatch Preparation

Before dispatching to Gemini, always include:

1. **Component import list**: Exact imports Gemini should use
2. **FORBIDDEN patterns**: Copy from architecture guide Section 4
3. **Visual reference**: Which Stitch page/screenshot to match
4. **Token reference**: Which tokens from @theme are relevant

## Quality Gates

### Before dispatching frontend work

- [ ] All needed components exist (or are being created in the same dispatch)
- [ ] No new hardcoded colors/shadows — all use tokens
- [ ] Dispatch includes FORBIDDEN patterns list
- [ ] Visual reference (Stitch screenshot) is specified

### After receiving frontend work

- [ ] No `rgba(`, `#xxx`, `shadow-[` in page-level code
- [ ] All UI elements imported from `src/components/ui/`
- [ ] Visual comparison with Stitch reference passes
- [ ] cn() used for all className merging

## Integration with Other Skills

| Situation | Invoke |
|-----------|--------|
| New feature needs full design discussion | `brainstorming` |
| Component spec ready, need implementation plan | `writing-plans` |
| Ready to dispatch to Gemini | `structured-dispatch` |
| Code came back, need review | `requesting-code-review` |
| Visual comparison needed | Use Glance MCP directly |

## Key References

- Architecture guide: `docs/superpowers/specs/frontend-architecture-guide.md`
- Component library spec: `docs/superpowers/specs/2026-04-09-component-library-design.md`
- Design tokens: `src/app/globals.css` (@theme inline block)
- Stitch HTML sources: `wireframe/stitch/code/*.html`
- Stitch screenshots: `wireframe/stitch/page*.png`

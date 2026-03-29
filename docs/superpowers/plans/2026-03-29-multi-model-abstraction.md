# Multi-Model API Abstraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded Anthropic SDK client with Vercel AI SDK so a single env var switches all AI calls to any supported model/provider.

**Architecture:** New `src/lib/ai.ts` sets up a Vercel AI SDK provider registry (Anthropic + Google + OpenAI-compatible). All 12 call sites migrate from `claude.messages.create()` to `generateText()`. Model selection via `AI_MODEL` env var (format: `provider:model-name`).

**Tech Stack:** Vercel AI SDK v6 (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/openai`)

**Design Spec:** `docs/superpowers/specs/2026-03-29-multi-model-abstraction-design.md`

---

## Pre-conditions

- M0-M2 complete, all existing routes working with current `src/lib/claude.ts`
- Current client: Anthropic SDK with proxy support and 300s timeout
- All 12 call sites use `getClaudeClient()` + `CLAUDE_MODEL`

## Important Notes

- **Proxy support**: Current code reads `HTTPS_PROXY`/`HTTP_PROXY` and creates a `ProxyAgent` with `undici`. Vercel AI SDK providers accept a `fetch` option for custom fetch — reuse the same proxy logic there.
- **JSON extraction**: 9 of 12 files parse JSON from AI response using `/\{[\s\S]*\}/` regex. This logic stays in each route — only the AI call changes.
- **`kp-extraction-service.ts`**: This is a service, not a route. It imports `getClaudeClient` and `CLAUDE_MODEL` the same way as routes. Treat it as Pattern A.
- **`test-evaluate/route.ts`**: Only calls Claude for open questions (MC is auto-scored). The Claude call itself is Pattern A.
- **No tests exist**: This is a refactor. Verification is `npx next build` + manual smoke test with free model.

---

## Task 0: Install Vercel AI SDK Dependencies [Codex]

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
npm install ai @ai-sdk/anthropic @ai-sdk/google @ai-sdk/openai
```

- [ ] **Step 2: Verify build still passes**

```bash
npx next build
```

Expected: Build succeeds (new packages don't affect existing code yet).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install Vercel AI SDK + provider packages"
git push origin master
```

---

## Task 1: Create `src/lib/ai.ts` [Codex]

**Files:**
- Create: `src/lib/ai.ts`
- Reference: `src/lib/claude.ts` (current implementation to replace)

- [ ] **Step 1: Create `src/lib/ai.ts`**

```typescript
import { createProviderRegistry, customProvider } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'

// --- Proxy support (migrated from claude.ts) ---

function getCustomFetch(): typeof globalThis.fetch | undefined {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy ||
                process.env.HTTP_PROXY  || process.env.http_proxy
  if (!proxy) return undefined

  // Dynamic import to avoid bundling undici when no proxy is needed
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ProxyAgent, fetch: undiciFetch } = require('undici')
  const proxyAgent = new ProxyAgent(proxy)

  return (async (url: string | URL | Request, init?: RequestInit) => {
    const response = await undiciFetch(
      url as string,
      { ...(init ?? {}), dispatcher: proxyAgent } as Parameters<typeof undiciFetch>[1]
    )
    return response as unknown as Response
  }) as typeof globalThis.fetch
}

// --- Provider setup ---

const customFetch = getCustomFetch()
const timeout = 300_000 // 5 minutes, same as previous claude.ts

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  ...(customFetch ? { fetch: customFetch } : {}),
})

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  ...(customFetch ? { fetch: customFetch } : {}),
})

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
  ...(customFetch ? { fetch: customFetch } : {}),
})

// --- Provider registry ---

const registry = createProviderRegistry({
  anthropic,
  google,
  openai,
})

// --- Exports ---

/**
 * AI_MODEL env var format: "provider:model-name"
 * Examples:
 *   anthropic:claude-sonnet-4-6
 *   google:gemini-2.5-flash
 *   openai:deepseek-chat  (with OPENAI_BASE_URL=https://api.deepseek.com)
 */
export const AI_MODEL_ID = process.env.AI_MODEL || 'anthropic:claude-sonnet-4-6'

export function getModel() {
  return registry.languageModel(AI_MODEL_ID)
}

export { timeout }
```

- [ ] **Step 2: Verify build**

```bash
npx next build
```

Expected: Build succeeds. No files import `ai.ts` yet so it's unused but valid.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai.ts
git commit -m "feat: create unified AI client with Vercel AI SDK provider registry"
git push origin master
```

---

## Task 2: Migrate Pattern A Call Sites (9 files) [Codex]

All 9 files follow the identical transformation. Each file currently does:

```typescript
// REMOVE these imports:
import { getClaudeClient, CLAUDE_MODEL } from '@/lib/claude'

// REPLACE with:
import { generateText } from 'ai'
import { getModel, timeout } from '@/lib/ai'
```

And the call changes from:

```typescript
// REMOVE:
const claude = getClaudeClient()
const message = await claude.messages.create({
  model: CLAUDE_MODEL,
  max_tokens: XXXX,
  messages: [{ role: 'user', content: prompt }],
})
const rawContent = message.content[0]
// ... then extract text from rawContent

// REPLACE with:
const { text } = await generateText({
  model: getModel(),
  maxTokens: XXXX,
  prompt: prompt,
  abortSignal: AbortSignal.timeout(timeout),
})
// ... then use `text` directly (replaces rawContent.text)
```

**Files to migrate (Pattern A):**

| # | File | maxTokens |
|---|------|-----------|
| 1 | `src/app/api/modules/[moduleId]/qa-feedback/route.ts` | 1024 |
| 2 | `src/app/api/modules/[moduleId]/generate-questions/route.ts` | 4096 |
| 3 | `src/app/api/modules/[moduleId]/guide/route.ts` | 1024 |
| 4 | `src/app/api/modules/[moduleId]/generate-notes/route.ts` | 4096 |
| 5 | `src/app/api/modules/[moduleId]/evaluate/route.ts` | 8192 |
| 6 | `src/app/api/modules/[moduleId]/test-questions/route.ts` | 6000 |
| 7 | `src/app/api/modules/route.ts` | 8192 |
| 8 | `src/app/api/modules/[moduleId]/questions/route.ts` | 8192 |
| 9 | `src/app/api/modules/[moduleId]/test-evaluate/route.ts` | 2048 |

**Special notes per file:**

- **qa-feedback**: Remove the `if (rawContent.type !== 'text')` check — `generateText` always returns `text` string. JSON regex extraction uses `text` directly instead of `rawContent.text`.
- **generate-notes**: Uses raw text (no JSON parsing). Simply use `text.trim()` instead of the content block extraction.
- **test-evaluate**: Only calls Claude for open questions. The `if (openQuestions.length > 0)` guard stays. The Claude call inside it becomes `generateText`.

- [ ] **Step 1: Migrate all 9 files**

Apply the transformation above to each file. For each:
1. Replace imports
2. Replace `getClaudeClient()` + `claude.messages.create()` with `generateText()`
3. Replace `rawContent.text` / `message.content[0].text` with `text`
4. Remove `rawContent.type !== 'text'` checks (no longer needed)
5. Keep all JSON parsing logic (`/\{[\s\S]*\}/` regex) — just change the input variable name

- [ ] **Step 2: Verify build**

```bash
npx next build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/modules/ src/app/api/modules/
git commit -m "refactor: migrate 9 Pattern A routes from Anthropic SDK to Vercel AI SDK"
git push origin master
```

---

## Task 3: Migrate `kp-extraction-service.ts` (Pattern A) [Codex]

**Files:**
- Modify: `src/lib/services/kp-extraction-service.ts`

This is a service file, not a route, but uses the same Pattern A call. Same transformation as Task 2.

- [ ] **Step 1: Migrate**

Replace imports and all `claude.messages.create()` calls with `generateText()`. This file may have multiple call sites (multi-stage extraction pipeline) — migrate all of them.

- [ ] **Step 2: Verify build**

```bash
npx next build
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/kp-extraction-service.ts
git commit -m "refactor: migrate kp-extraction-service from Anthropic SDK to Vercel AI SDK"
git push origin master
```

---

## Task 4: Migrate `messages/route.ts` (Pattern B — Multi-turn) [Codex]

**Files:**
- Modify: `src/app/api/conversations/[conversationId]/messages/route.ts`

This file builds a multi-turn conversation history and includes a system prompt.

- [ ] **Step 1: Migrate**

```typescript
// REMOVE:
import { getClaudeClient, CLAUDE_MODEL } from '@/lib/claude'
const claude = getClaudeClient()
const resp = await claude.messages.create({
  model: CLAUDE_MODEL,
  max_tokens: 1024,
  system: systemPrompt,
  messages: conversationHistory,
})
const aiText = resp.content[0].type === 'text' ? resp.content[0].text : ''

// REPLACE with:
import { generateText } from 'ai'
import { getModel, timeout } from '@/lib/ai'
const { text: aiText } = await generateText({
  model: getModel(),
  maxTokens: 1024,
  system: systemPrompt,
  messages: conversationHistory,
  abortSignal: AbortSignal.timeout(timeout),
})
```

Note: Vercel AI SDK `generateText` accepts `system` and `messages` parameters directly.

- [ ] **Step 2: Verify build**

```bash
npx next build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/conversations/
git commit -m "refactor: migrate conversation route (multi-turn) to Vercel AI SDK"
git push origin master
```

---

## Task 5: Migrate `screenshot-ask/route.ts` (Pattern C — Vision) [Codex]

**Files:**
- Modify: `src/app/api/books/[bookId]/screenshot-ask/route.ts`

This file sends a base64 image + text to Claude with a system prompt.

- [ ] **Step 1: Migrate**

```typescript
// REMOVE:
import { getClaudeClient, CLAUDE_MODEL } from '@/lib/claude'
const claude = getClaudeClient()
const response = await claude.messages.create({
  model: CLAUDE_MODEL,
  max_tokens: 1024,
  system: systemPrompt,
  messages: [{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64Data } },
      { type: 'text', text: userPrompt },
    ]
  }],
})

// REPLACE with:
import { generateText } from 'ai'
import { getModel, timeout } from '@/lib/ai'
const { text } = await generateText({
  model: getModel(),
  maxTokens: 1024,
  system: systemPrompt,
  messages: [{
    role: 'user',
    content: [
      { type: 'image', image: Buffer.from(base64Data, 'base64'), mimeType: 'image/png' },
      { type: 'text', text: userPrompt },
    ],
  }],
  abortSignal: AbortSignal.timeout(timeout),
})
```

Also update the response extraction: remove the `.map(block => block.type === 'text' ? ...)` logic — `generateText` returns `text` directly as a string.

**Important:** Not all models support vision. If `AI_MODEL` points to a text-only model, this route will error. This is acceptable for MVP.

- [ ] **Step 2: Verify build**

```bash
npx next build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/books/
git commit -m "refactor: migrate screenshot-ask route (vision) to Vercel AI SDK"
git push origin master
```

---

## Task 6: Remove `src/lib/claude.ts` + Update Config [Codex]

**Files:**
- Delete: `src/lib/claude.ts`
- Modify: `.env.example` or `.env.local` (add new env vars)

- [ ] **Step 1: Verify no remaining imports of claude.ts**

```bash
grep -r "from '@/lib/claude'" src/ --include="*.ts" --include="*.tsx"
```

Expected: No results.

- [ ] **Step 2: Delete claude.ts**

```bash
rm src/lib/claude.ts
```

- [ ] **Step 3: Add new env vars to `.env.example`** (create if doesn't exist)

```env
# AI Model Configuration
# Format: provider:model-name
# Examples:
#   anthropic:claude-sonnet-4-6    (production)
#   google:gemini-2.5-flash        (dev/test, free tier)
#   openai:deepseek-chat           (budget, set OPENAI_BASE_URL=https://api.deepseek.com)
AI_MODEL=google:gemini-2.5-flash

# Provider API Keys (configure whichever provider you use)
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
OPENAI_API_KEY=
OPENAI_BASE_URL=
```

- [ ] **Step 4: Update `.env.local`** — add `AI_MODEL=anthropic:claude-sonnet-4-6` (preserve current behavior) and `GOOGLE_GENERATIVE_AI_API_KEY` if available.

- [ ] **Step 5: Verify build**

```bash
npx next build
```

Expected: Build succeeds. `claude.ts` is gone, all imports point to `ai.ts`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove claude.ts, add AI_MODEL env config"
git push origin master
```

---

## Task 7: Docs Update [Claude]

**Files:**
- Modify: `CLAUDE.md` — Update tech stack section
- Modify: `AGENTS.md` — Update import references
- Modify: `docs/project_status.md` — Record completion
- Modify: `docs/changelog.md` — Record changes

Claude (PM) handles this after Codex completes T0-T6.

---

## Verification

After all tasks complete, user switches to free model and smoke-tests:

```env
AI_MODEL=google:gemini-2.5-flash
GOOGLE_GENERATIVE_AI_API_KEY=your-key-here
```

Then opens the app and tests one module learning flow. If it works, the migration is complete.

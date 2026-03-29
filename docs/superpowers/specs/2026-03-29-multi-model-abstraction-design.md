# Multi-Model API Abstraction Layer — Design Spec

> **Priority**: T0
> **Date**: 2026-03-29
> **Status**: Draft

---

## 1. Problem

The app is hardcoded to Claude via `src/lib/claude.ts`. 12 files (11 routes + 1 service) import `getClaudeClient` and `CLAUDE_MODEL` directly. This creates two problems:

1. **Testing is expensive** — Claude Sonnet costs ¥124/M tokens. Every dev test burns real money.
2. **Vendor lock-in** — Cannot try cheaper or free models without rewriting every call site.

## 2. Goal

A single environment variable switches ALL AI calls to a different model/provider. No code changes needed to swap models.

**MVP scope**: Global model switch (one env var controls everything).
**Future scope**: Per-feature model assignment (different features use different models).

## 3. Solution: Vercel AI SDK v6

Use Vercel AI SDK — the de facto standard for multi-model abstraction in Next.js/TypeScript (1M+ weekly npm downloads, 120+ models supported). This is the same pattern used by Cursor, Continue, and other mainstream AI IDEs.

### 3.1 New Dependencies

```
ai                    — Core SDK (generateText, streamText, provider registry)
@ai-sdk/anthropic     — Claude provider
@ai-sdk/google        — Gemini provider
@ai-sdk/openai        — OpenAI + OpenAI-compatible provider (DeepSeek, Qwen, ERNIE, GLM)
```

### 3.2 Provider Coverage

| Provider Package | Models Covered | Auth Env Var |
|------------------|---------------|--------------|
| `@ai-sdk/anthropic` | Claude Sonnet 4.6, Haiku 4.5 | `ANTHROPIC_API_KEY` |
| `@ai-sdk/google` | Gemini 2.5 Pro, Flash, Flash-Lite | `GOOGLE_GENERATIVE_AI_API_KEY` |
| `@ai-sdk/openai` | GPT-5.4, DeepSeek, Qwen, ERNIE, GLM, Doubao, Grok | `OPENAI_API_KEY` + `OPENAI_BASE_URL` |

The OpenAI-compatible provider covers all Chinese models since they all implement the OpenAI chat completions protocol.

### 3.3 Configuration

One environment variable controls the model:

```env
# Format: provider:model-name
AI_MODEL=google:gemini-2.5-flash

# Provider API keys (configure whichever you use)
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=AIza...
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.deepseek.com    # optional, for OpenAI-compatible providers
```

Example configurations:

| Scenario | AI_MODEL value | Cost |
|----------|---------------|------|
| Dev/test (free) | `google:gemini-2.5-flash` | ¥0 (250 RPD free) |
| Dev/test (free, high volume) | `openai:ernie-speed` + ERNIE base URL | ¥0 (unlimited) |
| Production | `anthropic:claude-sonnet-4-6` | ¥124/M tokens |
| Budget production | `openai:deepseek-chat` + DeepSeek base URL | ¥9.5/M tokens |

### 3.4 New File: `src/lib/ai.ts`

Replaces `src/lib/claude.ts`. Responsibilities:

1. **Provider registry setup** — Register anthropic, google, openai providers
2. **`getModel()` function** — Reads `AI_MODEL` env var, returns the corresponding provider model instance
3. **Proxy support** — Current `HTTPS_PROXY` logic migrates here via custom fetch option
4. **Timeout config** — Maintains the current 300s timeout

Exports:
- `getModel()` — Returns the AI model instance based on env config
- `AI_MODEL_ID` — The raw model string for logging

### 3.5 Call Site Migration Pattern

12 files follow one of three migration patterns:

**Pattern A — Single-turn text prompt (10 files)**

```typescript
// BEFORE
import { getClaudeClient, CLAUDE_MODEL } from '@/lib/claude'
const claude = getClaudeClient()
const message = await claude.messages.create({
  model: CLAUDE_MODEL,
  max_tokens: 1024,
  messages: [{ role: 'user', content: prompt }],
})
const rawText = message.content[0].type === 'text' ? message.content[0].text : ''

// AFTER
import { generateText } from 'ai'
import { getModel } from '@/lib/ai'
const { text } = await generateText({
  model: getModel(),
  maxTokens: 1024,
  prompt: prompt,
})
```

**Pattern B — Multi-turn conversation with system prompt (`conversations/messages/route.ts`)**

```typescript
// BEFORE
const message = await claude.messages.create({
  model: CLAUDE_MODEL,
  max_tokens: 2048,
  system: systemPrompt,
  messages: conversationHistory,  // [{role:'user',content:'...'}, {role:'assistant',content:'...'}]
})

// AFTER
const { text } = await generateText({
  model: getModel(),
  maxTokens: 2048,
  system: systemPrompt,
  messages: conversationHistory,  // same format, Vercel AI SDK accepts this directly
})
```

**Pattern C — Vision / image input (`screenshot-ask/route.ts`)**

```typescript
// BEFORE (Anthropic-specific image content block)
const message = await claude.messages.create({
  model: CLAUDE_MODEL,
  max_tokens: 2048,
  messages: [{ role: 'user', content: [
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64Data } },
    { type: 'text', text: userQuestion },
  ]}],
})

// AFTER (Vercel AI SDK image format)
const { text } = await generateText({
  model: getModel(),
  maxTokens: 2048,
  messages: [{
    role: 'user',
    content: [
      { type: 'image', image: Buffer.from(base64Data, 'base64'), mimeType: 'image/png' },
      { type: 'text', text: userQuestion },
    ],
  }],
})
```

Note: Not all models support vision. If `AI_MODEL` points to a text-only model, the screenshot-ask route will fail. This is acceptable for MVP — screenshot-ask is a separate feature from the coach flow.

Each file changes ~5-8 lines.

### 3.6 Files to Modify

| File | Change |
|------|--------|
| `src/lib/ai.ts` | **Create** — New unified AI client |
| `src/lib/claude.ts` | **Delete** — Replaced by ai.ts |
| `src/app/api/modules/[moduleId]/qa-feedback/route.ts` | Migrate |
| `src/app/api/modules/[moduleId]/generate-questions/route.ts` | Migrate |
| `src/app/api/modules/[moduleId]/guide/route.ts` | Migrate |
| `src/app/api/modules/[moduleId]/generate-notes/route.ts` | Migrate |
| `src/lib/services/kp-extraction-service.ts` | Migrate |
| `src/app/api/books/[bookId]/screenshot-ask/route.ts` | Migrate |
| `src/app/api/conversations/[conversationId]/messages/route.ts` | Migrate |
| `src/app/api/modules/[moduleId]/evaluate/route.ts` | Migrate |
| `src/app/api/modules/[moduleId]/test-questions/route.ts` | Migrate |
| `src/app/api/modules/route.ts` | Migrate |
| `src/app/api/modules/[moduleId]/questions/route.ts` | Migrate |
| `src/app/api/modules/[moduleId]/test-evaluate/route.ts` | Migrate |
| `CLAUDE.md` | Update tech stack section (AI model reference) |
| `AGENTS.md` | Update import references for Codex |
| `.env.local` | Add AI_MODEL, GOOGLE_GENERATIVE_AI_API_KEY |

## 4. What Does NOT Change

- **Prompt template system** — `getPrompt()` and `src/lib/seed-templates.ts` are model-agnostic, no changes needed
- **Database schema** — No changes
- **Frontend** — No changes (frontend never calls AI directly)
- **Route structure** — No changes
- **Response format** — `handleRoute` wrapper unchanged, JSON parsing logic stays in each route

## 5. Known Risk: Prompt Compatibility

Different models respond differently to the same prompt. Switching from Claude to another model may cause:

| Risk | Impact | Mitigation |
|------|--------|-----------|
| JSON output format varies | Parse failures in routes that extract JSON from AI response | Existing `repairLooseJSON()` helps; may need to handle markdown code fences |
| Instruction adherence varies | Lower quality output (missed fields, wrong format) | Test with target model, adjust prompts if needed |
| Output quality varies | Simpler/shallower feedback, less nuanced questions | Accept for testing, keep Claude for production |

**MVP stance**: Accept that non-Claude models may produce lower quality output. The goal is to make switching possible, not to guarantee identical quality across all models. Prompt tuning for specific models is future work.

## 6. Implementation Sequence

| Task | Owner | Dependency |
|------|-------|-----------|
| T0: Install Vercel AI SDK + provider packages | Codex | None |
| T1: Create `src/lib/ai.ts` with provider registry + getModel() | Codex | T0 |
| T2: Migrate all 12 call sites from claude.ts to ai.ts | Codex | T1 |
| T3: Delete `src/lib/claude.ts` | Codex | T2 |
| T4: Update env config + docs | Claude | T2 |
| T5: Smoke test with Gemini Flash (free) | User | T3 |

All tasks are Codex (backend), except docs (Claude) and manual test (user).

## 7. Reversibility

**Easy to revert.** If Vercel AI SDK causes unexpected issues:
- `git revert` the migration commits
- `src/lib/claude.ts` is restored
- Total rollback time: minutes

No database changes, no frontend changes, no schema changes. Pure backend refactor.

# M5 功能补完 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix broken features (screenshot-ask, Markdown rendering), add missing displays (correct answers, dashboard, mistakes page), make the MVP usable.

**Architecture:** Backend-first approach — schema migration and API endpoints first, then frontend consumes them. All new APIs use `handleRoute` wrapper (returns `{ success: true, data: ... }`). Frontend uses a shared `<AIResponse>` component for all AI text rendering.

**Tech Stack:** Next.js 15 App Router, better-sqlite3, Vercel AI SDK, react-markdown + remark-gfm, @tailwindcss/typography

**Spec:** `docs/superpowers/specs/2026-04-03-m5-feature-completion-design.md`

---

## Dependency Graph

```
T1 (schema+template) ──→ T3 (screenshot APIs) ──→ T6 (screenshot UI)
         │                                              ↑
         │                                         T2 (AIResponse) ──→ T9 (rollout)
         │                                              ↑
         └──→ T4 (review+test APIs) ──────────→ T7 (answer display)
                                                        
T5 (dashboard+mistakes APIs) ──────────────→ T8 (dashboard+mistakes pages)
```

**Parallel lanes:**
- Codex: T1 → T3 → T4 → T5
- Gemini: T2 → (wait T3) → T6 → (wait T4) → T7 → (wait T5) → T8 → T9

---

## Task 1: Schema Migration + Seed Template (Codex)

**Files:**
- Modify: `src/lib/db.ts` (migration block, ~line 260-278 area)
- Modify: `src/lib/seed-templates.ts` (assistant/screenshot_qa template, line 424-428)

**Depends on:** Nothing

- [ ] **Step 1: Add mistakes table migration**

In `db.ts`, find the existing ALTER TABLE migration block (try/catch pattern around line 260-278). Add 3 new ALTER TABLE statements for the mistakes table:

```typescript
// Add to the migration block in db.ts
try { db.exec('ALTER TABLE mistakes ADD COLUMN question_text TEXT') } catch { /* already exists */ }
try { db.exec('ALTER TABLE mistakes ADD COLUMN user_answer TEXT') } catch { /* already exists */ }
try { db.exec('ALTER TABLE mistakes ADD COLUMN correct_answer TEXT') } catch { /* already exists */ }
```

All nullable — existing rows keep NULL values. New inserts will populate these.

- [ ] **Step 2: Update assistant seed template**

In `seed-templates.ts`, find the assistant/screenshot_qa template (line 424-428). The current `template_text` is garbled UTF-8. Replace with clean Chinese:

```typescript
{
  role: 'assistant',
  stage: 'screenshot_qa',
  template_text: '以下是教材内容：\n{screenshot_text}\n\n用户的问题：{user_question}\n\n{conversation_history}',
},
```

Variables `{screenshot_text}`, `{user_question}`, `{conversation_history}` are preserved — they get substituted by `getPrompt()` at runtime.

- [ ] **Step 3: Verify migration runs**

```bash
# Delete existing DB to force recreation with migration
rm -f data/app.db
npm run dev
# Check app starts without errors, then stop
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/db.ts src/lib/seed-templates.ts
git commit -m "feat(m5): mistakes schema migration + fix assistant prompt template"
git push origin master
```

---

## Task 2: AIResponse Component + Dependencies (Gemini)

**Files:**
- Create: `src/components/AIResponse.tsx`
- Modify: `package.json` (new deps)
- Modify: `tailwind.config.ts` (typography plugin)

**Depends on:** Nothing

- [ ] **Step 1: Install dependencies**

```bash
npm install react-markdown remark-gfm @tailwindcss/typography
```

- [ ] **Step 2: Add typography plugin to Tailwind config**

In `tailwind.config.ts`, add `@tailwindcss/typography` to the plugins array:

```typescript
plugins: [
  require('@tailwindcss/typography'),
  // ... existing plugins
],
```

- [ ] **Step 3: Create AIResponse component**

Create `src/components/AIResponse.tsx`:

```tsx
'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface AIResponseProps {
  content: string
  className?: string
}

export default function AIResponse({ content, className = '' }: AIResponseProps) {
  if (!content) return null

  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
```

- [ ] **Step 4: Verify component renders**

Import and use in any existing page temporarily to verify Markdown renders correctly (tables, headers, bold, code blocks). Remove test usage after verification.

- [ ] **Step 5: Commit**

```bash
git add src/components/AIResponse.tsx package.json package-lock.json tailwind.config.ts
git commit -m "feat(m5): AIResponse component with react-markdown + typography"
git push origin master
```

---

## Task 3: Screenshot APIs (Codex)

**Files:**
- Create: `src/app/api/books/[bookId]/screenshot-ocr/route.ts`
- Modify: `src/app/api/books/[bookId]/screenshot-ask/route.ts`

**Depends on:** T1 (seed template updated)

### Step group A: New screenshot-ocr endpoint

- [ ] **Step 1: Create screenshot-ocr route**

Create `src/app/api/books/[bookId]/screenshot-ocr/route.ts`. This endpoint ONLY does OCR, no AI call.

Extract the `ocrImage()` and `isUsefulOcrText()` functions from the existing `screenshot-ask/route.ts` (lines 18-83) into this new file (or a shared utility). The endpoint:

1. Receives `{ imageBase64 }` in POST body
2. Writes base64 to a temp file
3. Calls PaddleOCR HTTP service at `127.0.0.1:9876/ocr`
4. Returns `{ data: { text: "...", confidence: 0.95 } }`
5. Uses `handleRoute` wrapper for consistent response format

```typescript
// Key structure — reuse ocrImage() logic from screenshot-ask
export const POST = handleRoute(async (req, context) => {
  const { bookId } = await context!.params
  // ... validate bookId, parse body, get imageBase64
  // ... write to temp file, call ocrImage(), cleanup
  return { data: { text: ocr.text, confidence: ocr.confidence } }
})
```

- [ ] **Step 2: Rewrite screenshot-ask route**

Modify `src/app/api/books/[bookId]/screenshot-ask/route.ts`:

**Remove:**
- `buildScreenshotPrompt()` function (lines 85-102)
- Hardcoded `systemPrompt` string (line 150-151)
- Internal OCR call — the frontend now sends OCR text directly
- `extractedText` from response (line 194)

**Change request body** from `{ imageBase64, pageNumber }` to `{ image, text, question }`:
- `image`: base64 encoded screenshot (for AI vision)
- `text`: OCR text from screenshot-ocr (for context)
- `question`: user's question

**Add prompt template usage:**

```typescript
import { getPrompt } from '@/lib/prompt-templates'

// System prompt (hardcoded, short role definition)
const systemPrompt = `你是一个教材学习助手。用户会给你一段教材内容（文字+截图），并提出问题。
规则：
1. 只根据提供的内容回答，不要编造内容之外的信息
2. 用与教材内容相同的语言回答（中文内容用中文，英文内容用英文）
3. 回答要清晰、有条理，使用 Markdown 格式`

// User prompt from template system
const userPrompt = getPrompt('assistant', 'screenshot_qa', {
  screenshot_text: body.text || '(无文字识别结果)',
  user_question: body.question,
  conversation_history: '', // empty for first message
})
```

**AI call structure** — keep the multipart message with image + text:

```typescript
const { text } = await generateText({
  model: getModel(),
  maxOutputTokens: 1024,
  system: systemPrompt,
  messages: [{
    role: 'user',
    content: [
      { type: 'image', image: Buffer.from(base64Data, 'base64'), mediaType: 'image/png' },
      { type: 'text', text: userPrompt },
    ],
  }],
  abortSignal: AbortSignal.timeout(timeout),
})
```

**Response:** Return `{ data: { conversationId, answer } }` (no more `extractedText`). Use `handleRoute` wrapper.

**Conversation creation:** Still insert into conversations table with `screenshot_text` from body.text. Store user's question (not the rendered template) as the user message.

- [ ] **Step 3: Test both endpoints manually**

```bash
# 1. Start dev server
npm run dev

# 2. Test screenshot-ocr with a base64 image
curl -X POST http://localhost:3000/api/books/1/screenshot-ocr \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"<base64-data>"}'

# 3. Test screenshot-ask with text + question
curl -X POST http://localhost:3000/api/books/1/screenshot-ask \
  -H "Content-Type: application/json" \
  -d '{"image":"<base64>","text":"extracted text","question":"What does this mean?"}'
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/books/\[bookId\]/screenshot-ocr/ src/app/api/books/\[bookId\]/screenshot-ask/
git commit -m "feat(m5): split screenshot flow — new OCR endpoint + ask rewrite with prompt template"
git push origin master
```

---

## Task 4: Review Respond + Test Submit Updates (Codex)

**Files:**
- Modify: `src/app/api/review/[scheduleId]/respond/route.ts`
- Modify: `src/app/api/modules/[moduleId]/test/submit/route.ts`

**Depends on:** T1 (schema migration for mistakes columns)

### Step group A: Review respond — add correct_answer to response + update mistakes INSERT

- [ ] **Step 1: Add correct_answer + explanation to review respond response**

In `src/app/api/review/[scheduleId]/respond/route.ts`, the response is built at ~line 280-288:

```typescript
// CURRENT:
return {
  data: {
    is_correct: feedback.is_correct,
    score: feedback.score,
    ai_feedback: feedback.feedback,
    has_next: Boolean(nextQuestion),
    next_question: formatNextQuestion(nextQuestion),
  },
}
```

The `question` variable (queried earlier) is of type `ReviewQuestionRow` which already has `correct_answer` and `explanation` fields from the review_questions table. Add them to the response:

```typescript
// CHANGED:
return {
  data: {
    is_correct: feedback.is_correct,
    score: feedback.score,
    ai_feedback: feedback.feedback,
    correct_answer: question.correct_answer,
    explanation: question.explanation,
    has_next: Boolean(nextQuestion),
    next_question: formatNextQuestion(nextQuestion),
  },
}
```

- [ ] **Step 2: Update mistakes INSERT in review respond**

Find the mistakes INSERT at ~line 254-263:

```typescript
// CURRENT:
db.prepare(`
  INSERT INTO mistakes (module_id, kp_id, knowledge_point, error_type, source, remediation, is_resolved)
  VALUES (?, ?, ?, ?, 'review', ?, 0)
`).run(schedule.module_id, question.kp_id, knowledgePointLabel, normalizedErrorType, feedback.remediation)
```

Add the 3 new columns. The data is available from:
- `question_text` → `question.question_text`
- `user_answer` → from the request body (the user's answer that was just submitted)
- `correct_answer` → `question.correct_answer`

```typescript
// CHANGED:
db.prepare(`
  INSERT INTO mistakes (module_id, kp_id, knowledge_point, error_type, source, remediation, is_resolved, question_text, user_answer, correct_answer)
  VALUES (?, ?, ?, ?, 'review', ?, 0, ?, ?, ?)
`).run(
  schedule.module_id,
  question.kp_id,
  knowledgePointLabel,
  normalizedErrorType,
  feedback.remediation,
  question.question_text,
  userAnswer,            // local variable from parseRequestBody() — NOT body.answer
  question.correct_answer
)
```

Check where `body.answer` comes from — find the request body parsing earlier in the function (should be something like `const { question_id, answer } = body`).

### Step group B: Test submit — update mistakes INSERT

- [ ] **Step 3: Update mistakes INSERT in test submit**

In `src/app/api/modules/[moduleId]/test/submit/route.ts`, find the mistakes INSERT at ~line 213-229:

```typescript
// CURRENT:
const insertMistake = db.prepare(`
  INSERT INTO mistakes (module_id, kp_id, knowledge_point, error_type, source, remediation)
  VALUES (?, ?, ?, ?, ?, ?)
`)
for (const r of allResults) {
  if (r.is_correct) continue
  const q = questions.find((qu) => qu.id === r.question_id)!
  const kpIdsArr: number[] = q.kp_ids ? JSON.parse(q.kp_ids) : []
  insertMistake.run(id, q.kp_id ?? kpIdsArr[0] ?? null, q.question_text.slice(0, 200), r.error_type ?? 'blind_spot', 'test', r.remediation ?? null)
}
```

Add the 3 new columns. Data sources:
- `question_text` → `q.question_text` (full text, not sliced — that was for `knowledge_point`)
- `user_answer` → find from `body.answers` matching `q.id`
- `correct_answer` → `q.correct_answer`

```typescript
// CHANGED:
const insertMistake = db.prepare(`
  INSERT INTO mistakes (module_id, kp_id, knowledge_point, error_type, source, remediation, question_text, user_answer, correct_answer)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
for (const r of allResults) {
  if (r.is_correct) continue
  const q = questions.find((qu) => qu.id === r.question_id)!
  const kpIdsArr: number[] = q.kp_ids ? JSON.parse(q.kp_ids) : []
  const userAnswer = body.answers.find((a) => a.question_id === q.id)
  insertMistake.run(
    id,
    q.kp_id ?? kpIdsArr[0] ?? null,
    q.question_text.slice(0, 200),
    r.error_type ?? 'blind_spot',
    'test',
    r.remediation ?? null,
    q.question_text,
    userAnswer?.user_answer ?? '',
    q.correct_answer ?? null
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/review/\[scheduleId\]/respond/ src/app/api/modules/\[moduleId\]/test/submit/
git commit -m "feat(m5): add correct_answer to review response + populate mistakes new columns"
git push origin master
```

---

## Task 5: Dashboard + Mistakes APIs (Codex)

**Files:**
- Create: `src/app/api/books/[bookId]/dashboard/route.ts`
- Create: `src/app/api/books/[bookId]/mistakes/route.ts`

**Depends on:** Nothing (reads existing tables; new mistakes columns are nullable so old data works fine)

### Step group A: Dashboard API

- [ ] **Step 1: Create dashboard aggregate endpoint**

Create `src/app/api/books/[bookId]/dashboard/route.ts`. This is a GET endpoint that aggregates data from 4+ tables.

Use `handleRoute` wrapper. Pattern reference: `src/app/api/modules/[moduleId]/mistakes/route.ts` for how to use `handleRoute` with GET.

```typescript
import { handleRoute } from '@/lib/handle-route'
import { getDb } from '@/lib/db'
import { UserError } from '@/lib/errors'

export const GET = handleRoute(async (_req, context) => {
  const { bookId } = await context!.params
  const id = Number(bookId)
  if (!Number.isInteger(id) || id <= 0) throw new UserError('Invalid book ID', 'INVALID_ID', 400)

  const db = getDb()

  // 1. Book info
  const book = db.prepare('SELECT id, title FROM books WHERE id = ?').get(id)
  if (!book) throw new UserError('Book not found', 'NOT_FOUND', 404)

  // 2. Modules with learning status + QA progress
  const modules = db.prepare(`
    SELECT m.id, m.title, m.order_index, m.learning_status, m.kp_count,
      (SELECT COUNT(*) FROM qa_questions qq WHERE qq.module_id = m.id) as qa_total,
      (SELECT COUNT(*) FROM qa_responses qr
       JOIN qa_questions qq2 ON qq2.id = qr.question_id
       WHERE qq2.module_id = m.id) as qa_answered,
      (SELECT tp.total_score FROM test_papers tp WHERE tp.module_id = m.id ORDER BY tp.created_at DESC LIMIT 1) as test_score,
      (SELECT tp.is_passed FROM test_papers tp WHERE tp.module_id = m.id ORDER BY tp.created_at DESC LIMIT 1) as test_passed
    FROM modules m WHERE m.book_id = ? ORDER BY m.order_index
  `).all(id)

  const totalModules = modules.length
  const completedModules = modules.filter(m => m.learning_status === 'completed').length

  // 3. Reviews due
  const reviewsDue = db.prepare(`
    SELECT rs.id as scheduleId, rs.module_id as moduleId, m.title as moduleTitle,
           rs.due_date as dueDate, rs.review_round as round
    FROM review_schedule rs
    JOIN modules m ON m.id = rs.module_id
    WHERE m.book_id = ? AND rs.status = 'pending'
    ORDER BY rs.due_date ASC
  `).all(id)

  // 4. Recent tests
  const recentTests = db.prepare(`
    SELECT tp.module_id as moduleId, m.title as moduleTitle,
           tp.total_score as score, tp.is_passed as passed, tp.created_at as completedAt
    FROM test_papers tp
    JOIN modules m ON m.id = tp.module_id
    WHERE m.book_id = ?
    ORDER BY tp.created_at DESC LIMIT 10
  `).all(id)

  // 5. Mistakes summary
  const mistakesSummary = db.prepare(`
    SELECT error_type, COUNT(*) as count
    FROM mistakes mk
    JOIN modules m ON m.id = mk.module_id
    WHERE m.book_id = ?
    GROUP BY error_type
  `).all(id)

  // Build summary
  const byType = { blind_spot: 0, procedural: 0, confusion: 0, careless: 0 }
  let total = 0
  for (const row of mistakesSummary) {
    if (row.error_type in byType) byType[row.error_type] = row.count
    total += row.count
  }

  return {
    data: {
      book: { id, title: book.title, totalModules, completedModules },
      modules: modules.map(m => ({
        id: m.id, title: m.title, orderIndex: m.order_index,
        learningStatus: m.learning_status,
        qaProgress: { total: m.qa_total, answered: m.qa_answered },
        testScore: m.test_score ?? null,
        testPassed: m.test_passed === 1 ? true : m.test_passed === 0 ? false : null,
      })),
      reviewsDue: reviewsDue.map(r => ({
        ...r, isOverdue: new Date(r.dueDate) < new Date(new Date().toDateString()),
      })),
      recentTests: recentTests.map(t => ({ ...t, passed: t.passed === 1 })),
      mistakesSummary: { total, byType },
    },
  }
})
```

Adjust TypeScript types for the query results as needed. The above is the logic structure — add proper type annotations for each `.get()` and `.all()` result.

### Step group B: Book-level mistakes API

- [ ] **Step 2: Create book-level mistakes endpoint**

Create `src/app/api/books/[bookId]/mistakes/route.ts`. Reference the existing module-level version at `src/app/api/modules/[moduleId]/mistakes/route.ts` for pattern.

GET endpoint with optional query params: `module`, `errorType`, `source`.

```typescript
import { handleRoute } from '@/lib/handle-route'
import { getDb } from '@/lib/db'
import { UserError } from '@/lib/errors'

export const GET = handleRoute(async (req, context) => {
  const { bookId } = await context!.params
  const id = Number(bookId)
  if (!Number.isInteger(id) || id <= 0) throw new UserError('Invalid book ID', 'INVALID_ID', 400)

  const db = getDb()
  const url = new URL(req.url)
  const moduleFilter = url.searchParams.get('module')
  const errorTypeFilter = url.searchParams.get('errorType')
  const sourceFilter = url.searchParams.get('source')

  // Build dynamic WHERE clause
  const conditions = ['m.book_id = ?']
  const params: (string | number)[] = [id]

  if (moduleFilter) { conditions.push('mk.module_id = ?'); params.push(Number(moduleFilter)) }
  if (errorTypeFilter) { conditions.push('mk.error_type = ?'); params.push(errorTypeFilter) }
  if (sourceFilter) { conditions.push('mk.source = ?'); params.push(sourceFilter) }

  const whereClause = conditions.join(' AND ')

  const mistakes = db.prepare(`
    SELECT mk.id, mk.module_id, m.title as moduleTitle,
           mk.question_text as questionText, mk.user_answer as userAnswer,
           mk.correct_answer as correctAnswer, mk.error_type as errorType,
           mk.remediation, mk.source, mk.created_at as createdAt,
           kp.description as kpTitle
    FROM mistakes mk
    JOIN modules m ON m.id = mk.module_id
    LEFT JOIN knowledge_points kp ON kp.id = mk.kp_id
    WHERE ${whereClause}
    ORDER BY mk.created_at DESC
  `).all(...params)

  // Summary
  const summaryByType = db.prepare(`
    SELECT mk.error_type, COUNT(*) as count
    FROM mistakes mk JOIN modules m ON m.id = mk.module_id
    WHERE m.book_id = ? GROUP BY mk.error_type
  `).all(id)

  const summaryByModule = db.prepare(`
    SELECT mk.module_id as moduleId, m.title as moduleTitle, COUNT(*) as count
    FROM mistakes mk JOIN modules m ON m.id = mk.module_id
    WHERE m.book_id = ? GROUP BY mk.module_id
  `).all(id)

  const byType = { blind_spot: 0, procedural: 0, confusion: 0, careless: 0 }
  let total = 0
  for (const r of summaryByType) {
    if (r.error_type in byType) byType[r.error_type] = r.count
    total += r.count
  }

  return {
    data: {
      mistakes,
      summary: { total, byType, byModule: summaryByModule },
    },
  }
})
```

- [ ] **Step 3: Test both endpoints**

```bash
npm run dev
curl http://localhost:3000/api/books/1/dashboard
curl http://localhost:3000/api/books/1/mistakes
curl "http://localhost:3000/api/books/1/mistakes?errorType=blind_spot"
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/books/\[bookId\]/dashboard/ src/app/api/books/\[bookId\]/mistakes/
git commit -m "feat(m5): dashboard aggregate API + book-level mistakes API"
git push origin master
```

---

## Task 6: Screenshot Flow UI Rewrite (Gemini)

**Files:**
- Modify: `src/app/books/[bookId]/reader/AiChatDialog.tsx` (major rewrite)
- Possibly modify: `src/app/books/[bookId]/reader/page.tsx` (if props change)

**Depends on:** T2 (AIResponse component), T3 (screenshot APIs)

- [ ] **Step 1: Rewrite AiChatDialog to two-step flow**

Current flow (AiChatDialog.tsx): On mount, sends `imageBase64` + `pageNumber` to `/api/books/{bookId}/screenshot-ask`, gets back auto-explanation.

New flow — two-step state machine:

```
idle → capturing → ocr_processing → text_ready → asking → answered
```

**IMPORTANT — response format change:** The rewritten screenshot-ask API now uses `handleRoute` wrapper, so the response format changes from raw `{ conversationId, extractedText, answer }` to `{ success: true, data: { conversationId, answer } }`. The screenshot-ocr API also uses `handleRoute`, returning `{ success: true, data: { text, confidence } }`. Parse accordingly: `const { data } = await res.json()` then use `data.answer`, `data.text` etc.

Key changes:

1. **Remove auto-explain on mount.** Instead, on mount call screenshot-ocr API first.
2. **Step 1 — OCR:** Call `POST /api/books/{bookId}/screenshot-ocr` with `{ imageBase64 }`. Show "识别中..." spinner. On success, display recognized text and show question input.
3. **Step 2 — Ask:** User types question, clicks send. Call `POST /api/books/{bookId}/screenshot-ask` with `{ image: imageBase64, text: ocrText, question: userQuestion }`. Show "AI 思考中..." spinner. On success, display answer.
4. **Render AI answer with `<AIResponse>`** component instead of plain text.
5. **Remove `extractedText`** from screenshot-ask response handling (API no longer returns it).
6. **Follow-up questions** still work via the existing conversations/messages API (conversationId is returned by screenshot-ask).

State management:

```typescript
type FlowState = 'ocr_processing' | 'text_ready' | 'asking' | 'answered' | 'error'

const [flowState, setFlowState] = useState<FlowState>('ocr_processing')
const [ocrText, setOcrText] = useState('')
const [question, setQuestion] = useState('')
```

Loading indicators:
- `ocr_processing`: "识别中..." with spinner
- `text_ready`: Show OCR text + input box + send button
- `asking`: "AI 思考中..." with spinner
- `answered`: Show AI response with `<AIResponse>` component

- [ ] **Step 2: Update props if needed**

Check if `page.tsx` passes `pageNumber` — it's no longer needed by screenshot-ocr (OCR doesn't need page context). But keep it available for screenshot-ask if the conversation record still stores it.

- [ ] **Step 3: Test the full flow in browser**

1. Open PDF reader for a book
2. Take a screenshot of a text area
3. Verify "识别中..." appears
4. Verify OCR text is displayed
5. Type a question and submit
6. Verify "AI 思考中..." appears
7. Verify AI answer renders as Markdown
8. Verify follow-up questions still work

- [ ] **Step 4: Commit**

```bash
git add src/app/books/\[bookId\]/reader/
git commit -m "feat(m5): two-step screenshot flow — OCR first, then user asks question"
git push origin master
```

---

## Task 7: Correct Answer Display (Gemini)

**Files:**
- Modify: Review session component (find the component that renders review respond results)
- Modify: Test results component (find the component that renders test submit results)

**Depends on:** T2 (AIResponse component), T4 (review respond API returns correct_answer)

- [ ] **Step 1: Find the review and test result display components**

Search for components that:
- Call `/api/review/{scheduleId}/respond` and display `ai_feedback`
- Call `/api/modules/{moduleId}/test/submit` and display test results

```bash
grep -r "ai_feedback\|respond.*review\|test.*submit" src/app/ src/components/ --include="*.tsx" -l
```

- [ ] **Step 2: Add correct answer display to review feedback**

After the AI feedback section, add:

```tsx
{/* After existing AI feedback display */}
{data.correct_answer && (
  <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
    <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">正确答案</p>
    <AIResponse content={data.correct_answer} />
  </div>
)}
{data.explanation && (
  <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
    <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">解析</p>
    <AIResponse content={data.explanation} />
  </div>
)}
```

- [ ] **Step 3: Add correct answer display to test results**

Test submit already returns `correct_answer` and `explanation` per question in the `results` array. Find where results are displayed and add similar blocks. The data is at `result.correct_answer` and `result.explanation`.

- [ ] **Step 4: Test in browser**

1. Complete a review session — verify correct answer + explanation appear after each response
2. Submit a test — verify correct answer + explanation appear in results

- [ ] **Step 5: Commit**

```bash
git add src/  # add only changed review/test display files
git commit -m "feat(m5): show correct answer + explanation after review and test scoring"
git push origin master
```

---

## Task 8: Dashboard + Mistakes Pages (Gemini)

**Files:**
- Create: `src/app/books/[bookId]/dashboard/page.tsx`
- Create: `src/app/books/[bookId]/mistakes/page.tsx`
- Modify: `src/app/page.tsx` (add dashboard entry to book cards)
- Modify: `src/app/books/[bookId]/page.tsx` (add dashboard entry)

**Depends on:** T2 (AIResponse component), T5 (dashboard + mistakes APIs)

### Step group A: Dashboard page

- [ ] **Step 1: Create dashboard page**

Create `src/app/books/[bookId]/dashboard/page.tsx`.

Fetch from `GET /api/books/{bookId}/dashboard`. The response is wrapped in `{ success: true, data: { ... } }`.

Layout — 4 sections in a 2×2 grid (responsive, single column on mobile):

```
┌──────────────┬──────────────┐
│ 学习进度      │ 待复习        │
├──────────────┼──────────────┤
│ 测试成绩      │ 错题快照      │
└──────────────┴──────────────┘
```

Key UI elements:
- **Top bar:** Book title + overall progress bar (`completedModules/totalModules`)
- **学习进度:** List each module with status icon (✅ completed, 📝 qa, 📖 reading, ⬜ unstarted). Click → navigate to `/modules/{moduleId}`
- **待复习:** List review_schedule items. Overdue items highlighted in red. Click → navigate to `/books/{bookId}/modules/{moduleId}/review?scheduleId={id}`
- **测试成绩:** Recent tests with score and pass/fail badge
- **错题快照:** Total count + error type distribution. "查看错题本 →" link to `/books/{bookId}/mistakes`

Use Tailwind for styling. Cards with subtle borders and hover effects.

### Step group B: Mistakes page

- [ ] **Step 2: Create mistakes page**

Create `src/app/books/[bookId]/mistakes/page.tsx`.

Fetch from `GET /api/books/{bookId}/mistakes`. Supports query params: `module`, `errorType`, `source`.

Layout:
- **Top:** Summary bar (total mistakes count)
- **Filter bar:** Module dropdown, error type tags (clickable to filter), source tags
- **List:** Cards for each mistake, showing:
  - Question text
  - User answer vs correct answer (side by side or stacked, clearly contrasted)
  - Error type badge (color-coded: blind_spot=purple, procedural=orange, confusion=yellow, careless=gray)
  - Remediation text rendered with `<AIResponse>` component
  - Source badge (test/review)
  - KP title
  - Timestamp

Implement client-side filter state that adds query params to the fetch URL.

### Step group C: Entry points

- [ ] **Step 3: Add dashboard entry to homepage**

In `src/app/page.tsx`, find the book card/list rendering. Add a "仪表盘" button/link to each book card that navigates to `/books/{bookId}/dashboard`.

- [ ] **Step 4: Add dashboard entry to book detail page**

In `src/app/books/[bookId]/page.tsx`, add a prominent link/button to the dashboard.

- [ ] **Step 5: Test in browser**

1. Navigate to homepage → verify "仪表盘" button on book cards
2. Click → verify dashboard page loads with all 4 sections
3. Navigate to mistakes page → verify list and filters work
4. Test filters (module, error type, source)

- [ ] **Step 6: Commit**

```bash
git add src/app/books/\[bookId\]/dashboard/ src/app/books/\[bookId\]/mistakes/ src/app/page.tsx src/app/books/\[bookId\]/page.tsx
git commit -m "feat(m5): dashboard page + mistakes page + entry points"
git push origin master
```

---

## Task 9: AIResponse Rollout (Gemini)

**Files:**
- Modify: All components that display AI-generated text

**Depends on:** T2 (AIResponse component), T6/T7/T8 (should be done first so new pages already use AIResponse)

- [ ] **Step 1: Find all AI text display locations**

Search for components that display AI-generated content as plain text:

```bash
grep -rn "ai_feedback\|feedback\|guide\|notes\|answer" src/app/ src/components/ --include="*.tsx" | grep -v "node_modules\|\.d\.ts"
```

Target locations from spec:
1. QA feedback (after answering a QA question)
2. Test scoring feedback (per-question feedback)
3. Review scoring feedback (per-question feedback)
4. Screenshot ask answer (already done in T6)
5. Study notes / module notes display
6. Reading guide (pre-reading guidance)

- [ ] **Step 2: Replace plain text with AIResponse in each location**

For each location found, replace patterns like:

```tsx
// Before:
<p>{feedback}</p>
// or
<div>{data.ai_feedback}</div>
```

With:

```tsx
// After:
import AIResponse from '@/components/AIResponse'
<AIResponse content={feedback} />
```

Do NOT change any component logic — only the rendering of AI text.

- [ ] **Step 3: Verify Markdown renders correctly**

Test each location:
1. QA: Answer a QA question → verify feedback renders Markdown
2. Test: Submit a test → verify per-question feedback renders Markdown
3. Review: Complete a review response → verify feedback renders Markdown
4. Notes: View study notes → verify Markdown rendering
5. Guide: Open a module reading guide → verify Markdown rendering

Check that existing content (which may not use Markdown) still displays correctly — `<AIResponse>` should pass through plain text gracefully.

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "feat(m5): replace all AI text outputs with AIResponse Markdown component"
git push origin master
```

---

## Post-Completion Checklist

After all 9 tasks are done:

- [ ] Update `docs/architecture.md` — add new pages, APIs, interface contract changes
- [ ] Update `docs/project_status.md` — M5 status
- [ ] Update `docs/changelog.md` — M5 changes
- [ ] Run milestone-audit skill

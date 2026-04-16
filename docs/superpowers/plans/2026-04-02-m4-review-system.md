---
date: 2026-04-02
topic: M4复习系统实施计划
type: plan
status: resolved
keywords: [M4, review, spaced-repetition, P-value, scheduling]
---

# M4 复习系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete review system — scheduling, AI-generated questions, per-question feedback, P-value updates, and a minimal frontend.

**Architecture:** 4 new API endpoints under `/api/review/`, 2 new DB tables, 1 new + 1 modified prompt template, frontend review session page + homepage button. Follows existing patterns: `handleRoute` wrapper, `getPrompt` for templates, `generateText` from Vercel AI SDK. Review session uses QA-mode (one question at a time with immediate AI feedback).

**Tech Stack:** Next.js 15 App Router, better-sqlite3, Vercel AI SDK (`generateText`), Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-02-m4-review-system-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/db.ts` | Add review_questions + review_responses tables; add P-value reset migration |
| Modify | `src/lib/seed-templates.ts` | Fix review_generation prompt; add review_scoring prompt |
| Modify | `src/app/api/modules/[moduleId]/test/submit/route.ts` | Fix P-value initialization (simple assignment, not incremental) |
| Create | `src/app/api/review/due/route.ts` | GET due reviews |
| Create | `src/app/api/review/[scheduleId]/generate/route.ts` | POST generate review questions |
| Create | `src/app/api/review/[scheduleId]/respond/route.ts` | POST submit answer + AI feedback |
| Create | `src/app/api/review/[scheduleId]/complete/route.ts` | POST complete session + P-value update |
| Create | `src/app/books/[bookId]/modules/[moduleId]/review/page.tsx` | Review page (thin wrapper) |
| Create | `src/app/books/[bookId]/modules/[moduleId]/review/ReviewSession.tsx` | Review session component |
| Modify | `src/app/page.tsx` | Add review button |
| Modify | `docs/architecture.md` | Fix P-value docs + add review system |

**Dependency order:** T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8

---

### Task 1: Schema + Seed Templates + P-Value Fix

**Owner:** Codex (backend)
**Files:**
- Modify: `src/lib/db.ts:200-220` (after review_records table)
- Modify: `src/lib/seed-templates.ts:339-385` (reviewer templates)
- Modify: `src/app/api/modules/[moduleId]/test/submit/route.ts:264-293` (P-value logic)

- [ ] **Step 1: Add review_questions and review_responses tables to db.ts**

Add after the `review_records` CREATE TABLE (around line 219):

```typescript
    CREATE TABLE IF NOT EXISTS review_questions (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        schedule_id     INTEGER NOT NULL REFERENCES review_schedule(id) ON DELETE CASCADE,
        module_id       INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
        cluster_id      INTEGER NOT NULL REFERENCES clusters(id),
        kp_id           INTEGER REFERENCES knowledge_points(id),
        question_type   TEXT    NOT NULL CHECK(question_type IN ('single_choice','c2_evaluation','calculation','essay')),
        question_text   TEXT    NOT NULL,
        options         TEXT,
        correct_answer  TEXT    NOT NULL,
        explanation     TEXT,
        order_index     INTEGER NOT NULL,
        created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS review_responses (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id     INTEGER NOT NULL REFERENCES review_questions(id) ON DELETE CASCADE,
        user_answer     TEXT    NOT NULL,
        is_correct      INTEGER,
        score           REAL,
        ai_feedback     TEXT,
        error_type      TEXT,
        created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );
```

- [ ] **Step 2: Add P-value reset migration to db.ts**

Add after the existing M3.5 migration block (around line 252):

```typescript
  // M4 migration: reset P-values to correct direction (low=good, range 1-4)
  try {
    db.exec(`UPDATE clusters SET current_p_value = 2, consecutive_correct = 0, last_review_result = NULL`)
  } catch {
    // Table might not exist yet on fresh DB
  }
```

- [ ] **Step 3: Fix review_generation prompt in seed-templates.ts**

Replace the existing reviewer template (lines 340-385) with:

```typescript
  {
    role: 'reviewer',
    stage: 'review_generation',
    template_text: `你是一位复习出题专家。

## 任务
根据聚类和 P 值出复习题。P 值越高，说明学生对该聚类掌握越差，需要出更多题。

## 复习规则
- P=1（已掌握）：出 1 题
- P=2（正常基线）：出 2 题
- P=3（有错题）：出 3 题，优先覆盖历史错题对应的 KP
- P=4（反复错）：出 4 题，优先覆盖历史错题对应的 KP
- 总题数上限：{max_questions} 题。如果按 P 值分配超过上限，等比缩减但每聚类至少 1 题
- 历史错题对应的 KP 必须优先覆盖
- 题型：single_choice, c2_evaluation, calculation, essay
- 题目难度与原始测试持平

## 聚类及 P 值
{clusters_with_p}

## 对应知识点
{kp_table}

## 历史错题
{past_mistakes}

## 最近一轮复习题（避免重复）
{recent_questions}

## 质量自检（内部执行，不输出）
- 所有 P>=2 的 cluster 都被覆盖
- 历史错题对应的 KP 都出了题
- 题目不与上面列出的最近一轮复习重复

## 输出要求
返回严格 JSON，不要有任何额外文字：
{
  "questions": [
    {
      "cluster_id": 0,
      "kp_id": 0,
      "type": "single_choice|calculation|essay|c2_evaluation",
      "text": "题目文本",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correct_answer": "正确答案",
      "explanation": "解析"
    }
  ]
}`,
  },
```

- [ ] **Step 4: Add review_scoring prompt template to seed-templates.ts**

Add a new entry to the `SEED_TEMPLATES` array (after the reviewer entry, before the assistant entry):

```typescript
  {
    role: 'reviewer',
    stage: 'review_scoring',
    template_text: `你是一位复习评分专家。根据题目、参考答案和学生回答，给出评分和反馈。

## 题目
{question_text}

## 参考答案
{correct_answer}

## 出题解析
{explanation}

## 相关知识点
{kp_content}

## 学生回答
{user_answer}

## 评分规则
- 判断是否正确（允许表述不同但意思正确）
- 如果错误，诊断错误类型：blind_spot（知识盲点）/ procedural（程序性失误）/ confusion（概念混淆）/ careless（粗心）
- 反馈和补救建议用中文，直接面向学生
- 禁止引用知识点编号（如"KP-01"），用具体的知识点名称或内容

## 输出要求
返回严格 JSON，不要有任何额外文字：
{
  "is_correct": true,
  "score": 1.0,
  "error_type": null,
  "feedback": "反馈文本",
  "remediation": null
}`,
  },
```

- [ ] **Step 5: Ensure the reviewer templates are in the seedTemplates() upsert loop**

In `seed-templates.ts`, find the `seedTemplates()` function. Verify it iterates over all entries in the SEED_TEMPLATES array and calls `upsertTemplate`. The M3.5 commit added `reviewer` to the loop — confirm both `review_generation` AND `review_scoring` stage entries will be upserted. If the loop filters by role, ensure `reviewer` is included.

- [ ] **Step 6: Fix test/submit P-value initialization**

In `test/submit/route.ts`, replace the P-value update block (lines 264-293) with simple initialization:

```typescript
      for (const clusterResult of clusterResults) {
        if (clusterResult.cluster_id === null) continue

        const correctCount = clusterResult.correct ?? 0
        const allCorrect = correctCount === clusterResult.total

        // Simple initialization: set P based on test results
        // P=2 (baseline) if all correct, P=3 (has errors) if any wrong
        // Don't touch consecutive_correct or last_review_result (managed by review flow)
        const newPValue = allCorrect ? 2 : 3

        db.prepare(
          'UPDATE clusters SET current_p_value = ? WHERE id = ?'
        ).run(newPValue, clusterResult.cluster_id)
      }
```

- [ ] **Step 7: Verify with TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS (exit code 0)

- [ ] **Step 8: Commit**

```bash
git add src/lib/db.ts src/lib/seed-templates.ts src/app/api/modules/*/test/submit/route.ts
git commit -m "feat: M4 schema + seed templates + P-value direction fix (M4-T1)"
git push origin master
```

---

### Task 2: GET /api/review/due

**Owner:** Codex (backend)
**Files:**
- Create: `src/app/api/review/due/route.ts`

- [ ] **Step 1: Create the due endpoint**

```typescript
import { handleRoute } from '@/lib/handle-route'
import { getDb } from '@/lib/db'

interface DueReview {
  schedule_id: number
  module_id: number
  module_title: string
  book_id: number
  book_title: string
  review_round: number
  due_date: string
}

export const GET = handleRoute(async () => {
  const db = getDb()
  const reviews = db.prepare(`
    SELECT
      rs.id AS schedule_id,
      rs.module_id,
      m.title AS module_title,
      b.id AS book_id,
      b.title AS book_title,
      rs.review_round,
      rs.due_date
    FROM review_schedule rs
    JOIN modules m ON rs.module_id = m.id
    JOIN books b ON m.book_id = b.id
    WHERE rs.status = 'pending' AND rs.due_date <= date('now')
    ORDER BY rs.due_date ASC
  `).all() as DueReview[]

  return { data: { reviews } }
})
```

- [ ] **Step 2: Verify**

Start dev server, then:
```bash
curl http://localhost:3000/api/review/due
```
Expected: `{"success":true,"data":{"reviews":[]}}`  (empty array if no modules completed yet)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/review/due/route.ts
git commit -m "feat: GET /api/review/due endpoint (M4-T2)"
git push origin master
```

---

### Task 3: POST /api/review/[scheduleId]/generate

**Owner:** Codex (backend)
**Files:**
- Create: `src/app/api/review/[scheduleId]/generate/route.ts`
**References:**
- Pattern: `src/app/api/modules/[moduleId]/test/generate/route.ts` — AI call + JSON parse + question storage
- Template: `getPrompt('reviewer', 'review_generation', { ... })` from `src/lib/prompt-templates.ts`

- [ ] **Step 1: Create the generate endpoint**

Key logic (implement as a complete file following the `handleRoute` + `generateText` + JSON parse pattern from test/generate):

**Idempotency check** — first thing in the handler:
```typescript
const existingQuestions = db.prepare(
  'SELECT id FROM review_questions WHERE schedule_id = ?'
).all(scheduleId) as { id: number }[]

if (existingQuestions.length > 0) {
  // Resume: find first unanswered question
  const nextQ = db.prepare(`
    SELECT rq.* FROM review_questions rq
    LEFT JOIN review_responses rr ON rr.question_id = rq.id
    WHERE rq.schedule_id = ? AND rr.id IS NULL
    ORDER BY rq.order_index ASC LIMIT 1
  `).get(scheduleId)
  // ... return nextQ or signal all answered
}
```

**Question allocation algorithm:**
```typescript
// clusters for this module
const clusters = db.prepare(`
  SELECT id, name, current_p_value FROM clusters WHERE module_id = ?
`).all(moduleId) as { id: number; name: string; current_p_value: number }[]

const MAX_QUESTIONS = 10
let rawCounts = clusters.map(c => ({ clusterId: c.id, count: c.current_p_value }))
let total = rawCounts.reduce((s, r) => s + r.count, 0)

if (total > MAX_QUESTIONS) {
  const scale = MAX_QUESTIONS / total
  rawCounts = rawCounts.map(r => ({ ...r, count: Math.max(1, Math.round(r.count * scale)) }))
  // Adjust to hit exactly MAX_QUESTIONS
  let adjusted = rawCounts.reduce((s, r) => s + r.count, 0)
  while (adjusted > MAX_QUESTIONS) {
    // Reduce from highest P-value cluster
    const highest = rawCounts.filter(r => r.count > 1).sort((a, b) => b.count - a.count)[0]
    if (highest) { highest.count--; adjusted-- }
    else break
  }
}
```

**Build prompt variables:**
```typescript
const clustersWithP = clusters.map(c => {
  const allocation = rawCounts.find(r => r.clusterId === c.id)
  return `- Cluster "${c.name}" (id=${c.id}): P=${c.current_p_value}, 分配 ${allocation?.count ?? 0} 题`
}).join('\n')

// KP table for these clusters
const kps = db.prepare(`
  SELECT id, kp_code, description, type, detailed_content, cluster_id
  FROM knowledge_points WHERE module_id = ?
`).all(moduleId)

// Unresolved mistakes for priority coverage
const mistakes = db.prepare(`
  SELECT m.kp_id, m.knowledge_point, m.error_type, m.remediation
  FROM mistakes m WHERE m.module_id = ? AND m.is_resolved = 0
`).all(moduleId)

// Previous round questions for dedup
const schedule = db.prepare('SELECT review_round, module_id FROM review_schedule WHERE id = ?').get(scheduleId)
const prevQuestions = db.prepare(`
  SELECT rq.question_text FROM review_questions rq
  JOIN review_schedule rs ON rq.schedule_id = rs.id
  WHERE rs.module_id = ? AND rs.review_round = ?
`).all(schedule.module_id, schedule.review_round - 1)
```

**AI call + JSON parse + store** — follow `test/generate` pattern:
```typescript
const prompt = getPrompt('reviewer', 'review_generation', {
  max_questions: String(MAX_QUESTIONS),
  clusters_with_p: clustersWithP,
  kp_table: formatKpTable(kps),
  past_mistakes: formatMistakes(mistakes),
  recent_questions: prevQuestions.length > 0
    ? prevQuestions.map(q => `- ${q.question_text}`).join('\n')
    : '(No previous review questions)',
})

const { text } = await generateText({
  model: getModel(),
  maxOutputTokens: 4096,
  prompt,
  abortSignal: AbortSignal.timeout(timeout),
})

// Parse JSON — use defensive extraction: strip markdown fences, find JSON
const jsonMatch = text.replace(/```json?\n?/g, '').replace(/```/g, '').match(/\{[\s\S]*\}/)
if (!jsonMatch) throw new SystemError('No JSON in reviewer response', text.slice(0, 300))

const parsed = JSON.parse(jsonMatch[0]) as { questions: GeneratedQuestion[] }
```

**Write questions to DB** in a transaction, then return first question.

**Response shape:**
```json
{
  "total_questions": 8,
  "current_index": 1,
  "question": { "id": 101, "type": "single_choice", "text": "...", "options": [...] }
}
```

- [ ] **Step 2: Verify**

Requires a module with learning_status='completed' and a pending review_schedule. If test data exists:
```bash
curl -X POST http://localhost:3000/api/review/1/generate
```
Expected: JSON with `total_questions` and first `question` object.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/review/*/generate/route.ts
git commit -m "feat: POST /api/review/[scheduleId]/generate endpoint (M4-T3)"
git push origin master
```

---

### Task 4: POST /api/review/[scheduleId]/respond

**Owner:** Codex (backend)
**Files:**
- Create: `src/app/api/review/[scheduleId]/respond/route.ts`
**References:**
- Pattern: `src/app/api/modules/[moduleId]/qa-feedback/route.ts` — AI scoring per question

- [ ] **Step 1: Create the respond endpoint**

Follow the `qa-feedback` POST handler pattern closely. Key differences from qa-feedback:

**Ownership validation** (qa-feedback checks `module_id`, here check `schedule_id`):
```typescript
const question = db.prepare(
  'SELECT * FROM review_questions WHERE id = ? AND schedule_id = ?'
).get(questionId, scheduleId)
if (!question) throw new UserError('Question not found or wrong schedule', 'NOT_FOUND', 404)
```

**Already-answered guard:**
```typescript
const existing = db.prepare(
  'SELECT id FROM review_responses WHERE question_id = ?'
).get(questionId)
if (existing) throw new UserError('Already answered', 'ALREADY_ANSWERED', 409)
```

**AI scoring call** — use `review_scoring` template:
```typescript
const kp = question.kp_id
  ? db.prepare('SELECT description, detailed_content FROM knowledge_points WHERE id = ?').get(question.kp_id)
  : null

const prompt = getPrompt('reviewer', 'review_scoring', {
  question_text: question.question_text,
  correct_answer: question.correct_answer,
  explanation: question.explanation || '',
  kp_content: kp ? `${kp.description}\n${kp.detailed_content}` : '(No KP linked)',
  user_answer: userAnswer.trim(),
})

const { text } = await generateText({
  model: getModel(),
  maxOutputTokens: 1024,
  prompt,
  abortSignal: AbortSignal.timeout(timeout),
})

// Parse feedback JSON (same defensive pattern as qa-feedback)
```

**Write response:**
```typescript
db.prepare(`
  INSERT INTO review_responses (question_id, user_answer, is_correct, score, ai_feedback, error_type)
  VALUES (?, ?, ?, ?, ?, ?)
`).run(questionId, userAnswer, feedback.is_correct ? 1 : 0, feedback.score, feedback.feedback, feedback.error_type)
```

**Write mistake if wrong:**
```typescript
if (!feedback.is_correct) {
  const schedule = db.prepare('SELECT module_id FROM review_schedule WHERE id = ?').get(scheduleId)
  const kpDesc = kp ? kp.description : question.question_text.slice(0, 50)

  db.prepare(`
    INSERT INTO mistakes (module_id, kp_id, knowledge_point, error_type, source, remediation, is_resolved)
    VALUES (?, ?, ?, ?, 'review', ?, 0)
  `).run(schedule.module_id, question.kp_id, kpDesc, feedback.error_type, feedback.remediation)
}
```

**Find next question and return:**
```typescript
const nextQ = db.prepare(`
  SELECT rq.id, rq.question_type, rq.question_text, rq.options, rq.order_index
  FROM review_questions rq
  LEFT JOIN review_responses rr ON rr.question_id = rq.id
  WHERE rq.schedule_id = ? AND rr.id IS NULL
  ORDER BY rq.order_index ASC LIMIT 1
`).get(scheduleId)

return {
  data: {
    is_correct: feedback.is_correct,
    score: feedback.score,
    ai_feedback: feedback.feedback,
    has_next: !!nextQ,
    next_question: nextQ ? {
      id: nextQ.id, type: nextQ.question_type,
      text: nextQ.question_text, options: nextQ.options ? JSON.parse(nextQ.options) : null
    } : null,
  },
}
```

- [ ] **Step 2: Verify**

After generating questions (T3), submit an answer:
```bash
curl -X POST http://localhost:3000/api/review/1/respond \
  -H "Content-Type: application/json" \
  -d '{"question_id": 1, "user_answer": "B"}'
```
Expected: JSON with `is_correct`, `ai_feedback`, `has_next`, and `next_question`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/review/*/respond/route.ts
git commit -m "feat: POST /api/review/[scheduleId]/respond endpoint (M4-T4)"
git push origin master
```

---

### Task 5: POST /api/review/[scheduleId]/complete

**Owner:** Codex (backend)
**Files:**
- Create: `src/app/api/review/[scheduleId]/complete/route.ts`

- [ ] **Step 1: Create the complete endpoint**

This is the most logic-heavy endpoint. Use `handleRoute` wrapper.

**Validation:**
```typescript
const schedule = db.prepare(
  'SELECT * FROM review_schedule WHERE id = ?'
).get(scheduleId)
if (!schedule) throw new UserError('Schedule not found', 'NOT_FOUND', 404)
if (schedule.status === 'completed') throw new UserError('Already completed', 'ALREADY_COMPLETED', 409)

// Check all questions answered
const unanswered = db.prepare(`
  SELECT rq.id FROM review_questions rq
  LEFT JOIN review_responses rr ON rr.question_id = rq.id
  WHERE rq.schedule_id = ? AND rr.id IS NULL
`).all(scheduleId)
if (unanswered.length > 0) {
  throw new UserError(`${unanswered.length} questions unanswered`, 'INCOMPLETE', 400)
}
```

**Aggregate per-cluster results:**
```typescript
const clusterResults = db.prepare(`
  SELECT
    rq.cluster_id,
    c.name AS cluster_name,
    c.current_p_value,
    c.last_review_result,
    c.consecutive_correct,
    COUNT(*) AS total,
    SUM(CASE WHEN rr.is_correct = 1 THEN 1 ELSE 0 END) AS correct
  FROM review_questions rq
  JOIN review_responses rr ON rr.question_id = rq.id
  JOIN clusters c ON rq.cluster_id = c.id
  WHERE rq.schedule_id = ?
  GROUP BY rq.cluster_id
`).all(scheduleId)
```

**P-value update per cluster (spec Section 3.3):**
```typescript
const ROUND_INTERVALS = [0, 3, 7, 15, 30, 60] // index = round number

for (const cr of clusterResults) {
  const allCorrect = cr.correct === cr.total
  const prevResult = cr.last_review_result // 'all_correct' | 'has_errors' | null
  const pBefore = cr.current_p_value
  let pAfter = pBefore
  let newConsecutive = cr.consecutive_correct

  if (allCorrect) {
    pAfter = Math.max(1, pBefore - 1)
    newConsecutive += 1
  } else if (prevResult === 'has_errors') {
    // Consecutive errors → punish
    pAfter = Math.min(4, pBefore + 1)
    newConsecutive = 0
  } else {
    // Single failure (prev was 'all_correct' or NULL) → no change
    newConsecutive = 0
  }

  db.prepare(`
    UPDATE clusters SET current_p_value = ?, consecutive_correct = ?, last_review_result = ?
    WHERE id = ?
  `).run(pAfter, newConsecutive, allCorrect ? 'all_correct' : 'has_errors', cr.cluster_id)

  db.prepare(`
    INSERT INTO review_records (schedule_id, cluster_id, questions_count, correct_count, p_value_before, p_value_after)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(scheduleId, cr.cluster_id, cr.total, cr.correct, pBefore, pAfter)
}
```

**P=1 skip check + next schedule creation:**
```typescript
// Check if ALL clusters qualify for skip (P=1, cc>=3)
const allClustersSkip = clusterResults.every(cr => {
  const updated = db.prepare('SELECT current_p_value, consecutive_correct FROM clusters WHERE id = ?').get(cr.cluster_id)
  return updated.current_p_value === 1 && updated.consecutive_correct >= 3
})

const nextRound = schedule.review_round + 1
let effectiveRound = nextRound

if (allClustersSkip && nextRound <= 5) {
  // Skip one interval level
  effectiveRound = Math.min(nextRound + 1, 5)
  // Reset consecutive_correct for all clusters
  db.prepare('UPDATE clusters SET consecutive_correct = 0 WHERE module_id = ?').run(schedule.module_id)
}

// Create next schedule (duplicate guard + max round 5)
if (effectiveRound <= 5) {
  const existing = db.prepare(
    'SELECT id FROM review_schedule WHERE module_id = ? AND review_round = ?'
  ).get(schedule.module_id, effectiveRound)

  if (!existing) {
    const interval = ROUND_INTERVALS[effectiveRound] ?? 60
    db.prepare(`
      INSERT INTO review_schedule (module_id, review_round, due_date, status)
      VALUES (?, ?, date('now', '+' || ? || ' days'), 'pending')
    `).run(schedule.module_id, effectiveRound, interval)
  }
}

// Mark current schedule completed
db.prepare(
  "UPDATE review_schedule SET status = 'completed', completed_at = datetime('now') WHERE id = ?"
).run(scheduleId)
```

**Response:**
```typescript
const nextSchedule = effectiveRound <= 5
  ? db.prepare('SELECT review_round, due_date FROM review_schedule WHERE module_id = ? AND review_round = ?')
      .get(schedule.module_id, effectiveRound)
  : null

return {
  data: {
    summary: {
      total_questions: clusterResults.reduce((s, c) => s + c.total, 0),
      correct_count: clusterResults.reduce((s, c) => s + c.correct, 0),
      accuracy: totalQ > 0 ? correctQ / totalQ : 0,
      clusters: clusterResults.map(cr => ({
        name: cr.cluster_name,
        correct: cr.correct,
        total: cr.total,
      })),
    },
    next_review: nextSchedule
      ? { round: nextSchedule.review_round, due_date: nextSchedule.due_date }
      : null,
  },
}
```

- [ ] **Step 2: Verify**

After answering all questions for a schedule:
```bash
curl -X POST http://localhost:3000/api/review/1/complete
```
Expected: JSON with `summary` (accuracy + cluster breakdown) and `next_review` (next round date).

Verify in DB:
```bash
sqlite3 data/app.db "SELECT * FROM review_records WHERE schedule_id = 1"
sqlite3 data/app.db "SELECT * FROM review_schedule WHERE module_id = (SELECT module_id FROM review_schedule WHERE id = 1)"
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/review/*/complete/route.ts
git commit -m "feat: POST /api/review/[scheduleId]/complete endpoint (M4-T5)"
git push origin master
```

---

### Task 6: Review Session Frontend

**Owner:** Gemini (frontend)
**Files:**
- Create: `src/app/books/[bookId]/modules/[moduleId]/review/page.tsx`
- Create: `src/app/books/[bookId]/modules/[moduleId]/review/ReviewSession.tsx`
**References:**
- Pattern: `src/app/books/[bookId]/modules/[moduleId]/qa/QASession.tsx` — one-at-a-time + feedback UI
- Pattern: `src/app/books/[bookId]/modules/[moduleId]/qa/page.tsx` — thin page wrapper

- [ ] **Step 1: Create review page.tsx**

Thin server component wrapper that reads scheduleId from query params and renders ReviewSession:

```tsx
// page.tsx
import ReviewSession from './ReviewSession'

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookId: string; moduleId: string }>
  searchParams: Promise<{ scheduleId?: string }>
}) {
  const { bookId, moduleId } = await params
  const { scheduleId } = await searchParams

  if (!scheduleId) {
    return <div className="p-10 text-center text-gray-500">缺少 scheduleId 参数</div>
  }

  return (
    <ReviewSession
      bookId={Number(bookId)}
      moduleId={Number(moduleId)}
      scheduleId={Number(scheduleId)}
    />
  )
}
```

- [ ] **Step 2: Create ReviewSession.tsx**

Follow QASession.tsx pattern closely. Key states:

```tsx
'use client'
import { useState, useEffect } from 'react'
import MarkdownRenderer from '@/components/MarkdownRenderer'
```

**States:** `question`, `totalQuestions`, `currentIndex`, `userAnswer`, `feedback`, `isLoading`, `isSubmitting`, `summary`, `phase` ('intro' | 'answering' | 'feedback' | 'complete')

**Phase flow:**
1. `intro` — show "系统会根据你的复习表现动态调整题目" + "开始复习" button
2. On start → call `POST /api/review/{scheduleId}/generate` → set first question → `answering`
3. `answering` — show question, input area, submit button
4. On submit → call `POST /api/review/{scheduleId}/respond` → show feedback → `feedback`
5. `feedback` — show AI feedback, "下一题" button (or "查看结果" if last)
6. On next → set next question from response → `answering` (or call complete)
7. On complete → call `POST /api/review/{scheduleId}/complete` → show summary → `complete`

**Question display:** Support single_choice (radio buttons), calculation/essay (textarea), c2_evaluation (textarea). Same rendering as QASession.

**Result summary view:**
```tsx
// phase === 'complete'
<div>
  <h2>复习完成</h2>
  <p>正确率：{Math.round(summary.accuracy * 100)}%</p>
  <div>
    {summary.clusters.map(c => (
      <div key={c.name}>
        <span>{c.name}</span>
        <span>{c.correct}/{c.total}</span>
      </div>
    ))}
  </div>
  {summary.next_review && (
    <p>下次复习：第 {summary.next_review.round} 轮，{summary.next_review.due_date}</p>
  )}
  <a href="/">返回首页</a>
</div>
```

**Progress indicator:** Show "第 X / Y 题" at the top.

Style with Tailwind, consistent with existing QASession styling.

- [ ] **Step 3: Verify**

Navigate to `/books/1/modules/1/review?scheduleId=1` in browser. Walk through full flow: intro → answer questions → see feedback → complete → see summary.

- [ ] **Step 4: Commit**

```bash
git add src/app/books/*/modules/*/review/
git commit -m "feat: review session frontend page + component (M4-T6)"
git push origin master
```

---

### Task 7: Homepage Review Button

**Owner:** Gemini (frontend)
**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add review button to homepage**

The homepage (`src/app/page.tsx`) is currently a server component. The review button needs to fetch `/api/review/due` on client side. Two approaches:

**Approach (recommended):** Add a client component `ReviewButton.tsx` and embed it in page.tsx.

Create `src/app/ReviewButton.tsx`:

```tsx
'use client'
import { useState, useEffect } from 'react'

interface DueReview {
  schedule_id: number
  module_id: number
  module_title: string
  book_id: number
  book_title: string
  review_round: number
  due_date: string
}

export default function ReviewButton() {
  const [reviews, setReviews] = useState<DueReview[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetch('/api/review/due')
      .then(r => r.json())
      .then(result => {
        if (result.success) setReviews(result.data.reviews)
      })
      .catch(() => {})
  }, [])

  if (reviews.length === 0) return null

  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        复习 ({reviews.length})
      </button>
      {expanded && (
        <div className="mt-2 bg-white rounded-xl border border-gray-200 divide-y">
          {reviews.map(r => (
            <a
              key={r.schedule_id}
              href={`/books/${r.book_id}/modules/${r.module_id}/review?scheduleId=${r.schedule_id}`}
              className="block px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <p className="text-sm font-medium text-gray-900">{r.module_title}</p>
              <p className="text-xs text-gray-400">{r.book_title} · 第 {r.review_round} 轮复习</p>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
```

Then in `page.tsx`, add `import ReviewButton from './ReviewButton'` and place `<ReviewButton />` between the "上传新教材" button and the book list (around line 31):

```tsx
        {/* After the upload button, before books list */}
        <ReviewButton />
```

- [ ] **Step 2: Verify**

Open homepage in browser. If there are pending reviews, the amber "复习 (N)" button should appear. Click to expand and see module list. Click a module to navigate to review session.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx src/app/ReviewButton.tsx
git commit -m "feat: homepage review button (M4-T7)"
git push origin master
```

---

### Task 8: Documentation Update

**Owner:** Claude (PM)
**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/project_status.md`
- Modify: `docs/changelog.md`

- [ ] **Step 1: Update architecture.md**

Fix the "测试 → 复习" interface contract section to reflect:
- P-value direction: low=good (1-4), not high=good
- test/submit does simple initialization (P=2 or P=3), not incremental update
- Add "复习 → 下一轮" interface contract section
- Add review_questions + review_responses to DB table list (21 tables total)
- Add review API group to API 组 section

- [ ] **Step 2: Update project_status.md**

Mark M4 as completed, update current status.

- [ ] **Step 3: Update changelog.md**

Add M4 entry with all tasks.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture.md docs/project_status.md docs/changelog.md
git commit -m "docs: update architecture, project_status, changelog for M4 completion"
git push origin master
```

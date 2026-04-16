---
date: 2026-03-31
topic: M3考官AI测试与评分系统
type: plan
status: resolved
keywords: [M3, examiner, test, scoring, diagnosis]
---

# M3 Examiner AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Examiner AI — test generation, scoring, error diagnosis, and pass/fail gating for each learning module.

**Architecture:** Two AI calls per test cycle: (1) generate questions covering all KPs in a module (stored in DB with answers), (2) score subjective questions + diagnose errors. Single-choice questions are auto-scored by code. Pass rate computed server-side (80% hard threshold). Frontend shows all questions at once (exam style), submits as batch.

**Tech Stack:** Next.js 15 API Routes, better-sqlite3, Vercel AI SDK (`generateText`), `handleRoute` envelope, `getPrompt` template system, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-03-31-m3-examiner-ai-design.md`

**CCB Split:**
- Tasks 1-6: Codex (backend) — `src/app/api/**`, `src/lib/**`
- Tasks 7-8: Gemini (frontend) — `src/app/books/**`, `src/components/**` (if any)
- Task 9: Claude (PM) — `docs/**`, `.agents/**`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/lib/db.ts` | Add `kp_ids` column migration |
| Modify | `src/lib/seed-templates.ts` | Update examiner templates + add to upsert block |
| Create | `src/app/api/modules/[moduleId]/test/generate/route.ts` | Test generation endpoint |
| Create | `src/app/api/modules/[moduleId]/test/submit/route.ts` | Test submission + scoring endpoint |
| Create | `src/app/api/modules/[moduleId]/test/route.ts` | Test status query endpoint |
| Rewrite | `src/app/api/modules/[moduleId]/mistakes/route.ts` | Adapt to new schema |
| Delete | `src/app/api/modules/[moduleId]/test-questions/route.ts` | Old Phase 1 route |
| Delete | `src/app/api/modules/[moduleId]/test-evaluate/route.ts` | Old Phase 1 route |
| Rewrite | `src/app/books/[bookId]/modules/[moduleId]/test/page.tsx` | Server component, adapt to new API |
| Rewrite | `src/app/books/[bookId]/modules/[moduleId]/test/TestSession.tsx` | Client component, new state machine |
| Rewrite | `src/app/books/[bookId]/modules/[moduleId]/mistakes/page.tsx` | Adapt to new schema |
| Modify | `.agents/API_CONTRACT.md` | Add M3 endpoints |

---

## Task 1: Schema Migration + Prompt Templates (Codex)

**Files:**
- Modify: `src/lib/db.ts:234-243` (migration block)
- Modify: `src/lib/seed-templates.ts:222-231` (examiner templates) + `src/lib/seed-templates.ts:296-310` (upsert block)

- [ ] **Step 1: Add `kp_ids` column migration to `db.ts`**

In `src/lib/db.ts`, after the existing M2 migration block (line 234-239), add:

```typescript
  // M3 migrations (safe to re-run)
  try {
    db.exec(`ALTER TABLE test_questions ADD COLUMN kp_ids TEXT`)
  } catch {
    // Column already exists
  }
```

- [ ] **Step 2: Update examiner `test_generation` template in `seed-templates.ts`**

Replace the existing `examiner/test_generation` entry (line 223-225) with the full quality-rules template:

```typescript
  {
    role: 'examiner',
    stage: 'test_generation',
    template_text: `你是一位考试出题专家。

## 任务
根据知识点表出模块测试题。出题的同时生成正确答案和解析。

## 覆盖规则
- 所有 KP 必须被至少 1 道题覆盖
- 上限 10 题，通过合并相关 KP 到同一题控制题量
- 下限 5 题
- 每道题标注覆盖的 kp_ids（数组）

## 题型分配
- 单选题 → C1 判断类 + 定义类 KP（1-2 KP/题，4 选项 A/B/C/D）
- C2 评估题 → C2 评估类 KP（2-3 KP/题，开放作答，必须含矛盾信号：至少 1 个正面 + 1 个负面）
- 计算题 → 计算类 KP（1-2 KP/题，虚构数据，多步计算，至少 1 道逆向计算）
- 思考题 → 综合跨类 KP（3-4 KP/题，给完整 mini 案例）

## 出题质量自检（内部执行，不输出）
- 单选题答案字母分布：4 题以上时 A/B/C/D 大致均匀，任一字母不超过 40%
- 正确答案不得是最长选项
- 错误选项来自真实认知误区（混淆概念、遗漏条件、因果倒置、程度错误、半对半错）
- C2 题 4 个选项对应 4 种不同的权衡结论，正确选项只给结论不展开分析机制
- 计算题数据自洽（出完后验算所有数字）
- 不用原文原数字原名字，必须 paraphrase
- 避免绝对词（"一定""绝对""所有"）

## 历史错题（优先覆盖这些 KP）
{past_mistakes}

## 本模块知识点
{kp_table}

## 输出要求
返回严格 JSON，不要有任何额外文字：
{
  "questions": [
    {
      "kp_ids": [1, 2],
      "type": "single_choice",
      "text": "题目文本",
      "options": ["A. 选项A", "B. 选项B", "C. 选项C", "D. 选项D"],
      "correct_answer": "B",
      "explanation": "解析：为什么B正确..."
    },
    {
      "kp_ids": [3],
      "type": "calculation",
      "text": "计算题题目（含完整数据）",
      "options": null,
      "correct_answer": "完整计算步骤和结果",
      "explanation": "考察知识点和关键步骤"
    }
  ]
}

type 只能是：single_choice, c2_evaluation, calculation, essay
单选题 options 为 4 个字符串数组，其他题型 options 为 null
单选题 correct_answer 为单个字母（A/B/C/D），其他题型为完整答案文本`,
  },
```

- [ ] **Step 3: Update examiner `test_scoring` template**

Replace the existing `examiner/test_scoring` entry (line 227-230):

```typescript
  {
    role: 'examiner',
    stage: 'test_scoring',
    template_text: `你是一位考试评分专家。

## 任务
评估学生的主观题答案，并对所有错题（含已由系统判分的单选题）进行错误类型诊断。

## 评分标准
- 你只需要对主观题评分，单选题已由系统自动判分
- 计算题（满分 5 分）：过程和结果都对 → 5 分；过程对结果错 → 2-3 分；过程错 → 0 分
- 思考题（满分 10 分）：按分析深度、逻辑完整性和覆盖 KP 数量分段给分
- C2 评估题（满分 5 分）：结论合理+分析到位 → 5 分；结论对但分析不完整 → 2-3 分；结论错 → 0-1 分

## 错误诊断（所有错题必填 error_type）
- blind_spot：完全不知道概念（答案与正确方向完全无关）
- procedural：懂原理但步骤错（方向对但执行出错）
- confusion：把 A 误认为 B（混淆了两个相近概念）
- careless：偶发失误，非系统性（如计算笔误、选错选项但解释正确）

## 试卷和答案
{test_paper}

## 单选题已判结果（仅供诊断用，不需要重新评分）
{mc_results}

## 输出要求
返回严格 JSON，不要有任何额外文字：
{
  "results": [
    {
      "question_id": 1,
      "is_correct": false,
      "score": 3,
      "feedback": "你的分析方向正确，但忽略了...",
      "error_type": "procedural",
      "remediation": "建议回去重做该 KP 的 Q&A worked example，重点练习..."
    }
  ]
}

注意：
- 对主观题：返回 is_correct, score, feedback, error_type, remediation
- 对已判分的单选错题：只返回 error_type, feedback, remediation（score 和 is_correct 已由系统确定）
- 正确的题目不需要返回`,
  },
```

- [ ] **Step 4: Add examiner to upsert block in `seedTemplates()`**

In `src/lib/seed-templates.ts`, inside the existing `const tx = db.transaction(() => { ... })` block (lines 297-310), insert this **after** the coach upsert loop (line 308) and **before** the closing `})` at line 309:

```typescript
    for (const t of SEED_TEMPLATES) {
      if (t.role === 'examiner') {
        upsert.run(t.role, t.stage, t.template_text)
      }
    }
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts src/lib/seed-templates.ts
git commit -m "feat(m3): schema migration + examiner prompt templates"
```

---

## Task 2: Test Generate API (Codex)

**Files:**
- Create: `src/app/api/modules/[moduleId]/test/generate/route.ts`

**Reference pattern:** `src/app/api/modules/[moduleId]/generate-questions/route.ts` (M2 Q&A generation)

- [ ] **Step 1: Create the route file**

```typescript
import { handleRoute } from '@/lib/handle-route'
import { getDb } from '@/lib/db'
import { UserError, SystemError } from '@/lib/errors'
import { getPrompt } from '@/lib/prompt-templates'
import { generateText } from 'ai'
import { getModel, timeout } from '@/lib/ai'
import { logAction } from '@/lib/log'

interface ModuleRow {
  id: number
  book_id: number
  title: string
  learning_status: string
}

interface KP {
  id: number
  kp_code: string
  section_name: string
  description: string
  type: string
  importance: number
  detailed_content: string
}

interface MistakeRow {
  id: number
  kp_id: number | null
  knowledge_point: string
  error_type: string
  remediation: string | null
}

interface GeneratedQuestion {
  kp_ids: number[]
  type: string
  text: string
  options: string[] | null
  correct_answer: string
  explanation: string
}

const VALID_TYPES = new Set(['single_choice', 'c2_evaluation', 'calculation', 'essay'])

export const POST = handleRoute(async (req, context) => {
  const { moduleId } = await context!.params
  const id = Number(moduleId)
  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid module ID', 'INVALID_ID', 400)
  }

  const body = await req.json().catch(() => ({})) as { retake?: boolean }

  const db = getDb()
  const module_ = db
    .prepare('SELECT id, book_id, title, learning_status FROM modules WHERE id = ?')
    .get(id) as ModuleRow | undefined

  if (!module_) {
    throw new UserError('Module not found', 'NOT_FOUND', 404)
  }

  // Status check: must be notes_generated or testing (for retakes)
  if (module_.learning_status !== 'notes_generated' && module_.learning_status !== 'testing') {
    throw new UserError(
      'Module must have completed Q&A before testing',
      'INVALID_STATUS',
      409
    )
  }

  // On retake: clean up any unsubmitted papers first
  if (body.retake) {
    db.prepare('DELETE FROM test_papers WHERE module_id = ? AND total_score IS NULL').run(id)
  } else {
    // Check for existing unsubmitted paper (total_score IS NULL)
    const existingPaper = db.prepare(`
      SELECT tp.id, tp.attempt_number FROM test_papers tp
      WHERE tp.module_id = ? AND tp.total_score IS NULL
      ORDER BY tp.id DESC LIMIT 1
    `).get(id) as { id: number; attempt_number: number } | undefined

    if (existingPaper) {
      const questions = db.prepare(`
        SELECT id, kp_id, kp_ids, question_type, question_text, options, order_index
        FROM test_questions WHERE paper_id = ? ORDER BY order_index ASC
      `).all(existingPaper.id)

      return {
        data: {
          paper_id: existingPaper.id,
          attempt_number: existingPaper.attempt_number,
          questions,
          cached: true,
        },
      }
    }
  }

  // Get KPs
  const kps = db.prepare(`
    SELECT id, kp_code, section_name, description, type, importance, detailed_content
    FROM knowledge_points WHERE module_id = ?
  `).all(id) as KP[]

  if (kps.length === 0) {
    throw new UserError('No knowledge points found for this module', 'NO_KPS', 409)
  }

  const kpTable = kps
    .map((kp) =>
      `- [ID=${kp.id}] [${kp.kp_code}] (${kp.type}, importance=${kp.importance}) ${kp.description}\n  Detail: ${kp.detailed_content}`
    )
    .join('\n')

  // Get unresolved mistakes
  const mistakes = db.prepare(`
    SELECT id, kp_id, knowledge_point, error_type, remediation
    FROM mistakes WHERE module_id = ? AND is_resolved = 0
  `).all(id) as MistakeRow[]

  const pastMistakes = mistakes.length > 0
    ? mistakes.map((m) => `- KP ${m.kp_id ?? '?'}: ${m.knowledge_point} (${m.error_type})`).join('\n')
    : '(No past mistakes)'

  // Determine attempt number
  const lastPaper = db.prepare(`
    SELECT attempt_number FROM test_papers
    WHERE module_id = ? ORDER BY attempt_number DESC LIMIT 1
  `).get(id) as { attempt_number: number } | undefined

  const attemptNumber = body.retake && lastPaper ? lastPaper.attempt_number + 1 : 1

  logAction('Test generation started', `moduleId=${id}, attempt=${attemptNumber}, kpCount=${kps.length}`)

  const prompt = getPrompt('examiner', 'test_generation', {
    kp_table: kpTable,
    past_mistakes: pastMistakes,
  })

  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens: 16384,
    prompt,
    abortSignal: AbortSignal.timeout(timeout),
  })

  // Parse AI response
  let generated: { questions: GeneratedQuestion[] }
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in response')
    generated = JSON.parse(jsonMatch[0]) as { questions: GeneratedQuestion[] }
    if (!Array.isArray(generated.questions) || generated.questions.length === 0) {
      throw new Error('Empty questions array')
    }
  } catch (err) {
    logAction('Test generation parse error', text.slice(0, 500), 'error')
    throw new SystemError('Failed to parse AI response for test generation', err)
  }

  // Validate and insert
  const kpIds = new Set(kps.map((kp) => kp.id))

  const insertPaper = db.prepare(`
    INSERT INTO test_papers (module_id, attempt_number) VALUES (?, ?)
  `)

  const insertQuestion = db.prepare(`
    INSERT INTO test_questions (paper_id, kp_id, kp_ids, question_type, question_text, options, correct_answer, explanation, order_index)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  interface InsertedQ {
    id: number | bigint
    kp_id: number | null
    kp_ids: string
    question_type: string
    question_text: string
    options: string | null
    order_index: number
  }
  const insertedQuestions: InsertedQ[] = []

  const tx = db.transaction(() => {
    const paperResult = insertPaper.run(id, attemptNumber)
    const paperId = paperResult.lastInsertRowid

    for (const [index, q] of generated.questions.entries()) {
      const validKpIds = (q.kp_ids ?? []).filter((kid) => kpIds.has(kid))
      const primaryKpId = validKpIds.length > 0 ? validKpIds[0] : null
      const questionType = VALID_TYPES.has(q.type) ? q.type : 'essay'
      const optionsJson = q.options ? JSON.stringify(q.options) : null
      const kpIdsJson = JSON.stringify(validKpIds)

      const result = insertQuestion.run(
        paperId,
        primaryKpId,
        kpIdsJson,
        questionType,
        q.text,
        optionsJson,
        q.correct_answer,
        q.explanation ?? null,
        index + 1
      )

      insertedQuestions.push({
        id: result.lastInsertRowid,
        kp_id: primaryKpId,
        kp_ids: kpIdsJson,
        question_type: questionType,
        question_text: q.text,
        options: optionsJson,
        order_index: index + 1,
      })
    }

    // Update module status to testing
    if (module_.learning_status === 'notes_generated') {
      db.prepare('UPDATE modules SET learning_status = ? WHERE id = ?').run('testing', id)
    }
  })

  tx()

  const paperId = db.prepare(`
    SELECT id FROM test_papers WHERE module_id = ? AND attempt_number = ?
  `).get(id, attemptNumber) as { id: number }

  logAction('Test generation complete', `moduleId=${id}, paperId=${paperId.id}, questionCount=${insertedQuestions.length}`)

  return {
    data: {
      paper_id: paperId.id,
      attempt_number: attemptNumber,
      questions: insertedQuestions,
    },
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/modules/\[moduleId\]/test/generate/route.ts
git commit -m "feat(m3): test generation API endpoint"
```

---

## Task 3: Test Submit API (Codex)

**Files:**
- Create: `src/app/api/modules/[moduleId]/test/submit/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
import { handleRoute } from '@/lib/handle-route'
import { getDb } from '@/lib/db'
import { UserError, SystemError } from '@/lib/errors'
import { getPrompt } from '@/lib/prompt-templates'
import { generateText } from 'ai'
import { getModel, timeout } from '@/lib/ai'
import { logAction } from '@/lib/log'

interface TestQuestion {
  id: number
  kp_id: number | null
  kp_ids: string | null
  question_type: string
  question_text: string
  options: string | null
  correct_answer: string
  explanation: string | null
  order_index: number
}

interface UserAnswer {
  question_id: number
  user_answer: string
}

interface AIResult {
  question_id: number
  is_correct: boolean
  score: number
  feedback: string
  error_type: string | null
  remediation: string | null
}

const POINTS: Record<string, number> = {
  single_choice: 5,
  c2_evaluation: 5,
  calculation: 5,
  essay: 10,
}

export const POST = handleRoute(async (req, context) => {
  const { moduleId } = await context!.params
  const id = Number(moduleId)
  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid module ID', 'INVALID_ID', 400)
  }

  const body = await req.json() as { paper_id: number; answers: UserAnswer[] }
  if (!body.paper_id || !Array.isArray(body.answers) || body.answers.length === 0) {
    throw new UserError('Missing paper_id or answers', 'INVALID_INPUT', 400)
  }

  const db = getDb()

  // Validate paper belongs to module and is unsubmitted
  const paper = db.prepare(`
    SELECT id, module_id, attempt_number, total_score
    FROM test_papers WHERE id = ? AND module_id = ?
  `).get(body.paper_id, id) as { id: number; module_id: number; attempt_number: number; total_score: number | null } | undefined

  if (!paper) {
    throw new UserError('Test paper not found', 'NOT_FOUND', 404)
  }
  if (paper.total_score !== null) {
    throw new UserError('This test has already been submitted', 'ALREADY_SUBMITTED', 409)
  }

  // Get all questions for this paper
  const questions = db.prepare(`
    SELECT id, kp_id, kp_ids, question_type, question_text, options, correct_answer, explanation, order_index
    FROM test_questions WHERE paper_id = ? ORDER BY order_index ASC
  `).all(body.paper_id) as TestQuestion[]

  if (questions.length === 0) {
    throw new UserError('No questions found for this paper', 'NO_QUESTIONS', 409)
  }

  // ── Phase 1: Auto-score single choice ──
  const mcQuestions = questions.filter((q) => q.question_type === 'single_choice')
  const subjectiveQuestions = questions.filter((q) => q.question_type !== 'single_choice')

  const mcResults: Array<{
    question_id: number
    is_correct: boolean
    score: number
    feedback: string | null
    error_type: string | null
    remediation: string | null
  }> = []

  for (const q of mcQuestions) {
    const answer = body.answers.find((a) => a.question_id === q.id)
    const userAnswer = (answer?.user_answer ?? '').trim().toUpperCase()
    const correctAnswer = q.correct_answer.trim().toUpperCase()
    const isCorrect = userAnswer === correctAnswer
    mcResults.push({
      question_id: q.id,
      is_correct: isCorrect,
      score: isCorrect ? POINTS.single_choice : 0,
      feedback: isCorrect ? null : `正确答案是 ${correctAnswer}。${q.explanation ?? ''}`,
      error_type: null, // Will be filled by AI for wrong answers
      remediation: null,
    })
  }

  // ── Phase 2: AI score subjective questions + diagnose all errors ──
  const wrongMcIds = mcResults.filter((r) => !r.is_correct).map((r) => r.question_id)
  let aiResults: AIResult[] = []

  if (subjectiveQuestions.length > 0 || wrongMcIds.length > 0) {
    // Build test paper context for AI
    const subjectivePaper = subjectiveQuestions.map((q) => {
      const answer = body.answers.find((a) => a.question_id === q.id)
      return `【题目 ID=${q.id}】(${q.question_type}, 满分 ${POINTS[q.question_type] ?? 5} 分)
题目：${q.question_text}
参考答案：${q.correct_answer}
解析：${q.explanation ?? '无'}
学生回答：${answer?.user_answer ?? '(未作答)'}`
    }).join('\n\n---\n\n')

    const mcErrorContext = wrongMcIds.length > 0
      ? mcQuestions
          .filter((q) => wrongMcIds.includes(q.id))
          .map((q) => {
            const answer = body.answers.find((a) => a.question_id === q.id)
            return `【单选错题 ID=${q.id}】
题目：${q.question_text}
正确答案：${q.correct_answer}
学生选择：${answer?.user_answer ?? '(未作答)'}
解析：${q.explanation ?? '无'}`
          })
          .join('\n\n')
      : '(无单选错题)'

    const prompt = getPrompt('examiner', 'test_scoring', {
      test_paper: subjectivePaper || '(无主观题)',
      mc_results: mcErrorContext,
    })

    logAction('Test scoring started', `paperId=${body.paper_id}`)

    const { text } = await generateText({
      model: getModel(),
      maxOutputTokens: 8192,
      prompt,
      abortSignal: AbortSignal.timeout(timeout),
    })

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found')
      const parsed = JSON.parse(jsonMatch[0]) as { results: AIResult[] }
      aiResults = parsed.results ?? []
    } catch (err) {
      logAction('Test scoring parse error', text.slice(0, 500), 'error')
      throw new SystemError('Failed to parse AI scoring response', err)
    }
  }

  // ── Phase 3: Merge results and compute totals ──

  // Merge AI diagnosis into MC results
  for (const mcr of mcResults) {
    if (!mcr.is_correct) {
      const aiDiag = aiResults.find((ar) => ar.question_id === mcr.question_id)
      if (aiDiag) {
        mcr.error_type = aiDiag.error_type ?? 'blind_spot'
        mcr.feedback = aiDiag.feedback ?? mcr.feedback
        mcr.remediation = aiDiag.remediation ?? null
      } else {
        mcr.error_type = 'blind_spot' // Default if AI didn't diagnose
      }
    }
  }

  // Build subjective results
  const subjectiveResults = subjectiveQuestions.map((q) => {
    const aiResult = aiResults.find((ar) => ar.question_id === q.id)
    const maxPts = POINTS[q.question_type] ?? 5
    return {
      question_id: q.id,
      is_correct: aiResult?.is_correct ?? false,
      score: Math.min(aiResult?.score ?? 0, maxPts),
      feedback: aiResult?.feedback ?? null,
      error_type: aiResult?.error_type ?? (aiResult?.is_correct ? null : 'blind_spot'),
      remediation: aiResult?.remediation ?? null,
    }
  })

  const allResults = [...mcResults, ...subjectiveResults]

  // Compute totals server-side
  const totalScore = allResults.reduce((sum, r) => sum + r.score, 0)
  const maxScore = questions.reduce((sum, q) => sum + (POINTS[q.question_type] ?? 5), 0)
  const passRate = maxScore > 0 ? totalScore / maxScore : 0
  const isPassed = passRate >= 0.8

  // ── Phase 4: Write to DB ──
  const insertResponse = db.prepare(`
    INSERT INTO test_responses (question_id, user_answer, is_correct, score, ai_feedback, error_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const tx = db.transaction(() => {
    // Insert all responses
    for (const q of questions) {
      const answer = body.answers.find((a) => a.question_id === q.id)
      const result = allResults.find((r) => r.question_id === q.id)
      insertResponse.run(
        q.id,
        answer?.user_answer ?? '',
        result?.is_correct ? 1 : 0,
        result?.score ?? 0,
        result?.feedback ?? null,
        result?.error_type ?? null
      )
    }

    // Record mistakes inline (NOT via recordMistakes — that creates its own transaction which would crash)
    const insertMistake = db.prepare(`
      INSERT INTO mistakes (module_id, kp_id, knowledge_point, error_type, source, remediation)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    for (const r of allResults) {
      if (r.is_correct) continue
      const q = questions.find((qu) => qu.id === r.question_id)!
      const kpIdsArr: number[] = q.kp_ids ? JSON.parse(q.kp_ids) : []
      insertMistake.run(
        id,
        q.kp_id ?? kpIdsArr[0] ?? null,
        q.question_text.slice(0, 200),
        r.error_type ?? 'blind_spot',
        'test',
        r.remediation ?? null
      )
    }

    // Update paper with scores
    db.prepare(`
      UPDATE test_papers SET total_score = ?, pass_rate = ?, is_passed = ? WHERE id = ?
    `).run(totalScore, passRate, isPassed ? 1 : 0, body.paper_id)

    // Update module status if passed
    if (isPassed) {
      db.prepare('UPDATE modules SET learning_status = ? WHERE id = ?').run('completed', id)
    }
  })

  tx()

  logAction(
    'Test scoring complete',
    `paperId=${body.paper_id}, score=${totalScore}/${maxScore}, passed=${isPassed}`
  )

  // Build response with full question details for frontend
  const responseData = questions.map((q) => {
    const result = allResults.find((r) => r.question_id === q.id)
    const answer = body.answers.find((a) => a.question_id === q.id)
    return {
      question_id: q.id,
      question_type: q.question_type,
      question_text: q.question_text,
      options: q.options ? JSON.parse(q.options) : null,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      user_answer: answer?.user_answer ?? '',
      is_correct: result?.is_correct ?? false,
      score: result?.score ?? 0,
      max_score: POINTS[q.question_type] ?? 5,
      feedback: result?.feedback ?? null,
      error_type: result?.error_type ?? null,
      remediation: result?.remediation ?? null,
    }
  })

  return {
    data: {
      paper_id: body.paper_id,
      attempt_number: paper.attempt_number,
      total_score: totalScore,
      max_score: maxScore,
      pass_rate: Math.round(passRate * 100),
      is_passed: isPassed,
      results: responseData,
    },
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/modules/\[moduleId\]/test/submit/route.ts
git commit -m "feat(m3): test submit + scoring API endpoint"
```

---

## Task 4: Test Status API (Codex)

**Files:**
- Create: `src/app/api/modules/[moduleId]/test/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
import { handleRoute } from '@/lib/handle-route'
import { getDb } from '@/lib/db'
import { UserError } from '@/lib/errors'

interface PaperRow {
  id: number
  attempt_number: number
  total_score: number | null
  pass_rate: number | null
  is_passed: number
  created_at: string
}

export const GET = handleRoute(async (_req, context) => {
  const { moduleId } = await context!.params
  const id = Number(moduleId)
  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid module ID', 'INVALID_ID', 400)
  }

  const db = getDb()

  const module_ = db.prepare('SELECT learning_status FROM modules WHERE id = ?').get(id) as { learning_status: string } | undefined
  if (!module_) {
    throw new UserError('Module not found', 'NOT_FOUND', 404)
  }

  // Get all papers for this module
  const papers = db.prepare(`
    SELECT id, attempt_number, total_score, pass_rate, is_passed, created_at
    FROM test_papers WHERE module_id = ? ORDER BY attempt_number ASC
  `).all(id) as PaperRow[]

  // Find in-progress paper (unsubmitted)
  const inProgress = papers.find((p) => p.total_score === null)

  // Completed papers
  const history = papers
    .filter((p) => p.total_score !== null)
    .map((p) => ({
      paper_id: p.id,
      attempt_number: p.attempt_number,
      total_score: p.total_score,
      pass_rate: p.pass_rate !== null ? Math.round(p.pass_rate * 100) : null,
      is_passed: p.is_passed === 1,
      created_at: p.created_at,
    }))

  return {
    data: {
      learning_status: module_.learning_status,
      in_progress_paper_id: inProgress?.id ?? null,
      history,
    },
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/modules/\[moduleId\]/test/route.ts
git commit -m "feat(m3): test status query API endpoint"
```

---

## Task 5: Rewrite Mistakes API (Codex)

**Files:**
- Rewrite: `src/app/api/modules/[moduleId]/mistakes/route.ts`

- [ ] **Step 1: Rewrite the file**

Replace the entire file. The old version joins against non-existent `questions` and `user_responses` tables. New version uses `mistakes` table directly + optional join to `knowledge_points`.

```typescript
import { handleRoute } from '@/lib/handle-route'
import { getDb } from '@/lib/db'
import { UserError } from '@/lib/errors'

interface MistakeRow {
  id: number
  module_id: number
  kp_id: number | null
  knowledge_point: string
  error_type: string
  source: string
  remediation: string | null
  is_resolved: number
  created_at: string
  kp_code: string | null
  kp_description: string | null
}

export const GET = handleRoute(async (_req, context) => {
  const { moduleId } = await context!.params
  const id = Number(moduleId)
  if (!Number.isInteger(id) || id <= 0) {
    throw new UserError('Invalid module ID', 'INVALID_ID', 400)
  }

  const db = getDb()

  const mistakes = db.prepare(`
    SELECT
      m.id, m.module_id, m.kp_id, m.knowledge_point, m.error_type,
      m.source, m.remediation, m.is_resolved, m.created_at,
      kp.kp_code, kp.description AS kp_description
    FROM mistakes m
    LEFT JOIN knowledge_points kp ON kp.id = m.kp_id
    WHERE m.module_id = ?
    ORDER BY m.created_at DESC
  `).all(id) as MistakeRow[]

  return {
    data: {
      mistakes: mistakes.map((m) => ({
        id: m.id,
        kp_id: m.kp_id,
        kp_code: m.kp_code,
        kp_description: m.kp_description,
        knowledge_point: m.knowledge_point,
        error_type: m.error_type,
        source: m.source,
        remediation: m.remediation,
        is_resolved: m.is_resolved === 1,
        created_at: m.created_at,
      })),
    },
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/modules/\[moduleId\]/mistakes/route.ts
git commit -m "fix(m3): rewrite mistakes API for new schema"
```

---

## Task 6: Delete Old Routes (Codex)

**Files:**
- Delete: `src/app/api/modules/[moduleId]/test-questions/route.ts`
- Delete: `src/app/api/modules/[moduleId]/test-evaluate/route.ts`

- [ ] **Step 1: Delete old files**

```bash
rm src/app/api/modules/\[moduleId\]/test-questions/route.ts
rmdir src/app/api/modules/\[moduleId\]/test-questions
rm src/app/api/modules/\[moduleId\]/test-evaluate/route.ts
rmdir src/app/api/modules/\[moduleId\]/test-evaluate
```

- [ ] **Step 2: Commit**

```bash
git add -A src/app/api/modules/\[moduleId\]/test-questions src/app/api/modules/\[moduleId\]/test-evaluate
git commit -m "chore(m3): remove old Phase 1 test routes"
```

---

## Task 7: Frontend — Test Page + TestSession (Gemini)

**Files:**
- Rewrite: `src/app/books/[bookId]/modules/[moduleId]/test/page.tsx`
- Rewrite: `src/app/books/[bookId]/modules/[moduleId]/test/TestSession.tsx`

**API contract (for frontend):**

```
POST /api/modules/{moduleId}/test/generate
  Body: { retake?: boolean }
  Response: { success: true, data: { paper_id, attempt_number, questions: [{ id, question_type, question_text, options, order_index }] } }
  Note: Response does NOT contain correct_answer or explanation

POST /api/modules/{moduleId}/test/submit
  Body: { paper_id: number, answers: [{ question_id: number, user_answer: string }] }
  Response: { success: true, data: { paper_id, attempt_number, total_score, max_score, pass_rate, is_passed, results: [{ question_id, question_type, question_text, options, correct_answer, explanation, user_answer, is_correct, score, max_score, feedback, error_type, remediation }] } }

GET /api/modules/{moduleId}/test
  Response: { success: true, data: { learning_status, in_progress_paper_id, history: [{ paper_id, attempt_number, total_score, pass_rate, is_passed, created_at }] } }
```

- [ ] **Step 1: Rewrite `page.tsx`**

Server component. Query module + test status. Pass props to TestSession.

Key changes from old version:
- Remove `pass_status` query (use `test_papers.is_passed` via test status API instead)
- Pass `learningStatus` to TestSession so it knows entry conditions

```tsx
// page.tsx must:
// 1. Query book + module (404 if not found)
// 2. Check learning_status: only allow 'notes_generated', 'testing', or 'completed'
// 3. Query test_papers for this module to determine: has_active_paper, last_passed
// 4. Pass { moduleId, moduleTitle, bookId, learningStatus, hasPassed } to TestSession
```

- [ ] **Step 2: Rewrite `TestSession.tsx`**

Client component. State machine with stages: `test_intro | generating | answering | submitting | results | error`.

Key differences from old version:
- Calls new API paths (`/api/modules/${moduleId}/test/generate`, `/api/modules/${moduleId}/test/submit`)
- Handles `{ success, data }` envelope
- Tracks `paper_id` in state (received from generate, sent with submit)
- `answering` stage: renders questions by type (single_choice with radio buttons, others with textarea)
- Options come as JSON array `["A. ...", "B. ...", ...]` — parse and render
- `results` stage: shows total_score/max_score, pass_rate%, pass/fail badge, per-question feedback
- Error types displayed with Chinese labels: `blind_spot → 知识盲点`, `procedural → 程序性失误`, `confusion → 概念混淆`, `careless → 粗心错误`
- `test_intro` stage: display soft reminder "建议在完成 Q&A 后隔天再做测试，间隔效应让记忆更牢固" above the "开始测试" button, with a "明天再来" link back to module map (same UX as existing TestSession.tsx reminder stage)
- "重新测试" button calls generate with `{ retake: true }`
- After 3 **consecutive** failed attempts (check that the last 3 entries in `history` all have `is_passed === false`), show extra hint: "建议回去重做 Q&A"
- **Product invariant #3**: No notes/QA links anywhere on the test page

Design tokens: read `.gemini/DESIGN_TOKENS.md` for colors, spacing, component styles.

- [ ] **Step 3: Commit**

```bash
git add src/app/books/\[bookId\]/modules/\[moduleId\]/test/
git commit -m "feat(m3): rewrite test page + TestSession for new API"
```

---

## Task 8: Frontend — Mistakes Page (Gemini)

**Files:**
- Rewrite: `src/app/books/[bookId]/modules/[moduleId]/mistakes/page.tsx`

**API contract:**

```
GET /api/modules/{moduleId}/mistakes
  Response: { success: true, data: { mistakes: [{ id, kp_id, kp_code, kp_description, knowledge_point, error_type, source, remediation, is_resolved, created_at }] } }
```

- [ ] **Step 1: Rewrite the page**

Key changes:
- Use `handleRoute` envelope: `data.mistakes` instead of `mistakes` directly
- Display `error_type` with Chinese labels
- Display `source` (test/qa/review)
- Display `remediation` (AI's suggested fix)
- Display `kp_code` + `kp_description` if available
- Group by `is_resolved` (unresolved first, then resolved)

- [ ] **Step 2: Commit**

```bash
git add src/app/books/\[bookId\]/modules/\[moduleId\]/mistakes/
git commit -m "feat(m3): rewrite mistakes page for new schema"
```

---

## Task 9: API Contract + Status Update (Claude)

**Files:**
- Modify: `.agents/API_CONTRACT.md`
- Modify: `docs/project_status.md`
- Modify: `docs/changelog.md`

- [ ] **Step 1: Add M3 endpoints to API_CONTRACT.md**

Add the three new endpoints with request/response schemas (as documented in Tasks 2-4).

- [ ] **Step 2: Update project_status.md**

Change M3 status from "未开始" to "进行中" (or "已完成" after all tasks done).

- [ ] **Step 3: Update changelog.md**

Add M3 entry with completed tasks.

- [ ] **Step 4: Commit**

```bash
git add .agents/API_CONTRACT.md docs/project_status.md docs/changelog.md
git commit -m "docs: update API contract and project status for M3"
```

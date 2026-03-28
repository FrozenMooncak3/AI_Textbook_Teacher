# M0：地基改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the database schema to support KP-centric learning, add a prompt template system, and fix existing OCR bugs — without breaking upload/PDF reader/screenshot AI.

**Architecture:** Destructive migration — backup old DB, delete it, create new schema from scratch via `initSchema()`. Prompt templates stored in DB, loaded and rendered by a new utility module.

**Tech Stack:** SQLite (better-sqlite3), TypeScript, Next.js API routes, Python (OCR scripts)

**Design spec:** `docs/superpowers/specs/2026-03-21-mvp-redesign-design.md` — Section 4 (Data Model)

**CCB role:** This plan is for **Codex**（后端工程师）. File boundary: `src/app/api/**`, `src/lib/**`, `scripts/**`

---

## What Must Still Work After M0

Upload PDF → PDF reader → Screenshot AI → OCR processing. These use `books`, `conversations`, `messages`, `highlights` tables (all preserved).

## What Will Break (Intentionally)

The old learning flow (Q&A, test, review) uses `questions`, `user_responses`, `review_tasks` — all dropped. The old `notes` table is replaced by `reading_notes`. `modules.pass_status` and `modules.guide_json` are dropped.

**API routes that will break** (to be rebuilt in M1-M3):
- `GET /api/modules/[moduleId]/questions` — references `questions` table
- `POST /api/modules/[moduleId]/evaluate` — references `questions`, `user_responses`
- `GET /api/modules/[moduleId]/test-questions` — references `questions` table
- `POST /api/qa/[questionId]/respond` — references `user_responses`
- `GET/POST /api/modules/[moduleId]/guide` — references `modules.guide_json`
- `GET/POST/PUT/DELETE /api/books/[bookId]/notes` — references `notes` table

These routes remain in the codebase but will error if called. They will be rewritten in M1-M3.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/db.ts` | Complete schema rewrite |
| Create | `src/lib/prompt-templates.ts` | Template loading + variable substitution |
| Create | `src/lib/seed-templates.ts` | Seed initial prompt templates |
| Modify | `src/lib/mistakes.ts` | Update for new mistakes table columns |
| Investigate/Fix | `scripts/ocr_pdf.py` | OCR progress bar bug |
| Investigate/Fix | `scripts/ocr_server.py` | Screenshot OCR bug |

---

## Task 1: Database Schema Rewrite

**Files:**
- Modify: `src/lib/db.ts`

### Steps

- [ ] **Step 1: Back up the current database**

```bash
cp data/app.db data/app.db.backup-$(date +%Y%m%d)
```

- [ ] **Step 2: Rewrite `initSchema()` in `src/lib/db.ts`**

Replace the entire body of `initSchema()` with the following. Since we delete the DB file in Step 3, all tables use `CREATE TABLE IF NOT EXISTS` with final column definitions. No ALTER TABLE needed.

```sql
-- ==================== PRESERVED TABLES (same or extended) ====================

CREATE TABLE IF NOT EXISTS books (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  title                 TEXT    NOT NULL,
  raw_text              TEXT,
  file_path             TEXT,
  parse_status          TEXT    NOT NULL DEFAULT 'pending',
  kp_extraction_status  TEXT    NOT NULL DEFAULT 'pending',
  ocr_current_page      INTEGER NOT NULL DEFAULT 0,
  ocr_total_pages       INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS modules (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id         INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  title           TEXT    NOT NULL,
  summary         TEXT    NOT NULL DEFAULT '',
  order_index     INTEGER NOT NULL,
  kp_count        INTEGER NOT NULL DEFAULT 0,
  cluster_count   INTEGER NOT NULL DEFAULT 0,
  page_start      INTEGER,
  page_end        INTEGER,
  learning_status TEXT    NOT NULL DEFAULT 'not_started',
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id          INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  page_number      INTEGER NOT NULL,
  screenshot_text  TEXT    NOT NULL DEFAULT '',
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT    NOT NULL CHECK(role IN ('user', 'assistant')),
  content         TEXT    NOT NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS highlights (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  text        TEXT    NOT NULL,
  color       TEXT    NOT NULL DEFAULT 'yellow',
  rects_json  TEXT    NOT NULL DEFAULT '[]',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  level      TEXT    NOT NULL DEFAULT 'info',
  action     TEXT    NOT NULL,
  details    TEXT    NOT NULL DEFAULT ''
);

-- ==================== NEW CORE TABLES ====================

CREATE TABLE IF NOT EXISTS knowledge_points (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id        INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  kp_code          TEXT    NOT NULL,
  section_name     TEXT    NOT NULL,
  description      TEXT    NOT NULL,
  type             TEXT    NOT NULL CHECK(type IN ('position','calculation','c1_judgment','c2_evaluation','definition')),
  importance       INTEGER NOT NULL DEFAULT 2,
  detailed_content TEXT    NOT NULL,
  cluster_id       INTEGER REFERENCES clusters(id),
  ocr_quality      TEXT    NOT NULL DEFAULT 'good',
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clusters (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id            INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  name                 TEXT    NOT NULL,
  current_p_value      INTEGER NOT NULL DEFAULT 2,
  last_review_result   TEXT,
  consecutive_correct  INTEGER NOT NULL DEFAULT 0,
  next_review_date     TEXT,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ==================== LEARNING CHAIN TABLES ====================

CREATE TABLE IF NOT EXISTS reading_notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  module_id   INTEGER REFERENCES modules(id),
  page_number INTEGER,
  content     TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS module_notes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id      INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  content        TEXT    NOT NULL,
  generated_from TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS qa_questions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id        INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  kp_id            INTEGER REFERENCES knowledge_points(id),
  question_type    TEXT    NOT NULL CHECK(question_type IN ('worked_example','scaffolded_mc','short_answer','comparison')),
  question_text    TEXT    NOT NULL,
  correct_answer   TEXT,
  scaffolding      TEXT,
  order_index      INTEGER NOT NULL,
  is_review        INTEGER NOT NULL DEFAULT 0,
  source_module_id INTEGER,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS qa_responses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES qa_questions(id) ON DELETE CASCADE,
  user_answer TEXT    NOT NULL,
  is_correct  INTEGER,
  ai_feedback TEXT,
  score       REAL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS test_papers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id      INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  total_score    REAL,
  pass_rate      REAL,
  is_passed      INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS test_questions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  paper_id       INTEGER NOT NULL REFERENCES test_papers(id) ON DELETE CASCADE,
  kp_id          INTEGER REFERENCES knowledge_points(id),
  question_type  TEXT    NOT NULL CHECK(question_type IN ('single_choice','c2_evaluation','calculation','essay')),
  question_text  TEXT    NOT NULL,
  options        TEXT,
  correct_answer TEXT    NOT NULL,
  explanation    TEXT,
  order_index    INTEGER NOT NULL,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS test_responses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES test_questions(id) ON DELETE CASCADE,
  user_answer TEXT    NOT NULL,
  is_correct  INTEGER,
  score       REAL,
  ai_feedback TEXT,
  error_type  TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mistakes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id       INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  kp_id           INTEGER REFERENCES knowledge_points(id),
  knowledge_point TEXT,
  error_type      TEXT    NOT NULL CHECK(error_type IN ('blind_spot','procedural','confusion','careless')),
  source          TEXT    NOT NULL DEFAULT 'test' CHECK(source IN ('test','qa','review')),
  remediation     TEXT,
  is_resolved     INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ==================== REVIEW SYSTEM ====================

CREATE TABLE IF NOT EXISTS review_schedule (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id    INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  review_round INTEGER NOT NULL,
  due_date     TEXT    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'pending',
  completed_at TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS review_records (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id     INTEGER NOT NULL REFERENCES review_schedule(id) ON DELETE CASCADE,
  cluster_id      INTEGER NOT NULL REFERENCES clusters(id),
  questions_count INTEGER NOT NULL,
  correct_count   INTEGER NOT NULL,
  p_value_before  INTEGER NOT NULL,
  p_value_after   INTEGER NOT NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ==================== AI DISPATCH ====================

CREATE TABLE IF NOT EXISTS prompt_templates (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  role          TEXT    NOT NULL,
  stage         TEXT    NOT NULL,
  version       INTEGER NOT NULL DEFAULT 1,
  template_text TEXT    NOT NULL,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(role, stage, version)
);
```

Remove all old migration code (the `try { ALTER TABLE... } catch {}` blocks for `guide_json`, `ocr_current_page`, `ocr_total_pages`). Those columns are now in the `CREATE TABLE` directly.

Remove any `CREATE TABLE` for old tables: `questions`, `user_responses`, `review_tasks`, `notes`.

- [ ] **Step 3: Delete old database and restart**

```bash
rm data/app.db
npm run dev
```

Verify: app starts without errors. Check tables exist:

```bash
sqlite3 data/app.db ".tables"
```

Expected: `books`, `modules`, `knowledge_points`, `clusters`, `reading_notes`, `module_notes`, `qa_questions`, `qa_responses`, `test_papers`, `test_questions`, `test_responses`, `mistakes`, `review_schedule`, `review_records`, `conversations`, `messages`, `highlights`, `logs`, `prompt_templates`.

- [ ] **Step 4: Verify preserved functionality**

Upload a test PDF via the upload page. Verify:
- Book appears in list
- PDF reader opens
- OCR starts (if testing with real PDF)
- Screenshot AI responds (if ocr_server.py is running)

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts
git commit -m "M0: rewrite database schema — KP-centric tables, destructive migration"
```

---

## Task 2: Prompt Template System

**Files:**
- Create: `src/lib/prompt-templates.ts`
- Create: `src/lib/seed-templates.ts`
- Modify: `src/lib/db.ts` (call seedTemplates at end of initSchema)

### Steps

- [ ] **Step 1: Create `src/lib/prompt-templates.ts`**

```typescript
import { getDb } from './db'

interface PromptTemplate {
  id: number
  role: string
  stage: string
  version: number
  template_text: string
  is_active: number
}

/**
 * Get the currently active template for a role + stage.
 * Throws if no active template found.
 */
export function getActiveTemplate(role: string, stage: string): PromptTemplate {
  const db = getDb()
  const row = db.prepare(
    'SELECT * FROM prompt_templates WHERE role = ? AND stage = ? AND is_active = 1'
  ).get(role, stage) as PromptTemplate | undefined

  if (!row) {
    throw new Error(`No active prompt template found for role=${role}, stage=${stage}`)
  }
  return row
}

/**
 * Render a template by substituting {variable} placeholders with values.
 * Unmatched placeholders are left as-is.
 */
export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match
  })
}

/**
 * Load active template + substitute variables in one call.
 */
export function getPrompt(role: string, stage: string, variables: Record<string, string>): string {
  const template = getActiveTemplate(role, stage)
  return renderTemplate(template.template_text, variables)
}
```

- [ ] **Step 2: Create `src/lib/seed-templates.ts`**

```typescript
import { getDb } from './db'

interface TemplateSeed {
  role: string
  stage: string
  template_text: string
}

const SEED_TEMPLATES: TemplateSeed[] = [
  // ---- Extractor ----
  {
    role: 'extractor',
    stage: 'structure_scan',
    template_text: '你是一个教材知识点提取专家。\n\n## 任务\n对以下教材文本进行结构扫描，识别小节标题和页码范围。\n\n## 文本\n{ocr_text}\n\n## 输出要求\n返回 JSON: { "sections": [{ "title": "", "line_start": 0, "line_end": 0, "estimated_kp_count": 0 }] }'
  },
  {
    role: 'extractor',
    stage: 'kp_extraction',
    template_text: '你是一个教材知识点提取专家。\n\n## 任务\n从以下文本块中提取知识点。\n\n## 提取规则\n{extraction_rules}\n\n## 文本块\n{text_block}\n\n## 已提取的 KP（上下文）\n{existing_kps}\n\n## 输出要求\n返回 JSON: { "knowledge_points": [{ "kp_code": "", "section_name": "", "description": "", "type": "", "importance": 1, "detailed_content": "", "cross_block_risk": false }] }'
  },
  {
    role: 'extractor',
    stage: 'quality_check',
    template_text: '你是一个知识点质量审核专家。\n\n## 任务\n检查以下 KP 表的质量。\n\n## KP 表\n{kp_table}\n\n## 质量门标准\n{quality_gates}\n\n## 输出要求\n返回 JSON: { "passed": true, "issues": [] }'
  },
  // ---- Coach ----
  {
    role: 'coach',
    stage: 'pre_reading_guide',
    template_text: '你是一个学习教练。\n\n## 任务\n为以下模块生成读前指引。\n\n## 本模块知识点\n{kp_table}\n\n## 跨模块依赖\n{dependencies}\n\n## 输出要求\n返回 JSON: { "can_do_after": "", "key_points": [], "common_pitfalls": [] }'
  },
  {
    role: 'coach',
    stage: 'qa_generation',
    template_text: '你是一个教材学习教练。\n\n## 任务\n根据知识点表出 Q&A 练习题。\n\n## Q&A 规则\n{qa_rules}\n\n## 本模块知识点\n{kp_table}\n\n## 用户阅读笔记\n{user_notes}\n\n## 用户截图问答记录\n{user_qa_history}\n\n## 历史错题\n{past_mistakes}\n\n## 输出要求\n返回 JSON: { "questions": [{ "kp_id": 0, "type": "", "text": "", "correct_answer": "", "scaffolding": "" }] }'
  },
  {
    role: 'coach',
    stage: 'qa_feedback',
    template_text: '你是一个学习教练。\n\n## 任务\n评估学生回答并给出即时反馈。\n\n## 题目\n{question}\n\n## 正确答案\n{correct_answer}\n\n## 学生回答\n{user_answer}\n\n## 对应知识点\n{kp_detail}\n\n## 输出要求\n返回 JSON: { "is_correct": true, "score": 0, "feedback": "" }'
  },
  {
    role: 'coach',
    stage: 'note_generation',
    template_text: '你是一个学习笔记生成专家。\n\n## 任务\n整合以下信息生成模块学习笔记。\n\n## 知识点表\n{kp_table}\n\n## 用户阅读笔记\n{user_notes}\n\n## Q&A 结果\n{qa_results}\n\n## 输出要求\n返回 Markdown 格式的学习笔记。'
  },
  // ---- Examiner ----
  {
    role: 'examiner',
    stage: 'test_generation',
    template_text: '你是一个考试出题专家。\n\n## 任务\n根据知识点表出模块测试题。\n\n## 测试规则\n{test_rules}\n\n## 本模块知识点\n{kp_table}\n\n## 历史错题\n{past_mistakes}\n\n## 输出要求\n返回 JSON: { "questions": [{ "kp_id": 0, "type": "", "text": "", "options": [], "correct_answer": "", "explanation": "" }] }'
  },
  {
    role: 'examiner',
    stage: 'test_scoring',
    template_text: '你是一个考试评分专家。\n\n## 任务\n评估学生测试答案。\n\n## 试卷\n{test_paper}\n\n## 学生答案\n{user_answers}\n\n## 输出要求\n返回 JSON: { "results": [{ "question_id": 0, "is_correct": true, "score": 0, "feedback": "", "error_type": null }], "total_score": 0, "pass_rate": 0, "is_passed": true }'
  },
  // ---- Reviewer ----
  {
    role: 'reviewer',
    stage: 'review_generation',
    template_text: '你是一个复习出题专家。\n\n## 任务\n根据聚类和 P 值出复习题。\n\n## 复习规则\n{review_rules}\n\n## 聚类及 P 值\n{clusters_with_p}\n\n## 对应知识点\n{kp_table}\n\n## 历史错题\n{past_mistakes}\n\n## 输出要求\n返回 JSON: { "questions": [{ "cluster_id": 0, "kp_id": 0, "type": "", "text": "", "options": [], "correct_answer": "", "explanation": "" }] }'
  },
  // ---- Assistant ----
  {
    role: 'assistant',
    stage: 'screenshot_qa',
    template_text: '你是一个教材学习助手。用户在阅读 PDF 时截图了一段内容并提问。\n\n## 截图识别文本\n{screenshot_text}\n\n## 用户问题\n{user_question}\n\n## 之前的对话\n{conversation_history}\n\n## 要求\n用中文回答，解释清楚，如果涉及公式请写出完整步骤。'
  },
]

export function seedTemplates(): void {
  const db = getDb()
  const existing = db.prepare('SELECT COUNT(*) as count FROM prompt_templates').get() as { count: number }
  if (existing.count > 0) return

  const insert = db.prepare(
    'INSERT INTO prompt_templates (role, stage, version, template_text, is_active) VALUES (?, ?, 1, ?, 1)'
  )

  const tx = db.transaction(() => {
    for (const t of SEED_TEMPLATES) {
      insert.run(t.role, t.stage, t.template_text)
    }
  })
  tx()
}
```

- [ ] **Step 3: Call seedTemplates() at end of initSchema() in db.ts**

```typescript
import { seedTemplates } from './seed-templates'

// At the very end of initSchema(), after all CREATE TABLE statements:
seedTemplates()
```

- [ ] **Step 4: Delete database, restart, verify**

```bash
rm data/app.db
npm run dev
```

Verify templates are seeded:

```bash
sqlite3 data/app.db "SELECT role, stage FROM prompt_templates;"
```

Expected: 11 rows covering all roles and stages.

- [ ] **Step 5: Test renderTemplate**

Create and run `scripts/test-prompt-templates.ts`:

```typescript
import { renderTemplate } from '../src/lib/prompt-templates'

// Test 1: basic substitution
const r1 = renderTemplate('Hello {name}, you have {count} items.', { name: 'Alice', count: '3' })
console.assert(r1 === 'Hello Alice, you have 3 items.', `FAIL: got "${r1}"`)

// Test 2: unmatched placeholders preserved
const r2 = renderTemplate('Hello {name}, {unknown} here.', { name: 'Bob' })
console.assert(r2 === 'Hello Bob, {unknown} here.', `FAIL: got "${r2}"`)

// Test 3: empty variables object
const r3 = renderTemplate('{a} and {b}', {})
console.assert(r3 === '{a} and {b}', `FAIL: got "${r3}"`)

console.log('All prompt template tests passed')
```

Run with: `npx tsx scripts/test-prompt-templates.ts`

- [ ] **Step 6: Commit**

```bash
git add src/lib/prompt-templates.ts src/lib/seed-templates.ts src/lib/db.ts scripts/test-prompt-templates.ts
git commit -m "M0: add prompt template system with 11 seed templates"
```

---

## Task 3: Update mistakes.ts

**Files:**
- Modify: `src/lib/mistakes.ts`

### Steps

- [ ] **Step 1: Rewrite the recordMistake function**

The old function inserted into `(module_id, question_id, knowledge_point, next_review_date)`. The new `mistakes` table has different columns. Update to:

```typescript
import { getDb } from './db'

interface RecordMistakeParams {
  moduleId: number
  knowledgePoint: string
  kpId?: number
  errorType: 'blind_spot' | 'procedural' | 'confusion' | 'careless'
  source?: 'test' | 'qa' | 'review'
  remediation?: string
}

export function recordMistake(params: RecordMistakeParams): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO mistakes (module_id, kp_id, knowledge_point, error_type, source, remediation)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    params.moduleId,
    params.kpId ?? null,
    params.knowledgePoint,
    params.errorType,
    params.source ?? 'test',
    params.remediation ?? null
  )
}

export function getUnresolvedMistakes(moduleId: number): unknown[] {
  const db = getDb()
  return db.prepare(
    'SELECT * FROM mistakes WHERE module_id = ? AND is_resolved = 0 ORDER BY created_at DESC'
  ).all(moduleId)
}

export function resolveMistake(mistakeId: number): void {
  const db = getDb()
  db.prepare('UPDATE mistakes SET is_resolved = 1 WHERE id = ?').run(mistakeId)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/mistakes.ts
git commit -m "M0: update mistakes module for new schema"
```

---

## Task 4: Diagnose and Fix OCR Progress Bar Bug

**Context:** OCR progress bar stops at 1/189. Could be: script crash, DB update failure, or frontend polling issue.

**Files:**
- Investigate: `scripts/ocr_pdf.py`
- Investigate: `src/app/api/books/[bookId]/status/route.ts`

### Steps

- [ ] **Step 1: Check OCR logs and book status**

```bash
sqlite3 data/app.db "SELECT id, title, parse_status, ocr_current_page, ocr_total_pages FROM books;"
sqlite3 data/app.db "SELECT * FROM logs WHERE action LIKE '%ocr%' ORDER BY created_at DESC LIMIT 20;"
```

If `parse_status` is still `processing` and `ocr_current_page` is stuck, the script likely crashed.

- [ ] **Step 2: Test OCR script manually**

```bash
python scripts/ocr_pdf.py <book_id> "data/uploads/<bookId>.pdf"
```

Watch console output. If it crashes, the traceback will show the issue. If it hangs, check which page is problematic.

- [ ] **Step 3: Apply fix**

Common fixes:
- **Page-level crash not caught**: Ensure every page is wrapped in try/except and progress is updated even on failure
- **DB path mismatch**: Verify the Python script uses the same `data/app.db` path
- **Process exits on Windows**: Check child process spawning in the upload API route

- [ ] **Step 4: Verify**

Upload a new test PDF. Watch progress update via:

```bash
# Poll status API every 3 seconds
while true; do curl -s http://localhost:3000/api/books/1/status | python -m json.tool; sleep 3; done
```

- [ ] **Step 5: Commit**

```bash
git add scripts/ocr_pdf.py
git commit -m "M0: fix OCR progress bar not updating"
```

---

## Task 5: Diagnose and Fix Screenshot OCR Bug

**Context:** Screenshot OCR returns "无法识别". Likely: ocr_server.py not running, or OCR result is empty.

**Files:**
- Investigate: `scripts/ocr_server.py`
- Investigate: `src/app/api/books/[bookId]/screenshot-ask/route.ts`

### Steps

- [ ] **Step 1: Check if ocr_server.py is running**

```bash
curl http://localhost:9876/health
# If no response:
python scripts/ocr_server.py
```

- [ ] **Step 2: Test OCR server directly with a real image**

Take a screenshot of some text, save as PNG, then:

```bash
curl -X POST http://localhost:9876/ocr -F "image=@test_screenshot.png"
```

If response has text → server works, issue is in the API route.
If response is empty → PaddleOCR model issue.

- [ ] **Step 3: Check screenshot-ask API route**

Read `src/app/api/books/[bookId]/screenshot-ask/route.ts`. Verify:
- Image is correctly forwarded to ocr_server.py
- Empty OCR result is handled (add fallback message instead of sending empty text to Claude)
- Proxy is bypassed for localhost connections

- [ ] **Step 4: Apply fix and verify**

After fixing, test end-to-end: open PDF reader → select area → verify AI response is meaningful.

- [ ] **Step 5: Commit**

```bash
git add scripts/ocr_server.py "src/app/api/books/[bookId]/screenshot-ask/route.ts"
git commit -m "M0: fix screenshot OCR recognition failure"
```

---

## Task 6: Final Verification

- [ ] **Step 1: Clean restart**

```bash
rm data/app.db
npm run dev
# In separate terminal:
python scripts/ocr_server.py
```

- [ ] **Step 2: Run verification checklist**

| # | Check | How | Expected |
|---|-------|-----|----------|
| 1 | App starts | `npm run dev` | No errors |
| 2 | 19 tables exist | `sqlite3 data/app.db ".tables"` | All tables listed |
| 3 | 11 prompt templates seeded | `sqlite3 data/app.db "SELECT COUNT(*) FROM prompt_templates;"` | 11 |
| 4 | Upload PDF | Upload page in browser | Book created, redirect works |
| 5 | PDF reader | Click into book | PDF renders |
| 6 | OCR progress | Watch status API after upload | Progress increments |
| 7 | Screenshot AI | Select area in PDF reader | AI responds with content |
| 8 | Prompt system | `npx tsx scripts/test-prompt-templates.ts` | All tests pass |

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "M0: foundation migration complete — all checks passed"
```

---

## M0 完成标准

1. 数据库包含 19 张表（含 knowledge_points, clusters, prompt_templates 等新表）
2. `getPrompt('coach', 'qa_generation', { kp_table: '...' })` 返回渲染后的 prompt
3. OCR 进度条正常更新
4. 截图 OCR 返回有效回答
5. 上传 → PDF 阅读器 → 截图问 AI 链路完整可用
6. 旧学习流程（Q&A/测试/复习）已知会 break，这是预期行为

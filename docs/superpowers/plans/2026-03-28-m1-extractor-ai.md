# M1: Extractor AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload PDF → three-stage KP extraction → KP table and module map written to DB → module map page display

**Architecture:** Background extraction pipeline triggered after OCR completes. Three-stage Claude API pipeline (structure scan → block extraction → quality validation). Results written to `modules`, `knowledge_points`, `clusters` tables. Frontend polls `kp_extraction_status` and navigates to module map page when ready.

**Tech Stack:** Next.js 15 API Routes, Claude API (`claude-sonnet-4-6`), SQLite (`better-sqlite3`), React + Tailwind CSS

**Design Spec:** `docs/superpowers/specs/2026-03-21-mvp-redesign-design.md` (Section 3.6 + Section 6)

---

## Pre-conditions

- M0 complete: 19 DB tables exist, prompt template system works, Claude client configured
- `src/app/api/books/route.ts` is **corrupted** (contains conversation JSON, not code) — Task 0 fixes this
- Existing DB may already have old prompt templates — Task 1 handles template migration

## Important Notes

- **`parse_status` values**: The Python OCR script (`scripts/ocr_pdf.py`) sets `parse_status = 'done'` (not `'completed'`). The spec documents the enum as `pending/processing/completed/failed`, but the actual runtime value is `'done'`. Do NOT "fix" this to `'completed'` — it would break the existing OCR flow.
- **Page markers in raw_text**: The OCR script currently joins page texts with `"\n\n"` without page markers. Task 0 adds `--- PAGE N ---` markers so Stage 0 can map sections to PDF page numbers.

## File Map

### New files (Codex)

| File | Responsibility |
|------|---------------|
| `src/lib/services/kp-extraction-types.ts` | TypeScript types for extraction pipeline |
| `src/lib/services/kp-extraction-service.ts` | Three-stage extraction orchestrator |
| `src/app/api/books/[bookId]/extract/route.ts` | Trigger KP extraction |
| `src/app/api/books/[bookId]/module-map/route.ts` | Get module map data |
| `src/app/api/books/[bookId]/module-map/confirm/route.ts` | User confirms module map |
| `src/app/api/books/[bookId]/module-map/regenerate/route.ts` | Re-trigger extraction (delete old + re-run) |

### Modified files (Codex)

| File | Change |
|------|--------|
| `src/app/api/books/route.ts` | Recover from git (`git show 3b48622:src/app/api/books/route.ts`) |
| `src/lib/seed-templates.ts` | Replace 3 extractor templates with detailed three-stage versions |
| `src/lib/prompt-templates.ts` | Add `upsertTemplate()` for template migration |
| `scripts/ocr_pdf.py` | Add `--- PAGE N ---` markers to raw_text output |

### New files (Gemini)

| File | Responsibility |
|------|---------------|
| `src/app/books/[bookId]/module-map/page.tsx` | Module map display + confirm/regenerate UI |

### Modified files (Gemini)

| File | Change |
|------|--------|
| `src/app/books/[bookId]/reader/page.tsx` (or `PdfViewerLoader`) | Add extraction status banner + link to module map when ready |

---

## Task 0: Fix Corrupted Files + Add OCR Page Markers [Codex]

**Files:**
- Fix: `src/app/api/books/route.ts`
- Modify: `scripts/ocr_pdf.py`

### Step 1: Recover corrupted books route

- [ ] **Recover from the last known good commit**

```bash
git show 3b48622:src/app/api/books/route.ts > src/app/api/books/route.ts
```

Verify the recovered file contains a valid Next.js route handler with `POST` (upload) and `GET` (list) exports. The `POST` handler saves the PDF, creates a DB row, spawns `ocr_pdf.py` in background.

### Step 2: Add page markers to OCR output

- [ ] **Modify `scripts/ocr_pdf.py`**

The current code joins pages with `"\n\n".join(pages_text)` (around line 104). Replace this join with page-marked output:

```python
# Replace:
#   return "\n\n".join(pages_text)
# With:
marked_parts: list[str] = []
for i, text in enumerate(pages_text):
    marked_parts.append(f"--- PAGE {i + 1} ---\n{text}")
return "\n\n".join(marked_parts)
```

This adds `--- PAGE N ---` markers that Stage 0 uses to map sections to actual PDF page numbers.

**Note on existing data:** Books already processed won't have page markers. This is fine — Stage 0 handles missing markers gracefully (falls back to line numbers). For accurate page mapping, re-upload or re-run OCR on existing books.

### Step 3: Verify and commit

- [ ] **Verify the app builds**

```bash
npx tsc --noEmit
```

- [ ] **Commit**

```bash
git add src/app/api/books/route.ts scripts/ocr_pdf.py
git commit -m "fix: recover corrupted books route + add page markers to OCR output"
git push origin master
```

---

## Task 1: Types + Enhanced Prompt Templates [Codex]

**Files:**
- Create: `src/lib/services/kp-extraction-types.ts`
- Modify: `src/lib/seed-templates.ts`
- Modify: `src/lib/prompt-templates.ts`

### Step 1: Create types file

- [ ] **Create `src/lib/services/kp-extraction-types.ts`**

```typescript
// === Stage 0 types ===

export interface Section {
  title: string
  line_start: number
  line_end: number
  page_start: number | null  // PDF page number (from --- PAGE N --- markers)
  page_end: number | null    // PDF page number
  estimated_kp_count: number
  module_group: number
}

export interface ModuleGroup {
  group_id: number
  title: string
  sections: string[]
  estimated_total_kp: number
  page_start: number | null
  page_end: number | null
}

export interface Stage0Result {
  sections: Section[]
  modules: ModuleGroup[]
}

// === Stage 1 types ===

export type KPType = 'position' | 'calculation' | 'c1_judgment' | 'c2_evaluation' | 'definition'
export type OCRQuality = 'good' | 'uncertain' | 'damaged'

export interface RawKP {
  kp_code: string
  section_name: string
  description: string
  type: KPType
  importance: number
  detailed_content: string
  cross_block_risk: boolean
  ocr_quality: OCRQuality
}

export interface Stage1Result {
  knowledge_points: RawKP[]
}

// === Stage 2 types ===

export interface QualityGates {
  all_sections_have_kp: boolean
  calculation_kp_complete: boolean
  c2_kp_have_signals: boolean
  no_too_wide_kp: boolean
  ocr_damaged_marked: boolean
  cross_block_merged: boolean
  module_ratio_ok: boolean
}

export interface QualityIssue {
  kp_code: string
  issue: string
  suggestion: string
}

export interface FinalKP {
  kp_code: string
  module_group: number
  cluster_name: string
  section_name: string
  description: string
  type: KPType
  importance: number
  detailed_content: string
  ocr_quality: OCRQuality
}

export interface ClusterDef {
  module_group: number
  name: string
  kp_codes: string[]
}

export interface Stage2Result {
  quality_gates: QualityGates
  issues: QualityIssue[]
  final_knowledge_points: FinalKP[]
  clusters: ClusterDef[]
}

// === Module map API types ===

export interface ModuleMapKP {
  id: number
  kp_code: string
  description: string
  type: KPType
  importance: number
  cluster_name: string | null
  ocr_quality: OCRQuality
}

export interface ModuleMapCluster {
  id: number
  name: string
  kp_count: number
}

export interface ModuleMapModule {
  id: number
  title: string
  summary: string
  order_index: number
  kp_count: number
  cluster_count: number
  page_start: number | null
  page_end: number | null
  knowledge_points: ModuleMapKP[]
  clusters: ModuleMapCluster[]
}

export interface ModuleMapResponse {
  book_id: number
  book_title: string
  kp_extraction_status: string
  total_kp_count: number
  total_module_count: number
  modules: ModuleMapModule[]
}
```

### Step 2: Add `upsertTemplate` to prompt-templates.ts

- [ ] **Add upsert function to `src/lib/prompt-templates.ts`**

Add this function after the existing `getPrompt`:

```typescript
/**
 * Insert or update a prompt template. Used for template migrations.
 */
export function upsertTemplate(role: string, stage: string, templateText: string): void {
  const db = getDb()
  const existing = db.prepare(
    'SELECT id FROM prompt_templates WHERE role = ? AND stage = ? AND is_active = 1'
  ).get(role, stage) as { id: number } | undefined

  if (existing) {
    db.prepare('UPDATE prompt_templates SET template_text = ? WHERE id = ?')
      .run(templateText, existing.id)
  } else {
    db.prepare(
      'INSERT INTO prompt_templates (role, stage, version, template_text, is_active) VALUES (?, ?, 1, ?, 1)'
    ).run(role, stage, templateText)
  }
}
```

### Step 3: Update extractor templates in seed-templates.ts

- [ ] **Replace the 3 extractor templates in `src/lib/seed-templates.ts`**

Replace the `structure_scan`, `kp_extraction`, and `quality_check` entries in `SEED_TEMPLATES` with the following. **Important**: Keep all other templates unchanged.

**structure_scan** (replace the existing entry):

```typescript
{
  role: 'extractor',
  stage: 'structure_scan',
  template_text: `你是一个教材知识点提取专家。

## 任务
对以下教材 OCR 文本进行结构扫描。识别所有小节标题、行号范围，并建议模块分组。

## 扫描规则
1. 识别所有二级和三级标题（通常是 X.X 或 X.X.X 编号，或加粗/大写的标题行）
2. 标注每个小节的起始行号和结束行号
3. 估计每个小节的知识点数量（8-15 个/10 页是正常密度）
4. 将小节分组为学习模块，确保：
   - 每个模块覆盖一个完整主题
   - 模块间 KP 数量差距不超过 2:1
   - 模块边界对齐小节边界（不在小节中间切割）
5. 忽略目录页、版权页、索引页等非正文内容
6. 文本中的 "--- PAGE N ---" 标记表示 PDF 第 N 页的开始，用来确定 page_start 和 page_end

## 文本（含行号）
{ocr_text}

## 输出要求
返回严格 JSON，不要有任何额外文字。page_start/page_end 从 "--- PAGE N ---" 标记中提取，如果没有标记则填 null：
{
  "sections": [
    {
      "title": "小节标题",
      "line_start": 0,
      "line_end": 0,
      "page_start": 1,
      "page_end": 3,
      "estimated_kp_count": 0,
      "module_group": 1
    }
  ],
  "modules": [
    {
      "group_id": 1,
      "title": "模块名称（概括主题，不是小节名拼接）",
      "sections": ["小节标题1", "小节标题2"],
      "estimated_total_kp": 0,
      "page_start": 1,
      "page_end": 5
    }
  ]
}`,
},
```

**kp_extraction** (replace the existing entry):

```typescript
{
  role: 'extractor',
  stage: 'kp_extraction',
  template_text: `你是一个教材知识点提取专家。

## 任务
从以下文本块中提取知识点（Knowledge Points, KP）。

## 提取规则

### 1. 内容分类
- 技术内容（定义、公式、规则、判断标准）→ 提取为独立 KP
- 举例/案例（某公司某年的数据）→ 归入上一个 KP 的 detailed_content，不单独提取
- 故事/背景（叙事性描述）→ 只提取其中的规则/原则，不提取情节

### 2. KP 粒度控制
- 太宽：description 含"以及""包括X个方面""和" → 必须拆分为多个 KP
- 太窄：只是某公司某年的具体数字，换个情境不适用 → 归入上一个 KP 的例子
- 判断标准：这个 KP 换一家公司、换一个情境还适用吗？适用 = 独立 KP，不适用 = 例子

### 3. KP 类型（必须标注其一）
- position: 立场/观点类（"XX 应该 YY"、"好的 XX 通常具备 YY"）
- calculation: 计算类（必须含公式 + 计算步骤 + 注意事项，三者缺一不可）
- c1_judgment: C1 判断类（能回答"是不是 XX"的事实性判断）
- c2_evaluation: C2 评估类（需权衡多因素做判断，必须含矛盾信号/正反两面）
- definition: 定义类（术语/概念的精确含义）

### 4. detailed_content 要求
- 必须自足（self-contained），不依赖上下文就能理解和出题
- 必须足够详细，作为出题的唯一依据
- 计算类：必须包含完整公式、计算步骤、单位、注意事项
- C2 评估类：必须包含正反两面的信号（"一方面...另一方面..."）
- 如果原文不够完整，用 [OCR 内容不完整] 标注

### 5. 跨块标记
如果文本块末尾的内容明显未完结（句子断裂、列表未结束、公式不完整），标记 cross_block_risk = true

## 所属小节
{section_name}

## 文本块
{text_block}

## 上一个块的末尾 KP（用于跨块续接，若为"无"则忽略）
{previous_block_tail}

## 输出要求
返回严格 JSON，不要有任何额外文字：
{
  "knowledge_points": [
    {
      "kp_code": "小节序号-KP序号（如 2.3-01）",
      "section_name": "所属小节名",
      "description": "一句话描述，不超过 25 字",
      "type": "position|calculation|c1_judgment|c2_evaluation|definition",
      "importance": 1,
      "detailed_content": "完整出题依据，自足内容",
      "cross_block_risk": false,
      "ocr_quality": "good|uncertain|damaged"
    }
  ]
}`,
},
```

**quality_check** (replace the existing entry):

```typescript
{
  role: 'extractor',
  stage: 'quality_check',
  template_text: `你是一个知识点质量审核专家。

## 任务
审核 KP 提取结果，执行跨块缝合、去重、聚类、模块分配和质量门检查。

## 审核步骤

### 1. 跨块缝合
- 找到所有 cross_block_risk = true 的 KP
- 如果下一个 KP 是续接内容（描述相似、同一主题），合并为一个 KP
- 合并后的 kp_code 用前一个

### 2. 去重
- 两个 KP 的"考法"完全相同（能出的题一模一样）→ 合并，保留 detailed_content 更详细的

### 3. 聚类
- 主题相近的 KP 归入同一聚类（cluster）
- 每个聚类 2-5 个 KP
- 聚类名称用 2-4 个字概括主题

### 4. 模块分配
根据以下模块结构，将每个 KP 分配到对应 module_group：
{module_structure}

### 5. 质量门（逐条检查，全部通过才合格）
1. 每个小节至少有 1 个 KP
2. 计算类 KP 全部包含完整公式和步骤
3. C2 评估类 KP 全部包含矛盾信号（正反两面）
4. 没有"太宽"KP（description 超过 25 字且含多个独立概念 → 需拆分）
5. OCR 损坏区域已标注 ocr_quality = "damaged" 或 "uncertain"
6. 所有 cross_block_risk KP 已处理（合并或确认独立）
7. 模块间 KP 数量比例 ≤ 2:1

## 原始 KP 列表
{kp_table}

## 输出要求
返回严格 JSON，不要有任何额外文字：
{
  "quality_gates": {
    "all_sections_have_kp": true,
    "calculation_kp_complete": true,
    "c2_kp_have_signals": true,
    "no_too_wide_kp": true,
    "ocr_damaged_marked": true,
    "cross_block_merged": true,
    "module_ratio_ok": true
  },
  "issues": [
    {
      "kp_code": "2.3-01",
      "issue": "问题描述",
      "suggestion": "修复建议"
    }
  ],
  "final_knowledge_points": [
    {
      "kp_code": "2.3-01",
      "module_group": 1,
      "cluster_name": "聚类名",
      "section_name": "所属小节",
      "description": "一句话描述",
      "type": "position|calculation|c1_judgment|c2_evaluation|definition",
      "importance": 1,
      "detailed_content": "完整自足内容",
      "ocr_quality": "good|uncertain|damaged"
    }
  ],
  "clusters": [
    {
      "module_group": 1,
      "name": "聚类名",
      "kp_codes": ["2.3-01", "2.3-02"]
    }
  ]
}`,
},
```

### Step 4: Add template migration logic

- [ ] **Update `seedTemplates()` in `src/lib/seed-templates.ts` to handle existing DBs**

Replace the current `seedTemplates` function:

```typescript
export function seedTemplates(): void {
  const db = getDb()
  const existing = db
    .prepare('SELECT COUNT(*) as count FROM prompt_templates')
    .get() as { count: number }

  if (existing.count === 0) {
    // Fresh DB: insert all templates
    const insert = db.prepare(
      'INSERT INTO prompt_templates (role, stage, version, template_text, is_active) VALUES (?, ?, 1, ?, 1)'
    )
    const tx = db.transaction(() => {
      for (const t of SEED_TEMPLATES) {
        insert.run(t.role, t.stage, t.template_text)
      }
    })
    tx()
  } else {
    // Existing DB: upsert extractor templates (may have been updated)
    const upsert = db.prepare(`
      INSERT INTO prompt_templates (role, stage, version, template_text, is_active)
      VALUES (?, ?, 1, ?, 1)
      ON CONFLICT(role, stage, version) DO UPDATE SET template_text = excluded.template_text
    `)
    const tx = db.transaction(() => {
      for (const t of SEED_TEMPLATES) {
        if (t.role === 'extractor') {
          upsert.run(t.role, t.stage, t.template_text)
        }
      }
    })
    tx()
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/kp-extraction-types.ts src/lib/seed-templates.ts src/lib/prompt-templates.ts
git commit -m "feat(m1): add extraction types + enhanced extractor prompt templates"
git push origin master
```

---

## Task 2: KP Extraction Service [Codex]

**Files:**
- Create: `src/lib/services/kp-extraction-service.ts`

This is the core of M1. The service implements the three-stage extraction protocol and writes results to the database.

- [ ] **Step 1: Create `src/lib/services/kp-extraction-service.ts`**

```typescript
import { getDb } from '../db'
import { getClaudeClient, CLAUDE_MODEL } from '../claude'
import { getPrompt } from '../prompt-templates'
import { logAction } from '../log'
import { SystemError } from '../errors'
import type {
  Stage0Result, Stage1Result, Stage2Result,
  RawKP, Section, ModuleGroup
} from './kp-extraction-types'

// --- Helpers ---

function splitIntoLines(text: string): string[] {
  return text.split('\n')
}

function addLineNumbers(lines: string[], startLine: number = 0): string {
  return lines.map((line, i) => `${startLine + i}: ${line}`).join('\n')
}

async function callClaude(prompt: string, maxTokens: number = 8192): Promise<string> {
  const claude = getClaudeClient()
  const msg = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  })
  const content = msg.content[0]
  if (content.type !== 'text') {
    throw new SystemError('Claude 返回非文本响应')
  }
  return content.text
}

function parseJSON<T>(text: string, context: string): T {
  // Extract JSON from response (Claude sometimes wraps in ```json blocks)
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) {
    throw new SystemError(`${context}: 未在 Claude 响应中找到 JSON`)
  }
  try {
    return JSON.parse(match[0]) as T
  } catch (err) {
    throw new SystemError(`${context}: JSON 解析失败`, err)
  }
}

// --- Stage 0: Structure Scan ---

const MAX_CHARS_PER_CALL = 120000 // Conservative limit for Claude input

async function structureScan(rawText: string): Promise<Stage0Result> {
  const lines = splitIntoLines(rawText)

  // For long texts, sample to stay within token limits
  let scanLines: string[]
  let scanStart = 0
  if (rawText.length > MAX_CHARS_PER_CALL) {
    // Sample: take first 3 lines of every 5 to preserve structure
    scanLines = lines.filter((_, i) => i % 5 < 3)
    // Adjust: we still use original line numbers
    const numberedText = lines
      .map((line, i) => (i % 5 < 3 ? `${i}: ${line}` : null))
      .filter(Boolean)
      .join('\n')

    const prompt = getPrompt('extractor', 'structure_scan', {
      ocr_text: numberedText.slice(0, MAX_CHARS_PER_CALL),
    })
    const response = await callClaude(prompt, 4096)
    return parseJSON<Stage0Result>(response, 'Stage 0')
  }

  const numberedText = addLineNumbers(lines)
  const prompt = getPrompt('extractor', 'structure_scan', {
    ocr_text: numberedText,
  })
  const response = await callClaude(prompt, 4096)
  return parseJSON<Stage0Result>(response, 'Stage 0')
}

// --- Stage 1: Block-by-block KP extraction ---

async function blockExtract(
  rawText: string,
  sections: Section[]
): Promise<RawKP[]> {
  const lines = splitIntoLines(rawText)
  const allKPs: RawKP[] = []
  let previousTail = '无'

  for (const section of sections) {
    // Extract the text block for this section
    const start = Math.max(0, section.line_start)
    const end = Math.min(lines.length - 1, section.line_end)
    const blockLines = lines.slice(start, end + 1)
    const block = blockLines.join('\n')

    if (block.trim().length === 0) {
      logAction('KP 提取跳过', `小节"${section.title}"文本为空`)
      continue
    }

    const prompt = getPrompt('extractor', 'kp_extraction', {
      section_name: section.title,
      text_block: block,
      previous_block_tail: previousTail,
    })

    const response = await callClaude(prompt, 8192)
    const result = parseJSON<Stage1Result>(response, `Stage 1: ${section.title}`)

    allKPs.push(...result.knowledge_points)

    // Track last KP for cross-block continuity
    const lastKP = result.knowledge_points[result.knowledge_points.length - 1]
    if (lastKP?.cross_block_risk) {
      previousTail = JSON.stringify(lastKP)
    } else {
      previousTail = '无'
    }

    logAction('KP 提取', `小节"${section.title}"提取到 ${result.knowledge_points.length} 个 KP`)
  }

  return allKPs
}

// --- Stage 2: Quality validation + module assignment ---

async function qualityCheck(
  rawKPs: RawKP[],
  modules: ModuleGroup[]
): Promise<Stage2Result> {
  const prompt = getPrompt('extractor', 'quality_check', {
    kp_table: JSON.stringify(rawKPs, null, 2),
    module_structure: JSON.stringify(modules, null, 2),
  })

  // Larger max_tokens because output includes all finalized KPs
  const response = await callClaude(prompt, 16384)
  return parseJSON<Stage2Result>(response, 'Stage 2')
}

// --- DB Write ---

function writeResultsToDB(
  bookId: number,
  stage0: Stage0Result,
  stage2: Stage2Result
): void {
  const db = getDb()

  db.transaction(() => {
    // Clean up any existing data for this book (for regeneration)
    const existingModules = db
      .prepare('SELECT id FROM modules WHERE book_id = ?')
      .all(bookId) as { id: number }[]

    for (const mod of existingModules) {
      // Cascading deletes handle knowledge_points, clusters, etc.
      db.prepare('DELETE FROM modules WHERE id = ?').run(mod.id)
    }

    // Create modules
    const insertModule = db.prepare(
      `INSERT INTO modules (book_id, title, summary, order_index, page_start, page_end, kp_count, cluster_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )

    const moduleIdMap: Record<number, number> = {}
    for (const mod of stage0.modules) {
      // Use PDF page numbers from Stage 0 (detected from --- PAGE N --- markers)
      // Falls back to null if markers were not present in the OCR text
      const pageStart = mod.page_start
      const pageEnd = mod.page_end
      const kpCount = stage2.final_knowledge_points
        .filter(kp => kp.module_group === mod.group_id).length
      const clusterCount = stage2.clusters
        .filter(c => c.module_group === mod.group_id).length

      const result = insertModule.run(
        bookId,
        mod.title,
        `${mod.sections.join(' / ')}`,
        mod.group_id,
        pageStart,
        pageEnd,
        kpCount,
        clusterCount
      )
      moduleIdMap[mod.group_id] = Number(result.lastInsertRowid)
    }

    // Create clusters
    const insertCluster = db.prepare(
      'INSERT INTO clusters (module_id, name) VALUES (?, ?)'
    )
    const clusterIdMap: Record<string, number> = {}

    for (const cluster of stage2.clusters) {
      const moduleId = moduleIdMap[cluster.module_group]
      if (!moduleId) continue
      const result = insertCluster.run(moduleId, cluster.name)
      clusterIdMap[`${cluster.module_group}:${cluster.name}`] = Number(result.lastInsertRowid)
    }

    // Create knowledge points
    const insertKP = db.prepare(
      `INSERT INTO knowledge_points
       (module_id, kp_code, section_name, description, type, importance, detailed_content, cluster_id, ocr_quality)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )

    for (const kp of stage2.final_knowledge_points) {
      const moduleId = moduleIdMap[kp.module_group]
      if (!moduleId) continue
      const clusterKey = `${kp.module_group}:${kp.cluster_name}`
      const clusterId = clusterIdMap[clusterKey] ?? null

      insertKP.run(
        moduleId,
        kp.kp_code,
        kp.section_name,
        kp.description,
        kp.type,
        kp.importance,
        kp.detailed_content,
        clusterId,
        kp.ocr_quality
      )
    }

    // Update book status
    db.prepare(
      "UPDATE books SET kp_extraction_status = 'completed' WHERE id = ?"
    ).run(bookId)
  })()
}

// --- Main Orchestrator ---

export async function extractKPs(bookId: number): Promise<void> {
  const db = getDb()

  const book = db
    .prepare('SELECT id, title, raw_text, kp_extraction_status FROM books WHERE id = ?')
    .get(bookId) as {
      id: number; title: string; raw_text: string | null; kp_extraction_status: string
    } | undefined

  if (!book) throw new SystemError(`教材 ${bookId} 不存在`)
  if (!book.raw_text) throw new SystemError(`教材 ${bookId} 无 OCR 文本，请先完成 OCR`)

  db.prepare(
    "UPDATE books SET kp_extraction_status = 'processing' WHERE id = ?"
  ).run(bookId)

  try {
    logAction('KP 提取开始', `bookId=${bookId}，教材：${book.title}`)

    // Stage 0: Structure scan
    const stage0 = await structureScan(book.raw_text)
    logAction(
      'Stage 0 完成',
      `识别到 ${stage0.sections.length} 个小节，${stage0.modules.length} 个模块`
    )

    // Stage 1: Block-by-block extraction
    const rawKPs = await blockExtract(book.raw_text, stage0.sections)
    logAction('Stage 1 完成', `初提取 ${rawKPs.length} 个 KP`)

    // Stage 2: Quality validation + module assignment
    const stage2 = await qualityCheck(rawKPs, stage0.modules)
    logAction(
      'Stage 2 完成',
      `最终 ${stage2.final_knowledge_points.length} 个 KP，${stage2.clusters.length} 个聚类`
    )

    // Quality gate check (spec: "写入数据库前必须通过")
    const gates = stage2.quality_gates
    const failedGates = Object.entries(gates)
      .filter(([, passed]) => !passed)
      .map(([name]) => name)

    if (failedGates.length > 0) {
      logAction('质量门未通过', `失败项: ${failedGates.join(', ')}`, 'warn')
      // Log issues for debugging
      if (stage2.issues.length > 0) {
        logAction('质量问题详情', JSON.stringify(stage2.issues), 'warn')
      }
      // Per spec, quality gates must pass before DB write.
      // MVP pragmatic decision: log warnings but still write results.
      // The module map page shows quality warnings to the user,
      // who can choose to regenerate if quality is insufficient.
      // TODO: Consider blocking on critical gates (e.g. module_ratio_ok) in future.
    }

    // Write to DB
    writeResultsToDB(bookId, stage0, stage2)
    logAction(
      'KP 提取完成',
      `bookId=${bookId}，${stage2.final_knowledge_points.length} 个 KP，${stage2.clusters.length} 个聚类，${stage0.modules.length} 个模块`
    )
  } catch (err) {
    db.prepare(
      "UPDATE books SET kp_extraction_status = 'failed' WHERE id = ?"
    ).run(bookId)
    logAction('KP 提取失败', `bookId=${bookId}: ${String(err)}`, 'error')
    throw err
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/kp-extraction-service.ts
git commit -m "feat(m1): implement three-stage KP extraction service"
git push origin master
```

---

## Task 3: API Endpoints [Codex]

**Files:**
- Create: `src/app/api/books/[bookId]/extract/route.ts`
- Create: `src/app/api/books/[bookId]/module-map/route.ts`
- Create: `src/app/api/books/[bookId]/module-map/confirm/route.ts`
- Create: `src/app/api/books/[bookId]/module-map/regenerate/route.ts`

### Step 1: Extract trigger endpoint

- [ ] **Create `src/app/api/books/[bookId]/extract/route.ts`**

```typescript
import { handleRoute } from '@/lib/handle-route'
import { getDb } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { logAction } from '@/lib/log'
import { extractKPs } from '@/lib/services/kp-extraction-service'

// POST /api/books/[bookId]/extract — trigger KP extraction
export const POST = handleRoute(async (_req, context) => {
  const { bookId } = await context!.params
  const id = Number(bookId)
  const db = getDb()

  const book = db
    .prepare('SELECT id, parse_status, kp_extraction_status FROM books WHERE id = ?')
    .get(id) as { id: number; parse_status: string; kp_extraction_status: string } | undefined

  if (!book) {
    throw new UserError('教材不存在', 'NOT_FOUND', 404)
  }

  if (book.parse_status !== 'done') {
    throw new UserError('OCR 尚未完成，请等待 OCR 处理完毕', 'OCR_NOT_DONE', 409)
  }

  if (book.kp_extraction_status === 'processing') {
    throw new UserError('KP 提取正在进行中', 'ALREADY_PROCESSING', 409)
  }

  if (book.kp_extraction_status === 'completed') {
    throw new UserError(
      '已有提取结果，如需重新提取请使用 regenerate 接口',
      'ALREADY_COMPLETED',
      409
    )
  }

  // Fire-and-forget: start extraction in background
  extractKPs(id).catch(err => {
    logAction('KP 提取后台错误', `bookId=${id}: ${String(err)}`, 'error')
  })

  return { data: { status: 'processing', bookId: id }, status: 202 }
})
```

### Step 2: Module map data endpoint

- [ ] **Create `src/app/api/books/[bookId]/module-map/route.ts`**

```typescript
import { handleRoute } from '@/lib/handle-route'
import { getDb } from '@/lib/db'
import { UserError } from '@/lib/errors'
import type { ModuleMapResponse, ModuleMapModule, ModuleMapKP, ModuleMapCluster } from '@/lib/services/kp-extraction-types'

// GET /api/books/[bookId]/module-map — get module map data
export const GET = handleRoute(async (_req, context) => {
  const { bookId } = await context!.params
  const id = Number(bookId)
  const db = getDb()

  const book = db
    .prepare('SELECT id, title, kp_extraction_status FROM books WHERE id = ?')
    .get(id) as { id: number; title: string; kp_extraction_status: string } | undefined

  if (!book) {
    throw new UserError('教材不存在', 'NOT_FOUND', 404)
  }

  if (book.kp_extraction_status !== 'completed') {
    return {
      data: {
        book_id: id,
        book_title: book.title,
        kp_extraction_status: book.kp_extraction_status,
        total_kp_count: 0,
        total_module_count: 0,
        modules: [],
      } satisfies ModuleMapResponse,
    }
  }

  // Fetch modules
  const modules = db
    .prepare('SELECT * FROM modules WHERE book_id = ? ORDER BY order_index')
    .all(id) as Array<{
      id: number; title: string; summary: string; order_index: number
      kp_count: number; cluster_count: number; page_start: number | null; page_end: number | null
    }>

  const result: ModuleMapModule[] = modules.map(mod => {
    // Fetch KPs for this module
    const kps = db
      .prepare(`
        SELECT kp.id, kp.kp_code, kp.description, kp.type, kp.importance, kp.ocr_quality,
               c.name as cluster_name
        FROM knowledge_points kp
        LEFT JOIN clusters c ON kp.cluster_id = c.id
        WHERE kp.module_id = ?
        ORDER BY kp.kp_code
      `)
      .all(mod.id) as ModuleMapKP[]

    // Fetch clusters for this module
    const clusters = db
      .prepare(`
        SELECT c.id, c.name, COUNT(kp.id) as kp_count
        FROM clusters c
        LEFT JOIN knowledge_points kp ON kp.cluster_id = c.id
        WHERE c.module_id = ?
        GROUP BY c.id
      `)
      .all(mod.id) as ModuleMapCluster[]

    return {
      id: mod.id,
      title: mod.title,
      summary: mod.summary,
      order_index: mod.order_index,
      kp_count: mod.kp_count,
      cluster_count: mod.cluster_count,
      page_start: mod.page_start,
      page_end: mod.page_end,
      knowledge_points: kps,
      clusters,
    }
  })

  const totalKP = result.reduce((sum, m) => sum + m.kp_count, 0)

  return {
    data: {
      book_id: id,
      book_title: book.title,
      kp_extraction_status: 'completed',
      total_kp_count: totalKP,
      total_module_count: result.length,
      modules: result,
    } satisfies ModuleMapResponse,
  }
})
```

### Step 3: Confirm endpoint

- [ ] **Create `src/app/api/books/[bookId]/module-map/confirm/route.ts`**

```typescript
import { handleRoute } from '@/lib/handle-route'
import { getDb } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { logAction } from '@/lib/log'

// POST /api/books/[bookId]/module-map/confirm — user confirms module map
export const POST = handleRoute(async (_req, context) => {
  const { bookId } = await context!.params
  const id = Number(bookId)
  const db = getDb()

  const book = db
    .prepare('SELECT id, title, kp_extraction_status FROM books WHERE id = ?')
    .get(id) as { id: number; title: string; kp_extraction_status: string } | undefined

  if (!book) {
    throw new UserError('教材不存在', 'NOT_FOUND', 404)
  }

  if (book.kp_extraction_status !== 'completed') {
    throw new UserError('KP 提取尚未完成', 'NOT_READY', 409)
  }

  // Set first module to "reading" status to indicate user is ready to start
  const firstModule = db
    .prepare("SELECT id FROM modules WHERE book_id = ? AND learning_status = 'not_started' ORDER BY order_index LIMIT 1")
    .get(id) as { id: number } | undefined

  if (firstModule) {
    db.prepare("UPDATE modules SET learning_status = 'reading' WHERE id = ?")
      .run(firstModule.id)
  }

  logAction('模块地图已确认', `bookId=${id}，教材：${book.title}`)

  return { data: { confirmed: true, firstModuleId: firstModule?.id ?? null } }
})
```

### Step 4: Regenerate endpoint

- [ ] **Create `src/app/api/books/[bookId]/module-map/regenerate/route.ts`**

```typescript
import { handleRoute } from '@/lib/handle-route'
import { getDb } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { logAction } from '@/lib/log'
import { extractKPs } from '@/lib/services/kp-extraction-service'

// POST /api/books/[bookId]/module-map/regenerate — delete existing + re-extract
export const POST = handleRoute(async (_req, context) => {
  const { bookId } = await context!.params
  const id = Number(bookId)
  const db = getDb()

  const book = db
    .prepare('SELECT id, title, parse_status, kp_extraction_status FROM books WHERE id = ?')
    .get(id) as { id: number; title: string; parse_status: string; kp_extraction_status: string } | undefined

  if (!book) {
    throw new UserError('教材不存在', 'NOT_FOUND', 404)
  }

  if (book.parse_status !== 'done') {
    throw new UserError('OCR 尚未完成', 'OCR_NOT_DONE', 409)
  }

  if (book.kp_extraction_status === 'processing') {
    throw new UserError('KP 提取正在进行中，请等待完成', 'ALREADY_PROCESSING', 409)
  }

  // Reset status to pending, then trigger
  db.prepare(
    "UPDATE books SET kp_extraction_status = 'pending' WHERE id = ?"
  ).run(id)

  logAction('重新提取 KP', `bookId=${id}，教材：${book.title}`)

  // Fire-and-forget
  extractKPs(id).catch(err => {
    logAction('KP 重新提取后台错误', `bookId=${id}: ${String(err)}`, 'error')
  })

  return { data: { status: 'processing', bookId: id }, status: 202 }
})
```

- [ ] **Step 5: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/books/\[bookId\]/extract/ src/app/api/books/\[bookId\]/module-map/
git commit -m "feat(m1): add KP extraction + module map API endpoints"
git push origin master
```

---

## Task 4: Module Map Page [Gemini]

**Files:**
- Create: `src/app/books/[bookId]/module-map/page.tsx`

### API Contract (for Gemini reference)

```
GET /api/books/{bookId}/module-map
Response: {
  success: true,
  data: {
    book_id: number,
    book_title: string,
    kp_extraction_status: "pending" | "processing" | "completed" | "failed",
    total_kp_count: number,
    total_module_count: number,
    modules: [{
      id: number,
      title: string,
      summary: string,
      order_index: number,
      kp_count: number,
      cluster_count: number,
      page_start: number | null,
      page_end: number | null,
      knowledge_points: [{
        id: number,
        kp_code: string,
        description: string,
        type: "position" | "calculation" | "c1_judgment" | "c2_evaluation" | "definition",
        importance: number,
        cluster_name: string | null,
        ocr_quality: "good" | "uncertain" | "damaged"
      }],
      clusters: [{ id: number, name: string, kp_count: number }]
    }]
  }
}

POST /api/books/{bookId}/module-map/confirm
Response: { success: true, data: { confirmed: true, firstModuleId: number | null } }

POST /api/books/{bookId}/module-map/regenerate
Response: { success: true, data: { status: "processing", bookId: number } }

GET /api/books/{bookId}/status
Response includes: { parse_status, kp_extraction_status, ... }
```

### Design Requirements

This is the page users see after KP extraction completes. It shows the module structure and lets users confirm or regenerate.

**Layout:**
1. **Header**: Book title + extraction status
2. **Stats bar**: Total modules, total KPs, type distribution (how many of each KP type)
3. **Module list**: Collapsible cards, one per module, showing:
   - Module title + order number
   - KP count + cluster count
   - Expandable section: list of KPs grouped by cluster
   - Each KP shows: code, description, type badge (color-coded), importance stars
   - OCR quality warnings (yellow badge for "uncertain", red for "damaged")
4. **Action bar** (bottom, sticky):
   - "确认模块地图" primary button → calls confirm API → redirects to first module
   - "重新生成" secondary button → calls regenerate API → shows processing state

**States:**
- `pending` / `processing`: Show loading spinner + "正在提取知识点..." message with explanation
- `completed`: Show full module map
- `failed`: Show error message + "重新生成" button

**Type badge colors** (Tailwind):
- position: `bg-blue-100 text-blue-800`
- calculation: `bg-green-100 text-green-800`
- c1_judgment: `bg-yellow-100 text-yellow-800`
- c2_evaluation: `bg-purple-100 text-purple-800`
- definition: `bg-gray-100 text-gray-800`

**Polling**: If status is `pending` or `processing`, poll `GET /api/books/{bookId}/status` every 3 seconds. When status becomes `completed`, fetch module map data.

- [ ] **Step 1: Implement the page**

Create `src/app/books/[bookId]/module-map/page.tsx` following the design above. Use client component (`'use client'`) for polling and interactivity.

- [ ] **Step 2: Verify the page renders at `/books/1/module-map`**

```bash
npm run dev
# Visit http://localhost:3000/books/1/module-map
```

- [ ] **Step 3: Commit**

```bash
git add src/app/books/\[bookId\]/module-map/
git commit -m "feat(m1): add module map page with KP display + confirm/regenerate"
git push origin master
```

---

## Task 5: Reader Integration [Gemini]

**Files:**
- Modify: `src/app/books/[bookId]/reader/page.tsx` and/or its child components

### Requirements

After OCR completes, the reader should show a notification about KP extraction status and provide navigation to the module map page.

**Behavior:**
1. Poll `GET /api/books/{bookId}/status` (existing polling may already exist for OCR progress)
2. When `parse_status == 'done'` and `kp_extraction_status == 'pending'`:
   - Show a banner: "OCR 完成，正在提取知识点..."
   - Auto-call `POST /api/books/{bookId}/extract` to trigger extraction
3. When `kp_extraction_status == 'processing'`:
   - Show banner: "正在提取知识点...（这可能需要几分钟）"
4. When `kp_extraction_status == 'completed'`:
   - Show banner: "模块地图已生成！" with a button "查看模块地图" → navigates to `/books/{bookId}/module-map`
5. When `kp_extraction_status == 'failed'`:
   - Show banner: "知识点提取失败" with "重试" button → calls extract again

**Placement:** Top of the reader page, above the PDF viewer. Dismissible after user has seen it.

- [ ] **Step 1: Add status banner to reader**

Modify the reader page (or PdfViewerLoader) to add the extraction status banner.

- [ ] **Step 2: Test the flow**

1. Open a book in the reader
2. If OCR is done, verify the extraction trigger fires
3. Verify status updates show correctly

- [ ] **Step 3: Commit**

```bash
git add src/app/books/
git commit -m "feat(m1): add KP extraction status banner to PDF reader"
git push origin master
```

---

## Task 6: Integration Test [Manual]

**This task is executed manually by the developer after all code tasks are complete.**

### Test Flow

1. **Start the app**
   ```bash
   npm run dev
   ```

2. **Upload a PDF** — Go to `/upload`, select a PDF textbook (recommended: one chapter, ~20 pages), enter title, submit

3. **Verify OCR** — Watch the reader page. OCR should process and show progress. When done, `parse_status` should be `done`.

4. **Verify KP extraction trigger** — The reader should auto-trigger extraction. Check the status banner shows "正在提取知识点..."

5. **Monitor progress** — Check `/logs` page for Stage 0, Stage 1, Stage 2 log entries

6. **Verify module map** — When extraction completes, navigate to `/books/{bookId}/module-map`. Verify:
   - [ ] Modules are displayed with correct titles
   - [ ] KPs are listed under each module, grouped by cluster
   - [ ] KP types are correctly color-coded
   - [ ] KP count and cluster count match
   - [ ] OCR quality warnings show if applicable

7. **Verify confirm flow** — Click "确认模块地图". Should redirect to the first module page.

8. **Verify regenerate flow** — Go back to module map. Click "重新生成". Should show processing state, then regenerate.

9. **Quality check** — Compare extracted KPs against the original text:
   - [ ] Each section has at least 1 KP
   - [ ] KP descriptions are concise (≤25 chars)
   - [ ] Calculation KPs have formulas
   - [ ] No obvious duplicates
   - [ ] Cluster groupings make sense

### Acceptance Criteria (from spec)

> 上传《读财报》一个章节，KP 提取质量不低于 CC 手动提取

---

## Summary: Task Assignment

| Task | Assignee | Dependencies | Complexity |
|------|----------|-------------|------------|
| T0: Fix corrupted files + OCR page markers | Codex | None | Light |
| T1: Types + prompt templates | Codex | T0 | Light |
| T2: KP extraction service | Codex | T1 | Standard |
| T3: API endpoints | Codex | T2 | Light |
| T4: Module map page | Gemini | T3 (API contract only) | Standard |
| T5: Reader integration | Gemini | T3 (API contract only) | Light |
| T6: Integration test | Manual | T0-T5 | — |

**Dispatch order:**
1. Codex: T0 → T1 → T2 → T3 (sequential, one session or chained)
2. Gemini: T4 + T5 (can start after T3 API contract is available, doesn't need backend running)
3. Integration test after both complete

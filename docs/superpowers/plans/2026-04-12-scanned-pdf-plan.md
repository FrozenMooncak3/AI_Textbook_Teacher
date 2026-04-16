---
date: 2026-04-12
topic: 扫描PDF处理升级计划
type: plan
status: resolved
keywords: [scanned-PDF, OCR, progressive-unlock, classification]
---

# Scanned PDF Processing Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade PDF processing from "OCR everything then start" to "smart classify → text pages instant → scanned pages background → modules unlock progressively"

**Architecture:** New 4-step pipeline in OCR server (classify → extract → ocr-scanned → kp-extract-per-module). modules table gains per-module processing status. Frontend polls module-level status instead of book-level.

**Tech Stack:** Python (Flask, pymupdf4llm, PaddleOCR, google-cloud-documentai), Node.js/TypeScript (Next.js API routes), PostgreSQL, React (frontend polling)

**Spec:** `docs/superpowers/specs/2026-04-12-scanned-pdf-design.md`

---

## Dependency Graph

```
T1 (Schema + Docker)
  ├── T2 (classify-pdf)
  ├── T3 (extract-text + pymupdf4llm)
  ├── T5 (text-chunker page tracking)
  │
  T4 (ocr-pdf scanned-only) ← depends on T2
  T6 (kp-extraction per-module) ← depends on T5
  T7 (API routes) ← depends on T2, T3, T5, T6
  T8 (Frontend) ← depends on T7
  T9 (Docs) ← depends on all
```

T2, T3, T5 can run in parallel after T1.

---

## Task 1: DB Schema + Docker Foundation

**Executor:** Codex [轻档]
**Files:**
- Modify: `src/lib/schema.sql`
- Modify: `Dockerfile.ocr` (project root)
- Modify: `docker-compose.yml`

### Steps

- [ ] **Step 1: Add new columns to schema.sql**

In the `CREATE TABLE books` block, add after existing columns:
```sql
page_classifications TEXT DEFAULT NULL,
text_pages_count INTEGER DEFAULT 0,
scanned_pages_count INTEGER DEFAULT 0,
```

In the `CREATE TABLE modules` block, add after existing columns:
```sql
text_status TEXT DEFAULT 'pending',
ocr_status TEXT DEFAULT 'pending',
kp_extraction_status TEXT DEFAULT 'pending',
```

- [ ] **Step 2: Add ALTER TABLE migration block**

Append to the **end of `schema.sql`** (after all CREATE TABLE statements). `initDb()` reads the entire file as one query string and executes it via `pool.query(schema)`, so this block runs every time but is idempotent:

```sql
-- Migration: scanned PDF upgrade (2026-04-12)
ALTER TABLE books ADD COLUMN IF NOT EXISTS page_classifications TEXT DEFAULT NULL;
ALTER TABLE books ADD COLUMN IF NOT EXISTS text_pages_count INTEGER DEFAULT 0;
ALTER TABLE books ADD COLUMN IF NOT EXISTS scanned_pages_count INTEGER DEFAULT 0;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS text_status TEXT DEFAULT 'ready';
ALTER TABLE modules ADD COLUMN IF NOT EXISTS ocr_status TEXT DEFAULT 'done';
ALTER TABLE modules ADD COLUMN IF NOT EXISTS kp_extraction_status TEXT DEFAULT 'completed';
```

Note: ALTER TABLE defaults are 'ready'/'done'/'completed' (for existing data backward compat). CREATE TABLE defaults are 'pending' (for new records).

- [ ] **Step 3: Add pymupdf4llm to Dockerfile.ocr**

In `Dockerfile.ocr` at project root, in the pip install line, add `pymupdf4llm`:
```dockerfile
RUN pip install pymupdf pymupdf4llm paddleocr paddlepaddle flask psycopg2-binary
```

If there's a requirements.txt referenced, add `pymupdf4llm` there instead.

- [ ] **Step 4: Add environment variables to docker-compose.yml**

In the `ocr` service's `environment` section, add:
```yaml
- OCR_PROVIDER=${OCR_PROVIDER:-paddle}
- GOOGLE_CLOUD_PROJECT_ID=${GOOGLE_CLOUD_PROJECT_ID:-}
- GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS:-}
```

- [ ] **Step 5: Verify**

Run: `docker-compose build ocr` — should succeed.
Start app: verify `initDb()` runs without error (check logs for table creation + ALTER TABLE).

- [ ] **Step 6: Commit + push**

```bash
git add src/lib/schema.sql Dockerfile.ocr docker-compose.yml
git commit -m "feat(db): add scanned PDF processing columns + pymupdf4llm dep"
git push origin master
```

---

## Task 2: OCR Server — Page Classification Endpoint

**Executor:** Codex [标准档]
**Files:**
- Modify: `scripts/ocr_server.py`

### Context

The OCR server is a Flask app (`scripts/ocr_server.py`). It already has endpoints `/ocr` (single image) and `/ocr-pdf` (full PDF). Uses PyMuPDF (`fitz`) for PDF handling and `psycopg2` for DB writes.

### Steps

- [ ] **Step 1: Add classify_page helper function**

```python
def classify_page(page):
    """Classify a PDF page as text, scanned, or mixed."""
    text = page.get_text().strip()
    char_count = len(text)
    images = page.get_images()
    
    # Calculate image coverage
    page_area = page.rect.width * page.rect.height
    image_coverage = 0
    if page_area > 0 and images:
        for img in images:
            xref = img[0]
            try:
                img_rect = page.get_image_rects(xref)
                if img_rect:
                    for rect in img_rect:
                        image_coverage += rect.width * rect.height
            except:
                pass
        image_coverage = image_coverage / page_area
    
    if char_count > 50 and image_coverage < 0.5:
        return "text"
    elif char_count < 10 and image_coverage > 0.7:
        return "scanned"
    else:
        return "mixed"
```

- [ ] **Step 2: Add POST /classify-pdf endpoint**

Note: The OCR server uses `psycopg2.connect(os.environ.get("DATABASE_URL"))` for DB access and the existing `run_write(connection, sql, params)` helper. Do NOT use `get_db_connection()` — it doesn't exist.

```python
@app.route('/classify-pdf', methods=['POST'])
def classify_pdf():
    data = request.json
    pdf_path = data.get('pdf_path')
    book_id = data.get('book_id')
    
    if not pdf_path or not book_id:
        return jsonify({'error': 'pdf_path and book_id required'}), 400
    
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        return jsonify({"error": "missing DATABASE_URL"}), 500
    
    doc = fitz.open(pdf_path)
    pages = []
    text_count = 0
    scanned_count = 0
    
    for i in range(len(doc)):
        page = doc[i]
        page_type = classify_page(page)
        pages.append({'page': i + 1, 'type': page_type})
        if page_type == 'text':
            text_count += 1
        else:
            # mixed and scanned both count toward scanned for OCR purposes
            scanned_count += 1
    
    doc.close()
    
    # Write to DB using existing pattern
    import json
    with psycopg2.connect(database_url) as connection:
        run_write(
            connection,
            """UPDATE books 
               SET page_classifications = %s, text_pages_count = %s, scanned_pages_count = %s 
               WHERE id = %s""",
            (json.dumps(pages), text_count, scanned_count, book_id),
        )
    
    return jsonify({
        'pages': pages,
        'text_count': text_count,
        'scanned_count': scanned_count
    })
```

- [ ] **Step 3: Verify**

Test with a known text-based PDF:
```bash
curl -X POST http://localhost:8000/classify-pdf \
  -H "Content-Type: application/json" \
  -d '{"pdf_path": "/app/data/uploads/1.pdf", "book_id": "<id>"}'
```
Expected: response with pages array, most classified as "text".

- [ ] **Step 4: Commit + push**

```bash
git add scripts/ocr_server.py
git commit -m "feat(ocr): add /classify-pdf endpoint for page-level type detection"
git push origin master
```

---

## Task 3: OCR Server — Text Extraction with pymupdf4llm

**Executor:** Codex [标准档]
**Files:**
- Modify: `scripts/ocr_server.py`

### Steps

- [ ] **Step 1: Add pymupdf4llm import and extract-text endpoint**

Note: Uses the same DB pattern as the rest of the file (`psycopg2.connect(database_url)` + `run_write()`). Does NOT call pymupdf4llm twice — extracts per-page in a single loop to insert PAGE markers.

```python
import pymupdf4llm

@app.route('/extract-text', methods=['POST'])
def extract_text():
    data = request.json
    pdf_path = data.get('pdf_path')
    book_id = data.get('book_id')
    
    if not pdf_path or not book_id:
        return jsonify({'error': 'pdf_path and book_id required'}), 400
    
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        return jsonify({"error": "missing DATABASE_URL"}), 500
    
    # Read page classifications from DB
    with psycopg2.connect(database_url) as connection:
        with connection.cursor() as cur:
            cur.execute("SELECT page_classifications FROM books WHERE id = %s", (book_id,))
            row = cur.fetchone()
    
    if not row or not row[0]:
        return jsonify({'error': 'Run /classify-pdf first'}), 400
    
    import json
    classifications = json.loads(row[0])
    
    # Build full text with PAGE markers — one pymupdf4llm call per text page
    doc = fitz.open(pdf_path)
    full_text_parts = []
    text_page_count = 0
    
    for page_idx in range(len(doc)):
        page_num = page_idx + 1
        classification = next((p for p in classifications if p['page'] == page_num), None)
        if classification and classification['type'] == 'text':
            page_md = pymupdf4llm.to_markdown(pdf_path, pages=[page_idx])
            full_text_parts.append(f"--- PAGE {page_num} ---\n{page_md}")
            text_page_count += 1
        else:
            # Placeholder for scanned pages (will be filled by OCR later)
            full_text_parts.append(f"--- PAGE {page_num} ---\n[OCR_PENDING]")
    doc.close()
    
    full_text = "\n".join(full_text_parts)
    
    # Write to DB
    with psycopg2.connect(database_url) as connection:
        run_write(connection, "UPDATE books SET raw_text = %s WHERE id = %s", (full_text, book_id))
    
    return jsonify({'text': full_text, 'page_count': text_page_count})
```

- [ ] **Step 2: Handle pymupdf4llm import failure gracefully**

At the top of the file, add fallback:
```python
try:
    import pymupdf4llm
    HAS_PYMUPDF4LLM = True
except ImportError:
    HAS_PYMUPDF4LLM = False
```

In the endpoint, if `not HAS_PYMUPDF4LLM`, fall back to `page.get_text()` with PAGE markers (current behavior).

- [ ] **Step 3: Verify**

```bash
curl -X POST http://localhost:8000/extract-text \
  -H "Content-Type: application/json" \
  -d '{"pdf_path": "/app/data/uploads/1.pdf", "book_id": "<id>"}'
```
Expected: JSON with markdown-formatted text including `#` headers and `--- PAGE N ---` markers.

- [ ] **Step 4: Commit + push**

```bash
git add scripts/ocr_server.py
git commit -m "feat(ocr): add /extract-text endpoint with pymupdf4llm structured Markdown"
git push origin master
```

---

## Task 4: OCR Server — Scanned-Only Processing + Provider Abstraction

**Executor:** Codex [标准档]
**Files:**
- Modify: `scripts/ocr_server.py`

### Steps

- [ ] **Step 1: Add OCR provider abstraction**

```python
import os

OCR_PROVIDER = os.environ.get('OCR_PROVIDER', 'paddle')

def ocr_page_image(image):
    """Route OCR to configured provider."""
    if OCR_PROVIDER == 'google':
        return google_ocr(image)
    else:
        return paddle_ocr(image)

def google_ocr(image):
    """Google Document AI OCR. Only used in production."""
    try:
        from google.cloud import documentai_v1 as documentai
        project_id = os.environ.get('GOOGLE_CLOUD_PROJECT_ID')
        # Note: processor_id needs to be configured per deployment
        processor_id = os.environ.get('GOOGLE_DOCUMENT_AI_PROCESSOR_ID', '')
        location = os.environ.get('GOOGLE_DOCUMENT_AI_LOCATION', 'us')
        
        client = documentai.DocumentProcessorServiceClient()
        name = client.processor_path(project_id, location, processor_id)
        
        # image is bytes
        raw_document = documentai.RawDocument(content=image, mime_type='image/png')
        request = documentai.ProcessRequest(name=name, raw_document=raw_document)
        result = client.process_document(request=request)
        
        return result.document.text
    except Exception as e:
        print(f"Google OCR failed: {e}, falling back to PaddleOCR")
        return paddle_ocr(image)
```

- [ ] **Step 2: Modify /ocr-pdf to only process scanned/mixed pages**

In the existing `process_pdf_ocr` background thread function, modify the page loop. Note: this function already receives `database_url` as a parameter and uses `psycopg2.connect(database_url)`.

```python
# Inside process_pdf_ocr, after opening the doc:
# Read classifications
with psycopg2.connect(database_url) as conn:
    with conn.cursor() as cur:
        cur.execute("SELECT page_classifications FROM books WHERE id = %s", (book_id,))
        row = cur.fetchone()
classifications = json.loads(row[0]) if row and row[0] else None

for page_num in range(total_pages):
    page_1indexed = page_num + 1
    
    # Skip text pages if classifications exist
    if classifications:
        page_class = next((p for p in classifications if p['page'] == page_1indexed), None)
        if page_class and page_class['type'] == 'text':
            continue  # Already extracted by /extract-text
    
    # OCR this page (scanned or mixed)
    page = doc[page_num]
    # ... existing OCR logic, but use ocr_page_image() instead of direct PaddleOCR call ...
    
    # After OCR, update the raw_text by replacing [OCR_PENDING] placeholder
    # for this page with actual OCR text
    page_text = ocr_page_image(page_image_bytes)
    replace_page_placeholder(book_id, page_1indexed, page_text, conn)
    
    # Update progress
    cur.execute("UPDATE books SET ocr_current_page = %s WHERE id = %s", 
                (page_1indexed, book_id))
    conn.commit()
    
    # Check if this completes a module
    check_module_ocr_completion(book_id, page_1indexed, conn)
```

- [ ] **Step 3: Add helper functions**

Note: These helpers receive a `psycopg2` connection from `process_pdf_ocr` (which already uses `psycopg2.connect(database_url)` and the `run_write` helper). Follow the same pattern.

```python
def replace_page_placeholder(book_id, page_num, ocr_text, connection):
    """Replace [OCR_PENDING] placeholder for a specific page in raw_text."""
    with connection.cursor() as cur:
        cur.execute("SELECT raw_text FROM books WHERE id = %s", (book_id,))
        raw_text = cur.fetchone()[0] or ''
    
    placeholder = f"--- PAGE {page_num} ---\n[OCR_PENDING]"
    replacement = f"--- PAGE {page_num} ---\n{ocr_text}"
    raw_text = raw_text.replace(placeholder, replacement)
    
    run_write(connection, "UPDATE books SET raw_text = %s WHERE id = %s", (raw_text, book_id))

def check_module_ocr_completion(book_id, completed_page, connection):
    """Check if completing this page finishes a module's OCR needs.
    Since OCR processes pages sequentially, we just check if the completed page
    is the last scanned page in any module's range."""
    with connection.cursor() as cur:
        cur.execute(
            """SELECT id, page_start, page_end FROM modules 
               WHERE book_id = %s AND ocr_status = 'processing'""",
            (book_id,)
        )
        modules = cur.fetchall()
        
        cur.execute("SELECT page_classifications FROM books WHERE id = %s", (book_id,))
        classifications = json.loads(cur.fetchone()[0])
    
    for mod in modules:
        mod_id, page_start, page_end = mod
        if page_start is None or page_end is None:
            continue
        # Find all scanned pages in this module's range
        module_scanned_pages = [
            p['page'] for p in classifications 
            if p['page'] >= page_start and p['page'] <= page_end 
            and p['type'] in ('scanned', 'mixed')
        ]
        if not module_scanned_pages:
            continue
        # If completed_page is the last scanned page in this module, mark done
        if completed_page == max(module_scanned_pages):
            run_write(
                connection,
                "UPDATE modules SET ocr_status = 'done' WHERE id = %s",
                (mod_id,),
            )
    connection.commit()
```

- [ ] **Step 4: Update ocr_total_pages to only count scanned pages**

When starting OCR, set `ocr_total_pages` to the number of scanned+mixed pages (not total pages):
```python
scanned_page_count = len([p for p in classifications if p['type'] in ('scanned', 'mixed')])
cur.execute("UPDATE books SET ocr_total_pages = %s WHERE id = %s", (scanned_page_count, book_id))
```

- [ ] **Step 5: Verify**

Test with a mixed PDF (if available) or the existing test PDF:
- Call `/classify-pdf` first
- Call `/extract-text` 
- Call `/ocr-pdf`
- Check that only scanned pages are OCR'd (log output)
- Check that `raw_text` has the complete text (no `[OCR_PENDING]` remaining)

- [ ] **Step 6: Commit + push**

```bash
git add scripts/ocr_server.py
git commit -m "feat(ocr): scanned-only processing + OCR provider abstraction"
git push origin master
```

---

## Task 5: text-chunker Page Tracking

**Executor:** Codex [轻档]
**Files:**
- Modify: `src/lib/text-chunker.ts`

### Context

Current `text-chunker.ts` splits text by chapter headings (regex patterns: `Chapter N`, `第N章`, numbered sections, ALL CAPS). Input: full text string. Output: `TextChunk[]` with `index`, `title`, `text`, `startLine`, `endLine`.

The text now has `--- PAGE N ---` markers and Markdown `#` headers (from pymupdf4llm).

### Steps

- [ ] **Step 1: Add Markdown heading detection to heading patterns**

In the heading detection regex/logic, add Markdown heading patterns:
```typescript
// Add to existing heading patterns:
const MARKDOWN_HEADING = /^#{1,3}\s+.+/;  // # Heading, ## Heading, ### Heading

// In the heading detection function, add:
if (MARKDOWN_HEADING.test(line)) {
  return true;
}
```

- [ ] **Step 2: Track page numbers per chunk**

Add `pageStart` and `pageEnd` to the output interface:
```typescript
export interface TextChunk {
  index: number;
  title: string;
  text: string;
  startLine: number;
  endLine: number;
  pageStart: number | null;  // NEW
  pageEnd: number | null;    // NEW
}
```

In the chunking logic, track page numbers by detecting `--- PAGE N ---` markers:
```typescript
const PAGE_MARKER = /^--- PAGE (\d+) ---$/;

// While iterating lines to build chunks:
let currentPage = 1;
// When encountering a page marker:
const pageMatch = line.match(PAGE_MARKER);
if (pageMatch) {
  currentPage = parseInt(pageMatch[1]);
  // Don't include marker line in chunk text
  continue;
}

// When starting a new chunk, record pageStart = currentPage
// When ending a chunk, record pageEnd = currentPage
```

- [ ] **Step 3: Strip PAGE markers from chunk text**

Ensure `--- PAGE N ---` lines are not included in the `text` field of chunks (they're metadata, not content).

- [ ] **Step 4: Verify**

Create a test string with PAGE markers and headings:
```
--- PAGE 1 ---
# Chapter 1: Introduction
Some content...
--- PAGE 5 ---
# Chapter 2: Methods
More content...
```
Run text-chunker, verify output has `pageStart: 1, pageEnd: 4` for chunk 1 and `pageStart: 5, pageEnd: ...` for chunk 2.

- [ ] **Step 5: Commit + push**

```bash
git add src/lib/text-chunker.ts
git commit -m "feat(chunker): track page ranges per chunk + support Markdown headings"
git push origin master
```

---

## Task 6: kp-extraction-service Per-Module Rewrite

**Executor:** Codex [重档]
**Files:**
- Modify: `src/lib/services/kp-extraction-service.ts`
- Modify: `src/lib/kp-merger.ts` (minor)

### Context

Current `writeResultsToDB` does: `DELETE FROM modules WHERE book_id = X` then inserts all modules fresh. This MUST change to per-module UPSERT so that extracting Module 2 doesn't destroy Module 1's data.

Current flow: receives full book text → text-chunker → all chunks → extract all → merge all → write all.
New flow: receives single module's text → extract → merge within module → write that module only.

### Steps

- [ ] **Step 1: Add extractModule function**

New exported function for single-module extraction:
Note: IDs are `number` throughout the codebase (schema uses `SERIAL PRIMARY KEY`). Use `number`, not `string`.

```typescript
export async function extractModule(
  bookId: number, 
  moduleId: number,
  moduleText: string,
  moduleName: string
): Promise<void> {
  // 1. Update module status
  await run(
    "UPDATE modules SET kp_extraction_status = 'processing' WHERE id = $1",
    [moduleId]
  );
  
  try {
    // 2. Chunk the module text (may produce multiple chunks if very long)
    const chunks = chunkText(moduleText);
    
    // 3. Extract KPs from each chunk
    const chunkResults = [];
    for (const chunk of chunks) {
      const result = await extractKPsFromChunk(chunk, moduleName);
      chunkResults.push(result);
    }
    
    // 4. Merge if multiple chunks (existing kp-merger logic)
    const merged = chunks.length > 1 
      ? mergeChunkResults(chunkResults) 
      : chunkResults[0];
    
    // 5. Write to DB (module-level, not book-level)
    await writeModuleResults(bookId, moduleId, merged);
    
    // 6. Update status
    await run(
      "UPDATE modules SET kp_extraction_status = 'completed' WHERE id = $1",
      [moduleId]
    );
  } catch (error) {
    await run(
      "UPDATE modules SET kp_extraction_status = 'failed' WHERE id = $1",
      [moduleId]
    );
    throw error;
  }
}
```

- [ ] **Step 2: Implement writeModuleResults (per-module UPSERT)**

Note: The `insert()` function in `src/lib/db.ts` takes raw SQL + params: `insert(sql: string, params?: unknown[]): Promise<number>`. It is NOT an ORM — do not pass object literals.

```typescript
async function writeModuleResults(
  bookId: number, 
  moduleId: number, 
  result: ExtractionResult
): Promise<void> {
  // Delete ONLY this module's KPs and clusters (not all modules!)
  await run("DELETE FROM knowledge_points WHERE module_id = $1", [moduleId]);
  await run("DELETE FROM clusters WHERE module_id = $1", [moduleId]);
  
  // Insert clusters for this module
  for (const cluster of result.clusters) {
    const clusterId = await insert(
      "INSERT INTO clusters (module_id, name) VALUES ($1, $2)",
      [moduleId, cluster.name]
    );
    
    // Insert KPs for this cluster
    for (const kp of cluster.knowledge_points) {
      await insert(
        `INSERT INTO knowledge_points 
         (module_id, cluster_id, kp_code, section_name, description, type, importance, detailed_content)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [moduleId, clusterId, kp.kp_code, kp.section_name, kp.description, kp.type, kp.importance, kp.detailed_content]
      );
    }
  }
  
  // Update module counts
  await run(
    "UPDATE modules SET kp_count = $1, cluster_count = $2 WHERE id = $3",
    [result.totalKPs, result.clusters.length, moduleId]
  );
}
```

- [ ] **Step 3: Keep existing extractBook function for backward compat**

Don't delete the existing book-level extraction function — keep it working but have it call `extractModule` internally for each module. Or simply leave it as-is for the `/extract` route's "all modules" mode.

- [ ] **Step 4: Update kp-merger if needed**

The `mergeChunkResults` function should already work for per-module use (it merges chunks within a single extraction). Verify it doesn't assume all chunks belong to the entire book. If it does, adjust the deduplication scope.

- [ ] **Step 5: Verify**

- Call `extractModule` for a specific module
- Check DB: only that module's KPs are affected
- Other modules' KPs should remain unchanged
- Module's `kp_extraction_status` should be 'completed'

- [ ] **Step 6: Commit + push**

```bash
git add src/lib/services/kp-extraction-service.ts src/lib/kp-merger.ts
git commit -m "feat(kp): per-module extraction with module-scoped DB writes"
git push origin master
```

---

## Task 7: API Routes (Upload + Extract + Module-Status)

**Executor:** Codex [标准档]
**Files:**
- Modify: `src/app/api/books/route.ts`
- Modify: `src/app/api/books/[bookId]/extract/route.ts`
- Create: `src/app/api/books/[bookId]/module-status/route.ts`

### Steps

- [ ] **Step 1: Modify upload route (books/route.ts)**

After saving the PDF file, replace the current fire-and-forget OCR call with the new flow:

```typescript
// After file save, get book_id...

// Step 1: Classify pages (synchronous, < 1s)
const classifyRes = await fetch(`http://${OCR_HOST}:${OCR_PORT}/classify-pdf`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ pdf_path: filePath, book_id: bookId }),
});
const { text_count, scanned_count } = await classifyRes.json();

// Step 2: Extract text pages (synchronous, seconds)
const extractRes = await fetch(`http://${OCR_HOST}:${OCR_PORT}/extract-text`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ pdf_path: filePath, book_id: bookId }),
});
const { text: rawText } = await extractRes.json();

// Step 3: Run text-chunker to create modules
// Note: insert() takes raw SQL, not object. Column is `title`, not `name`.
if (rawText) {
  const chunks = chunkText(rawText);
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    await insert(
      `INSERT INTO modules (book_id, title, order_index, page_start, page_end, text_status, ocr_status, kp_extraction_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [bookId, chunk.title, i, chunk.pageStart, chunk.pageEnd, 'ready',
       scanned_count > 0 ? 'pending' : 'skipped', 'pending']
    );
  }
}

// Step 4: If scanned pages exist, fire-and-forget OCR
if (scanned_count > 0) {
  fetch(`http://${OCR_HOST}:${OCR_PORT}/ocr-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdf_path: filePath, book_id: bookId }),
  }).catch(() => {}); // fire-and-forget
  
  // Mark modules with scanned pages as ocr_status = 'processing'
  // (modules whose page_start-page_end range overlaps with scanned pages)
} else {
  // No scanned pages — mark book as done
  await run("UPDATE books SET parse_status = 'done' WHERE id = $1", [bookId]);
}

// Step 5: Auto-trigger KP extraction for text-ready modules with no scanned pages
// triggerReadyModulesExtraction: queries modules WHERE book_id = X AND ocr_status = 'skipped'
// AND kp_extraction_status = 'pending', then calls extractModule() for each.
// Fire-and-forget (don't await — runs in background).
triggerReadyModulesExtraction(bookId);
```

- [ ] **Step 2: Modify extract route**

In `src/app/api/books/[bookId]/extract/route.ts`:

Remove the `parse_status === 'done'` gate. Replace with module-level check:

Note: `moduleId` from searchParams is `string | null` — convert to `number` for `extractModule()`. Column is `title` not `name`. `getModuleText()` is a helper you need to implement: reads `books.raw_text`, finds text between `--- PAGE {page_start} ---` and `--- PAGE {page_end+1} ---` markers, returns that slice.

```typescript
// OLD: if (book.parse_status !== 'done') return 409
// NEW:
const moduleIdParam = searchParams.get('moduleId');

if (moduleIdParam) {
  // Single module extraction
  const moduleId = Number(moduleIdParam);
  const mod = await queryOne("SELECT * FROM modules WHERE id = $1 AND book_id = $2", [moduleId, bookId]);
  if (!mod) return NextResponse.json({ error: 'Module not found' }, { status: 404 });
  if (mod.text_status !== 'ready' && mod.ocr_status !== 'done') {
    return NextResponse.json({ error: 'Module text not ready' }, { status: 409 });
  }
  await extractModule(bookId, moduleId, getModuleText(bookId, mod), mod.title);
} else {
  // All ready modules
  const readyModules = await query(
    `SELECT * FROM modules WHERE book_id = $1 
     AND (ocr_status IN ('done', 'skipped') OR text_status = 'ready')
     AND kp_extraction_status = 'pending'`,
    [bookId]
  );
  for (const mod of readyModules) {
    await extractModule(bookId, mod.id, getModuleText(bookId, mod), mod.title);
  }
}
```

- [ ] **Step 3: Create module-status endpoint**

Create `src/app/api/books/[bookId]/module-status/route.ts`:

Note: `requireBookOwner` is in `@/lib/auth` (not auth-helpers), signature: `requireBookOwner(request: Request, bookId: number)`. The modules table column is `title` (not `name`).

```typescript
import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { requireBookOwner } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: { bookId: string } }
) {
  const bookId = Number(params.bookId);
  await requireBookOwner(request, bookId);
  
  const book = await queryOne<{ id: number; parse_status: string }>(
    "SELECT id, parse_status FROM books WHERE id = $1",
    [bookId]
  );
  
  if (!book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 });
  }
  
  const modules = await query(
    `SELECT id, title, text_status, ocr_status, kp_extraction_status, 
            page_start, page_end
     FROM modules WHERE book_id = $1 ORDER BY page_start ASC NULLS LAST`,
    [bookId]
  );
  
  return NextResponse.json({
    data: {
      bookId,
      parseStatus: book.parse_status,
      modules: modules.map((m: Record<string, unknown>) => ({
        id: m.id,
        title: m.title,
        textStatus: m.text_status,
        ocrStatus: m.ocr_status,
        kpStatus: m.kp_extraction_status,
        pageStart: m.page_start,
        pageEnd: m.page_end,
      }))
    }
  });
}
```

- [ ] **Step 4: Keep `books.kp_extraction_status` in sync**

Multiple existing routes (`module-map`, `regenerate`, `extract`, `status`, `ProcessingPoller.tsx`, `PdfViewer.tsx`) check `books.kp_extraction_status`. This field must stay in sync with module-level statuses. Add a helper:

```typescript
async function syncBookKpStatus(bookId: number): Promise<void> {
  const modules = await query(
    "SELECT kp_extraction_status FROM modules WHERE book_id = $1",
    [bookId]
  );
  const statuses = modules.map((m: Record<string, unknown>) => m.kp_extraction_status as string);
  
  let bookStatus: string;
  if (statuses.every(s => s === 'completed')) {
    bookStatus = 'completed';
  } else if (statuses.some(s => s === 'processing')) {
    bookStatus = 'processing';
  } else if (statuses.some(s => s === 'failed')) {
    bookStatus = 'failed';
  } else {
    bookStatus = 'pending';
  }
  
  await run("UPDATE books SET kp_extraction_status = $1 WHERE id = $2", [bookStatus, bookId]);
}
```

Call this after each module's KP extraction completes (in `extractModule` after updating module status). This ensures existing routes that check `books.kp_extraction_status` continue to work correctly.

- [ ] **Step 5: Verify**

Upload a text-based PDF → check:
1. `/classify-pdf` called (check books.page_classifications populated)
2. `/extract-text` called (check books.raw_text has Markdown)
3. Modules created with `text_status = 'ready'`, `ocr_status = 'skipped'`
4. KP extraction triggered automatically
5. `GET /api/books/[bookId]/module-status` returns module list with statuses
6. `books.kp_extraction_status` is 'completed' after all modules finish

- [ ] **Step 6: Commit + push**

```bash
git add src/app/api/books/route.ts src/app/api/books/[bookId]/extract/route.ts src/app/api/books/[bookId]/module-status/route.ts
git commit -m "feat(api): new upload flow + module-level extract + module-status endpoint"
git push origin master
```

---

## Task 8: Frontend — Module-Level Processing UI

**Executor:** Gemini [标准档]
**Files:**
- Modify: `src/components/ProcessingPoller.tsx` (or equivalent)
- Modify: `src/app/books/[bookId]/page.tsx`
- Modify: `src/components/ui/StatusBadge.tsx`

### Context

- ProcessingPoller currently polls `GET /api/books/[bookId]/status` and shows a single progress bar
- New API: `GET /api/books/[bookId]/module-status` returns per-module statuses
- Action Hub (books/[bookId]/page.tsx) shows module list with StatusBadge
- StatusBadge currently has 4 states: completed, in-progress, not-started, locked

### Steps

- [ ] **Step 1: Add new StatusBadge states**

In `src/components/ui/StatusBadge.tsx`, add two new states:
- `processing`: neutral variant with a subtle pulse animation — "OCR 处理中" or "KP 提取中"
- `readable`: primary variant — "可阅读"

- [ ] **Step 2: Modify ProcessingPoller to use module-status API**

Change polling endpoint from `/api/books/[bookId]/status` to `/api/books/[bookId]/module-status`.

Display module-level progress:
- Show each module's status (icon + name + state)
- For modules with `ocrStatus: "processing"`, show progress (X/Y pages)
- When all modules have `kpStatus: "completed"` → stop polling, call `router.refresh()`

Keep backward compatibility: if the new endpoint returns 404 (old books), fall back to the old polling behavior.

- [ ] **Step 3: Update Action Hub module list**

In `src/app/books/[bookId]/page.tsx`, use the module status to show appropriate badges:

| Condition | Badge | Clickable? |
|-----------|-------|-----------|
| kpStatus=completed | StatusBadge completed | Yes → go to module learning |
| textStatus=ready, kpStatus=pending/processing | StatusBadge readable ("可阅读") | Yes → go to reader only |
| ocrStatus=processing | StatusBadge processing ("处理中") | No (disabled) |
| textStatus=pending | StatusBadge locked | No (disabled) |

- [ ] **Step 4: Verify**

1. Upload a text-based PDF → all modules should show "completed" status within seconds
2. Upload a scanned PDF (if available) → modules should show "处理中" with progress, then unlock
3. Check that clicking "可阅读" modules opens the reader

- [ ] **Step 5: Commit + push**

```bash
git add src/components/ProcessingPoller.tsx src/app/books/[bookId]/page.tsx src/components/ui/StatusBadge.tsx
git commit -m "feat(ui): module-level processing status with progressive unlock"
git push origin master
```

---

## Task 9: Integration Verification + Docs

**Executor:** Claude
**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/changelog.md`

### Steps

- [ ] **Step 1: End-to-end test with text-based PDF**

Upload a known text-based PDF. Verify:
- Classification: all pages marked "text"
- Extraction: raw_text has Markdown with headers
- Modules created with correct page_start/page_end
- KP extraction runs per-module
- Module-status API returns correct data
- Frontend shows all modules as ready

- [ ] **Step 2: End-to-end test with scanned PDF**

Upload a scanned PDF (test_ocr.pdf in data/uploads/). Verify:
- Classification: pages marked "scanned"
- Extract-text: placeholder text
- OCR runs only on scanned pages
- Progress updates per-page
- Module unlocks when all its pages are OCR'd
- KP extraction triggers for completed modules

- [ ] **Step 3: Update architecture.md**

Update the "PDF OCR 管道" section and add new "渐进式处理" section. Update modules table schema. Add new API endpoint.

- [ ] **Step 4: Update changelog.md**

Add entry for this milestone.

- [ ] **Step 5: Update project_status.md**

Mark scanned PDF feature as complete.

---

## Execution Notes

**Task ordering for serial execution:**
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9

**If parallelizing:**
- T1 first (foundation)
- Then T2 + T3 + T5 in parallel (independent)
- Then T4 (needs T2) + T6 (needs T5)
- Then T7 (needs all backend)
- Then T8 (needs T7)
- T9 last

**Recommended dispatch model:**
- T1-T7: Codex (backend)
- T8: Gemini (frontend)
- T9: Claude (docs + verification)

**Risk mitigation:**
- T6 is the hardest task (per-module rewrite). Consider dispatching at 重档.
- After T7, do a quick smoke test before dispatching T8 to Gemini.

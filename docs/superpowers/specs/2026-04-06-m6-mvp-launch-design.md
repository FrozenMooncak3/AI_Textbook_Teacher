# M6: MVP Launch — Design Spec

## 1. Problem Statement

The product has a complete learning flow (upload → KP extraction → reading → Q&A → testing → spaced review) but cannot be used by real users because:

1. **Two data-state bugs** cause errors for certain books
2. **Large PDFs fail** — real textbooks (230K+ chars) exceed AI single-call limits
3. **PDF reader is too basic** — no zoom, search, or bookmarks
4. **No user accounts** — single-user local app, no data isolation
5. **Not deployed** — runs on localhost only

## 2. Goal

**Validate one hypothesis:** "Will international students use an AI learning system to study textbooks?"

Validation method: Deploy publicly, post demo videos on Douyin/Xiaohongshu, measure whether strangers complete the learning flow.

## 3. MVP Scope

### In Scope

| Item | Description |
|------|-------------|
| Bug fixes | Fix test_ch1_2 "PDF处理失败" + 读财报 module-map white screen |
| Large PDF chunking | Split large texts into chunks for KP extraction, merge results |
| PDF reader replacement | Replace current basic viewer with react-pdf-viewer (zoom, search, bookmarks) |
| User auth system | Email + password + invite code registration, session management |
| Deployment | PostgreSQL (Supabase/Neon) + Railway/Fly.io + PaddleOCR on server |

### Out of Scope (Post-MVP)

- Courseware/slides mode (PPT/short PDF) — first post-MVP iteration
- View source text during Q&A/review
- Pre-generation system
- Text selection ask AI
- Notes-QA integration
- Calendar, mind maps, hint system
- Translation features
- Mobile responsiveness
- iOS app
- Subscription/payment
- Multi-language support

## 4. Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database | PostgreSQL (migrate from SQLite) | Production-grade, supports cloud platforms, concurrent users |
| OCR | Keep PaddleOCR (self-hosted) | Free per-use, switch to cloud OCR later if needed |
| Deployment | Railway or Fly.io | Managed platform, auto-deploy on push, PostgreSQL add-on available |
| PDF reader | react-pdf-viewer | Most mature React PDF library, full feature set |
| DB abstraction | Raw pg driver + async query helpers | Minimizes conversion scope (SQL stays same, just swap driver + add await). Drizzle deferred to post-MVP — adding an ORM on top of a 48-file driver migration doubles the work. |
| Auth | Custom (email + password + invite code) | Simplest approach, no external auth provider dependency |
| PDF chunking | Chapter/heading-based segmentation | Preserves knowledge context within chunks |

**CLAUDE.md override:** The existing rule "禁止引入多用户 / 登录 / 注册系统" is explicitly overridden for this milestone by user decision (2026-04-06). MVP launch requires user accounts for data isolation and access control.

## 5. Design: Bug Fixes

### 5.1 test_ch1_2 "PDF处理失败"

**Symptom:** Book page shows "PDF处理失败" but PDF file exists and reader can display it.

**Likely cause:** `parse_status` is set to `'error'` in DB due to a previous failed processing attempt, but the PDF was actually uploaded successfully.

**Fix approach:**
1. Diagnose: query DB for the book's `parse_status`, `kp_extraction_status`
2. Fix the root cause (either the status-setting logic or add recovery mechanism)
3. Ensure ProcessingPoller handles interrupted states gracefully

### 5.2 读财报 module-map white screen

**Symptom:** Module map page is blank for a book uploaded as TXT (not PDF).

**Likely cause:** Module map page or its API assumes PDF-sourced data and fails silently for non-PDF books.

**Fix approach:**
1. Check module-map page component and API for PDF-only assumptions
2. Either support TXT-uploaded books properly or show a clear error message
3. Add error boundary coverage if missing

## 6. Design: Large PDF Chunking

### 6.1 Problem

Current extraction flow sends the entire book text to AI in one call. For texts > ~50K characters, the AI cannot process it in a single context window, causing extraction to fail silently or produce incomplete results.

### 6.2 Architecture

```
Upload → OCR → Full Text
                  ↓
            Check text length
                  ↓
        ┌─── ≤ 50K chars ───┐
        │                     │
   Single extraction    Split into chunks
        │                     │
        ↓               ┌─────┴─────┐
    KP results      Chunk 1  Chunk 2  Chunk N
                        │        │        │
                    Extract  Extract  Extract
                        │        │        │
                        └────┬───┘────────┘
                             ↓
                      Merge & deduplicate KPs
                             ↓
                      Generate module map
```

### 6.3 Chunking Strategy

1. **Detect natural boundaries:** Scan text for chapter headings, section headers, numbered sections using regex patterns common in textbooks
2. **Split on boundaries:** Each chunk should be a logical section (chapter or group of sections)
3. **Target chunk size:** ~30K-40K characters per chunk (leaves room for AI prompt overhead)
4. **Overlap:** Include last paragraph of previous chunk as context prefix
5. **Metadata:** Each chunk carries its position index and detected chapter/section title

### 6.4 Merge Strategy

1. Each chunk produces a list of KPs with module assignments
2. Merge phase:
   - Concatenate all KP lists
   - Deduplicate KPs with similar content (AI-assisted or string similarity)
   - Reconcile module assignments across chunks
   - Generate final module map from merged data

### 6.5 Files Affected

- **Modify:** `src/lib/services/kp-extraction-service.ts` — integrate chunking into the 3-stage extraction pipeline (structureScan → blockExtract → qualityCheck). This is where the actual AI calls happen, NOT the route handler.
- **Modify:** `src/app/api/books/[bookId]/extract/route.ts` — may need to handle longer timeouts for chunked extraction
- **Create:** `src/lib/text-chunker.ts` — text splitting utilities
- **Create:** `src/lib/kp-merger.ts` — KP merge and deduplication utilities
- **Modify:** `src/lib/seed-templates.ts` — may need chunk-aware extraction prompt variant
- **Modify:** `docs/architecture.md` — update extraction flow description

### 6.6 Interface Contract Impact

- **提取 → 学习** contract: KP structure unchanged. Chunks produce the same KP format, just in smaller batches. Merge step ensures final output matches existing contract.
- No breaking changes to downstream consumers (coach, examiner, reviewer).

## 7. Design: PDF Reader Replacement

### 7.1 Current State

Basic custom PDF viewer in `src/app/books/[bookId]/reader/` with limited functionality:
- Simple page rendering
- Screenshot selection (for screenshot-ask AI feature)
- No zoom, search, or bookmarks
- "Fit to width" is one-way (can't undo)

### 7.2 Target

Replace with `@react-pdf-viewer/core` + plugins:
- **Zoom plugin:** zoom in/out, fit-to-width, fit-to-page, percentage control
- **Search plugin:** text search with highlighting
- **Bookmark/TOC plugin:** table of contents navigation
- **Page navigation:** thumbnails, page number input, prev/next
- **Scroll mode:** continuous scroll or page-by-page

### 7.3 Screenshot AI Preservation

The existing screenshot selection feature (drag to select region → OCR → ask AI) MUST be preserved. Implementation approach:
- Screenshot selection is an overlay on top of the PDF viewer
- The new viewer component replaces only the PDF rendering layer
- **Critical:** `ScreenshotOverlay.tsx` performs coordinate calculations using `scrollContainer.querySelectorAll('canvas')` and `getBoundingClientRect()`. The new viewer MUST render pages as `<canvas>` elements within a scrollable container accessible by ref, or `ScreenshotOverlay.tsx` must be updated to match the new DOM structure.
- Verify coordinate mapping with zoom/scroll state changes

### 7.4 Files Affected

- **Modify:** `src/app/books/[bookId]/reader/page.tsx` — replace PDF rendering component
- **Modify:** `src/app/books/[bookId]/reader/ScreenshotOverlay.tsx` — adapt coordinate calculations to new viewer DOM structure
- **Reference:** `src/app/books/[bookId]/reader/AiChatDialog.tsx` — screenshot AI dialog (preserve)
- **Modify:** `package.json` — add @react-pdf-viewer dependencies, remove old PDF dependencies if any

## 8. Design: User Auth System

### 8.1 Database Schema Changes

Migration from SQLite to PostgreSQL includes adding auth tables:

```sql
-- New tables
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invite_codes (
  code TEXT PRIMARY KEY,
  created_by INTEGER REFERENCES users(id),
  max_uses INTEGER NOT NULL DEFAULT 5,
  used_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Existing tables: add user_id foreign key
ALTER TABLE books ADD COLUMN user_id INTEGER REFERENCES users(id);
-- (Books is the root — modules belong to books, all downstream data chains through books.)
```

Tables needing `user_id`:
- `books` (primary — all other tables link through book → module chain)
- Books table is the root — modules belong to books, KPs belong to modules, etc. Adding `user_id` to `books` and filtering at the book level isolates all downstream data.

### 8.2 Auth Flow

```
Landing page (not logged in)
    ↓
Register: email + password + invite code
    ↓ (validate invite code, hash password, create user)
Login: email + password
    ↓ (verify password, create session)
Session cookie (HTTP-only, secure)
    ↓
All API routes: check session → get user_id → filter data
    ↓
Logout: clear session
```

### 8.3 Middleware

- Create auth middleware that runs before all API routes (except `/api/auth/*`)
- Extracts user_id from session cookie
- Passes user_id to route handlers
- Returns 401 if no valid session

### 8.4 Frontend

- **New pages:** `/login`, `/register`
- **Redirect logic:** unauthenticated users → `/login`
- **UI:** simple forms, no complex design needed for MVP

### 8.5 Invite Code Management

For MVP, invite codes are created manually (seed script or direct DB insert). No admin UI needed. The user (product owner) generates codes and distributes them.

### 8.6 Files Affected

- **Create:** `src/app/api/auth/register/route.ts`
- **Create:** `src/app/api/auth/login/route.ts`
- **Create:** `src/app/api/auth/logout/route.ts`
- **Create:** `src/app/(auth)/login/page.tsx`
- **Create:** `src/app/(auth)/register/page.tsx`
- **Create:** `src/lib/auth.ts` — session management, password hashing
- **Create:** `src/middleware.ts` — Next.js middleware for auth checks
- **Modify:** `src/lib/db.ts` — replace better-sqlite3 with Drizzle ORM + PostgreSQL driver
- **Modify:** All API route handlers (~34 files) — convert sync db calls to async, add user_id filtering
- **Modify:** All server component pages that call db directly (~6 files: page.tsx, reader/page.tsx, qa/page.tsx, test/page.tsx, module page.tsx, logs/page.tsx) — add user_id guards to prevent cross-user data access via direct URL
- **Modify:** `package.json` — add drizzle-orm, postgres driver, bcrypt; remove better-sqlite3

### 8.7 Interface Contract Impact

- All API endpoints gain implicit `user_id` filtering
- No changes to request/response formats (user_id comes from session, not request body)
- Frontend code unchanged except: add login/register pages, add redirect logic

## 9. Design: Deployment

### 9.1 Architecture

```
[User Browser]
      ↓ HTTPS
[Railway/Fly.io]
  ├── Next.js App (Node.js)
  ├── PaddleOCR Service (Python)
  └── PostgreSQL (Railway add-on / Supabase / Neon)
```

### 9.2 Deployment Strategy

1. **PostgreSQL:** Use Railway's built-in PostgreSQL add-on or Neon free tier
2. **Next.js app:** Dockerize, deploy to Railway
3. **PaddleOCR:** Dockerize as separate service, deploy alongside
4. **File storage:** Uploaded PDFs stored on persistent volume (Railway volume) or object storage (S3/R2)
5. **Domain:** Custom domain or use Railway's default subdomain for MVP

### 9.3 Environment Variables

```
DATABASE_URL=postgresql://...
OCR_SERVICE_URL=http://ocr-service:8000
ANTHROPIC_API_KEY=...
AI_MODEL=anthropic:claude-sonnet-4-6
SESSION_SECRET=...
APP_URL=https://your-domain.com
```

### 9.4 Docker Setup

Two Dockerfiles:
- `Dockerfile` — Next.js app (Node.js 20, build, serve)
- `Dockerfile.ocr` — PaddleOCR service (Python 3.10, PaddleOCR, HTTP server)

Docker Compose for local development parity.

### 9.5 Migration Script

One-time migration from SQLite schema to PostgreSQL:
- Convert all CREATE TABLE statements from SQLite syntax to PostgreSQL
- Add UUID types, TIMESTAMPTZ, etc.
- Add users table and invite_codes table
- Add user_id columns
- Seed initial invite codes

### 9.6 Files Affected

- **Create:** `Dockerfile`, `Dockerfile.ocr`, `docker-compose.yml`
- **Create:** `scripts/migrate-to-postgres.sql` — PostgreSQL schema
- **Create:** `scripts/seed-invite-codes.ts` — generate initial invite codes
- **Modify:** `src/lib/db.ts` — replace better-sqlite3 with pg/postgres driver
- **Modify:** `scripts/ocr_server.py` — ensure Docker compatibility
- **Modify:** `.env.example` — document required env vars

## 10. Execution Order

Tasks have dependencies. Recommended order:

```
T1: PostgreSQL migration + Drizzle ORM (LARGEST TASK)
    - Rewrite src/lib/db.ts with Drizzle + PostgreSQL
    - Define Drizzle schema for all 21 existing tables + 2 new (users, invite_codes)
    - Convert ALL 48 files (34 API routes + 6 server pages + 8 lib files) from sync better-sqlite3 to async Drizzle
    - Add user_id column to books table
    - Migration script for PostgreSQL schema
    ↓
T2: Auth system (depends on T1)
    - Auth routes, middleware, login/register pages
    - user_id filtering in all queries
    ↓ (T3-T4 can parallel after T1)
T3: Large PDF chunking (independent of auth)
T4: PDF reader replacement (independent of auth)
    ↓
T5: Bug fixes (after DB migration, may resolve naturally)
    ↓
T6: Deployment (Docker + Railway/Fly.io)
    - Dockerize Next.js + PaddleOCR
    - OCR server bind to 0.0.0.0, configurable port
    - Configure PostgreSQL connection
    ↓
T7: Smoke test + architecture.md update
```

T1 is the critical path — it touches every file that uses the database. Estimate: this is 60%+ of the milestone's work. T3 and T4 can run in parallel after T1.

## 11. Success Criteria

- [ ] A new user can register with invite code + email
- [ ] User can upload a 200+ page PDF textbook and have KPs extracted successfully
- [ ] PDF reader has zoom, search, and page navigation
- [ ] Screenshot AI feature still works in new reader
- [ ] User can complete full learning flow: read → Q&A → test → review
- [ ] Each user only sees their own books and data
- [ ] Product is accessible via public URL
- [ ] No data-state bugs on existing test cases
- [ ] PaddleOCR service runs correctly in deployment

## 12. What This Spec Does NOT Cover

- Mobile responsiveness (desktop-first for MVP)
- Payment/subscription
- Admin dashboard for invite code management
- Analytics/tracking
- Rate limiting or abuse prevention (invite code controls access)
- Courseware/slides mode
- Any features listed in "Out of Scope" (Section 3)

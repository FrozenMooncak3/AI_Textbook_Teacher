CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS books (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  raw_text TEXT,
  file_path TEXT,
  parse_status TEXT NOT NULL DEFAULT 'pending',
  kp_extraction_status TEXT NOT NULL DEFAULT 'pending',
  ocr_current_page INTEGER NOT NULL DEFAULT 0,
  ocr_total_pages INTEGER NOT NULL DEFAULT 0,
  page_classifications TEXT DEFAULT NULL,
  text_pages_count INTEGER DEFAULT 0,
  scanned_pages_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE books ADD COLUMN IF NOT EXISTS learning_mode TEXT NOT NULL DEFAULT 'full';
ALTER TABLE books ADD COLUMN IF NOT EXISTS preferred_learning_mode TEXT;
-- M4.5: upload stage tracking (for presigned URL upload flow)
ALTER TABLE books ADD COLUMN IF NOT EXISTS upload_status TEXT NOT NULL DEFAULT 'confirmed';
ALTER TABLE books ADD COLUMN IF NOT EXISTS file_size BIGINT NOT NULL DEFAULT 0;

-- Ensure CHECK constraint is present (idempotent via NOT EXISTS probe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'books' AND c.conname = 'books_upload_status_check'
  ) THEN
    ALTER TABLE books ADD CONSTRAINT books_upload_status_check
      CHECK (upload_status IN ('pending', 'confirmed'));
  END IF;
END $$;

DO $$
DECLARE
  con_name TEXT;
BEGIN
  FOR con_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    WHERE t.relname = 'books'
      AND n.nspname = 'public'
      AND c.contype = 'c'
      AND a.attname IN ('learning_mode', 'preferred_learning_mode')
  LOOP
    EXECUTE format('ALTER TABLE books DROP CONSTRAINT %I', con_name);
  END LOOP;
END $$;

ALTER TABLE books ADD CONSTRAINT books_learning_mode_check
  CHECK (learning_mode IN ('teaching', 'full'));

ALTER TABLE books ADD CONSTRAINT books_preferred_learning_mode_check
  CHECK (preferred_learning_mode IN ('teaching', 'full') OR preferred_learning_mode IS NULL);

CREATE TABLE IF NOT EXISTS modules (
  id SERIAL PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL,
  kp_count INTEGER NOT NULL DEFAULT 0,
  cluster_count INTEGER NOT NULL DEFAULT 0,
  page_start INTEGER,
  page_end INTEGER,
  learning_status TEXT NOT NULL DEFAULT 'unstarted',
  text_status TEXT DEFAULT 'pending',
  ocr_status TEXT DEFAULT 'pending',
  kp_extraction_status TEXT DEFAULT 'pending',
  guide_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clusters (
  id SERIAL PRIMARY KEY,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  current_p_value INTEGER NOT NULL DEFAULT 2,
  last_review_result TEXT,
  consecutive_correct INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_points (
  id SERIAL PRIMARY KEY,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  kp_code TEXT NOT NULL,
  section_name TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL,
  importance INTEGER NOT NULL DEFAULT 2,
  detailed_content TEXT NOT NULL,
  cluster_id INTEGER REFERENCES clusters(id),
  ocr_quality TEXT NOT NULL DEFAULT 'good',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
DECLARE
  con_name TEXT;
BEGIN
  FOR con_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    WHERE t.relname = 'knowledge_points'
      AND n.nspname = 'public'
      AND c.contype = 'c'
      AND a.attname = 'type'
  LOOP
    EXECUTE format('ALTER TABLE knowledge_points DROP CONSTRAINT %I', con_name);
  END LOOP;
END $$;

ALTER TABLE knowledge_points ADD CONSTRAINT knowledge_points_type_check
  CHECK (type IN ('factual', 'conceptual', 'procedural', 'analytical', 'evaluative'));

ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS source_anchor JSONB;

CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  screenshot_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS highlights (
  id SERIAL PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  text TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'yellow',
  rects_json TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS logs (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id INTEGER REFERENCES users(id),
  level TEXT NOT NULL DEFAULT 'info',
  action TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS reading_notes (
  id SERIAL PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  module_id INTEGER REFERENCES modules(id),
  page_number INTEGER,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS module_notes (
  id SERIAL PRIMARY KEY,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  generated_from TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qa_questions (
  id SERIAL PRIMARY KEY,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  kp_id INTEGER REFERENCES knowledge_points(id),
  question_type TEXT NOT NULL CHECK(question_type IN ('worked_example','scaffolded_mc','short_answer','comparison')),
  question_text TEXT NOT NULL,
  correct_answer TEXT,
  scaffolding TEXT,
  order_index INTEGER NOT NULL,
  is_review INTEGER NOT NULL DEFAULT 0,
  source_module_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qa_responses (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES qa_questions(id) ON DELETE CASCADE,
  user_answer TEXT NOT NULL,
  is_correct INTEGER,
  ai_feedback TEXT,
  score REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_papers (
  id SERIAL PRIMARY KEY,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  total_score REAL,
  pass_rate REAL,
  is_passed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_questions (
  id SERIAL PRIMARY KEY,
  paper_id INTEGER NOT NULL REFERENCES test_papers(id) ON DELETE CASCADE,
  kp_id INTEGER REFERENCES knowledge_points(id),
  kp_ids TEXT,
  question_type TEXT NOT NULL CHECK(question_type IN ('single_choice','c2_evaluation','calculation','essay')),
  question_text TEXT NOT NULL,
  options TEXT,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_responses (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES test_questions(id) ON DELETE CASCADE,
  user_answer TEXT NOT NULL,
  is_correct INTEGER,
  score REAL,
  ai_feedback TEXT,
  error_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mistakes (
  id SERIAL PRIMARY KEY,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  kp_id INTEGER REFERENCES knowledge_points(id),
  knowledge_point TEXT,
  error_type TEXT NOT NULL CHECK(error_type IN ('blind_spot','procedural','confusion','careless')),
  source TEXT NOT NULL DEFAULT 'test' CHECK(source IN ('test','qa','review')),
  remediation TEXT,
  is_resolved INTEGER NOT NULL DEFAULT 0,
  question_text TEXT,
  user_answer TEXT,
  correct_answer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_schedule (
  id SERIAL PRIMARY KEY,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  review_round INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  completed_at TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_records (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER NOT NULL REFERENCES review_schedule(id) ON DELETE CASCADE,
  cluster_id INTEGER NOT NULL REFERENCES clusters(id),
  questions_count INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  p_value_before INTEGER NOT NULL,
  p_value_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_questions (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER NOT NULL REFERENCES review_schedule(id) ON DELETE CASCADE,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  cluster_id INTEGER NOT NULL REFERENCES clusters(id),
  kp_id INTEGER REFERENCES knowledge_points(id),
  question_type TEXT NOT NULL CHECK(question_type IN ('single_choice','c2_evaluation','calculation','essay')),
  question_text TEXT NOT NULL,
  options TEXT,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_responses (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES review_questions(id) ON DELETE CASCADE,
  user_answer TEXT NOT NULL,
  is_correct INTEGER,
  score REAL,
  ai_feedback TEXT,
  error_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prompt_templates (
  id SERIAL PRIMARY KEY,
  role TEXT NOT NULL,
  stage TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  template_text TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role, stage, version)
);

ALTER TABLE prompt_templates ADD COLUMN IF NOT EXISTS model TEXT NULL;

CREATE TABLE IF NOT EXISTS invite_codes (
  code TEXT PRIMARY KEY,
  created_by INTEGER REFERENCES users(id),
  max_uses INTEGER NOT NULL DEFAULT 5,
  used_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration: scanned PDF upgrade (2026-04-12)
-- ALTER TABLE defaults differ from CREATE TABLE defaults for backward compat:
-- existing rows get 'ready'/'done'/'completed' (already-processed state),
-- new rows get 'pending' (needs processing).
ALTER TABLE books ADD COLUMN IF NOT EXISTS page_classifications TEXT DEFAULT NULL;
ALTER TABLE books ADD COLUMN IF NOT EXISTS text_pages_count INTEGER DEFAULT 0;
ALTER TABLE books ADD COLUMN IF NOT EXISTS scanned_pages_count INTEGER DEFAULT 0;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS text_status TEXT DEFAULT 'ready';
ALTER TABLE modules ADD COLUMN IF NOT EXISTS ocr_status TEXT DEFAULT 'done';
ALTER TABLE modules ADD COLUMN IF NOT EXISTS kp_extraction_status TEXT DEFAULT 'completed';

CREATE TABLE IF NOT EXISTS teaching_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  cluster_id INTEGER REFERENCES clusters(id) ON DELETE SET NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transcript JSONB NOT NULL DEFAULT '{"version":1,"state":{"depth":"full","currentKpId":null,"coveredKpIds":[],"strugglingStreak":0,"startedAt":null,"lastActiveAt":null,"tokensInTotal":0,"tokensOutTotal":0},"messages":[]}'::jsonb,
  depth TEXT NOT NULL DEFAULT 'full' CHECK (depth IN ('light', 'full')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teaching_sessions_module ON teaching_sessions(module_id);
CREATE INDEX IF NOT EXISTS idx_teaching_sessions_user ON teaching_sessions(user_id);

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'premium' CHECK (tier IN ('free', 'premium')),
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);

INSERT INTO user_subscriptions (user_id, tier, effective_at)
SELECT u.id, 'premium', NOW()
FROM users u
WHERE NOT EXISTS (
  SELECT 1
  FROM user_subscriptions s
  WHERE s.user_id = u.id
);

-- ========================================================================
-- 2026-04-25: OCR + KP 成本架构（D1/D6/D7）— 5 张新表 + books 2 列 + users 3 列
-- 来源: docs/superpowers/specs/2026-04-25-ocr-cost-architecture-design.md
-- ========================================================================

-- D6: KP 全书级缓存（半全局共享，无 user_id；教材客观知识点跨用户复用）
CREATE TABLE IF NOT EXISTS kp_cache (
  id            BIGSERIAL PRIMARY KEY,
  pdf_md5       TEXT UNIQUE NOT NULL,
  page_count    INTEGER NOT NULL,
  language      TEXT NOT NULL CHECK (language IN ('zh', 'en')),
  model_used    TEXT NOT NULL,
  kp_payload    JSONB NOT NULL,
  hit_count     INTEGER NOT NULL DEFAULT 0,
  last_hit_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kp_cache_md5 ON kp_cache(pdf_md5);

-- D1: 月度账户预算 meter（month-of-year reset by cron `0 16 1 * *` UTC = 北京 1 号 0:00）
CREATE TABLE IF NOT EXISTS monthly_cost_meter (
  id              BIGSERIAL PRIMARY KEY,
  year_month      TEXT UNIQUE NOT NULL,             -- 'YYYY-MM' 北京时区
  total_cost_yuan NUMERIC(10, 4) NOT NULL DEFAULT 0,
  alert_80_sent   BOOLEAN NOT NULL DEFAULT FALSE,   -- 80% 预警邮件已发
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_monthly_cost_meter_ym ON monthly_cost_meter(year_month);

-- D1: 每次 LLM 调用的成本明细（KP 提取 / 教学对话）
CREATE TABLE IF NOT EXISTS cost_log (
  id          BIGSERIAL PRIMARY KEY,
  book_id     INTEGER REFERENCES books(id) ON DELETE SET NULL,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  call_type   TEXT NOT NULL CHECK (call_type IN ('kp_extraction', 'teaching_free', 'teaching_premium')),
  model       TEXT NOT NULL,
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_yuan   NUMERIC(10, 6) NOT NULL DEFAULT 0,
  cache_hit   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cost_log_book ON cost_log(book_id);
CREATE INDEX IF NOT EXISTS idx_cost_log_user_date ON cost_log(user_id, created_at);

-- D7: 上传事件流水（rate-limit + 异常检测查询用；写入时机 = confirm 成功后）
CREATE TABLE IF NOT EXISTS book_uploads_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_book_uploads_log_user_time ON book_uploads_log(user_id, created_at);

-- D0: 拒绝时邮箱收集（launch list / 众筹早鸟池）
CREATE TABLE IF NOT EXISTS email_collection_list (
  id                 BIGSERIAL PRIMARY KEY,
  email              TEXT NOT NULL,
  reject_reason      TEXT NOT NULL CHECK (reject_reason IN ('scanned_pdf', 'too_large', 'too_many_pages', 'too_many_slides', 'unsupported_type')),
  book_filename      TEXT,
  book_size_bytes    BIGINT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  launch_notified_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_email_collection_email ON email_collection_list(email);

-- D6: books 加 file_md5 + cache_hit 列
ALTER TABLE books ADD COLUMN IF NOT EXISTS file_md5 TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS cache_hit BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_books_md5 ON books(file_md5);

-- D7: users 加 quota / invite_code_used / suspicious_flag 列
ALTER TABLE users ADD COLUMN IF NOT EXISTS book_quota_remaining INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_code_used TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspicious_flag BOOLEAN NOT NULL DEFAULT FALSE;

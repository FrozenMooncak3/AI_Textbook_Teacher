import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { seedTemplates } from './seed-templates'

const DB_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DB_DIR, 'app.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true })
  }

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  initSchema(db)
  return db
}

function initSchema(db: Database.Database): void {
  db.exec(`
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
      learning_status TEXT    NOT NULL DEFAULT 'unstarted',
      guide_json      TEXT,
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
      created_at           TEXT    NOT NULL DEFAULT (datetime('now'))
    );

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
  `)

  // M2 migrations (safe to re-run)
  try {
    db.exec(`ALTER TABLE modules ADD COLUMN guide_json TEXT`)
  } catch {
    // Column already exists
  }

  // M3 migrations (safe to re-run)
  try {
    db.exec(`ALTER TABLE test_questions ADD COLUMN kp_ids TEXT`)
  } catch {
    // Column already exists
  }

  // M3.5 migrations (safe to re-run)
  try {
    db.exec(`ALTER TABLE clusters DROP COLUMN next_review_date`)
  } catch {
    // Column already dropped or never existed
  }

  db.exec(`UPDATE modules SET learning_status = 'unstarted' WHERE learning_status = 'not_started'`)

  seedTemplates()
}

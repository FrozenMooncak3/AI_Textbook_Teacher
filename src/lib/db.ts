import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

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
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      title        TEXT    NOT NULL,
      raw_text     TEXT    NOT NULL,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      parse_status TEXT    NOT NULL DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS modules (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id         INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      title           TEXT    NOT NULL,
      summary         TEXT    NOT NULL DEFAULT '',
      order_index     INTEGER NOT NULL,
      kp_count        INTEGER NOT NULL DEFAULT 0,
      learning_status TEXT    NOT NULL DEFAULT 'unstarted',
      pass_status     TEXT    NOT NULL DEFAULT 'not_passed'
    );

    CREATE TABLE IF NOT EXISTS questions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id   INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      type        TEXT    NOT NULL CHECK(type IN ('qa', 'test', 'review')),
      prompt      TEXT    NOT NULL,
      answer_key  TEXT    NOT NULL DEFAULT '',
      explanation TEXT    NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS user_responses (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id   INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      response_text TEXT    NOT NULL,
      score         INTEGER,
      error_type    TEXT,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mistakes (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id        INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      question_id      INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      knowledge_point  TEXT    NOT NULL,
      next_review_date TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS review_tasks (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      due_date  TEXT    NOT NULL,
      status    TEXT    NOT NULL DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      level      TEXT    NOT NULL DEFAULT 'info',
      action     TEXT    NOT NULL,
      details    TEXT    NOT NULL DEFAULT ''
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

    CREATE TABLE IF NOT EXISTS notes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      page_number INTEGER NOT NULL,
      content     TEXT    NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // 迁移：为旧版 modules 表加 guide_json 列
  try {
    db.exec(`ALTER TABLE modules ADD COLUMN guide_json TEXT`)
  } catch {
    // 列已存在，忽略
  }

  // 迁移：books 表加 OCR 进度列
  try {
    db.exec(`ALTER TABLE books ADD COLUMN ocr_current_page INTEGER NOT NULL DEFAULT 0`)
  } catch {
    // 列已存在，忽略
  }
  try {
    db.exec(`ALTER TABLE books ADD COLUMN ocr_total_pages INTEGER NOT NULL DEFAULT 0`)
  } catch {
    // 列已存在，忽略
  }
}

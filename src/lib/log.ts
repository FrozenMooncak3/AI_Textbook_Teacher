import { getDb } from './db'

type Level = 'info' | 'warn' | 'error'

export function logAction(action: string, details: string = '', level: Level = 'info'): void {
  try {
    const db = getDb()
    db.prepare('INSERT INTO logs (level, action, details) VALUES (?, ?, ?)').run(level, action, details)
  } catch {
    // 日志写入失败不能影响主流程
  }
}

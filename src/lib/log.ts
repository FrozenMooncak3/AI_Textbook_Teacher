import { run } from './db'

type Level = 'info' | 'warn' | 'error'

export async function logAction(
  action: string,
  details: string = '',
  level: Level = 'info'
): Promise<void> {
  try {
    await run('INSERT INTO logs (level, action, details) VALUES ($1, $2, $3)', [
      level,
      action,
      details,
    ])
  } catch {
    // 日志写入失败不能影响主流程
  }
}

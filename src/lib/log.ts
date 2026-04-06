import { run } from './db'

type Level = 'info' | 'warn' | 'error'

interface LogContext {
  userId?: number
}

export async function logAction(
  action: string,
  details: string = '',
  level: Level = 'info',
  context?: LogContext
): Promise<void> {
  try {
    if (typeof context?.userId === 'number') {
      await run('INSERT INTO logs (user_id, level, action, details) VALUES ($1, $2, $3, $4)', [
        context.userId,
        level,
        action,
        details,
      ])
      return
    }

    await run('INSERT INTO logs (level, action, details) VALUES ($1, $2, $3)', [level, action, details])
  } catch {
    // Log write failures must not interrupt the main flow.
  }
}

import { query, queryOne, run } from '@/lib/db'

export type QuotaCheckResult =
  | { ok: true }
  | { ok: false; reason: 'quota_exceeded' | 'rate_limit_1h' }

export async function checkQuotaAndRateLimit(userId: number): Promise<QuotaCheckResult> {
  const user = await queryOne<{ book_quota_remaining: number }>(
    `SELECT book_quota_remaining FROM users WHERE id = $1`,
    [userId]
  )
  if (!user || user.book_quota_remaining <= 0) {
    return { ok: false, reason: 'quota_exceeded' }
  }

  const recent = await queryOne<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM book_uploads_log
     WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
    [userId]
  )
  if (recent && Number(recent.cnt) >= 1) {
    return { ok: false, reason: 'rate_limit_1h' }
  }

  return { ok: true }
}

/**
 * 事务内消耗 quota + 写 upload log。
 * 时机：confirm 路由成功后调用（不在 presign 时；spec §7.4）。
 * 返回 false 表示 quota 已耗尽（race condition 防御）。
 */
export async function consumeQuotaAndLogUpload(
  userId: number,
  bookId: number
): Promise<boolean> {
  // pg 单条 UPDATE WHERE 已是原子；用 RETURNING 确认确实扣到了
  const result = await query<{ id: number }>(
    `UPDATE users
     SET book_quota_remaining = book_quota_remaining - 1
     WHERE id = $1 AND book_quota_remaining > 0
     RETURNING id`,
    [userId]
  )
  if (result.length === 0) {
    return false
  }
  await run(
    `INSERT INTO book_uploads_log (user_id, book_id) VALUES ($1, $2)`,
    [userId, bookId]
  )
  return true
}

/**
 * 邀请码已用 → quota +1。
 * 防重复扩额：用 invite_code_used IS NULL 守卫。
 * 返回 false 表示已经用过别的邀请码。
 */
export async function incrementQuotaForInviteCode(
  userId: number,
  inviteCode: string
): Promise<boolean> {
  const result = await query<{ id: number }>(
    `UPDATE users
     SET book_quota_remaining = book_quota_remaining + 1,
         invite_code_used = $2
     WHERE id = $1 AND invite_code_used IS NULL
     RETURNING id`,
    [userId, inviteCode]
  )
  return result.length > 0
}

import { query, run } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'
import { sendAbuseAlertEmail } from '@/lib/services/budget-email-alert'

export const GET = handleRoute(async (req) => {
  const cronSecret = req.headers.get('x-vercel-cron-secret')
  if (cronSecret !== process.env.CRON_SECRET) {
    throw new UserError('Unauthorized', 'UNAUTHORIZED', 401)
  }

  const offenders = await query<{ user_id: number; cnt: string; email: string }>(
    `SELECT bul.user_id, COUNT(*)::TEXT AS cnt, u.email
     FROM book_uploads_log bul
     JOIN users u ON u.id = bul.user_id
     WHERE bul.created_at > NOW() - INTERVAL '30 days'
       AND u.suspicious_flag = FALSE
     GROUP BY bul.user_id, u.email
     HAVING COUNT(*) > 5`
  )

  for (const row of offenders) {
    await run(`UPDATE users SET suspicious_flag = TRUE WHERE id = $1`, [row.user_id])
    await sendAbuseAlertEmail({
      userId: row.user_id,
      userEmail: row.email,
      monthlyUploadCount: Number(row.cnt),
    })
  }

  await logAction('abuse_alert_cron', `flagged=${offenders.length}`)
  return { data: { ok: true, flaggedCount: offenders.length } }
})

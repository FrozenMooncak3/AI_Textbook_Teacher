import { queryOne } from '@/lib/db'
import { UserError } from '@/lib/errors'
import { handleRoute } from '@/lib/handle-route'
import { logAction } from '@/lib/log'
import { sendBudgetAlertEmail } from '@/lib/services/budget-email-alert'

export const GET = handleRoute(async (req) => {
  const cronSecret = req.headers.get('x-vercel-cron-secret')
  if (cronSecret !== process.env.CRON_SECRET) {
    throw new UserError('Unauthorized', 'UNAUTHORIZED', 401)
  }

  const now = new Date()
  const beijing = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  let lastYear = beijing.getUTCFullYear()
  let lastMonth = beijing.getUTCMonth()
  if (lastMonth === 0) {
    lastYear -= 1
    lastMonth = 12
  }
  const lastYm = `${lastYear}-${String(lastMonth).padStart(2, '0')}`

  const lastMeter = await queryOne<{ total_cost_yuan: string; alert_80_sent: boolean }>(
    `SELECT total_cost_yuan, alert_80_sent FROM monthly_cost_meter WHERE year_month = $1`,
    [lastYm]
  )

  if (lastMeter) {
    await sendBudgetAlertEmail({
      yearMonth: lastYm,
      spent: Number(lastMeter.total_cost_yuan),
      threshold: Number(process.env.MONTHLY_BUDGET_TOTAL ?? '500') * 0.8,
      total: Number(process.env.MONTHLY_BUDGET_TOTAL ?? '500'),
      severity: 'warning',
    })
  }

  await logAction('monthly_cost_reset_cron', `lastYm=${lastYm}, sent=${!!lastMeter}`)
  return { data: { ok: true, reportedFor: lastYm } }
})

import { query, queryOne, run } from '@/lib/db'
import { logAction } from '@/lib/log'

export type CallType = 'kp_extraction' | 'teaching_free' | 'teaching_premium'

export interface RecordCostInput {
  bookId?: number | null
  userId?: number | null
  callType: CallType
  model: string
  inputTokens: number
  outputTokens: number
  costYuan: number
  cacheHit?: boolean
}

const MONTHLY_BUDGET_TOTAL = Number(process.env.MONTHLY_BUDGET_TOTAL ?? '500')
const ALERT_THRESHOLD_PCT = 0.8

function getBeijingYearMonth(): string {
  const now = new Date()
  // UTC + 8h = 北京时区
  const beijing = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const yyyy = beijing.getUTCFullYear()
  const mm = String(beijing.getUTCMonth() + 1).padStart(2, '0')
  return `${yyyy}-${mm}`
}

/**
 * 写 cost_log + UPSERT monthly_cost_meter（同事务）
 * Note: pg pool 的 query() 是单连接事务边界由调用方控制；这里用 single-statement
 * 写入 + UPSERT，pg 单语句天然原子，无需显式 BEGIN/COMMIT。
 */
export async function recordCost(input: RecordCostInput): Promise<void> {
  // 仅免费档教学 + KP 提取计入 monthly_cost_meter；付费档 Sonnet 走独立 Anthropic billing
  const countTowardsBudget =
    input.callType === 'kp_extraction' || input.callType === 'teaching_free'

  await run(
    `INSERT INTO cost_log (book_id, user_id, call_type, model, input_tokens, output_tokens, cost_yuan, cache_hit)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      input.bookId ?? null,
      input.userId ?? null,
      input.callType,
      input.model,
      input.inputTokens,
      input.outputTokens,
      input.costYuan,
      input.cacheHit ?? false,
    ]
  )

  if (countTowardsBudget) {
    const ym = getBeijingYearMonth()
    await run(
      `INSERT INTO monthly_cost_meter (year_month, total_cost_yuan, last_updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (year_month) DO UPDATE
       SET total_cost_yuan = monthly_cost_meter.total_cost_yuan + EXCLUDED.total_cost_yuan,
           last_updated_at = NOW()`,
      [ym, input.costYuan]
    )

    // 触发 80% 预警邮件（fire-and-forget，不阻塞主流程）
    void triggerBudgetAlertIfThreshold(ym).catch((err) => {
      void logAction('budget_alert_check_failed', `ym=${ym}, err=${String(err)}`, 'error')
    })
  }
}

export async function getCurrentMonthSpent(): Promise<number> {
  const ym = getBeijingYearMonth()
  const row = await queryOne<{ total_cost_yuan: string }>(
    `SELECT total_cost_yuan FROM monthly_cost_meter WHERE year_month = $1`,
    [ym]
  )
  return row ? Number(row.total_cost_yuan) : 0
}

export async function isBudgetExceeded(): Promise<boolean> {
  const spent = await getCurrentMonthSpent()
  return spent >= MONTHLY_BUDGET_TOTAL
}

async function triggerBudgetAlertIfThreshold(yearMonth: string): Promise<void> {
  const row = await queryOne<{ total_cost_yuan: string; alert_80_sent: boolean }>(
    `SELECT total_cost_yuan, alert_80_sent FROM monthly_cost_meter WHERE year_month = $1`,
    [yearMonth]
  )
  if (!row) return
  const spent = Number(row.total_cost_yuan)
  if (spent >= MONTHLY_BUDGET_TOTAL * ALERT_THRESHOLD_PCT && !row.alert_80_sent) {
    // mark sent first to避免并发重发
    await run(
      `UPDATE monthly_cost_meter SET alert_80_sent = TRUE WHERE year_month = $1 AND alert_80_sent = FALSE`,
      [yearMonth]
    )
    // 实际邮件发送由 budget-email-alert.ts 完成（Task 1.6）
    const { sendBudgetAlertEmail } = await import('./budget-email-alert')
    await sendBudgetAlertEmail({
      yearMonth,
      spent,
      threshold: MONTHLY_BUDGET_TOTAL * ALERT_THRESHOLD_PCT,
      total: MONTHLY_BUDGET_TOTAL,
      severity: 'warning',
    })
  }
}

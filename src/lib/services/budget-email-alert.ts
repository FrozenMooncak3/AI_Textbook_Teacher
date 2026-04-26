import { logAction } from '@/lib/log'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const BUDGET_ALERT_EMAIL = process.env.BUDGET_ALERT_EMAIL ?? 'zs2911@nyu.edu'
const SENDER = 'AI Textbook <noreply@ai-textbook.example.com>' // 上线前用户在 resend.com 配 verified domain 后改

export interface BudgetAlertInput {
  yearMonth: string
  spent: number
  threshold: number
  total: number
  severity: 'warning' | 'critical'
}

export interface AbuseAlertInput {
  userId: number
  userEmail: string
  monthlyUploadCount: number
}

export async function sendBudgetAlertEmail(input: BudgetAlertInput): Promise<void> {
  const subject =
    input.severity === 'critical'
      ? `🚨 [AI Textbook] 月度预算触顶 ${input.spent.toFixed(2)} / ${input.total} 元`
      : `⚠️ [AI Textbook] 月度预算 80% 预警 ${input.spent.toFixed(2)} / ${input.total} 元`

  const body = `
${input.yearMonth} 月度账户预算${input.severity === 'critical' ? '已触顶' : '已达 80% 预警线'}：

- 当前累计：${input.spent.toFixed(2)} 元
- 阈值：${input.threshold.toFixed(2)} 元
- 月度上限：${input.total} 元

${input.severity === 'critical' ? '新上传已被自动拦截，老用户继续可用。' : '继续监控，超 100% 将拦截新上传。'}

如需查看详情，登录 admin dashboard 或检查 Vercel cron 日志。
`.trim()

  await sendEmail(subject, body)
}

export async function sendAbuseAlertEmail(input: AbuseAlertInput): Promise<void> {
  const subject = `[AI Textbook] 用户上传异常 user=${input.userId}`
  const body = `
检测到用户异常上传（过去 30 天 ${input.monthlyUploadCount} 本，>5 本告警阈值）：

- userId: ${input.userId}
- email: ${input.userEmail}
- 月度上传数: ${input.monthlyUploadCount}

已自动设置 users.suspicious_flag=TRUE，未自动停服。请人工 review。
`.trim()

  await sendEmail(subject, body)
}

async function sendEmail(subject: string, body: string): Promise<void> {
  if (!RESEND_API_KEY) {
    void logAction('budget_alert_email_skipped', `RESEND_API_KEY 未配，subject="${subject}"`, 'warn')
    console.warn('[budget-alert] RESEND_API_KEY missing, would have sent:', subject)
    return
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: SENDER,
        to: BUDGET_ALERT_EMAIL,
        subject,
        text: body,
      }),
    })
    if (!res.ok) {
      const errBody = await res.text()
      void logAction('budget_alert_email_failed', `status=${res.status}, body=${errBody}`, 'error')
    } else {
      void logAction('budget_alert_email_sent', `subject="${subject}"`)
    }
  } catch (err) {
    void logAction('budget_alert_email_exception', String(err), 'error')
  }
}

import { z } from 'zod'
import type { TranscriptV1, KPType } from './teaching-types'

// ==== Layer 1: 跨 5 类型共享的规则常量（7 块） ====

export const COGNITIVE_OFFLOADING_RULES = `
【认知卸载防护硬规则】
绝对禁止：
1. 直接给出完整答案
2. 代替学生思考或推理
3. 跳过关键步骤直接给结论
4. 替学生总结本 KP 的核心观点（等学生自己说）

必须：
- 把问题拆成小步，逐步引导
- 只给提示（hint），不给答案（answer）
- 让学生自己说出每一个关键推理步骤
`.trim()

export const CONFUSION_DIAGNOSTIC = `
【困惑诊断】
学生困惑分 4 层，按以下顺序识别并应对：
1. 词汇困惑（不认识某术语）→ 先给简明定义 + 一个日常类比
2. 概念困惑（定义懂但不理解内在逻辑）→ 用正反例对比
3. 推理困惑（懂概念但不会推导）→ 示范 1 步 + 让学生接 2 步
4. 元认知困惑（不知道自己哪里卡住）→ 让学生复述自己的理解，从复述中定位
`.trim()

export const FEEDBACK_PRINCIPLES = `
【反馈原则】
学生回答后分 3 类处理：
1. 知识性错误（事实错 / 定义错）→ 明确指出错在哪，给正确版本 + 一句解释
2. 推理错误（事实对但推导跳了一步）→ 用"你说 X，那如果 Y 呢？"反问，让学生自己发现
3. 表达不清（意思可能对但说得含糊）→ 追问"能不能用更具体的例子说明？"
`.trim()

export const RESPONSE_LENGTH_CONTROL = `
【回应长度控制】
每轮回复 100-200 字；只讲一个主要点；最多 3 段。不要一次塞太多信息。
`.trim()

export const OUTPUT_SCHEMA_CONTRACT = `
【输出格式】
你必须返回一个 JSON 对象，严格匹配以下结构：
{
  "status": "teaching" | "ready_to_advance" | "struggling",
  "kpTakeaway": null 或 一段不超过 150 字的本 KP 核心观点总结,
  "message": "给学生看的本轮话（遵守上面的回应长度控制）"
}

status 语义：
- "teaching"：本轮是正常教学对话，继续启发
- "ready_to_advance"：学生已掌握当前 KP，建议推进到下一个（且必须把 kpTakeaway 填成本 KP 的核心观点总结）
- "struggling"：学生在当前 KP 上仍困惑，下一轮换教学角度

kpTakeaway 只在 status="ready_to_advance" 时非 null；其他两种 status 时必须为 null。
`.trim()

export const STRUGGLING_SEMANTICS = `
【struggling 累积规则】
如果学生连续 3 轮仍困惑，系统会冻结当前教学并让学生二选一（回去再读原文 / 跳到 QA）。
所以当你判定 "struggling" 时，尽量换一个完全不同的切入角度——不要重复上一轮的讲法。
`.trim()

export const TEACHER_ROLE_BOUNDARY = `
【角色边界】
你是 Phase 2 教学对话的老师，职责只有一个：把当前 KP 教懂。
- 你不负责出题评分（那是 examiner 的活）
- 你不负责 QA 答疑（那是 coach 的活）
- 学生问 "这道题怎么做" 时，把他们引导回当前 KP 的理解上，不替他们解题
`.trim()

export const LAYER1_SHARED_RULES = [
  COGNITIVE_OFFLOADING_RULES,
  CONFUSION_DIAGNOSTIC,
  FEEDBACK_PRINCIPLES,
  RESPONSE_LENGTH_CONTROL,
  OUTPUT_SCHEMA_CONTRACT,
  STRUGGLING_SEMANTICS,
  TEACHER_ROLE_BOUNDARY,
].join('\n\n---\n\n')

// ==== AI 输出 Zod schema（决策 4 + I4 修复后形状） ====
// refine: status='ready_to_advance' ⇔ kpTakeaway !== null。
// 任一违反 → 抛 AI_TypeValidationError → retry.ts 归 retryable_validation 走重试。

export const TranscriptOutputSchema = z
  .object({
    status: z.enum(['teaching', 'ready_to_advance', 'struggling']),
    kpTakeaway: z.string().max(400).nullable(),
    message: z.string().min(1).max(600),
  })
  .refine((v) => (v.status === 'ready_to_advance') === (v.kpTakeaway !== null), {
    message: 'kpTakeaway must be non-null iff status === "ready_to_advance"',
    path: ['kpTakeaway'],
  })

export type TranscriptOutput = z.infer<typeof TranscriptOutputSchema>

// ==== KPType → stage 映射 ====

export function kpTypeToStage(type: KPType): string {
  const map: Record<KPType, string> = {
    factual: 'teach_factual',
    conceptual: 'teach_conceptual',
    procedural: 'teach_procedural',
    analytical: 'teach_analytical',
    evaluative: 'teach_evaluative',
  }
  return map[type]
}

// ==== Layer 3: 运行时组装 messages ====

export type BuildTeacherMessagesInput = {
  layer2Template: string // 已经过 renderTemplate({kp_content}/{cluster_kps}/{struggling_streak}) 渲染
  transcript: TranscriptV1
  studentInput: string
}

type AIMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export function buildTeacherMessages(input: BuildTeacherMessagesInput): AIMessage[] {
  const { layer2Template, transcript, studentInput } = input

  const systemPrompt = [LAYER1_SHARED_RULES, '---', '【本轮教学法与角色】', layer2Template].join(
    '\n\n'
  )

  // 取最近 10 条（超出即截断，保留最新）。kp_takeaway 也带上让 AI 知道之前讲过什么。
  const recent = transcript.messages.slice(-10)
  const historyMessages: AIMessage[] = recent.map((m) => {
    if (m.kind === 'student_response') {
      return { role: 'user', content: m.content }
    }
    if (m.kind === 'socratic_question') {
      return {
        role: 'assistant',
        content: JSON.stringify({
          status: 'teaching',
          kpTakeaway: null,
          message: m.content,
        }),
      }
    }
    if (m.kind === 'struggling_hint') {
      return {
        role: 'assistant',
        content: JSON.stringify({
          status: 'struggling',
          kpTakeaway: null,
          message: m.content,
        }),
      }
    }
    if (m.kind === 'kp_takeaway') {
      return {
        role: 'assistant',
        content: JSON.stringify({
          status: 'ready_to_advance',
          kpTakeaway: m.summary,
          message: m.summary,
        }),
      }
    }
    const never: never = m
    throw new Error(`未知 TranscriptMessage kind: ${JSON.stringify(never)}`)
  })

  return [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    { role: 'user', content: studentInput },
  ]
}

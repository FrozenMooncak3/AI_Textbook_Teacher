import { UserError } from '@/lib/errors'

const PRICING_TABLE: Record<string, { input: number; output: number }> = {
  'deepseek:deepseek-chat': { input: 1.94, output: 7.92 },
  'qwen:qwen3-max': { input: 0.83, output: 4.95 },
  'google:gemini-2.5-flash': { input: 2.16, output: 18 },
  'anthropic:claude-sonnet-4-6': { input: 21.6, output: 108 },
}

const TOKENS_PER_PAGE_INPUT = 800
const TOKENS_OUTPUT_PER_MODULE = 4000
const ESTIMATED_MODULES_PER_BOOK = 4

export function estimateBookCostYuan(pageCount: number, modelId: string): number {
  const pricing = PRICING_TABLE[modelId]
  if (!pricing) {
    throw new Error(`Unknown model for cost estimation: ${modelId}`)
  }
  const inputTokens = pageCount * TOKENS_PER_PAGE_INPUT
  const outputTokens = TOKENS_OUTPUT_PER_MODULE * ESTIMATED_MODULES_PER_BOOK
  const yuan = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
  return Number(yuan.toFixed(4))
}

export const MAX_PER_BOOK_YUAN = Number(process.env.MONTHLY_BUDGET_PER_BOOK ?? '1.5')

export function assertWithinBookBudget(estimateYuan: number): void {
  if (estimateYuan > MAX_PER_BOOK_YUAN) {
    throw new UserError(
      `教材成本估算 ${estimateYuan.toFixed(2)} 元超出单本上限 ${MAX_PER_BOOK_YUAN} 元，请减少页数或联系我们升级`,
      'BOOK_BUDGET_EXCEEDED',
      400
    )
  }
}

/**
 * 实算单次 LLM 调用成本（Task 2.5 teaching messages / Task 2.4 KP 抽取共用）。
 * usage 字段沿用 ai-sdk v5 形态：{ promptTokens, completionTokens }。
 * 未知 model 抛 Error（避免静默把成本计为 0 漏统计）。
 */
export interface MessageUsage {
  promptTokens: number
  completionTokens: number
}

export function computeMessageCost(modelId: string, usage: MessageUsage): number {
  const pricing = PRICING_TABLE[modelId]
  if (!pricing) {
    throw new Error(`Unknown model for cost computation: ${modelId}`)
  }
  const yuan =
    (usage.promptTokens * pricing.input + usage.completionTokens * pricing.output) /
    1_000_000
  return Number(yuan.toFixed(4))
}

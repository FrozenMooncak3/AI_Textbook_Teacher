import { createProviderRegistry, wrapLanguageModel } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModelV3Middleware } from '@ai-sdk/provider'

function getCustomFetch(): typeof globalThis.fetch | undefined {
  const proxy =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy

  if (!proxy) {
    return undefined
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ProxyAgent, fetch: undiciFetch } = require('undici') as typeof import('undici')
  const proxyAgent = new ProxyAgent(proxy)

  return (async (url: string | URL | Request, init?: RequestInit) => {
    const response = await undiciFetch(url as string, {
      ...(init ?? {}),
      dispatcher: proxyAgent,
    } as Parameters<typeof undiciFetch>[1])

    const body = await response.arrayBuffer()
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    })
  }) as typeof globalThis.fetch
}

const customFetch = getCustomFetch()

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  ...(customFetch ? { fetch: customFetch } : {}),
})

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  ...(customFetch ? { fetch: customFetch } : {}),
})

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
  ...(customFetch ? { fetch: customFetch } : {}),
})

const DEEPSEEK_QWEN_MAX_OUTPUT_TOKENS = 8192

// DeepSeek/Qwen OpenAI-compatible chat APIs support `json_object`, but not `json_schema`.
// They also silently truncate oversized JSON when callers forward Gemini-sized budgets such as 65536.
// Clamp these wrapped providers to their real 8192 output ceiling here; Gemini/Anthropic/OpenAI do not
// use this middleware, so their larger budgets and native structured-output paths stay unchanged.
const downgradeJsonSchemaMiddleware: LanguageModelV3Middleware = {
  specificationVersion: 'v3',
  transformParams: async ({ params }) => {
    const updated: typeof params = { ...params }
    let changed = false

    if (params.responseFormat?.type === 'json' && params.responseFormat.schema) {
      updated.responseFormat = { type: 'json' as const }
      changed = true
    }

    if (
      params.maxOutputTokens &&
      params.maxOutputTokens > DEEPSEEK_QWEN_MAX_OUTPUT_TOKENS
    ) {
      updated.maxOutputTokens = DEEPSEEK_QWEN_MAX_OUTPUT_TOKENS
      changed = true
    }

    return changed ? updated : params
  },
}

// D5 (2026-04-25): DeepSeek V3.2 via OpenAI-compat baseURL (避免新依赖)
const deepseekRaw = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
  ...(customFetch ? { fetch: customFetch } : {}),
})
const deepseek = {
  ...deepseekRaw,
  languageModel: (modelId: string) =>
    wrapLanguageModel({
      model: deepseekRaw.chat(modelId),
      middleware: downgradeJsonSchemaMiddleware,
    }),
}

// D5 (2026-04-25): Qwen3-Max via DashScope OpenAI-compat baseURL
const qwenRaw = createOpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  ...(customFetch ? { fetch: customFetch } : {}),
})
const qwen = {
  ...qwenRaw,
  languageModel: (modelId: string) =>
    wrapLanguageModel({
      model: qwenRaw.chat(modelId),
      middleware: downgradeJsonSchemaMiddleware,
    }),
}

const registry = createProviderRegistry({
  anthropic,
  google,
  openai,
  deepseek,
  qwen,
})

export type ProviderModelId =
  | `anthropic:${string}`
  | `google:${string}`
  | `openai:${string}`
  | `deepseek:${string}`
  | `qwen:${string}`

export const AI_MODEL_ID =
  (process.env.AI_MODEL as ProviderModelId | undefined) || 'anthropic:claude-sonnet-4-6'

export const AI_MODEL_FALLBACK_ID =
  (process.env.AI_MODEL_FALLBACK as ProviderModelId | undefined) || 'qwen:qwen3-max'

export const timeout = 300_000

export function getModel() {
  return registry.languageModel(AI_MODEL_ID)
}

export function getFallbackModel() {
  return registry.languageModel(AI_MODEL_FALLBACK_ID)
}

export { registry }

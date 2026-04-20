import { createProviderRegistry } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'

function getCustomFetch(): typeof globalThis.fetch | undefined {
  const proxy =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy

  if (!proxy) {
    return undefined
  }

  // Dynamic require avoids loading the proxy client when no proxy is configured.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ProxyAgent, fetch: undiciFetch } = require('undici') as typeof import('undici')
  const proxyAgent = new ProxyAgent(proxy)

  return (async (url: string | URL | Request, init?: RequestInit) => {
    const response = await undiciFetch(url as string, {
      ...(init ?? {}),
      dispatcher: proxyAgent,
    } as Parameters<typeof undiciFetch>[1])

    // Read full body then re-wrap with the global Response to avoid
    // stream incompatibility between undici and Turbopack's polyfill.
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

const registry = createProviderRegistry({
  anthropic,
  google,
  openai,
})

type ProviderModelId = `anthropic:${string}` | `google:${string}` | `openai:${string}`

export const AI_MODEL_ID =
  (process.env.AI_MODEL as ProviderModelId | undefined) || 'anthropic:claude-sonnet-4-6'
export const timeout = 300_000

export function getModel() {
  return registry.languageModel(AI_MODEL_ID)
}

export { registry }

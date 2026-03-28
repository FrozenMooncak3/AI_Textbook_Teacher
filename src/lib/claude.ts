import Anthropic from '@anthropic-ai/sdk'
import { ProxyAgent, fetch as undiciFetch } from 'undici'

let client: Anthropic | null = null

export function getClaudeClient(): Anthropic {
  if (client) return client

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY 未配置，请在 .env.local 中设置')
  }

  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy ||
                process.env.HTTP_PROXY  || process.env.http_proxy

  const options: ConstructorParameters<typeof Anthropic>[0] = {
    apiKey,
    timeout: 60_000,
  }

  if (proxy) {
    const proxyAgent = new ProxyAgent(proxy)
    options.fetch = (async (url, init) => {
      const response = await undiciFetch(
        url as string,
        {
          ...(init ?? {}),
          dispatcher: proxyAgent,
        } as unknown as Parameters<typeof undiciFetch>[1]
      )
      return response as unknown as Response
    }) as NonNullable<typeof options.fetch>
  }

  client = new Anthropic(options)
  return client
}

export const CLAUDE_MODEL = 'claude-sonnet-4-6'

import Anthropic from '@anthropic-ai/sdk'
import { HttpsProxyAgent } from 'https-proxy-agent'

let client: Anthropic | null = null

export function getClaudeClient(): Anthropic {
  if (client) return client

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY 未配置，请在 .env.local 中设置')
  }

  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy ||
                process.env.HTTP_PROXY  || process.env.http_proxy

  const options: ConstructorParameters<typeof Anthropic>[0] = { apiKey }

  if (proxy) {
    options.httpAgent = new HttpsProxyAgent(proxy)
  }

  client = new Anthropic(options)
  return client
}

export const CLAUDE_MODEL = 'claude-sonnet-4-6'

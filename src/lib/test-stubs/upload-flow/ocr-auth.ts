type StubState = typeof globalThis & {
  __uploadFlowHeaderUrls: string[]
}

const stubState = globalThis as StubState

export async function buildOcrHeaders(url: string): Promise<Record<string, string>> {
  stubState.__uploadFlowHeaderUrls.push(url)
  return {
    'Content-Type': 'application/json',
    'X-App-Token': 'test-token',
  }
}

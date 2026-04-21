type StubState = typeof globalThis & {
  __uploadFlowLogCalls: unknown[][]
}

const stubState = globalThis as StubState

export async function logAction(...args: unknown[]): Promise<void> {
  stubState.__uploadFlowLogCalls.push(args)
}

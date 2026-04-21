type StubState = typeof globalThis & {
  __confirmLogCalls: unknown[][]
}

const stubState = globalThis as StubState

export async function logAction(...args: unknown[]): Promise<void> {
  stubState.__confirmLogCalls.push(args)
}

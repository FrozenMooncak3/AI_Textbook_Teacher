type StubState = typeof globalThis & {
  __statusRouteLogCalls: unknown[][]
}

const stubState = globalThis as StubState

export async function logAction(...args: unknown[]): Promise<void> {
  stubState.__statusRouteLogCalls.push(args)
}

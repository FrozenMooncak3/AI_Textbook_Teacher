type StubState = typeof globalThis & {
  __booksRouteLogCalls: unknown[][]
}

const stubState = globalThis as StubState

export async function logAction(...args: unknown[]): Promise<void> {
  stubState.__booksRouteLogCalls.push(args)
}

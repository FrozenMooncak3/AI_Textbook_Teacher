type StubState = typeof globalThis & {
  __uploadFlowKpCalls: number[]
}

const stubState = globalThis as StubState

export async function triggerReadyModulesExtraction(bookId: number): Promise<void> {
  stubState.__uploadFlowKpCalls.push(bookId)
}

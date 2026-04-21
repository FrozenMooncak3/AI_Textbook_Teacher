type StubState = typeof globalThis & {
  __confirmBuildObjectKeyCalls: number[]
  __confirmObjectKey?: string
}

const stubState = globalThis as StubState

export function buildObjectKey(bookId: number): string {
  stubState.__confirmBuildObjectKeyCalls.push(bookId)
  return stubState.__confirmObjectKey ?? `books/${bookId}/original.pdf`
}

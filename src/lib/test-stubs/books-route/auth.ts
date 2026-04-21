type StubState = typeof globalThis & {
  __booksRouteUserId?: number
}

const stubState = globalThis as StubState

export async function requireUser(): Promise<{
  id: number
  email: string
  display_name: null
}> {
  return {
    id: stubState.__booksRouteUserId ?? 7,
    email: 'test@example.com',
    display_name: null,
  }
}

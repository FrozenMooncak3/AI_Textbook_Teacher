type StubState = typeof globalThis & {
  __statusRouteRequireBookOwnerCalls: number[]
}

const stubState = globalThis as StubState

export async function requireBookOwner(
  _request: Request,
  bookId: number
): Promise<{
  user: {
    id: number
    email: string
    display_name: null
  }
}> {
  stubState.__statusRouteRequireBookOwnerCalls.push(bookId)

  return {
    user: {
      id: 7,
      email: 'test@example.com',
      display_name: null,
    },
  }
}

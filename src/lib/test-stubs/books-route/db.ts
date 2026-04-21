type InsertCall = {
  sql: string
  params: unknown[]
}

type StubState = typeof globalThis & {
  __booksRouteInsertCalls: InsertCall[]
  __booksRouteInsertId?: number
}

const stubState = globalThis as StubState

export async function insert(sql: string, params: unknown[]): Promise<number> {
  stubState.__booksRouteInsertCalls.push({ sql, params })
  return stubState.__booksRouteInsertId ?? 42
}

export async function query(): Promise<never[]> {
  return []
}

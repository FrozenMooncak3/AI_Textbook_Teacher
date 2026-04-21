type RunCall = {
  sql: string
  params: unknown[]
}

type InsertCall = {
  sql: string
  params: unknown[]
}

type StubState = typeof globalThis & {
  __uploadFlowRunCalls: RunCall[]
  __uploadFlowInsertCalls: InsertCall[]
}

const stubState = globalThis as StubState

export async function run(sql: string, params: unknown[]): Promise<{
  rows: never[]
  rowCount: number
  command: 'UPDATE'
  oid: number
  fields: never[]
}> {
  stubState.__uploadFlowRunCalls.push({ sql, params })
  return { rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] }
}

export async function insert(sql: string, params: unknown[]): Promise<number> {
  stubState.__uploadFlowInsertCalls.push({ sql, params })
  return stubState.__uploadFlowInsertCalls.length
}

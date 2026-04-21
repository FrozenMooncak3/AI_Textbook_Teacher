type QueryCall = {
  sql: string
  params: unknown[]
}

type RunCall = {
  sql: string
  params: unknown[]
}

type ConfirmBook = {
  id: number
  user_id: number
  upload_status: string
  parse_status: string
  file_size: number
} | undefined

type StubState = typeof globalThis & {
  __confirmBook: ConfirmBook
  __confirmQueryCalls: QueryCall[]
  __confirmRunCalls: RunCall[]
  __confirmUpdateRowCount?: number
}

const stubState = globalThis as StubState

export async function queryOne(sql: string, params: unknown[]): Promise<ConfirmBook> {
  stubState.__confirmQueryCalls.push({ sql, params })
  return stubState.__confirmBook
}

export async function run(sql: string, params: unknown[]): Promise<{
  rows: never[]
  rowCount: number
  command: 'UPDATE'
  oid: number
  fields: never[]
}> {
  stubState.__confirmRunCalls.push({ sql, params })
  return {
    rows: [],
    rowCount: stubState.__confirmUpdateRowCount ?? 1,
    command: 'UPDATE',
    oid: 0,
    fields: [],
  }
}

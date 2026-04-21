type QueryCall = {
  sql: string
  params: unknown[]
}

interface BookStatusStubRow {
  id: number
  upload_status: string
  parse_status: string
  kp_extraction_status: string
  ocr_current_page: number | null
  ocr_total_pages: number | null
}

interface ModuleStatusStubRow {
  id: number
  order_index: number
  title: string
  kp_extraction_status: string
}

type StubState = typeof globalThis & {
  __statusRouteBook?: BookStatusStubRow
  __statusRouteModules: ModuleStatusStubRow[]
  __statusRouteQueryOneCalls: QueryCall[]
  __statusRouteQueryCalls: QueryCall[]
}

const stubState = globalThis as StubState

export async function queryOne<T>(sql: string, params: unknown[]): Promise<T | undefined> {
  stubState.__statusRouteQueryOneCalls.push({ sql, params })
  return stubState.__statusRouteBook as T | undefined
}

export async function query<T>(sql: string, params: unknown[]): Promise<T[]> {
  stubState.__statusRouteQueryCalls.push({ sql, params })
  return stubState.__statusRouteModules as T[]
}

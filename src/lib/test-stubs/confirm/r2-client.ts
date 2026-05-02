type StubState = typeof globalThis & {
  __confirmBuildObjectKeyCalls: Array<{ bookId: number; contentType?: string }>
  __confirmObjectKey?: string
  __confirmHeadCalls: Record<string, unknown>[]
  __confirmHeadError?: unknown
  __confirmHeadContentLength?: number
  __confirmR2Buffer?: Buffer
}

const stubState = globalThis as StubState

export function buildObjectKey(bookId: number, contentType?: string): string {
  stubState.__confirmBuildObjectKeyCalls.push({ bookId, contentType })
  return stubState.__confirmObjectKey ?? `books/${bookId}/original.pdf`
}

export function getR2Bucket(): string {
  return process.env.R2_BUCKET ?? 'test-bucket'
}

export function getR2Client(): {
  send: (command: { input: Record<string, unknown> }) => Promise<{ ContentLength: number }>
} {
  return {
    async send(command) {
      stubState.__confirmHeadCalls.push(command.input)
      if (stubState.__confirmHeadError) {
        throw stubState.__confirmHeadError
      }

      return {
        ContentLength: stubState.__confirmHeadContentLength ?? 1_000_000,
      }
    },
  }
}

export async function getR2ObjectBuffer(): Promise<Buffer> {
  return stubState.__confirmR2Buffer ?? Buffer.from('pdf')
}

type StubState = typeof globalThis & {
  __confirmS3Configs: Record<string, unknown>[]
  __confirmHeadCalls: Record<string, unknown>[]
  __confirmHeadError?: unknown
  __confirmHeadContentLength?: number
}

const stubState = globalThis as StubState

export class HeadObjectCommand {
  input: Record<string, unknown>

  constructor(input: Record<string, unknown>) {
    this.input = input
  }
}

export class S3Client {
  constructor(config: Record<string, unknown>) {
    stubState.__confirmS3Configs.push(config)
  }

  async send(command: HeadObjectCommand): Promise<{ ContentLength: number }> {
    stubState.__confirmHeadCalls.push(command.input)
    if (stubState.__confirmHeadError) {
      throw stubState.__confirmHeadError
    }

    return {
      ContentLength: stubState.__confirmHeadContentLength ?? 1_000_000,
    }
  }
}

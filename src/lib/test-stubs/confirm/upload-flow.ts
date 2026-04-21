type UploadFlowCall = {
  bookId: number
  objectKey: string
}

type StubState = typeof globalThis & {
  __confirmUploadFlowCalls: UploadFlowCall[]
}

const stubState = globalThis as StubState

export async function runClassifyAndExtract(bookId: number, objectKey: string): Promise<void> {
  stubState.__confirmUploadFlowCalls.push({ bookId, objectKey })
}

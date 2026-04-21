type TextChunk = {
  index: number
  title: string
  text: string
  startLine: number
  endLine: number
  pageStart: number | null
  pageEnd: number | null
}

type StubState = typeof globalThis & {
  __uploadFlowChunkInputs: string[]
  __uploadFlowChunks: TextChunk[]
}

const stubState = globalThis as StubState

export function chunkText(rawText: string): TextChunk[] {
  stubState.__uploadFlowChunkInputs.push(rawText)
  return stubState.__uploadFlowChunks
}

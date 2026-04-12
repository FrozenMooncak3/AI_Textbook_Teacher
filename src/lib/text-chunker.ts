export interface TextChunk {
  index: number
  title: string
  text: string
  startLine: number
  endLine: number
  pageStart: number | null
  pageEnd: number | null
}

const MAX_CHUNK_CHARS = 35_000
const OVERLAP_LINES = 20
const MAX_HEADING_LENGTH = 120
const PAGE_MARKER = /^--- PAGE (\d+) ---$/

interface Boundary {
  lineIndex: number
  title: string
}

function splitLines(fullText: string): string[] {
  return fullText.replace(/\r\n/g, '\n').split('\n')
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function buildPageMap(lines: string[]): (number | null)[] {
  const pageByLine: (number | null)[] = []
  let currentPage: number | null = null

  for (const line of lines) {
    const match = line.match(PAGE_MARKER)
    if (match) {
      currentPage = parseInt(match[1], 10)
    }

    pageByLine.push(currentPage)
  }

  return pageByLine
}

function isPageMarker(line: string): boolean {
  return PAGE_MARKER.test(line)
}

function isAllCapsHeading(line: string): boolean {
  return (
    /^[A-Z][A-Z0-9\s:,&\-()]{4,}$/.test(line) &&
    /[A-Z]/.test(line) &&
    !/[a-z]/.test(line)
  )
}

function isHeadingLine(line: string): boolean {
  const normalized = normalizeWhitespace(line)
  if (!normalized || normalized.length > MAX_HEADING_LENGTH) {
    return false
  }

  return (
    /^#{1,3}\s+\S/.test(normalized) ||
    /^chapter\s+\d+/i.test(normalized) ||
    /^unit\s+\d+/i.test(normalized) ||
    /^第[一二三四五六七八九十百零〇\d]+[章节篇部分单元]/.test(normalized) ||
    /^[IVXLC]+\.\s+\S+/.test(normalized) ||
    /^\d+(\.\d+){0,2}\s+\S+/.test(normalized) ||
    isAllCapsHeading(normalized)
  )
}

function findHeadingBoundaries(lines: string[]): Boundary[] {
  const boundaries = new Map<number, string>()

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const currentLine = lines[lineIndex]
    if (isPageMarker(currentLine)) {
      continue
    }

    const normalized = normalizeWhitespace(currentLine)
    if (!normalized) {
      continue
    }

    if (boundaries.size === 0) {
      boundaries.set(lineIndex, normalized)
    }

    if (isHeadingLine(normalized)) {
      boundaries.set(lineIndex, normalized)
    }
  }

  if (boundaries.size === 0) {
    boundaries.set(0, 'Part 1')
  }

  return [...boundaries.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([lineIndex, title]) => ({ lineIndex, title }))
}

function estimateChars(lines: string[], startLine: number, endLine: number): number {
  return lines.slice(startLine, endLine + 1).join('\n').length
}

function buildChunk(
  lines: string[],
  index: number,
  startLine: number,
  endLine: number,
  title: string,
  pageByLine: (number | null)[]
): TextChunk {
  const chunkLines = lines
    .slice(startLine, endLine + 1)
    .filter((line) => !isPageMarker(line))
  const pagesInRange = pageByLine
    .slice(startLine, endLine + 1)
    .filter((page): page is number => page !== null)

  return {
    index,
    title,
    text: chunkLines.join('\n'),
    startLine,
    endLine,
    pageStart: pagesInRange.length > 0 ? pagesInRange[0] : null,
    pageEnd: pagesInRange.length > 0 ? pagesInRange[pagesInRange.length - 1] : null,
  }
}

function splitOversizedSection(
  lines: string[],
  startLine: number,
  endLine: number,
  title: string,
  nextIndex: number,
  pageByLine: (number | null)[]
): TextChunk[] {
  const sectionLines = lines.slice(startLine, endLine + 1)
  const sectionText = sectionLines.join('\n')

  if (sectionText.length <= MAX_CHUNK_CHARS) {
    return [buildChunk(lines, nextIndex, startLine, endLine, title, pageByLine)]
  }

  if (sectionLines.length === 1) {
    const rawLine = sectionLines[0]
    const chunks: TextChunk[] = []
    let cursor = 0
    let localIndex = 0
    const singleLinePage = pageByLine[startLine] ?? null

    while (cursor < rawLine.length) {
      const segment = rawLine.slice(cursor, cursor + MAX_CHUNK_CHARS)
      chunks.push({
        index: nextIndex + localIndex,
        title: `${title} (Part ${localIndex + 1})`,
        text: segment,
        startLine,
        endLine,
        pageStart: singleLinePage,
        pageEnd: singleLinePage,
      })

      if (segment.length >= rawLine.length - cursor) {
        break
      }

      cursor += Math.max(1, MAX_CHUNK_CHARS - 500)
      localIndex += 1
    }

    return chunks
  }

  return splitBySize(lines, startLine, endLine, title, nextIndex, pageByLine)
}

function splitBySize(
  lines: string[],
  startLine = 0,
  endLine = lines.length - 1,
  baseTitle = 'Part',
  startingIndex = 0,
  pageByLine: (number | null)[]
): TextChunk[] {
  const chunks: TextChunk[] = []
  let chunkIndex = startingIndex
  let currentStart = startLine

  while (currentStart <= endLine) {
    let currentEnd = currentStart
    let currentLength = 0

    while (currentEnd <= endLine) {
      const nextLineLength = lines[currentEnd].length + 1
      if (currentEnd > currentStart && currentLength + nextLineLength > MAX_CHUNK_CHARS) {
        break
      }

      currentLength += nextLineLength

      if (currentLength >= MAX_CHUNK_CHARS) {
        break
      }

      currentEnd += 1
    }

    if (currentEnd > endLine) {
      currentEnd = endLine
    }

    chunks.push(
      buildChunk(
        lines,
        chunkIndex,
        currentStart,
        currentEnd,
        `${baseTitle} ${chunkIndex - startingIndex + 1}`,
        pageByLine
      )
    )

    if (currentEnd >= endLine) {
      break
    }

    currentStart = Math.max(currentStart + 1, currentEnd - OVERLAP_LINES + 1)
    chunkIndex += 1
  }

  return chunks
}

function groupByBoundaries(
  lines: string[],
  boundaries: Boundary[],
  pageByLine: (number | null)[]
): TextChunk[] {
  const chunks: TextChunk[] = []
  let chunkStart = boundaries[0].lineIndex
  let chunkTitles = [boundaries[0].title]
  let chunkIndex = 0

  for (let index = 0; index < boundaries.length; index += 1) {
    const boundary = boundaries[index]
    const nextBoundary = boundaries[index + 1]
    const sectionEnd = (nextBoundary?.lineIndex ?? lines.length) - 1

    if (sectionEnd < boundary.lineIndex) {
      continue
    }

    const proposedLength = estimateChars(lines, chunkStart, sectionEnd)
    const sectionLength = estimateChars(lines, boundary.lineIndex, sectionEnd)

    if (sectionLength > MAX_CHUNK_CHARS) {
      if (chunkStart < boundary.lineIndex) {
        const title = chunkTitles.length === 1
          ? chunkTitles[0]
          : `${chunkTitles[0]} - ${chunkTitles[chunkTitles.length - 1]}`
        chunks.push(buildChunk(lines, chunkIndex, chunkStart, boundary.lineIndex - 1, title, pageByLine))
        chunkIndex += 1
      }

      const oversizedChunks = splitOversizedSection(
        lines,
        boundary.lineIndex,
        sectionEnd,
        boundary.title,
        chunkIndex,
        pageByLine
      )
      chunks.push(...oversizedChunks)
      chunkIndex += oversizedChunks.length

      if (nextBoundary) {
        chunkStart = nextBoundary.lineIndex
        chunkTitles = [nextBoundary.title]
      }

      continue
    }

    if (proposedLength > MAX_CHUNK_CHARS && chunkTitles.length > 0) {
      const previousBoundary = boundaries[index - 1]
      const previousEnd = boundary.lineIndex - 1
      const title = chunkTitles.length === 1
        ? chunkTitles[0]
        : `${chunkTitles[0]} - ${chunkTitles[chunkTitles.length - 1]}`

      chunks.push(buildChunk(lines, chunkIndex, chunkStart, previousEnd, title, pageByLine))
      chunkIndex += 1
      chunkStart = boundary.lineIndex
      chunkTitles = [boundary.title]
    } else if (index !== 0) {
      chunkTitles.push(boundary.title)
    }

    if (!nextBoundary) {
      const title = chunkTitles.length === 1
        ? chunkTitles[0]
        : `${chunkTitles[0]} - ${chunkTitles[chunkTitles.length - 1]}`
      chunks.push(buildChunk(lines, chunkIndex, chunkStart, sectionEnd, title, pageByLine))
    }
  }

  return chunks
}

export function chunkText(fullText: string): TextChunk[] {
  const lines = splitLines(fullText)
  const pageByLine = buildPageMap(lines)

  if (fullText.length <= MAX_CHUNK_CHARS) {
    const pagesInRange = pageByLine.filter((page): page is number => page !== null)
    return [
      {
        index: 0,
        title: 'Full Text',
        text: lines.filter((line) => !isPageMarker(line)).join('\n'),
        startLine: 0,
        endLine: Math.max(0, lines.length - 1),
        pageStart: pagesInRange.length > 0 ? pagesInRange[0] : null,
        pageEnd: pagesInRange.length > 0 ? pagesInRange[pagesInRange.length - 1] : null,
      },
    ]
  }

  const boundaries = findHeadingBoundaries(lines)

  if (boundaries.length <= 1) {
    if (lines.length === 1 && lines[0].length > MAX_CHUNK_CHARS) {
      return splitOversizedSection(lines, 0, 0, 'Part', 0, pageByLine)
    }

    return splitBySize(lines, 0, lines.length - 1, 'Part', 0, pageByLine)
  }

  return groupByBoundaries(lines, boundaries, pageByLine)
}

export { MAX_CHUNK_CHARS, OVERLAP_LINES }

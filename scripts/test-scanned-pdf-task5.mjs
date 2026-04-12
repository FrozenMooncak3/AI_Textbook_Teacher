import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL } from 'node:url'

const repoRoot = process.cwd()

async function read(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), 'utf8')
}

async function loadTsModule(relativePath) {
  const typescript = await import('typescript')
  const absolutePath = path.join(repoRoot, relativePath)
  const source = await fs.readFile(absolutePath, 'utf8')
  const transpiled = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.ES2022,
      target: typescript.ScriptTarget.ES2022,
    },
    fileName: absolutePath,
  }).outputText

  const tempFile = path.join(
    os.tmpdir(),
    `codex-task5-${path.basename(relativePath, '.ts')}-${Date.now()}-${Math.random().toString(16).slice(2)}.mjs`
  )
  await fs.writeFile(tempFile, transpiled, 'utf8')

  try {
    return await import(`${pathToFileURL(tempFile).href}?t=${Date.now()}`)
  } finally {
    await fs.unlink(tempFile).catch(() => {})
  }
}

test('task 5 source adds page metadata helpers and markdown heading support', async () => {
  const source = await read('src/lib/text-chunker.ts')

  assert.match(source, /pageStart: number \| null/)
  assert.match(source, /pageEnd: number \| null/)
  assert.ok(source.includes("const PAGE_MARKER = /^--- PAGE (\\d+) ---$/"))
  assert.match(source, /function buildPageMap\(lines: string\[\]\): \(number \| null\)\[\]/)
  assert.match(source, /function isPageMarker\(line: string\): boolean/)
  assert.match(source, /\/\^#\{1,3\}\\s\+\\S\/\.test\(normalized\)/)
  assert.doesNotMatch(source, /\^---\+\\s\*page\\s\+\\d\+\\s\*---\+\$/i)
})

test('task 5 chunkText strips page markers and tracks page range for short text', async () => {
  const { chunkText } = await loadTsModule('src/lib/text-chunker.ts')
  const text = [
    '--- PAGE 3 ---',
    '# Intro',
    'Line A',
    '--- PAGE 4 ---',
    'Line B',
  ].join('\n')

  const chunks = chunkText(text)

  assert.equal(chunks.length, 1)
  assert.deepEqual(chunks[0], {
    index: 0,
    title: 'Full Text',
    text: '# Intro\nLine A\nLine B',
    startLine: 0,
    endLine: 4,
    pageStart: 3,
    pageEnd: 4,
  })
})

test('task 5 chunkText uses markdown headings as boundaries and keeps page metadata', async () => {
  const { chunkText } = await loadTsModule('src/lib/text-chunker.ts')
  const introBody = 'A'.repeat(20_000)
  const methodsBody = 'B'.repeat(20_000)
  const text = [
    '--- PAGE 1 ---',
    '# Intro',
    introBody,
    '--- PAGE 2 ---',
    'Bridge text',
    '## Methods',
    methodsBody,
  ].join('\n')

  const chunks = chunkText(text)

  assert.equal(chunks.length, 2)
  assert.equal(chunks[0].title, '# Intro')
  assert.equal(chunks[0].pageStart, 1)
  assert.equal(chunks[0].pageEnd, 2)
  assert.doesNotMatch(chunks[0].text, /--- PAGE \d+ ---/)
  assert.match(chunks[0].text, /Bridge text/)
  assert.equal(chunks[1].title, '## Methods')
  assert.equal(chunks[1].pageStart, 2)
  assert.equal(chunks[1].pageEnd, 2)
  assert.doesNotMatch(chunks[1].text, /--- PAGE \d+ ---/)
})

test('task 5 page markers no longer create heading-based chunks by themselves', async () => {
  const { chunkText } = await loadTsModule('src/lib/text-chunker.ts')
  const text = [
    '--- PAGE 1 ---',
    'A'.repeat(12_000),
    '--- PAGE 2 ---',
    'B'.repeat(12_000),
    '--- PAGE 3 ---',
    'C'.repeat(12_000),
  ].join('\n')

  const chunks = chunkText(text)

  assert.ok(chunks.length >= 1)
  assert.ok(chunks.every((chunk) => /^Part \d+$/.test(chunk.title)))
  assert.ok(chunks.every((chunk) => !/--- PAGE \d+ ---/.test(chunk.text)))
  assert.equal(chunks[0].pageStart, 1)
  assert.equal(chunks[chunks.length - 1].pageEnd, 3)
})

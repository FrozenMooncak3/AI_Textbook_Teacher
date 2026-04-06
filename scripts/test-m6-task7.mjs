import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL } from 'node:url'

const repoRoot = process.cwd()

async function read(relativePath) {
  try {
    return await fs.readFile(path.join(repoRoot, relativePath), 'utf8')
  } catch {
    return ''
  }
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
    `codex-task7-${path.basename(relativePath, '.ts')}-${Date.now()}-${Math.random().toString(16).slice(2)}.mjs`
  )
  await fs.writeFile(tempFile, transpiled, 'utf8')

  try {
    return await import(`${pathToFileURL(tempFile).href}?t=${Date.now()}`)
  } finally {
    await fs.unlink(tempFile).catch(() => {})
  }
}

test('task 7 adds text chunker and kp merger modules', async () => {
  const chunkerSource = await read('src/lib/text-chunker.ts')
  const mergerSource = await read('src/lib/kp-merger.ts')

  assert.notEqual(chunkerSource, '', 'text-chunker.ts should exist')
  assert.notEqual(mergerSource, '', 'kp-merger.ts should exist')
  assert.match(chunkerSource, /export interface TextChunk/)
  assert.match(chunkerSource, /export function chunkText/)
  assert.match(chunkerSource, /MAX_CHUNK_CHARS = 35_000/)
  assert.match(mergerSource, /export function mergeChunkResults/)
  assert.match(mergerSource, /final_knowledge_points/)
  assert.match(mergerSource, /clusters/)
})

test('task 7 chunkText splits long text by headings or overlap fallback', async () => {
  const { chunkText } = await loadTsModule('src/lib/text-chunker.ts')
  const shortText = 'short text'
  const headingBlock = Array.from({ length: 4 }, (_, index) => (
    `Chapter ${index + 1}\n${'content '.repeat(6000)}`
  )).join('\n')
  const plainBlock = 'plain '.repeat(25000)

  const shortChunks = chunkText(shortText)
  const headingChunks = chunkText(headingBlock)
  const plainChunks = chunkText(plainBlock)

  const parsed = {
    shortCount: shortChunks.length,
    shortTitle: shortChunks[0]?.title,
    headingCount: headingChunks.length,
    headingTitles: headingChunks.map((chunk) => chunk.title),
    plainCount: plainChunks.length,
    plainOverlap: plainChunks.length > 1 && plainChunks[1].startLine <= plainChunks[0].endLine,
  }
  assert.equal(parsed.shortCount, 1)
  assert.equal(typeof parsed.shortTitle, 'string')
  assert.ok(parsed.headingCount > 1, 'heading-based text should split into multiple chunks')
  assert.ok(
    parsed.headingTitles.some((title) => /Chapter|Part/.test(title)),
    'chunk titles should reflect detected headings'
  )
  assert.ok(parsed.plainCount > 1, 'plain large text should use fallback chunking')
  assert.equal(parsed.plainOverlap, true, 'fallback chunks should overlap by line range')
})

test('task 7 mergeChunkResults deduplicates repeated modules and KPs', async () => {
  const { mergeChunkResults } = await loadTsModule('src/lib/kp-merger.ts')
  const merged = mergeChunkResults([
    {
      quality_gates: {
        all_sections_have_kp: true,
        calculation_kp_complete: true,
        c2_kp_have_signals: true,
        no_too_wide_kp: true,
        ocr_damaged_marked: true,
        cross_block_merged: true,
        module_ratio_ok: true,
      },
      issues: [],
      final_knowledge_points: [
        {
          kp_code: 'KP-1',
          module_group: 1,
          cluster_name: 'Cluster A',
          section_name: 'Chapter 1',
          description: 'Cell membrane structure',
          type: 'definition',
          importance: 5,
          detailed_content: 'Phospholipid bilayer and proteins',
          ocr_quality: 'good',
        },
      ],
      clusters: [
        { module_group: 1, name: 'Cluster A', kp_codes: ['KP-1'] },
      ],
    },
    {
      quality_gates: {
        all_sections_have_kp: true,
        calculation_kp_complete: true,
        c2_kp_have_signals: true,
        no_too_wide_kp: true,
        ocr_damaged_marked: true,
        cross_block_merged: true,
        module_ratio_ok: true,
      },
      issues: [],
      final_knowledge_points: [
        {
          kp_code: 'KP-7',
          module_group: 1,
          cluster_name: 'Cluster A',
          section_name: 'Chapter 1',
          description: 'Cell membrane structure',
          type: 'definition',
          importance: 5,
          detailed_content: 'Phospholipid bilayer and proteins',
          ocr_quality: 'good',
        },
        {
          kp_code: 'KP-8',
          module_group: 2,
          cluster_name: 'Cluster B',
          section_name: 'Chapter 2',
          description: 'Diffusion and osmosis',
          type: 'calculation',
          importance: 4,
          detailed_content: 'Transport across membranes',
          ocr_quality: 'good',
        },
      ],
      clusters: [
        { module_group: 1, name: 'Cluster A', kp_codes: ['KP-7'] },
        { module_group: 2, name: 'Cluster B', kp_codes: ['KP-8'] },
      ],
    },
  ])

  const parsed = {
    kpCount: merged.final_knowledge_points.length,
    clusterCount: merged.clusters.length,
    moduleGroups: [...new Set(merged.final_knowledge_points.map((kp) => kp.module_group))],
    kpCodes: merged.final_knowledge_points.map((kp) => kp.kp_code),
  }
  assert.equal(parsed.kpCount, 2, 'duplicate KP should be merged away')
  assert.equal(parsed.clusterCount, 2)
  assert.deepEqual(parsed.moduleGroups, [1, 2])
  assert.deepEqual(parsed.kpCodes, ['KP-1', 'KP-2'])
})

test('task 7 extraction service integrates chunking and merge flow', async () => {
  const source = await read('src/lib/services/kp-extraction-service.ts')

  assert.match(source, /from '\.\.\/text-chunker'/)
  assert.match(source, /from '\.\.\/kp-merger'/)
  assert.match(source, /const chunks = chunkText\(/)
  assert.match(source, /if \(chunks\.length === 1\)/)
  assert.match(source, /mergeChunkResults\(/)
  assert.match(source, /chunk [0-9]+\/[0-9]+|chunkIndex \+ 1|chunks\.length/)
})

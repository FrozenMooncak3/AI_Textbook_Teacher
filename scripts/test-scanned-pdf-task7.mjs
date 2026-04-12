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

function createServiceState() {
  return {
    runCalls: [],
    queryCalls: [],
    queryOneCalls: [],
    logCalls: [],
    generateTextCalls: [],
    promptCalls: [],
    chunkTextCalls: [],
    queryImpl() {
      return []
    },
    queryOneImpl() {
      return undefined
    },
    runImpl() {
      return { rows: [] }
    },
    connect() {
      throw new Error('pool.connect should not be used in this test')
    },
  }
}

async function loadServiceModule(relativePath, state) {
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

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-task7-'))
  const servicePath = path.join(tempDir, 'kp-extraction-service.mjs')
  const moduleSource = transpiled
    .replace("'ai'", "'./stubs-ai-sdk.mjs'")
    .replace("'../ai'", "'./stubs-lib-ai.mjs'")
    .replace("'../db'", "'./stubs-db.mjs'")
    .replace("'../errors'", "'./stubs-errors.mjs'")
    .replace("'../kp-merger'", "'./stubs-kp-merger.mjs'")
    .replace("'../log'", "'./stubs-log.mjs'")
    .replace("'../prompt-templates'", "'./stubs-prompts.mjs'")
    .replace("'../text-chunker'", "'./stubs-text-chunker.mjs'")

  await Promise.all([
    fs.writeFile(
      path.join(tempDir, 'stubs-ai-sdk.mjs'),
      [
        'export async function generateText(input) {',
        '  const state = globalThis.__TASK7_STATE__',
        '  state.generateTextCalls.push(input)',
        "  throw new Error('generateText should not run in this test')",
        '}',
      ].join('\n'),
      'utf8'
    ),
    fs.writeFile(
      path.join(tempDir, 'stubs-lib-ai.mjs'),
      [
        'export function getModel() {',
        '  return { provider: "test" }',
        '}',
        'export const timeout = 1000',
      ].join('\n'),
      'utf8'
    ),
    fs.writeFile(
      path.join(tempDir, 'stubs-db.mjs'),
      [
        'export async function query(sql, params = []) {',
        '  const state = globalThis.__TASK7_STATE__',
        '  state.queryCalls.push({ sql, params })',
        '  return state.queryImpl(sql, params)',
        '}',
        'export async function queryOne(sql, params = []) {',
        '  const state = globalThis.__TASK7_STATE__',
        '  state.queryOneCalls.push({ sql, params })',
        '  return state.queryOneImpl(sql, params)',
        '}',
        'export async function run(sql, params = []) {',
        '  const state = globalThis.__TASK7_STATE__',
        '  state.runCalls.push({ sql, params })',
        '  return state.runImpl(sql, params)',
        '}',
        'export const pool = {',
        '  async connect() {',
        '    return globalThis.__TASK7_STATE__.connect()',
        '  },',
        '}',
      ].join('\n'),
      'utf8'
    ),
    fs.writeFile(
      path.join(tempDir, 'stubs-errors.mjs'),
      [
        'export class SystemError extends Error {',
        '  constructor(message, originalError) {',
        '    super(message)',
        '    this.name = "SystemError"',
        '    this.originalError = originalError',
        '  }',
        '}',
      ].join('\n'),
      'utf8'
    ),
    fs.writeFile(
      path.join(tempDir, 'stubs-kp-merger.mjs'),
      [
        'export function mergeChunkResults(results) {',
        '  return results[0]',
        '}',
        'export function mergeModuleGroups(moduleChunks) {',
        '  return { modules: moduleChunks.flat(), mappings: [] }',
        '}',
      ].join('\n'),
      'utf8'
    ),
    fs.writeFile(
      path.join(tempDir, 'stubs-log.mjs'),
      [
        'export async function logAction(action, details, level = "info") {',
        '  const state = globalThis.__TASK7_STATE__',
        '  state.logCalls.push({ action, details, level })',
        '}',
      ].join('\n'),
      'utf8'
    ),
    fs.writeFile(
      path.join(tempDir, 'stubs-prompts.mjs'),
      [
        'export async function getPrompt(...args) {',
        '  const state = globalThis.__TASK7_STATE__',
        '  state.promptCalls.push(args)',
        "  return 'stub-prompt'",
        '}',
      ].join('\n'),
      'utf8'
    ),
    fs.writeFile(
      path.join(tempDir, 'stubs-text-chunker.mjs'),
      [
        'export function chunkText(text) {',
        '  const state = globalThis.__TASK7_STATE__',
        '  state.chunkTextCalls.push(text)',
        '  return [',
        "    { index: 0, title: 'Full Text', text, startLine: 0, endLine: 0, pageStart: 1, pageEnd: 1 },",
        '  ]',
        '}',
      ].join('\n'),
      'utf8'
    ),
    fs.writeFile(servicePath, moduleSource, 'utf8'),
  ])

  globalThis.__TASK7_STATE__ = state

  return {
    module: await import(`${pathToFileURL(servicePath).href}?t=${Date.now()}`),
    async cleanup() {
      delete globalThis.__TASK7_STATE__
      await fs.rm(tempDir, { recursive: true, force: true })
    },
  }
}

test('task 7 source rewires upload and extract routes and adds module-status contract', async () => {
  const serviceSource = await read('src/lib/services/kp-extraction-service.ts')
  const booksRouteSource = await read('src/app/api/books/route.ts')
  const extractRouteSource = await read('src/app/api/books/[bookId]/extract/route.ts')
  const moduleStatusSource = await read('src/app/api/books/[bookId]/module-status/route.ts')
  const apiContractSource = await read('.agents/API_CONTRACT.md')

  assert.match(serviceSource, /export async function syncBookKpStatus\s*\(/)
  assert.match(serviceSource, /export async function triggerReadyModulesExtraction\s*\(/)
  assert.match(serviceSource, /export async function getModuleText\s*\(/)
  assert.equal(
    serviceSource.match(/syncBookKpStatus\(bookId\)/g)?.length ?? 0,
    3,
    'extractModule should sync the book status in success, empty-text, and failure paths'
  )

  assert.match(booksRouteSource, /from '@\/lib\/text-chunker'/)
  assert.match(booksRouteSource, /from '@\/lib\/services\/kp-extraction-service'/)
  assert.match(booksRouteSource, /classify-pdf/)
  assert.match(booksRouteSource, /extract-text/)
  assert.match(booksRouteSource, /const chunks = chunkText\(rawText\)/)
  assert.match(
    booksRouteSource,
    /INSERT INTO modules \(book_id, title, order_index, page_start, page_end, text_status, ocr_status, kp_extraction_status\)/s
  )
  assert.match(booksRouteSource, /nonTextPages > 0 \? 'pending' : 'skipped'/)
  assert.match(booksRouteSource, /void triggerReadyModulesExtraction\(bookId\)/)
  assert.match(booksRouteSource, /if \(ext === 'txt'\)/)
  assert.match(booksRouteSource, /\[userId, title\.trim\(\), rawText, 'done'\]/)

  assert.match(extractRouteSource, /moduleIdParam = url\.searchParams\.get\('moduleId'\)/)
  assert.match(extractRouteSource, /extractModule,\s*getModuleText,\s*triggerReadyModulesExtraction/s)
  assert.doesNotMatch(extractRouteSource, /book\.parse_status !== 'done'/)
  assert.match(extractRouteSource, /Module text not ready/)
  assert.match(extractRouteSource, /extractModule\(id, moduleId, moduleText, mod\.title\)/)
  assert.match(extractRouteSource, /triggerReadyModulesExtraction\(id\)/)
  assert.match(extractRouteSource, /status: 202/)

  assert.notEqual(moduleStatusSource, '', 'module-status route should exist')
  assert.match(moduleStatusSource, /export const GET = handleRoute/)
  assert.match(moduleStatusSource, /ORDER BY order_index ASC/)
  assert.match(moduleStatusSource, /kpStatus: m\.kp_extraction_status/)
  assert.match(moduleStatusSource, /ocrCurrentPage: book\.ocr_current_page \?\? 0/)

  assert.match(apiContractSource, /### `POST \/api\/books\/\[bookId\]\/extract(?:\?moduleId=1)?`/)
  assert.match(apiContractSource, /### `GET \/api\/books\/\[bookId\]\/module-status`/)
  assert.match(apiContractSource, /\[2026-04-12\] \[Codex\] Added per-module extract and module-status API contracts/)
})

test('task 7 syncBookKpStatus derives the aggregate book status and skips empty books', async () => {
  const state = createServiceState()
  state.queryImpl = (sql, params) => {
    if (sql.includes('SELECT kp_extraction_status FROM modules WHERE book_id = $1')) {
      if (params[0] === 5) {
        return [
          { kp_extraction_status: 'completed' },
          { kp_extraction_status: 'processing' },
        ]
      }

      if (params[0] === 6) {
        return []
      }
    }

    return []
  }

  const loaded = await loadServiceModule('src/lib/services/kp-extraction-service.ts', state)
  try {
    assert.equal(typeof loaded.module.syncBookKpStatus, 'function')
    await loaded.module.syncBookKpStatus(5)
    await loaded.module.syncBookKpStatus(6)

    assert.deepEqual(state.runCalls, [
      {
        sql: 'UPDATE books SET kp_extraction_status = $1 WHERE id = $2',
        params: ['processing', 5],
      },
    ])
  } finally {
    await loaded.cleanup()
  }
})

test('task 7 getModuleText slices page ranges and tolerates null or missing markers', async () => {
  const state = createServiceState()
  state.queryOneImpl = (sql, params) => {
    if (sql.includes('SELECT raw_text FROM books WHERE id = $1')) {
      if (params[0] === 1) {
        return {
          raw_text: [
            '--- PAGE 2 ---',
            'Alpha',
            '--- PAGE 3 ---',
            'Beta',
            '--- PAGE 4 ---',
            'Gamma',
          ].join('\n'),
        }
      }

      if (params[0] === 2) {
        return {
          raw_text: [
            '--- PAGE 5 ---',
            'Tail only',
          ].join('\n'),
        }
      }
    }

    return undefined
  }

  const loaded = await loadServiceModule('src/lib/services/kp-extraction-service.ts', state)
  try {
    assert.equal(typeof loaded.module.getModuleText, 'function')
    const normalSlice = await loaded.module.getModuleText(1, 2, 3)
    const tailSlice = await loaded.module.getModuleText(2, 5, 6)
    const missingSlice = await loaded.module.getModuleText(1, 9, 10)
    const nullSlice = await loaded.module.getModuleText(1, null, 4)

    assert.equal(normalSlice, ['--- PAGE 2 ---', 'Alpha', '--- PAGE 3 ---', 'Beta'].join('\n'))
    assert.equal(tailSlice, ['--- PAGE 5 ---', 'Tail only'].join('\n'))
    assert.equal(missingSlice, '')
    assert.equal(nullSlice, '')
  } finally {
    await loaded.cleanup()
  }
})

test('task 7 triggerReadyModulesExtraction keeps going after one module fails', async () => {
  const state = createServiceState()
  state.queryImpl = (sql, params) => {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim()

    if (normalizedSql.startsWith('SELECT id, title, page_start, page_end FROM modules')) {
      return [
        { id: 11, title: 'Broken Module', page_start: null, page_end: null },
        { id: 12, title: 'Ready Module', page_start: null, page_end: null },
      ]
    }

    if (normalizedSql === 'SELECT kp_extraction_status FROM modules WHERE book_id = $1') {
      return [{ kp_extraction_status: 'completed' }]
    }

    return []
  }
  state.runImpl = (sql, params) => {
    if (
      sql === "UPDATE modules SET kp_extraction_status = 'processing' WHERE id = $1" &&
      params[0] === 11
    ) {
      throw new Error('module 11 failed')
    }

    return { rows: [] }
  }

  const loaded = await loadServiceModule('src/lib/services/kp-extraction-service.ts', state)
  try {
    assert.equal(typeof loaded.module.triggerReadyModulesExtraction, 'function')
    await loaded.module.triggerReadyModulesExtraction(3)

    assert.ok(
      state.runCalls.some((call) => (
        call.sql === "UPDATE modules SET kp_extraction_status = 'processing' WHERE id = $1" &&
        call.params[0] === 11
      )),
      'first module should still be attempted'
    )
    assert.ok(
      state.runCalls.some((call) => (
        call.sql === "UPDATE modules SET kp_extraction_status = 'processing' WHERE id = $1" &&
        call.params[0] === 12
      )),
      'later ready modules should still run after a failure'
    )
    assert.ok(
      state.logCalls.some((entry) => entry.action === 'Ready-modules extraction error'),
      'single-module failures should be logged and swallowed'
    )
  } finally {
    await loaded.cleanup()
  }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL } from 'node:url'

const repoRoot = process.cwd()

function makeStage2Result() {
  return {
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
        cluster_name: 'Shared Cluster',
        section_name: 'Section A',
        description: 'Alpha concept',
        type: 'definition',
        importance: 5,
        detailed_content: 'Alpha details',
        ocr_quality: 'good',
      },
      {
        kp_code: 'KP-2',
        module_group: 2,
        cluster_name: 'Shared Cluster',
        section_name: 'Section B',
        description: 'Beta concept',
        type: 'calculation',
        importance: 4,
        detailed_content: 'Beta details',
        ocr_quality: 'uncertain',
      },
      {
        kp_code: 'KP-3',
        module_group: 9,
        cluster_name: 'Secondary Cluster',
        section_name: 'Section C',
        description: 'Gamma concept',
        type: 'position',
        importance: 3,
        detailed_content: 'Gamma details',
        ocr_quality: 'damaged',
      },
    ],
    clusters: [
      { module_group: 1, name: 'Shared Cluster', kp_codes: ['KP-1'] },
      { module_group: 2, name: 'Shared Cluster', kp_codes: ['KP-2'] },
      { module_group: 9, name: 'Secondary Cluster', kp_codes: ['KP-3'] },
    ],
  }
}

async function read(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), 'utf8')
}

function createHarnessState() {
  const clientQueries = []
  const runCalls = []
  const queryCalls = []
  const logCalls = []
  const chunkTextCalls = []
  const mergeCalls = []
  const promptCalls = []
  const generateTextCalls = []
  const queryOneCalls = []

  const client = {
    async query(sql, params = []) {
      clientQueries.push({ sql, params })

      if (sql.includes('INSERT INTO clusters')) {
        const insertedId = clientQueries.filter((entry) => entry.sql.includes('INSERT INTO clusters')).length
        return { rows: [{ id: insertedId }] }
      }

      return { rows: [] }
    },
    release() {
      state.clientReleased = true
    },
  }

  const state = {
    clientQueries,
    runCalls,
    queryCalls,
    logCalls,
    chunkTextCalls,
    mergeCalls,
    promptCalls,
    generateTextCalls,
    queryOneCalls,
    connectCalls: 0,
    clientReleased: false,
    queryOneResult: undefined,
    chunkTextResult: [{ index: 0, title: 'Full Text', text: 'placeholder', startLine: 0, endLine: 0 }],
    chunkTextError: null,
    mergedResult: makeStage2Result(),
    generateTextQueue: [],
    async connect() {
      state.connectCalls += 1
      return client
    },
  }

  return state
}

async function loadServiceModule(sourceText, state) {
  const typescript = await import('typescript')
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-task6-'))
  const servicePath = path.join(tempDir, 'kp-extraction-service.mjs')
  const transpiled = typescript.transpileModule(sourceText, {
    compilerOptions: {
      module: typescript.ModuleKind.ES2022,
      target: typescript.ScriptTarget.ES2022,
    },
    fileName: path.join(repoRoot, 'src/lib/services/kp-extraction-service.ts'),
  }).outputText

  let moduleSource = transpiled
    .replace("'ai'", "'./stubs-ai-sdk.mjs'")
    .replace("'../ai'", "'./stubs-lib-ai.mjs'")
    .replace("'../db'", "'./stubs-db.mjs'")
    .replace("'../errors'", "'./stubs-errors.mjs'")
    .replace("'../kp-merger'", "'./stubs-kp-merger.mjs'")
    .replace("'../log'", "'./stubs-log.mjs'")
    .replace("'../prompt-templates'", "'./stubs-prompts.mjs'")
    .replace("'../text-chunker'", "'./stubs-text-chunker.mjs'")

  if (sourceText.includes('async function writeModuleResults')) {
    moduleSource += '\nexport { writeModuleResults }\n'
  }

  await Promise.all([
    fs.writeFile(
      path.join(tempDir, 'stubs-ai-sdk.mjs'),
      [
        'export async function generateText(input) {',
        '  const state = globalThis.__TASK6_STATE__',
        '  state.generateTextCalls.push(input)',
        '  if (state.generateTextQueue.length === 0) {',
        "    throw new Error('generateText should not run in this test')",
        '  }',
        '  return { text: state.generateTextQueue.shift() }',
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
        'export const timeout = 1_000',
      ].join('\n'),
      'utf8'
    ),
    fs.writeFile(
      path.join(tempDir, 'stubs-db.mjs'),
      [
        'export async function queryOne(sql, params = []) {',
        '  const state = globalThis.__TASK6_STATE__',
        '  state.queryOneCalls.push({ sql, params })',
        '  return state.queryOneResult',
        '}',
        'export async function query(sql, params = []) {',
        '  const state = globalThis.__TASK6_STATE__',
        '  state.queryCalls.push({ sql, params })',
        '  return []',
        '}',
        'export async function run(sql, params = []) {',
        '  const state = globalThis.__TASK6_STATE__',
        '  state.runCalls.push({ sql, params })',
        '  return { rows: [] }',
        '}',
        'export const pool = {',
        '  async connect() {',
        '    return globalThis.__TASK6_STATE__.connect()',
        '  },',
        '}',
      ].join('\n'),
      'utf8'
    ),
    fs.writeFile(
      path.join(tempDir, 'stubs-errors.mjs'),
      [
        'export class SystemError extends Error {',
        '  constructor(message, cause) {',
        '    super(message)',
        '    this.name = "SystemError"',
        '    this.cause = cause',
        '  }',
        '}',
      ].join('\n'),
      'utf8'
    ),
    fs.writeFile(
      path.join(tempDir, 'stubs-kp-merger.mjs'),
      [
        'export function mergeModuleGroups() {',
        "  throw new Error('mergeModuleGroups should not run in this test')",
        '}',
        'export function mergeChunkResults(results) {',
        '  const state = globalThis.__TASK6_STATE__',
        '  state.mergeCalls.push(results)',
        '  return state.mergedResult',
        '}',
      ].join('\n'),
      'utf8'
    ),
    fs.writeFile(
      path.join(tempDir, 'stubs-log.mjs'),
      [
        'export async function logAction(action, details, level = "info") {',
        '  const state = globalThis.__TASK6_STATE__',
        '  state.logCalls.push({ action, details, level })',
        '}',
      ].join('\n'),
      'utf8'
    ),
    fs.writeFile(
      path.join(tempDir, 'stubs-prompts.mjs'),
      [
        'export async function getPrompt(...args) {',
        '  const state = globalThis.__TASK6_STATE__',
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
        '  const state = globalThis.__TASK6_STATE__',
        '  state.chunkTextCalls.push(text)',
        '  if (state.chunkTextError) {',
        '    throw state.chunkTextError',
        '  }',
        '  return state.chunkTextResult',
        '}',
      ].join('\n'),
      'utf8'
    ),
    fs.writeFile(servicePath, moduleSource, 'utf8'),
  ])

  globalThis.__TASK6_STATE__ = state

  try {
    return await import(`${pathToFileURL(servicePath).href}?t=${Date.now()}`)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}

test('task 6 source adds extractModule and keeps legacy extractKPs flow', async () => {
  const source = await read('src/lib/services/kp-extraction-service.ts')

  assert.match(source, /export async function extractModule\s*\(/)
  assert.match(source, /async function writeModuleResults\s*\(\s*moduleId: number,\s*stage2: Stage2Result/s)
  assert.match(source, /UPDATE modules SET kp_extraction_status = 'processing' WHERE id = \$1/)
  assert.match(source, /UPDATE modules SET kp_extraction_status = 'completed' WHERE id = \$1/)
  assert.match(source, /UPDATE modules SET kp_extraction_status = 'failed' WHERE id = \$1/)
  assert.match(source, /if \(!moduleText\.trim\(\)\)/)
  assert.match(source, /const chunks = chunkText\(moduleText\)/)
  assert.match(source, /extractChunk\(moduleText,\s*`module \$\{moduleId\}: \$\{moduleName\}`\)/)
  assert.match(source, /mergeChunkResults\(chunkStage2Results\)/)
  assert.match(source, /DELETE FROM knowledge_points WHERE module_id = \$1/)
  assert.match(source, /DELETE FROM clusters WHERE module_id = \$1/)
  assert.match(source, /UPDATE modules SET kp_count = \$1, cluster_count = \$2 WHERE id = \$3/)
  assert.match(source, /export async function extractKPs\(bookId: number\): Promise<void>/)
  assert.match(source, /await writeResultsToDB\(bookId, stage0, stage2\)/)
})

test('task 6 writeModuleResults deletes and reinserts only the target module inside a transaction', async () => {
  const source = await read('src/lib/services/kp-extraction-service.ts')
  const state = createHarnessState()
  const service = await loadServiceModule(source, state)

  assert.equal(typeof service.writeModuleResults, 'function')
  await service.writeModuleResults(42, makeStage2Result())

  const sqls = state.clientQueries.map((entry) => entry.sql.replace(/\s+/g, ' ').trim())
  const clusterInserts = state.clientQueries.filter((entry) => entry.sql.includes('INSERT INTO clusters'))
  const kpInserts = state.clientQueries.filter((entry) => entry.sql.includes('INSERT INTO knowledge_points'))
  const kpParams = kpInserts.map((entry) => entry.params)

  assert.equal(state.connectCalls, 1)
  assert.equal(state.clientReleased, true)
  assert.equal(sqls[0], 'BEGIN')
  assert.equal(sqls[1], 'DELETE FROM knowledge_points WHERE module_id = $1')
  assert.deepEqual(state.clientQueries[1].params, [42])
  assert.equal(sqls[2], 'DELETE FROM clusters WHERE module_id = $1')
  assert.deepEqual(state.clientQueries[2].params, [42])
  assert.equal(clusterInserts.length, 2, 'duplicate cluster names should collapse within one module')
  assert.deepEqual(clusterInserts.map((entry) => entry.params), [
    [42, 'Shared Cluster'],
    [42, 'Secondary Cluster'],
  ])
  assert.equal(kpInserts.length, 3)
  assert.ok(kpParams.every((params) => params[0] === 42), 'all KPs should be written under moduleId')
  assert.deepEqual(
    kpParams.map((params) => params[7]),
    [1, 1, 2],
    'cluster lookup should be keyed by cluster name only'
  )
  assert.deepEqual(state.clientQueries.at(-2)?.params, [3, 2, 42])
  assert.equal(sqls.at(-1), 'COMMIT')
})

test('task 6 extractModule short-circuits empty module text without calling the model', async () => {
  const source = await read('src/lib/services/kp-extraction-service.ts')
  const state = createHarnessState()
  const service = await loadServiceModule(source, state)

  assert.equal(typeof service.extractModule, 'function')
  await service.extractModule(9, 12, '   \n\t  ', 'Module Twelve')

  assert.deepEqual(state.runCalls, [
    {
      sql: "UPDATE modules SET kp_extraction_status = 'processing' WHERE id = $1",
      params: [12],
    },
    {
      sql: "UPDATE modules SET kp_extraction_status = 'completed', kp_count = 0, cluster_count = 0 WHERE id = $1",
      params: [12],
    },
  ])
  assert.equal(state.chunkTextCalls.length, 0)
  assert.equal(state.generateTextCalls.length, 0)
  assert.equal(state.connectCalls, 0)
  assert.deepEqual(
    state.logCalls.map((entry) => [entry.action, entry.level]),
    [
      ['Module KP extraction started', 'info'],
      ['Module KP extraction skipped', 'warn'],
    ]
  )
})

test('task 6 extractModule marks the module failed when chunking throws', async () => {
  const source = await read('src/lib/services/kp-extraction-service.ts')
  const state = createHarnessState()
  state.chunkTextError = new Error('chunk failed')
  const service = await loadServiceModule(source, state)

  await assert.rejects(
    service.extractModule(3, 7, 'Non-empty text', 'Module Seven'),
    /chunk failed/
  )

  assert.deepEqual(state.runCalls, [
    {
      sql: "UPDATE modules SET kp_extraction_status = 'processing' WHERE id = $1",
      params: [7],
    },
    {
      sql: "UPDATE modules SET kp_extraction_status = 'failed' WHERE id = $1",
      params: [7],
    },
  ])
  assert.equal(state.generateTextCalls.length, 0)
  assert.equal(state.connectCalls, 0)
  assert.equal(state.logCalls.at(-1)?.action, 'Module KP extraction failed')
  assert.equal(state.logCalls.at(-1)?.level, 'error')
})

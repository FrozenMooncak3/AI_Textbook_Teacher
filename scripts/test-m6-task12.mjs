import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const repoRoot = process.cwd()

async function read(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), 'utf8')
}

test('task 12 next config raises proxy upload limit to 100mb for app router uploads', async () => {
  const source = await read('next.config.ts')

  assert.match(source, /experimental:\s*\{/)
  assert.match(source, /proxyClientMaxBodySize:\s*'100mb'/)
  assert.doesNotMatch(source, /middlewareClientMaxBodySize/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const repoRoot = process.cwd()

async function readIfExists(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath)
  try {
    return await fs.readFile(absolutePath, 'utf8')
  } catch {
    return null
  }
}

const sharedOcrSource = await readIfExists('src/lib/screenshot-ocr.ts')
const screenshotOcrRouteSource = await readIfExists('src/app/api/books/[bookId]/screenshot-ocr/route.ts')
const screenshotAskRouteSource = await readIfExists('src/app/api/books/[bookId]/screenshot-ask/route.ts')

test('shared screenshot OCR utility exists', () => {
  assert.ok(sharedOcrSource, 'src/lib/screenshot-ocr.ts must exist')
})

test('screenshot-ocr route exists and uses handleRoute', () => {
  assert.ok(screenshotOcrRouteSource, 'screenshot-ocr route must exist')
  assert.match(screenshotOcrRouteSource, /export const POST = handleRoute\(/)
})

test('both screenshot routes use shared OCR utility', () => {
  assert.match(screenshotOcrRouteSource ?? '', /from ['"]@\/lib\/screenshot-ocr['"]/)
  assert.match(screenshotAskRouteSource ?? '', /from ['"]@\/lib\/screenshot-ocr['"]/)
})

test('screenshot-ocr route accepts imageBase64 and returns text plus confidence', () => {
  assert.match(screenshotOcrRouteSource ?? '', /imageBase64/)
  assert.match(screenshotOcrRouteSource ?? '', /confidence/)
  assert.match(screenshotOcrRouteSource ?? '', /text/)
})

test('screenshot-ask route uses handleRoute and prompt templates', () => {
  assert.match(screenshotAskRouteSource ?? '', /export const POST = handleRoute\(/)
  assert.match(screenshotAskRouteSource ?? '', /getPrompt\('assistant', 'screenshot_qa'/)
})

test('screenshot-ask route expects image, text, question request fields', () => {
  assert.match(screenshotAskRouteSource ?? '', /image:\s*/)
  assert.match(screenshotAskRouteSource ?? '', /text:\s*/)
  assert.match(screenshotAskRouteSource ?? '', /question:\s*/)
})

test('screenshot-ask route defines the required chinese system prompt', () => {
  assert.match(screenshotAskRouteSource ?? '', /你是一个教材学习助手/)
  assert.match(screenshotAskRouteSource ?? '', /使用 Markdown 格式/)
})

test('screenshot-ask route returns wrapped data without extractedText', () => {
  assert.doesNotMatch(screenshotAskRouteSource ?? '', /extractedText/)
  assert.match(screenshotAskRouteSource ?? '', /conversationId/)
  assert.match(screenshotAskRouteSource ?? '', /answer/)
})

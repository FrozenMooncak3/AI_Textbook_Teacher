import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const repoRoot = process.cwd()
const routePath = path.join(repoRoot, 'src/app/api/books/[bookId]/screenshot-ask/route.ts')
const routeSource = await fs.readFile(routePath, 'utf8')

test('screenshot ask system prompt teaches instead of repeating screenshot text', () => {
  assert.match(routeSource, /const SCREENSHOT_ASK_SYSTEM_PROMPT = `/)
  assert.match(routeSource, /专业的教材学习导师/)
  assert.match(routeSource, /结合你自身的专业知识/)
  assert.match(routeSource, /主动补充必要的背景知识和解释/)
  assert.match(routeSource, /适当使用加粗、列表、分步骤等让回答易读/)
  assert.match(routeSource, /如果学生的问题比较简单，简洁回答即可，不要过度展开/)
  assert.doesNotMatch(routeSource, /不要编造内容之外的信息/)
})

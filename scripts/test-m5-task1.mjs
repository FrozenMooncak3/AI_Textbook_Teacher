import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const repoRoot = process.cwd()
const dbSource = await fs.readFile(path.join(repoRoot, 'src/lib/db.ts'), 'utf8')
const seedSource = await fs.readFile(path.join(repoRoot, 'src/lib/seed-templates.ts'), 'utf8')

const expectedTemplate = "template_text: '以下是教材内容：\\n{screenshot_text}\\n\\n用户的问题：{user_question}\\n\\n{conversation_history}'"

test('mistakes migration adds question_text column', () => {
  assert.match(
    dbSource,
    /ALTER TABLE mistakes ADD COLUMN question_text TEXT/,
    'db.ts must add mistakes.question_text'
  )
})

test('mistakes migration adds user_answer column', () => {
  assert.match(
    dbSource,
    /ALTER TABLE mistakes ADD COLUMN user_answer TEXT/,
    'db.ts must add mistakes.user_answer'
  )
})

test('mistakes migration adds correct_answer column', () => {
  assert.match(
    dbSource,
    /ALTER TABLE mistakes ADD COLUMN correct_answer TEXT/,
    'db.ts must add mistakes.correct_answer'
  )
})

test('assistant screenshot template is clean chinese text', () => {
  assert.match(
    seedSource,
    new RegExp(expectedTemplate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    'assistant/screenshot_qa template must be clean Chinese text'
  )
})

test('assistant screenshot template preserves runtime variables', () => {
  assert.match(seedSource, /\{screenshot_text\}/, 'template must keep {screenshot_text}')
  assert.match(seedSource, /\{user_question\}/, 'template must keep {user_question}')
  assert.match(seedSource, /\{conversation_history\}/, 'template must keep {conversation_history}')
})

test('seedTemplates upsert loop includes assistant role', () => {
  assert.match(
    seedSource,
    /if \(t\.role === 'assistant'\)/,
    'existing databases must upsert assistant templates too'
  )
})

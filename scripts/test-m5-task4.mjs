import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const repoRoot = process.cwd()
const reviewRespondSource = await fs.readFile(
  path.join(repoRoot, 'src/app/api/review/[scheduleId]/respond/route.ts'),
  'utf8'
)
const testSubmitSource = await fs.readFile(
  path.join(repoRoot, 'src/app/api/modules/[moduleId]/test/submit/route.ts'),
  'utf8'
)

test('review respond response includes correct_answer and explanation', () => {
  assert.match(
    reviewRespondSource,
    /return\s*\{\s*data:\s*\{[\s\S]*correct_answer:\s*question\.correct_answer,[\s\S]*explanation:\s*question\.explanation,[\s\S]*next_question:\s*formatNextQuestion\(nextQuestion\),[\s\S]*\},\s*\}/
  )
})

test('review respond mistakes insert stores question_text user_answer and correct_answer', () => {
  assert.match(
    reviewRespondSource,
    /INSERT INTO mistakes[\s\S]*question_text,\s*user_answer,\s*correct_answer[\s\S]*VALUES \(\?, \?, \?, \?, 'review', \?, 0, \?, \?, \?\)/
  )
  assert.match(reviewRespondSource, /question\.question_text,\s*userAnswer,\s*question\.correct_answer/)
})

test('test submit mistakes insert stores question_text user_answer and correct_answer', () => {
  assert.match(
    testSubmitSource,
    /INSERT INTO mistakes[\s\S]*question_text,\s*user_answer,\s*correct_answer[\s\S]*VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?\)/
  )
  assert.match(testSubmitSource, /const userAnswer = body\.answers\.find\(\(a\) => a\.question_id === q\.id\)/)
  assert.match(testSubmitSource, /q\.question_text,\s*userAnswer\?\.user_answer \?\? '',\s*q\.correct_answer \?\? null/)
})

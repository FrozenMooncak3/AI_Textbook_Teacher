import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const repoRoot = process.cwd()

const migratedFiles = [
  'src/app/api/modules/route.ts',
  'src/app/api/modules/[moduleId]/status/route.ts',
  'src/app/api/modules/[moduleId]/guide/route.ts',
  'src/app/api/modules/[moduleId]/generate-questions/route.ts',
  'src/app/api/modules/[moduleId]/questions/route.ts',
  'src/app/api/modules/[moduleId]/qa-feedback/route.ts',
  'src/app/api/modules/[moduleId]/evaluate/route.ts',
  'src/app/api/modules/[moduleId]/generate-notes/route.ts',
  'src/app/api/modules/[moduleId]/reading-notes/route.ts',
  'src/app/api/modules/[moduleId]/test/route.ts',
  'src/app/api/modules/[moduleId]/test/generate/route.ts',
  'src/app/api/modules/[moduleId]/test/submit/route.ts',
  'src/app/api/modules/[moduleId]/mistakes/route.ts',
  'src/app/api/review/due/route.ts',
  'src/app/api/review/[scheduleId]/generate/route.ts',
  'src/app/api/review/[scheduleId]/respond/route.ts',
  'src/app/api/review/[scheduleId]/complete/route.ts',
  'src/app/api/qa/[questionId]/respond/route.ts',
  'src/lib/services/kp-extraction-service.ts',
]

async function read(relativePath) {
  try {
    return await fs.readFile(path.join(repoRoot, relativePath), 'utf8')
  } catch {
    return ''
  }
}

test('task 4 target files stop importing getDb or using db.prepare', async () => {
  for (const file of migratedFiles) {
    const source = await read(file)
    assert.notEqual(source, '', `${file} should exist`)
    assert.doesNotMatch(source, /getDb/)
    assert.doesNotMatch(source, /db\.prepare\(/)
  }
})

test('task 4 routes await async helpers introduced in postgres migration', async () => {
  const guideRoute = await read('src/app/api/modules/[moduleId]/guide/route.ts')
  const generateQuestionsRoute = await read('src/app/api/modules/[moduleId]/generate-questions/route.ts')
  const qaFeedbackRoute = await read('src/app/api/modules/[moduleId]/qa-feedback/route.ts')
  const evaluateRoute = await read('src/app/api/modules/[moduleId]/evaluate/route.ts')
  const generateNotesRoute = await read('src/app/api/modules/[moduleId]/generate-notes/route.ts')
  const testGenerateRoute = await read('src/app/api/modules/[moduleId]/test/generate/route.ts')
  const testSubmitRoute = await read('src/app/api/modules/[moduleId]/test/submit/route.ts')
  const reviewGenerateRoute = await read('src/app/api/review/[scheduleId]/generate/route.ts')
  const reviewRespondRoute = await read('src/app/api/review/[scheduleId]/respond/route.ts')
  const kpExtractionService = await read('src/lib/services/kp-extraction-service.ts')

  assert.match(guideRoute, /await getPrompt\(/)
  assert.match(guideRoute, /await logAction\(/)

  assert.match(generateQuestionsRoute, /await getPrompt\(/)
  assert.match(generateQuestionsRoute, /await logAction\(/)

  assert.match(qaFeedbackRoute, /await getPrompt\(/)
  assert.match(qaFeedbackRoute, /await logAction\(/)

  assert.match(evaluateRoute, /await recordMistakes\(/)

  assert.match(generateNotesRoute, /await getPrompt\(/)
  assert.match(generateNotesRoute, /await logAction\(/)

  assert.match(testGenerateRoute, /await getPrompt\(/)
  assert.match(testGenerateRoute, /await logAction\(/)

  assert.match(testSubmitRoute, /await getPrompt\(/)
  assert.match(testSubmitRoute, /await logAction\(/)

  assert.match(reviewGenerateRoute, /await getPrompt\(/)
  assert.match(reviewGenerateRoute, /await logAction\(/)

  assert.match(reviewRespondRoute, /await getPrompt\(/)
  assert.match(reviewRespondRoute, /await logAction\(/)

  assert.match(kpExtractionService, /await getPrompt\(/)
  assert.match(kpExtractionService, /await logAction\(/)
})

test('task 4 routes use postgres placeholders and helper calls', async () => {
  const testSubmitRoute = await read('src/app/api/modules/[moduleId]/test/submit/route.ts')
  const reviewGenerateRoute = await read('src/app/api/review/[scheduleId]/generate/route.ts')
  const reviewCompleteRoute = await read('src/app/api/review/[scheduleId]/complete/route.ts')
  const qaRespondRoute = await read('src/app/api/qa/[questionId]/respond/route.ts')
  const kpExtractionService = await read('src/lib/services/kp-extraction-service.ts')

  assert.match(testSubmitRoute, /from '@\/lib\/db'/)
  assert.match(testSubmitRoute, /await query</)
  assert.match(testSubmitRoute, /pool\.connect\(\)/)
  assert.match(testSubmitRoute, /\$1/)

  assert.match(reviewGenerateRoute, /await query</)
  assert.match(reviewGenerateRoute, /pool\.connect\(\)/)
  assert.match(reviewGenerateRoute, /\$1/)

  assert.match(reviewCompleteRoute, /await query</)
  assert.match(reviewCompleteRoute, /pool\.connect\(\)/)
  assert.match(reviewCompleteRoute, /\$1/)

  assert.match(qaRespondRoute, /await insert\(/)
  assert.match(qaRespondRoute, /\$1/)

  assert.match(kpExtractionService, /pool\.connect\(\)/)
  assert.match(kpExtractionService, /await client\.query\('BEGIN'\)/)
  assert.match(kpExtractionService, /await client\.query\('COMMIT'\)/)
})

test('task 4 fixes screenshot ask fallback mojibake string', async () => {
  const screenshotAskRoute = await read('src/app/api/books/[bookId]/screenshot-ask/route.ts')

  assert.match(screenshotAskRoute, /\(鏃犳枃瀛楄瘑鍒粨鏋\?/)
  assert.doesNotMatch(screenshotAskRoute, /\(閺冪姵鏋冪€涙鐦戦崚/)
})

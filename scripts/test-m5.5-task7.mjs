import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const repoRoot = process.cwd()
const routeSource = await fs.readFile(
  path.join(repoRoot, 'src/app/api/modules/[moduleId]/test/submit/route.ts'),
  'utf8'
)

test('test submit imports shared error type normalizer', () => {
  assert.match(
    routeSource,
    /import \{ normalizeReviewErrorType \} from '@\/lib\/review-question-utils'/
  )
})

test('test submit normalizes mc diagnostic error types', () => {
  assert.match(routeSource, /mcr\.error_type = normalizeReviewErrorType\(aiDiag\.error_type\)/)
  assert.match(routeSource, /mcr\.error_type = normalizeReviewErrorType\(null\)/)
})

test('test submit normalizes subjective and mistake insert error types', () => {
  assert.match(
    routeSource,
    /error_type:\s*aiResult\?\.is_correct \? null : normalizeReviewErrorType\(aiResult\?\.error_type\)/
  )
  assert.match(routeSource, /normalizeReviewErrorType\(r\.error_type\)/)
})

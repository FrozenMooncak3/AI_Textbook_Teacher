import test from 'node:test'
import assert from 'node:assert/strict'

let reviewUtils = null

try {
  reviewUtils = await import('../src/lib/review-question-utils.ts')
} catch {
  reviewUtils = null
}

test('review question validator helper exists', () => {
  assert.ok(
    reviewUtils && typeof reviewUtils.validateGeneratedReviewQuestion === 'function',
    'validateGeneratedReviewQuestion helper must exist'
  )
})

test('non-single-choice questions with noisy options are normalized instead of rejected', () => {
  assert.ok(
    reviewUtils && typeof reviewUtils.validateGeneratedReviewQuestion === 'function',
    'validateGeneratedReviewQuestion helper must exist'
  )

  const validated = reviewUtils.validateGeneratedReviewQuestion(
    {
      cluster_id: 11,
      kp_id: 101,
      type: 'essay',
      text: 'Explain osmosis.',
      options: ['A. Water', 'B. Salt'],
      correct_answer: 'Water moves across a semipermeable membrane.',
      explanation: 'The answer should explain solvent movement and membrane selectivity.',
    },
    0,
    new Set([11]),
    new Map([
      [101, {
        id: 101,
        kp_code: 'KP-101',
        description: 'Osmosis',
        type: 'concept',
        detailed_content: 'Water movement through semipermeable membranes.',
        cluster_id: 11,
      }],
    ])
  )

  assert.equal(validated.type, 'essay')
  assert.equal(validated.options, null)
})

test('single-choice questions still require exactly four options', () => {
  assert.ok(
    reviewUtils && typeof reviewUtils.validateGeneratedReviewQuestion === 'function',
    'validateGeneratedReviewQuestion helper must exist'
  )

  assert.throws(
    () => reviewUtils.validateGeneratedReviewQuestion(
      {
        cluster_id: 11,
        kp_id: 101,
        type: 'single_choice',
        text: 'Pick the correct option.',
        options: ['A', 'B', 'C'],
        correct_answer: 'A',
        explanation: 'Only one option is correct.',
      },
      0,
      new Set([11]),
      new Map([
        [101, {
          id: 101,
          kp_code: 'KP-101',
          description: 'Osmosis',
          type: 'concept',
          detailed_content: 'Water movement through semipermeable membranes.',
          cluster_id: 11,
        }],
      ])
    ),
    /must include 4 options/
  )
})

test('review scoring output budget meets the minimum standard', () => {
  assert.equal(
    reviewUtils?.REVIEW_SCORING_MAX_OUTPUT_TOKENS,
    8192,
    'review scoring output budget must be at least 8192'
  )
})

test('review error_type normalizer helper exists', () => {
  assert.ok(
    reviewUtils && typeof reviewUtils.normalizeReviewErrorType === 'function',
    'normalizeReviewErrorType helper must exist'
  )
})

test('review error_type normalizer keeps valid values', () => {
  assert.equal(reviewUtils?.normalizeReviewErrorType('careless'), 'careless')
})

test('review error_type normalizer maps concept_confusion to confusion', () => {
  assert.equal(reviewUtils?.normalizeReviewErrorType('concept_confusion'), 'confusion')
})

test('review error_type normalizer maps knowledge_gap to blind_spot', () => {
  assert.equal(reviewUtils?.normalizeReviewErrorType('knowledge_gap'), 'blind_spot')
})

test('review error_type normalizer defaults unknown values to confusion', () => {
  assert.equal(reviewUtils?.normalizeReviewErrorType('totally_new_label'), 'confusion')
  assert.equal(reviewUtils?.normalizeReviewErrorType(null), 'confusion')
})

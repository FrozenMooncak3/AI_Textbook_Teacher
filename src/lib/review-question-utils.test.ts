import assert from 'node:assert/strict'
import test from 'node:test'

interface ReviewClusterRow {
  id: number
  name: string
  current_p_value: number
}

interface ReviewAllocationRow {
  clusterId: number
  pValue: number
  count: number
}

async function getBuildAllocations(): Promise<
  (clusters: ReviewClusterRow[]) => ReviewAllocationRow[]
> {
  const utils = await import(new URL('./review-question-utils.ts', import.meta.url).href) as Record<
    string,
    unknown
  >

  assert.equal(utils.MAX_REVIEW_QUESTIONS, 10)
  assert.equal(typeof utils.buildAllocations, 'function')

  return utils.buildAllocations as (clusters: ReviewClusterRow[]) => ReviewAllocationRow[]
}

test('buildAllocations keeps each cluster count aligned with p value when under the cap', async () => {
  const buildAllocations = await getBuildAllocations()

  assert.deepEqual(
    buildAllocations([
      { id: 1, name: 'Cluster 1', current_p_value: 1 },
      { id: 2, name: 'Cluster 2', current_p_value: 2 },
      { id: 3, name: 'Cluster 3', current_p_value: 3 },
    ]),
    [
      { clusterId: 1, pValue: 1, count: 1 },
      { clusterId: 2, pValue: 2, count: 2 },
      { clusterId: 3, pValue: 3, count: 3 },
    ]
  )
})

test('buildAllocations scales down heavy review sets to the shared max question budget', async () => {
  const buildAllocations = await getBuildAllocations()

  assert.deepEqual(
    buildAllocations([
      { id: 1, name: 'Cluster 1', current_p_value: 4 },
      { id: 2, name: 'Cluster 2', current_p_value: 4 },
      { id: 3, name: 'Cluster 3', current_p_value: 4 },
      { id: 4, name: 'Cluster 4', current_p_value: 4 },
    ]),
    [
      { clusterId: 1, pValue: 4, count: 2 },
      { clusterId: 2, pValue: 4, count: 2 },
      { clusterId: 3, pValue: 4, count: 3 },
      { clusterId: 4, pValue: 4, count: 3 },
    ]
  )
})

test('buildAllocations clamps invalid non-positive p values up to one question', async () => {
  const buildAllocations = await getBuildAllocations()

  assert.deepEqual(
    buildAllocations([
      { id: 1, name: 'Cluster 1', current_p_value: 0 },
      { id: 2, name: 'Cluster 2', current_p_value: -3 },
    ]),
    [
      { clusterId: 1, pValue: 1, count: 1 },
      { clusterId: 2, pValue: 1, count: 1 },
    ]
  )
})

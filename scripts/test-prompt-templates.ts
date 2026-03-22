import { renderTemplate } from '../src/lib/prompt-templates.ts'

// Test 1: basic substitution
const r1 = renderTemplate('Hello {name}, you have {count} items.', { name: 'Alice', count: '3' })
console.assert(r1 === 'Hello Alice, you have 3 items.', `FAIL: got "${r1}"`)

// Test 2: unmatched placeholders preserved
const r2 = renderTemplate('Hello {name}, {unknown} here.', { name: 'Bob' })
console.assert(r2 === 'Hello Bob, {unknown} here.', `FAIL: got "${r2}"`)

// Test 3: empty variables object
const r3 = renderTemplate('{a} and {b}', {})
console.assert(r3 === '{a} and {b}', `FAIL: got "${r3}"`)

console.log('All prompt template tests passed')

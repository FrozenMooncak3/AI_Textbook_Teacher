import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const repoRoot = process.cwd()

async function read(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), 'utf8')
}

test('task 11 register route allows empty invite code but still validates provided codes', async () => {
  const source = await read('src/app/api/auth/register/route.ts')

  assert.doesNotMatch(source, /Invite code is required/)
  assert.doesNotMatch(source, /MISSING_INVITE_CODE/)
  assert.match(source, /if \(inviteCode\) \{/)
  assert.match(source, /Invite code not found/)
  assert.match(source, /INVITE_CODE_EXHAUSTED/)
  assert.match(source, /UPDATE invite_codes SET used_count = used_count \+ 1 WHERE code = \$1/)
})

test('task 11 register page marks invite code as optional and no longer requires it', async () => {
  const source = await read('src/app/(auth)/register/page.tsx')
  const inviteSectionMatch = source.match(
    /<label className="mb-1 block text-sm font-medium text-gray-700">Invite Code \(optional\)<\/label>[\s\S]*?<input[\s\S]*?value=\{inviteCode\}[\s\S]*?\/>/
  )

  assert.match(source, /Invite Code \(optional\)/)
  assert.ok(inviteSectionMatch, 'invite code input block should exist')
  assert.doesNotMatch(inviteSectionMatch[0], /\brequired\b/)
  assert.match(source, /body: JSON\.stringify\(\{ email, password, displayName, inviteCode \}\)/)
})

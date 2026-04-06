import { run } from '../src/lib/db'

const codes = ['BETA-001', 'BETA-002', 'BETA-003', 'BETA-004', 'BETA-005']

async function seed(): Promise<void> {
  for (const code of codes) {
    await run(
      'INSERT INTO invite_codes (code, max_uses) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [code, 10]
    )
  }

  console.log(`Seeded ${codes.length} invite codes`)
}

seed().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})

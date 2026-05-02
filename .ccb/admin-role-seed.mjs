// One-off admin: set role='admin' for the dev account.
// Reads DATABASE_URL from .env.local. Logs before/after for audit.
import fs from 'node:fs';
import pg from 'pg';

const envText = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const TARGET_EMAIL = 'frozenmooncak3@gmail.com';
const NEW_ROLE = 'admin';

if (!env.DATABASE_URL) {
  console.error('DATABASE_URL is required in .env.local');
  process.exit(1);
}

const c = new pg.Client({ connectionString: env.DATABASE_URL });
await c.connect();
console.log('connected to DB (host masked)');

const before = await c.query(
  'SELECT id, email, role FROM users WHERE email = $1',
  [TARGET_EMAIL],
);
console.log('BEFORE:', before.rows);
if (before.rows.length === 0) {
  console.error('user not found - abort');
  await c.end();
  process.exit(1);
}

const result = await c.query(
  'UPDATE users SET role = $1 WHERE email = $2 RETURNING id, email, role',
  [NEW_ROLE, TARGET_EMAIL],
);
console.log('AFTER:', result.rows);

await c.end();
console.log('done.');

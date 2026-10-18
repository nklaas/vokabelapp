// Saves the whole database as one JSON file in backups/ (git-ignored).
// Run with: npm run backup
//
// With SUPABASE_SECRET_KEY in .env.local the backup contains every account's progress.
// Without it, it logs in as you and contains the shared word pool plus your own progress.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { connectAsAdmin, connectAsUser } from './lib/client.ts'

const TABLES = ['profiles', 'clusters', 'vocab', 'vocab_notes', 'cards', 'reviews', 'settings']
const PAGE = 1000 // Supabase returns at most 1000 rows per request

const admin = connectAsAdmin()
const client = admin ?? (await connectAsUser())

const data: Record<string, unknown[]> = {}
for (const table of TABLES) {
  const rows: unknown[] = []
  for (let from = 0; ; from += PAGE) {
    const { data: page, error } = await client.from(table).select('*').range(from, from + PAGE - 1)
    if (error) {
      console.error(`Reading ${table} failed: ${error.message}`)
      process.exit(1)
    }
    rows.push(...page)
    if (page.length < PAGE) break
  }
  data[table] = rows
  console.log(`${table.padEnd(12)} ${rows.length} rows`)
}

const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
mkdirSync('backups', { recursive: true })
const file = join('backups', `backup-${stamp}.json`)
writeFileSync(file, JSON.stringify({
  created_at: new Date().toISOString(),
  scope: admin ? 'all accounts' : 'shared pool + own progress',
  data,
}, null, 2))

console.log(`\nSaved ${file} (${admin ? 'all accounts' : 'shared pool + your own progress only'})`)

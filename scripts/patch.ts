// Changes single fields of words that are already in the pool, leaving everything else as it is.
// Run with: npm run patch -- vocab/<file>.json [--dry-run]
//
// File: { "language": "en", "words": [{ "term": "contentious", "also_correct": ["controversial"] }, …] }
// Each word is found by its term (and word_type, if given); only the other fields listed are written.
import { readFileSync } from 'node:fs'
import { connectAsUser } from './lib/client.ts'

const FIELDS = ['translations', 'ipa', 'gender', 'plural', 'forms', 'region', 'synonyms', 'also_correct',
  'example', 'example_de', 'notes', 'level', 'tags']

const args = process.argv.slice(2)
const path = args.find((a) => !a.startsWith('--'))
const dryRun = args.includes('--dry-run')
if (!path) {
  console.error('Usage: npm run patch -- vocab/<file>.json [--dry-run]')
  process.exit(1)
}

interface Patch { term: string; word_type?: string; [field: string]: unknown }
const file = JSON.parse(readFileSync(path, 'utf8')) as { language: 'en' | 'es'; words: Patch[] }

const db = await connectAsUser()
const { data: existing, error } = await db.from('vocab').select('id, term, word_type').eq('language', file.language)
if (error) throw error

let problems = 0
const updates: { id: string; term: string; data: Record<string, unknown> }[] = []
for (const { term, word_type, ...rest } of file.words) {
  const matches = existing.filter(
    (v) => v.term.toLowerCase() === term.toLowerCase() && (!word_type || v.word_type === word_type),
  )
  const unknown = Object.keys(rest).filter((k) => !FIELDS.includes(k))
  if (matches.length !== 1 || unknown.length || !Object.keys(rest).length) {
    console.error(`! ${term}: ${matches.length !== 1 ? `${matches.length} matching words` : unknown.length ? `unknown field ${unknown.join(', ')}` : 'nothing to change'}`)
    problems++
  } else {
    updates.push({ id: matches[0].id, term, data: rest })
  }
}
if (problems) {
  console.error(`\nNothing written, ${problems} problem(s).`)
  process.exit(1)
}

for (const u of updates) {
  if (!dryRun) {
    const { error } = await db.from('vocab').update(u.data).eq('id', u.id)
    if (error) {
      console.error(`! failed ${u.term}: ${error.message}`)
      process.exit(1)
    }
  }
  console.log(`~ ${u.term}: ${Object.keys(u.data).join(', ')}`)
}
console.log(`\n${dryRun ? 'DRY RUN – nothing written. ' : ''}${updates.length} words changed.`)

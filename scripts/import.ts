// Imports a vocab file into the shared pool.
// Run with: npm run import -- vocab/<file>.json [--dry-run] [--update]
//
// - new words are inserted
// - a draft with the same term is completed (updated, keeps who added it)
// - a complete word with the same term and type is skipped, or overwritten with --update
// - clusters are created when they don't exist yet
import { readFileSync } from 'node:fs'
import { connectAsUser } from './lib/client.ts'
import { validate, type VocabFile, type WordIn } from './lib/vocab-file.ts'

const args = process.argv.slice(2)
const path = args.find((a) => !a.startsWith('--'))
const dryRun = args.includes('--dry-run')
const overwrite = args.includes('--update')

if (!path) {
  console.error('Usage: npm run import -- vocab/<file>.json [--dry-run] [--update]')
  process.exit(1)
}

const file = JSON.parse(readFileSync(path, 'utf8')) as VocabFile
const problems = validate(file)
if (problems.length) {
  console.error(`Not imported, ${problems.length} problem(s):\n- ${problems.join('\n- ')}`)
  process.exit(1)
}

const db = await connectAsUser()

const { data: clusters, error: clusterError } = await db.from('clusters').select('id, name').eq('language', file.language)
if (clusterError) throw clusterError
const clusterIds = new Map(clusters.map((c) => [c.name.toLowerCase(), c.id as string]))

const { data: existing, error: vocabError } = await db
  .from('vocab')
  .select('id, term, word_type, is_draft')
  .eq('language', file.language)
if (vocabError) throw vocabError

async function clusterId(name: string): Promise<string> {
  const known = clusterIds.get(name.toLowerCase())
  if (known) return known
  if (dryRun) return `(new cluster "${name}")`
  const { data, error } = await db
    .from('clusters')
    .insert({ language: file.language, name, description: name === file.cluster ? file.cluster_description ?? null : null })
    .select('id')
    .single()
  if (error) throw error
  console.log(`+ cluster "${name}"`)
  clusterIds.set(name.toLowerCase(), data.id)
  return data.id
}

async function row(w: WordIn) {
  return {
    language: file.language,
    cluster_id: await clusterId(w.cluster ?? file.cluster!),
    term: w.term.trim(),
    word_type: w.word_type,
    translations: w.translations,
    level: w.level,
    ipa: w.ipa ?? null,
    gender: w.gender ?? null,
    plural: w.plural ?? null,
    forms: w.forms ?? null,
    region: w.region ?? null,
    synonyms: w.synonyms ?? [],
    example: w.example ?? null,
    example_de: w.example_de ?? null,
    notes: w.notes ?? null,
    tags: w.tags ?? [],
    is_draft: false,
  }
}

const counts = { inserted: 0, completed: 0, updated: 0, skipped: 0 }

for (const w of file.words) {
  const term = w.term.trim().toLowerCase()
  const draft = existing.find((v) => v.is_draft && v.term.toLowerCase() === term)
  const same = existing.find((v) => !v.is_draft && v.term.toLowerCase() === term && v.word_type === w.word_type)

  if (same && !overwrite) {
    console.log(`= skipped   ${w.term} (already in the pool)`)
    counts.skipped++
    continue
  }

  const target = draft ?? same
  const label = draft ? 'completed' : same ? 'updated' : 'inserted'
  if (!dryRun) {
    const data = await row(w)
    const { error } = target
      ? await db.from('vocab').update(data).eq('id', target.id)
      : await db.from('vocab').insert(data)
    if (error) {
      console.error(`! failed    ${w.term}: ${error.message}`)
      process.exit(1)
    }
  }
  console.log(`${draft ? '✓' : same ? '~' : '+'} ${label.padEnd(9)} ${w.term}`)
  counts[label]++
}

console.log(
  `\n${dryRun ? 'DRY RUN – nothing written. ' : ''}` +
    `${counts.inserted} new, ${counts.completed} drafts completed, ${counts.updated} updated, ${counts.skipped} skipped.`,
)

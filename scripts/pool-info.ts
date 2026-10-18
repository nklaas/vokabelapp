// Information about the shared pool for Claude Code.
//   npm run pool -- terms en|es    all terms of a language, grouped by cluster (to avoid duplicates)
//   npm run pool -- drafts         all drafts waiting to be completed, as JSON
//   npm run pool -- clusters       all clusters with their word counts
import { connectAsUser } from './lib/client.ts'

const [command, language] = process.argv.slice(2)
const db = await connectAsUser()

const [{ data: vocab, error: e1 }, { data: clusters, error: e2 }, { data: profiles, error: e3 }] = await Promise.all([
  db.from('vocab').select('id, language, term, word_type, is_draft, notes, cluster_id, created_by').limit(10000),
  db.from('clusters').select('id, language, name'),
  db.from('profiles').select('user_id, display_name'),
])
if (e1 || e2 || e3) throw e1 ?? e2 ?? e3

const clusterName = new Map(clusters.map((c) => [c.id, c.name]))

if (command === 'terms' && (language === 'en' || language === 'es')) {
  const groups = new Map<string, string[]>()
  for (const v of vocab.filter((v) => v.language === language)) {
    const name = v.is_draft ? '(drafts)' : clusterName.get(v.cluster_id) ?? '(no cluster)'
    groups.set(name, [...(groups.get(name) ?? []), v.term])
  }
  if (!groups.size) console.log(`No ${language} words yet.`)
  for (const [name, terms] of [...groups].sort()) console.log(`${name} (${terms.length}): ${terms.sort().join(', ')}`)
} else if (command === 'drafts') {
  const author = new Map(profiles.map((p) => [p.user_id, p.display_name]))
  const drafts = vocab
    .filter((v) => v.is_draft)
    .map((v) => ({ language: v.language, term: v.term, context: v.notes, added_by: author.get(v.created_by) ?? '?' }))
  console.log(JSON.stringify(drafts, null, 2))
} else if (command === 'clusters') {
  for (const c of clusters.sort((a, b) => a.language.localeCompare(b.language) || a.name.localeCompare(b.name))) {
    console.log(`${c.language}  ${c.name} (${vocab.filter((v) => v.cluster_id === c.id).length})`)
  }
} else {
  console.error('Usage: npm run pool -- terms en|es | drafts | clusters')
  process.exit(1)
}

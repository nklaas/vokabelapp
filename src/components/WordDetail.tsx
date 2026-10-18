import { Fragment } from 'react'
import { formatTranslation } from '../lib/format'
import { useData } from '../state/data'
import type { Vocab } from '../types'

const GENDER: Record<string, string> = { m: 'masculine', f: 'feminine', 'm/f': 'masculine/feminine' }

/** Everything known about a word: used after answering and in the pool. */
export function WordDetail({ vocab }: { vocab: Vocab }) {
  const { clusters, notes } = useData()
  const cluster = clusters.find((c) => c.id === vocab.cluster_id)
  const note = notes.get(vocab.id)
  const forms = Object.entries(vocab.forms ?? {})

  return (
    <div className="word-detail">
      <div className="wd-head">
        <span className="wd-term">{vocab.term}</span>
        {vocab.ipa && <span className="wd-ipa">{vocab.ipa}</span>}
      </div>
      <div className="badges">
        {vocab.word_type && <span className="badge">{vocab.word_type}</span>}
        {vocab.gender && <span className="badge">{GENDER[vocab.gender]}</span>}
        {vocab.level && <span className="badge">{vocab.level}</span>}
        {vocab.region && <span className="badge region">mainly {vocab.region}</span>}
        {vocab.is_draft && <span className="badge draft">draft</span>}
      </div>

      {vocab.translations.length > 0 && (
        <ul className="wd-translations">
          {vocab.translations.map((t, i) => <li key={i}>{formatTranslation(t)}</li>)}
        </ul>
      )}

      <dl className="wd-facts">
        {vocab.plural && <><dt>Plural</dt><dd>{vocab.plural}</dd></>}
        {forms.map(([label, value]) => (
          <Fragment key={label}><dt>{label}</dt><dd>{value}</dd></Fragment>
        ))}
        {vocab.synonyms.length > 0 && <><dt>Synonyms</dt><dd>{vocab.synonyms.join(', ')}</dd></>}
      </dl>

      {vocab.example && (
        <blockquote className="wd-example">
          {vocab.example}
          {vocab.example_de && <span className="muted">{vocab.example_de}</span>}
        </blockquote>
      )}

      {vocab.notes && <p className="wd-note">{vocab.notes}</p>}
      {note && <p className="wd-note personal"><strong>My note:</strong> {note}</p>}

      {(cluster || vocab.tags.length > 0) && (
        <div className="badges subtle">
          {cluster && <span className="badge">{cluster.name}</span>}
          {vocab.tags.map((t) => <span key={t} className="badge">#{t}</span>)}
        </div>
      )}
    </div>
  )
}

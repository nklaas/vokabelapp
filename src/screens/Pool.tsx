import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { WordPicker } from '../components/WordPicker'
import { LANGUAGE_NAME } from '../lib/format'
import { cardsByVocab, topicStats, type CardsByVocab } from '../lib/pool'
import { loadJson, loadPref, saveJson, savePref } from '../lib/storage'
import { useData } from '../state/data'
import { AREAS, type Cluster, type Language, type Vocab } from '../types'

const LANGUAGES = ['en', 'es'] as const
const OTHER = 'Other topics'
const CONTINUE_SHOWN = 3

/** The pool's start: topics grouped into areas, the ones being learned on top, and a search over all words. */
export function Pool() {
  const { vocab, cards, clusters } = useData()
  const [language, setLanguageState] = useState<Language>(() => loadPref('poolLanguage', 'en', LANGUAGES))
  const [search, setSearch] = useState('')
  const [showAllStarted, setShowAllStarted] = useState(false)
  const [openAreas, setOpenAreas] = useState<string[]>(() => loadJson<string[]>('poolOpenAreas') ?? [])

  const byVocab = useMemo(() => cardsByVocab(cards), [cards])
  const words = useMemo(() => vocab.filter((v) => v.language === language), [vocab, language])
  const topics = useMemo(() => clusters.filter((c) => c.language === language), [clusters, language])
  const wordsByTopic = useMemo(() => {
    const map = new Map<string, Vocab[]>()
    for (const v of words) if (v.cluster_id) map.set(v.cluster_id, [...(map.get(v.cluster_id) ?? []), v])
    return map
  }, [words])

  const q = search.trim().toLowerCase()
  const found = useMemo(
    () => (q ? words.filter((v) => v.term.toLowerCase().includes(q) || v.translations.some((t) => t.de.toLowerCase().includes(q))) : []),
    [words, q],
  )

  function setLanguage(l: Language) {
    setLanguageState(l)
    savePref('poolLanguage', l)
  }

  function toggleArea(area: string) {
    const next = openAreas.includes(area) ? openAreas.filter((a) => a !== area) : [...openAreas, area]
    setOpenAreas(next)
    saveJson('poolOpenAreas', next)
  }

  // Topics being learned and not finished, the most recently activated first.
  const lastActivated = (c: Cluster) =>
    Math.max(0, ...(wordsByTopic.get(c.id) ?? []).flatMap((v) => Object.values(byVocab.get(v.id) ?? {}).map((card) => Date.parse(card.activated_at))))
  const started = topics
    .filter((c) => {
      const s = topicStats(wordsByTopic.get(c.id) ?? [], byVocab)
      return s.learning > 0 && s.learning < s.total
    })
    .sort((a, b) => lastActivated(b) - lastActivated(a))
  const continued = showAllStarted ? started : started.slice(0, CONTINUE_SHOWN)
  const areas = [...AREAS, OTHER]
    .map((area) => ({
      area,
      topics: topics.filter((c) => (area === OTHER ? !(AREAS as readonly string[]).includes(c.area ?? '') : c.area === area)),
    }))
    .filter((a) => a.topics.length > 0)
  const withoutTopic = words.filter((v) => !v.cluster_id && !v.is_draft).length
  const drafts = words.filter((v) => v.is_draft).length

  return (
    <div className="page pool">
      <div className="pool-head">
        <h1>Pool</h1>
        <div className="segmented">
          {LANGUAGES.map((l) => (
            <button key={l} className={l === language ? 'on' : ''} onClick={() => setLanguage(l)}>{LANGUAGE_NAME[l]}</button>
          ))}
        </div>
      </div>

      <input className="pool-search" type="search" placeholder="Search word, translation or topic" value={search}
        onChange={(e) => setSearch(e.target.value)} />

      {q ? (
        <>
          {topics.filter((c) => c.name.toLowerCase().includes(q)).map((c) => (
            <TopicRow key={c.id} topic={c} language={language} words={wordsByTopic.get(c.id) ?? []} byVocab={byVocab} />
          ))}
          {found.length === 0 && <p className="muted hint">No words match “{search.trim()}”.</p>}
          <WordPicker key={`${language}|${q}`} language={language} words={found} batch={false} />
        </>
      ) : words.length === 0 ? (
        <p className="muted hint">No {LANGUAGE_NAME[language]} words yet. Add some in the Add tab or via Claude Code on the laptop.</p>
      ) : (
        <>
          {started.length > 0 && (
            <section className="pool-section">
              <h2 className="section-label">Continue</h2>
              {continued.map((c) => (
                <TopicRow key={c.id} topic={c} language={language} words={wordsByTopic.get(c.id) ?? []} byVocab={byVocab} />
              ))}
              {started.length > CONTINUE_SHOWN && (
                <button className="btn ghost small" onClick={() => setShowAllStarted((s) => !s)}>
                  {showAllStarted ? 'Show fewer' : `Show all ${started.length}`}
                </button>
              )}
            </section>
          )}

          <section className="pool-section">
            <h2 className="section-label">All topics</h2>
            {areas.map(({ area, topics }) => {
              const open = openAreas.includes(area)
              return (
                <div key={area} className="area">
                  <button className="area-head" onClick={() => toggleArea(area)} aria-expanded={open}>
                    <span className="area-arrow" aria-hidden>{open ? '▾' : '▸'}</span>
                    <span className="area-name">{area}</span>
                    <span className="muted small">{topics.length} topic{topics.length === 1 ? '' : 's'}</span>
                  </button>
                  {open && topics.map((c) => (
                    <TopicRow key={c.id} topic={c} language={language} words={wordsByTopic.get(c.id) ?? []} byVocab={byVocab} />
                  ))}
                </div>
              )
            })}
          </section>

          {(withoutTopic > 0 || drafts > 0) && (
            <div className="row-buttons">
              {withoutTopic > 0 && <Link className="btn small" to={`/pool/${language}/none`}>Without topic ({withoutTopic})</Link>}
              {drafts > 0 && <Link className="btn small" to={`/pool/${language}/drafts`}>Drafts ({drafts})</Link>}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TopicRow({ topic, language, words, byVocab }: { topic: Cluster; language: Language; words: Vocab[]; byVocab: CardsByVocab }) {
  const s = topicStats(words, byVocab)
  return (
    <Link className="topic-row" to={`/pool/${language}/${topic.id}`}>
      <span className="topic-top">
        <span className="topic-name">{topic.name}</span>
        <span className="muted small">{s.levels}</span>
      </span>
      <span className="topic-bottom">
        <span className="bar"><span style={{ width: `${s.total ? (s.learning / s.total) * 100 : 0}%` }} /></span>
        <span className="muted small">{s.learning}/{s.total}</span>
      </span>
    </Link>
  )
}

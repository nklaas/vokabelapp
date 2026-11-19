import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { WordPicker } from '../components/WordPicker'
import { cardsByVocab, LEVELS, topicStats } from '../lib/pool'
import { useData } from '../state/data'
import type { Language } from '../types'

/** One topic of the pool (or the words without topic, or the drafts): its words and the "Learn" button. */
export function Topic() {
  const params = useParams()
  const language = params.language as Language
  const topicId = params.topicId!
  const { vocab, cards, clusters } = useData()
  const [levels, setLevels] = useState<string[]>([])

  useEffect(() => window.scrollTo(0, 0), [topicId])

  const topic = clusters.find((c) => c.id === topicId)
  const title = topicId === 'none' ? 'Without topic' : topicId === 'drafts' ? 'Drafts' : topic?.name ?? 'Unknown topic'

  const byVocab = useMemo(() => cardsByVocab(cards), [cards])
  const all = useMemo(
    () =>
      vocab.filter((v) =>
        v.language === language &&
        (topicId === 'drafts' ? v.is_draft : topicId === 'none' ? !v.cluster_id && !v.is_draft : v.cluster_id === topicId)),
    [vocab, language, topicId],
  )
  const shown = levels.length ? all.filter((v) => v.level && levels.includes(v.level)) : all
  const stats = topicStats(all, byVocab)
  const usedLevels = LEVELS.filter((l) => all.some((v) => v.level === l))

  function toggleLevel(l: string) {
    setLevels((ls) => (ls.includes(l) ? ls.filter((x) => x !== l) : [...ls, l]))
  }

  return (
    <div className="page topic">
      <div className="topic-head">
        <Link className="btn ghost icon" to="/pool" aria-label="Back to topics">←</Link>
        <h1>{title}</h1>
      </div>
      {topic?.description && <p className="muted small">{topic.description}</p>}

      {topicId !== 'drafts' && (
        <>
          {usedLevels.length > 1 && (
            <div className="level-chips">
              {usedLevels.map((l) => (
                <button key={l} className={levels.includes(l) ? 'on' : ''} onClick={() => toggleLevel(l)} aria-pressed={levels.includes(l)}>{l}</button>
              ))}
            </div>
          )}
          <p className="muted small">{stats.total - stats.learning} new · {stats.learning} learning</p>
        </>
      )}

      <WordPicker language={language} words={shown} batch={topicId !== 'drafts'} />
    </div>
  )
}

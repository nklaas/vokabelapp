import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDue } from '../lib/format'
import { openToday, sessionKey } from '../lib/session'
import { isActive, upcoming } from '../lib/srs'
import { useData } from '../state/data'
import { FOLDERS } from '../types'

export function LearnHome() {
  const { cards, vocabById, userId } = useData()
  const [now] = useState(() => new Date())

  return (
    <div className="page">
      <h1>Learn</h1>
      <div className="folders">
        {FOLDERS.map((f) => {
          const own = cards.filter((c) => c.direction === f.direction && vocabById.get(c.vocab_id)?.language === f.language)
          const active = own.filter(isActive)
          // Due words plus the wrongly answered words of today's unfinished session that still need repeating.
          const due = openToday(active, sessionKey(userId, f.language, f.direction), cards, now)
          const learned = own.filter((c) => c.learned_at).length
          const next = upcoming(active, now, 1)[0]

          const body = (
            <>
              <span className="folder-label">{f.label}</span>
              <span className={due ? 'folder-due' : 'folder-due none'}>{due}</span>
              <span className="folder-meta">
                {due ? 'left today' : next ? `next: ${next.count} ${formatDue(next.day, now)}` : 'nothing active yet'}
                {' · '}{active.length} active · {learned} learned
              </span>
            </>
          )
          return due ? (
            <Link key={f.label} className="folder" to={`/learn/${f.language}/${f.direction}`}>{body}</Link>
          ) : (
            <div key={f.label} className="folder disabled">{body}</div>
          )
        })}
      </div>
      {cards.length === 0 && (
        <p className="muted hint">No words active yet. Go to <Link to="/pool">Pool</Link>, select words and activate them.</p>
      )}
    </div>
  )
}

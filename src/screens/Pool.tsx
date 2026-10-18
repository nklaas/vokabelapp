import { useMemo, useState } from 'react'
import { Sheet } from '../components/Sheet'
import { WordSheet } from '../components/WordSheet'
import { activate } from '../lib/activation'
import { deleteCards } from '../lib/db'
import { LANGUAGE_NAME } from '../lib/format'
import { loadPref, savePref } from '../lib/storage'
import { errorMessage, useData } from '../state/data'
import { FOLDERS, type Card, type Direction, type Language, type Vocab } from '../types'

const LANGUAGES = ['en', 'es'] as const
const PAGE = 150

type Status = 'all' | 'inactive' | 'active' | 'learned' | 'draft' | 'not_to_foreign' | 'not_to_german'

interface Pending {
  direction: Direction
  fresh: string[]
  existing: Card[]
  drafts: number
}

export function Pool() {
  const { vocab, vocabById, cards, clusters, settings, putCards, removeCards, toast } = useData()
  const [language, setLanguageState] = useState<Language>(() => loadPref('poolLanguage', 'en', LANGUAGES))
  const [search, setSearch] = useState('')
  const [cluster, setCluster] = useState('')
  const [wordType, setWordType] = useState('')
  const [level, setLevel] = useState('')
  const [status, setStatus] = useState<Status>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [limit, setLimit] = useState(PAGE)
  const [openId, setOpenId] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [deactivating, setDeactivating] = useState(false)
  const [busy, setBusy] = useState(false)

  const folders = FOLDERS.filter((f) => f.language === language)
  const short = (d: Direction) => (d === 'to_foreign' ? `→${language.toUpperCase()}` : '→DE')

  const cardsByVocab = useMemo(() => {
    const map = new Map<string, Partial<Record<Direction, Card>>>()
    for (const c of cards) map.set(c.vocab_id, { ...map.get(c.vocab_id), [c.direction]: c })
    return map
  }, [cards])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return vocab.filter((v) => {
      if (v.language !== language) return false
      if (cluster && (cluster === 'none' ? v.cluster_id : v.cluster_id !== cluster)) return false
      if (wordType && v.word_type !== wordType) return false
      if (level && v.level !== level) return false
      if (q && !v.term.toLowerCase().includes(q) && !v.translations.some((t) => t.de.toLowerCase().includes(q))) return false
      const own = cardsByVocab.get(v.id) ?? {}
      const all = Object.values(own)
      switch (status) {
        case 'inactive': return !v.is_draft && all.length === 0
        case 'active': return all.some((c) => !c.learned_at)
        case 'learned': return all.some((c) => c.learned_at)
        case 'draft': return v.is_draft
        case 'not_to_foreign': return !v.is_draft && !own.to_foreign
        case 'not_to_german': return !v.is_draft && !own.to_german
        default: return true
      }
    })
  }, [vocab, language, cluster, wordType, level, search, status, cardsByVocab])

  function setLanguage(l: Language) {
    setLanguageState(l)
    savePref('poolLanguage', l)
    setCluster('')
    setSelected(new Set())
    setLimit(PAGE)
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function startActivation(direction: Direction) {
    const ids = [...selected]
    const usable = ids.filter((id) => !vocabById.get(id)?.is_draft)
    const existing = usable.map((id) => cardsByVocab.get(id)?.[direction]).filter((c): c is Card => !!c)
    const taken = new Set(existing.map((c) => c.vocab_id))
    const next: Pending = { direction, fresh: usable.filter((id) => !taken.has(id)), existing, drafts: ids.length - usable.length }
    if (existing.length || next.drafts) setPending(next)
    else runActivation(next, false)
  }

  async function runActivation(p: Pending, resetExisting: boolean) {
    setBusy(true)
    try {
      const written = await activate(settings, p.direction, p.fresh, resetExisting ? p.existing.map((c) => c.id) : [])
      putCards(written)
      const label = FOLDERS.find((f) => f.language === language && f.direction === p.direction)?.label
      toast(`${written.length} word${written.length === 1 ? '' : 's'} activated in ${label}.`)
      setSelected(new Set())
      setPending(null)
    } catch (e) {
      toast(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  /** Cards of the selected words in the given directions. */
  function selectedCards(directions: Direction[]): Card[] {
    return [...selected].flatMap((id) => directions.map((d) => cardsByVocab.get(id)?.[d]).filter((c): c is Card => !!c))
  }

  async function runDeactivation(directions: Direction[]) {
    const target = selectedCards(directions)
    setBusy(true)
    try {
      await deleteCards(target.map((c) => c.id))
      removeCards(target.map((c) => c.id))
      toast(`${target.length} activation${target.length === 1 ? '' : 's'} removed (back to phase 0).`)
      setSelected(new Set())
      setDeactivating(false)
    } catch (e) {
      toast(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((v) => selected.has(v.id))
  const openVocab = openId ? vocabById.get(openId) : undefined

  return (
    <div className={`page pool ${selected.size ? 'has-selection' : ''}`}>
      <div className="pool-head">
        <h1>Pool</h1>
        <div className="segmented">
          {LANGUAGES.map((l) => (
            <button key={l} className={l === language ? 'on' : ''} onClick={() => setLanguage(l)}>{LANGUAGE_NAME[l]}</button>
          ))}
        </div>
      </div>

      <div className="filters">
        <input type="search" placeholder="Search word or translation" value={search}
          onChange={(e) => { setSearch(e.target.value); setLimit(PAGE) }} />
        <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
          <option value="all">All words</option>
          <option value="inactive">Inactive (phase 0)</option>
          <option value="not_to_foreign">Not active in {folders[0].label}</option>
          <option value="not_to_german">Not active in {folders[1].label}</option>
          <option value="active">Active</option>
          <option value="learned">Learned</option>
          <option value="draft">Drafts</option>
        </select>
        <select value={cluster} onChange={(e) => setCluster(e.target.value)}>
          <option value="">All clusters</option>
          {clusters.filter((c) => c.language === language).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value="none">Without cluster</option>
        </select>
        <select value={wordType} onChange={(e) => setWordType(e.target.value)}>
          <option value="">All types</option>
          {['noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'phrase', 'other'].map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">All levels</option>
          {['B1', 'B2', 'C1', 'C2'].map((l) => <option key={l}>{l}</option>)}
        </select>
      </div>

      <div className="list-head">
        <label className="check">
          <input type="checkbox" checked={allFilteredSelected}
            onChange={() => setSelected(allFilteredSelected ? new Set() : new Set(filtered.map((v) => v.id)))} />
          <span>{filtered.length} word{filtered.length === 1 ? '' : 's'}</span>
        </label>
      </div>

      {filtered.length === 0 && (
        <p className="muted hint">
          {vocab.some((v) => v.language === language) ? 'No words match these filters.' : `No ${LANGUAGE_NAME[language]} words yet. Add some in the Add tab or via Claude Code on the laptop.`}
        </p>
      )}

      <ul className="vocab-list">
        {filtered.slice(0, limit).map((v) => (
          <Row key={v.id} vocab={v} cards={cardsByVocab.get(v.id) ?? {}} short={short}
            selected={selected.has(v.id)} onToggle={() => toggle(v.id)} onOpen={() => setOpenId(v.id)} />
        ))}
      </ul>
      {filtered.length > limit && (
        <button className="btn ghost wide" onClick={() => setLimit((l) => l + PAGE)}>Show more ({filtered.length - limit})</button>
      )}

      {selected.size > 0 && (
        <div className="selection-bar">
          <div className="selection-info">
            <strong>{selected.size} selected</strong>
            <span className="selection-tools">
              <button className="btn ghost small danger-text" onClick={() => setDeactivating(true)}>Deactivate…</button>
              <button className="btn ghost small" onClick={() => setSelected(new Set())}>Clear</button>
            </span>
          </div>
          <div className="selection-actions">
            <span className="muted small">Activate</span>
            {folders.map((f) => (
              <button key={f.direction} className="btn primary" disabled={busy} onClick={() => startActivation(f.direction)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {pending && (
        <Sheet title="Activate words" onClose={() => setPending(null)}>
          <p>
            <strong>{pending.fresh.length}</strong> word{pending.fresh.length === 1 ? '' : 's'} will be activated in{' '}
            {FOLDERS.find((f) => f.language === language && f.direction === pending.direction)?.label}.
          </p>
          {pending.drafts > 0 && <p className="muted">{pending.drafts} draft{pending.drafts === 1 ? ' is' : 's are'} skipped (not completed yet).</p>}
          {pending.existing.length > 0 && (
            <>
              <p>{pending.existing.length} {pending.existing.length === 1 ? 'is' : 'are'} already active in this direction:</p>
              <ul className="existing-list">
                {pending.existing.map((c) => (
                  <li key={c.id}>
                    {vocabById.get(c.vocab_id)?.term} <span className="muted">– {c.learned_at ? 'learned' : `phase ${c.phase}`}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="dialog-actions">
            {pending.existing.length > 0 && (
              <button className="btn" disabled={busy} onClick={() => runActivation(pending, true)}>
                Reset these to phase 1
              </button>
            )}
            <button className="btn primary" disabled={busy || pending.fresh.length === 0} onClick={() => runActivation(pending, false)}>
              {pending.existing.length ? 'Skip them' : 'Activate'}
            </button>
          </div>
        </Sheet>
      )}

      {deactivating && (
        <Sheet title="Deactivate words" onClose={() => setDeactivating(false)}>
          <p>
            Puts the selected words back to phase 0. <strong>Their progress in that direction is lost.</strong>
          </p>
          <div className="deactivate-options">
            {[...folders.map((f) => ({ label: f.label, directions: [f.direction] })),
              { label: 'Both directions', directions: folders.map((f) => f.direction) }].map((o) => {
              const count = selectedCards(o.directions).length
              return (
                <button key={o.label} className="btn danger" disabled={busy || count === 0}
                  onClick={() => runDeactivation(o.directions)}>
                  {o.label} <span className="muted small">({count} active)</span>
                </button>
              )
            })}
          </div>
        </Sheet>
      )}

      {openVocab && <WordSheet vocab={openVocab} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function Row({ vocab, cards, short, selected, onToggle, onOpen }: {
  vocab: Vocab
  cards: Partial<Record<Direction, Card>>
  short: (d: Direction) => string
  selected: boolean
  onToggle: () => void
  onOpen: () => void
}) {
  return (
    <li className={`vocab-row ${selected ? 'selected' : ''}`}>
      <label className="check" aria-label={`Select ${vocab.term}`}>
        <input type="checkbox" checked={selected} onChange={onToggle} />
      </label>
      <button className="row-main" onClick={onOpen}>
        <span className="row-term">{vocab.term}</span>
        <span className="row-sub">
          {vocab.is_draft ? <em>draft</em> : vocab.translations.slice(0, 2).map((t) => t.de).join(', ')}
        </span>
      </button>
      <span className="row-status">
        {(['to_foreign', 'to_german'] as const).map((d) => {
          const c = cards[d]
          return c ? (
            <span key={d} className={`chip ${c.learned_at ? 'learned' : ''}`}>{short(d)} {c.learned_at ? '✓' : c.phase}</span>
          ) : null
        })}
      </span>
    </li>
  )
}

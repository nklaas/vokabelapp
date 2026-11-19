import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet } from './Sheet'
import { WordSheet } from './WordSheet'
import { activate } from '../lib/activation'
import { deleteCards } from '../lib/db'
import { cardsByVocab, isNew, MAIN_DIRECTION, poolOrder } from '../lib/pool'
import { loadPref, savePref } from '../lib/storage'
import { errorMessage, useData } from '../state/data'
import { FOLDERS, type Card, type Direction, type Language, type Vocab } from '../types'

const PAGE = 150
const BATCH_SIZES = ['5', '10', '15', '20', '25', '30', '40', '50'] as const

interface Pending {
  direction: Direction
  fresh: string[]
  existing: Card[]
}

/**
 * A word list with the "Learn" action bar: without a selection it offers the next N new words (easiest first),
 * with a selection exactly the ticked words. Activating starts a learning session right away.
 */
export function WordPicker({ language, words, batch }: {
  language: Language
  words: Vocab[]
  /** Offer "Learn N new words" when nothing is ticked (topic view); off for search results. */
  batch: boolean
}) {
  const { cards, vocabById, settings, putCards, removeCards, toast } = useData()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [size, setSizeState] = useState(() => Number(loadPref('learnBatch', '10', BATCH_SIZES)))
  const [limit, setLimit] = useState(PAGE)
  const [openId, setOpenId] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [deactivating, setDeactivating] = useState(false)
  const [busy, setBusy] = useState(false)

  const byVocab = useMemo(() => cardsByVocab(cards), [cards])
  const ordered = useMemo(() => poolOrder(words, byVocab), [words, byVocab])
  const fresh = ordered.filter((v) => isNew(v, byVocab))

  const folder = (d: Direction) => FOLDERS.find((f) => f.language === language && f.direction === d)!
  const reverse: Direction = MAIN_DIRECTION === 'to_foreign' ? 'to_german' : 'to_foreign'
  const short = (d: Direction) => (d === 'to_foreign' ? `→${language.toUpperCase()}` : '→DE')

  // The words the button acts on: the ticked ones (in list order), otherwise the next new ones.
  const targets = selected.size ? ordered.filter((v) => selected.has(v.id)).map((v) => v.id) : batch ? fresh.slice(0, size).map((v) => v.id) : []
  // Ticked words that are hidden by the current filter still count.
  const hiddenSelected = [...selected].filter((id) => !ordered.some((v) => v.id === id))
  const targetIds = [...targets, ...hiddenSelected]

  function setSize(next: number) {
    setSizeState(next)
    savePref('learnBatch', String(next))
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function learn(direction: Direction) {
    const usable = targetIds.filter((id) => !vocabById.get(id)?.is_draft)
    const existing = usable.map((id) => byVocab.get(id)?.[direction]).filter((c): c is Card => !!c)
    const taken = new Set(existing.map((c) => c.vocab_id))
    const next: Pending = { direction, fresh: usable.filter((id) => !taken.has(id)), existing }
    if (existing.length) setPending(next)
    else runActivation(next, false)
  }

  async function runActivation(p: Pending, resetExisting: boolean) {
    setBusy(true)
    try {
      const written = await activate(settings, p.direction, p.fresh, resetExisting ? p.existing.map((c) => c.id) : [])
      putCards(written)
      setSelected(new Set())
      setPending(null)
      if (settings.new_cards_due_immediately) {
        navigate(`/learn/${language}/${p.direction}`, { state: { add: written.map((c) => c.id) } })
      } else {
        toast(`${written.length} word${written.length === 1 ? '' : 's'} activated in ${folder(p.direction).label}.`)
      }
    } catch (e) {
      toast(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  /** Cards of the selected words in the given directions. */
  function selectedCards(directions: Direction[]): Card[] {
    return [...selected].flatMap((id) => directions.map((d) => byVocab.get(id)?.[d]).filter((c): c is Card => !!c))
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

  const count = targetIds.length
  const showBar = count > 0
  const openVocab = openId ? vocabById.get(openId) : undefined
  const sizeIndex = BATCH_SIZES.indexOf(String(size) as (typeof BATCH_SIZES)[number])

  return (
    <div className={showBar ? 'word-picker has-bar' : 'word-picker'}>
      {batch && words.length > 0 && fresh.length === 0 && (
        <p className="muted small">All words shown here are already being learned.</p>
      )}

      <ul className="vocab-list">
        {ordered.slice(0, limit).map((v) => (
          <Row key={v.id} vocab={v} cards={byVocab.get(v.id) ?? {}} short={short} dim={!isNew(v, byVocab)}
            selected={selected.has(v.id)} onToggle={() => toggle(v.id)} onOpen={() => setOpenId(v.id)} />
        ))}
      </ul>
      {ordered.length > limit && (
        <button className="btn ghost wide" onClick={() => setLimit((l) => l + PAGE)}>Show more ({ordered.length - limit})</button>
      )}

      {showBar && (
        <div className="learn-bar">
          <div className="learn-bar-inner">
            {selected.size > 0 && (
              <div className="selection-info">
                <span className="small"><strong>{selected.size}</strong> selected</span>
                <span className="selection-tools">
                  {selectedCards(['to_foreign', 'to_german']).length > 0 && (
                    <button className="btn ghost small danger-text" onClick={() => setDeactivating(true)}>Deactivate…</button>
                  )}
                  <button className="btn ghost small" onClick={() => setSelected(new Set())}>Clear</button>
                </span>
              </div>
            )}
            <div className="learn-main">
              <button className="btn primary learn-btn" disabled={busy} onClick={() => learn(MAIN_DIRECTION)}>
                <strong>Learn {count} {selected.size ? 'selected' : 'new'} word{count === 1 ? '' : 's'}</strong>
                <span className="small">{folder(MAIN_DIRECTION).label}</span>
              </button>
              {!selected.size && (
                <div className="stepper" aria-label="Number of new words">
                  <button className="btn small" disabled={sizeIndex <= 0} onClick={() => setSize(Number(BATCH_SIZES[sizeIndex - 1]))}>–</button>
                  <span>{size}</span>
                  <button className="btn small" disabled={sizeIndex >= BATCH_SIZES.length - 1} onClick={() => setSize(Number(BATCH_SIZES[sizeIndex + 1]))}>+</button>
                </div>
              )}
            </div>
            <button className="btn ghost small reverse-link" disabled={busy} onClick={() => learn(reverse)}>
              or learn {count === 1 ? 'it' : 'them'} {folder(reverse).label}
            </button>
          </div>
        </div>
      )}

      {pending && (
        <Sheet title="Learn words" onClose={() => setPending(null)}>
          <p>
            <strong>{pending.fresh.length}</strong> word{pending.fresh.length === 1 ? '' : 's'} will be activated in{' '}
            {folder(pending.direction).label}.
          </p>
          <p>{pending.existing.length} {pending.existing.length === 1 ? 'is' : 'are'} already active in this direction:</p>
          <ul className="existing-list">
            {pending.existing.map((c) => (
              <li key={c.id}>
                {vocabById.get(c.vocab_id)?.term} <span className="muted">– {c.learned_at ? 'learned' : `phase ${c.phase}`}</span>
              </li>
            ))}
          </ul>
          <div className="dialog-actions">
            <button className="btn" disabled={busy} onClick={() => runActivation(pending, true)}>Reset these to phase 1</button>
            <button className="btn primary" disabled={busy || pending.fresh.length === 0} onClick={() => runActivation(pending, false)}>
              Skip them
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
            {[...FOLDERS.filter((f) => f.language === language).map((f) => ({ label: f.label, directions: [f.direction] })),
              { label: 'Both directions', directions: ['to_foreign', 'to_german'] as Direction[] }].map((o) => {
              const n = selectedCards(o.directions).length
              return (
                <button key={o.label} className="btn danger" disabled={busy || n === 0} onClick={() => runDeactivation(o.directions)}>
                  {o.label} <span className="muted small">({n} active)</span>
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

function Row({ vocab, cards, short, dim, selected, onToggle, onOpen }: {
  vocab: Vocab
  cards: Partial<Record<Direction, Card>>
  short: (d: Direction) => string
  dim: boolean
  selected: boolean
  onToggle: () => void
  onOpen: () => void
}) {
  return (
    <li className={`vocab-row ${selected ? 'selected' : ''} ${dim ? 'dim' : ''}`}>
      {vocab.is_draft ? (
        <span className="check-spacer" />
      ) : (
        <label className="check" aria-label={`Select ${vocab.term}`}>
          <input type="checkbox" checked={selected} onChange={onToggle} />
        </label>
      )}
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
        {vocab.level && !vocab.is_draft && <span className="level">{vocab.level}</span>}
      </span>
    </li>
  )
}

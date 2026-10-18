import { useState } from 'react'
import { activate } from '../lib/activation'
import { deleteCard, deleteVocab, saveNote } from '../lib/db'
import { formatDue } from '../lib/format'
import { errorMessage, useData } from '../state/data'
import { FOLDERS, type Card, type Direction, type Vocab } from '../types'
import { Sheet } from './Sheet'
import { VocabForm } from './VocabForm'
import { WordDetail } from './WordDetail'

function status(card: Card | undefined): string {
  if (!card) return 'not active (phase 0)'
  if (card.learned_at) return 'learned'
  return `phase ${card.phase} · due ${formatDue(card.due_at)}`
}

/** A word from the pool: details, personal note, activation per direction, admin editing. */
export function WordSheet({ vocab, onClose }: { vocab: Vocab; onClose: () => void }) {
  const data = useData()
  const { cards, notes, profile, settings, userId, putCards, removeCard, removeVocab, setNote, toast } = data
  const [editing, setEditing] = useState(false)
  const [note, setNoteText] = useState(notes.get(vocab.id) ?? '')
  const [busy, setBusy] = useState(false)

  const folders = FOLDERS.filter((f) => f.language === vocab.language)
  const cardFor = (d: Direction) => cards.find((c) => c.vocab_id === vocab.id && c.direction === d)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    try {
      await action()
    } catch (e) {
      toast(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const activateIn = (d: Direction, existing?: Card) =>
    run(async () => {
      putCards(await activate(settings, d, existing ? [] : [vocab.id], existing ? [existing.id] : []))
      toast(existing ? 'Reset to phase 1.' : 'Activated.')
    })

  const deactivate = (c: Card) =>
    run(async () => {
      if (!window.confirm('Deactivate? The progress in this direction is lost.')) return
      await deleteCard(c.id)
      removeCard(c.id)
    })

  const saveMyNote = () =>
    run(async () => {
      await saveNote(userId, vocab.id, note)
      setNote(vocab.id, note)
      toast('Note saved.')
    })

  const remove = () =>
    run(async () => {
      if (!window.confirm(`Delete “${vocab.term}” for everyone, including all progress on it?`)) return
      await deleteVocab(vocab.id)
      removeVocab(vocab.id)
      onClose()
    })

  if (editing) {
    return (
      <Sheet title={`Edit “${vocab.term}”`} onClose={() => setEditing(false)}>
        <VocabForm language={vocab.language} initial={vocab} onSaved={() => setEditing(false)} />
      </Sheet>
    )
  }

  return (
    <Sheet title={vocab.term} onClose={onClose}>
      <WordDetail vocab={vocab} />

      <h3>Learning</h3>
      {vocab.is_draft ? (
        <p className="muted">Draft: can be activated once it is completed.</p>
      ) : (
        <ul className="direction-list">
          {folders.map((f) => {
            const card = cardFor(f.direction)
            return (
              <li key={f.direction}>
                <div>
                  <strong>{f.label}</strong>
                  <span className="muted small">{status(card)}</span>
                </div>
                <div className="actions">
                  {!card && <button className="btn small primary" disabled={busy} onClick={() => activateIn(f.direction)}>Activate</button>}
                  {card && card.phase !== 1 && (
                    <button className="btn small" disabled={busy} onClick={() => activateIn(f.direction, card)}>
                      {card.learned_at ? 'Reactivate' : 'Reset to 1'}
                    </button>
                  )}
                  {card && <button className="btn small ghost" disabled={busy} onClick={() => deactivate(card)}>Deactivate</button>}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <h3>My note</h3>
      <div className="form">
        <textarea rows={2} value={note} onChange={(e) => setNoteText(e.target.value)} placeholder="Only visible to you" />
        <button className="btn small" disabled={busy || note.trim() === (notes.get(vocab.id) ?? '')} onClick={saveMyNote}>
          Save note
        </button>
      </div>

      {profile.is_admin && (
        <div className="admin-actions">
          <button className="btn" onClick={() => setEditing(true)}>Edit word</button>
          <button className="btn danger" disabled={busy} onClick={remove}>Delete word</button>
        </div>
      )}
    </Sheet>
  )
}

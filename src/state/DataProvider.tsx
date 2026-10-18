import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { loadEverything, type Snapshot } from '../lib/db'
import { DataContext, errorMessage, type Data } from './data'

export function DataProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toastText, setToastText] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const reload = useCallback(async () => {
    try {
      setSnapshot(await loadEverything(userId))
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [userId])

  useEffect(() => {
    reload()
  }, [reload])

  const toast = useCallback((message: string) => {
    setToastText(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastText(null), 3500)
  }, [])

  const update = useCallback((fn: (s: Snapshot) => Snapshot) => {
    setSnapshot((s) => (s ? fn(s) : s))
  }, [])

  const value = useMemo<Data | null>(() => {
    if (!snapshot) return null
    return {
      userId,
      ...snapshot,
      vocabById: new Map(snapshot.vocab.map((v) => [v.id, v])),
      reload,
      toast,
      putCards: (cards) =>
        update((s) => {
          const byId = new Map(s.cards.map((c) => [c.id, c]))
          for (const c of cards) byId.set(c.id, c)
          return { ...s, cards: [...byId.values()] }
        }),
      removeCard: (id) => update((s) => ({ ...s, cards: s.cards.filter((c) => c.id !== id) })),
      putVocab: (v) =>
        update((s) => {
          const vocab = s.vocab.some((x) => x.id === v.id)
            ? s.vocab.map((x) => (x.id === v.id ? v : x))
            : [...s.vocab, v].sort((a, b) => a.term.localeCompare(b.term, 'es'))
          return { ...s, vocab }
        }),
      removeVocab: (id) =>
        update((s) => ({
          ...s,
          vocab: s.vocab.filter((v) => v.id !== id),
          cards: s.cards.filter((c) => c.vocab_id !== id),
        })),
      putCluster: (c) =>
        update((s) => ({ ...s, clusters: [...s.clusters, c].sort((a, b) => a.name.localeCompare(b.name)) })),
      setNote: (vocabId, note) =>
        update((s) => {
          const notes = new Map(s.notes)
          if (note.trim()) notes.set(vocabId, note.trim())
          else notes.delete(vocabId)
          return { ...s, notes }
        }),
      setSettings: (settings) => update((s) => ({ ...s, settings })),
      setProfile: (profile) => update((s) => ({ ...s, profile })),
    }
  }, [snapshot, userId, reload, toast, update])

  if (error) {
    return (
      <div className="center-card">
        <h1>Could not load your data</h1>
        <p className="error">{error}</p>
        <button className="btn primary" onClick={reload}>Try again</button>
      </div>
    )
  }
  if (!value) return <div className="center-card muted">Loading…</div>

  return (
    <DataContext.Provider value={value}>
      {children}
      {toastText && <div className="toast" role="status">{toastText}</div>}
    </DataContext.Provider>
  )
}

import { useState, type FormEvent } from 'react'
import { VocabForm } from '../components/VocabForm'
import { insertVocab, isDuplicateError } from '../lib/db'
import { LANGUAGE_NAME } from '../lib/format'
import { loadPref, savePref } from '../lib/storage'
import { errorMessage, useData } from '../state/data'
import type { Language } from '../types'

const LANGUAGES = ['en', 'es'] as const

export function Add() {
  const { putVocab, toast } = useData()
  const [language, setLanguageState] = useState<Language>(() => loadPref('addLanguage', 'en', LANGUAGES))
  const [mode, setMode] = useState<'quick' | 'full'>('quick')
  const [term, setTerm] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [formKey, setFormKey] = useState(0)

  function setLanguage(l: Language) {
    setLanguageState(l)
    savePref('addLanguage', l)
  }

  async function quickAdd(e: FormEvent) {
    e.preventDefault()
    if (!term.trim()) return
    setBusy(true)
    try {
      const saved = await insertVocab({
        language,
        term: term.trim(),
        notes: note.trim() || null,
        tags: ['quick add'],
        is_draft: true,
      })
      putVocab(saved)
      toast(`“${saved.term}” saved as draft.`)
      setTerm('')
      setNote('')
    } catch (e) {
      toast(isDuplicateError(e) ? `“${term.trim()}” is already in the pool.` : errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <h1>Add</h1>
      <div className="segmented">
        {LANGUAGES.map((l) => (
          <button key={l} className={l === language ? 'on' : ''} onClick={() => setLanguage(l)}>{LANGUAGE_NAME[l]}</button>
        ))}
      </div>
      <div className="segmented">
        <button className={mode === 'quick' ? 'on' : ''} onClick={() => setMode('quick')}>Quick add</button>
        <button className={mode === 'full' ? 'on' : ''} onClick={() => setMode('full')}>Full entry</button>
      </div>

      {mode === 'quick' ? (
        <form className="form" onSubmit={quickAdd}>
          <p className="muted">Just the word. It is saved as a draft and completed later with Claude Code on the laptop.</p>
          <input placeholder={`${LANGUAGE_NAME[language]} word or phrase`} value={term} onChange={(e) => setTerm(e.target.value)}
            autoCapitalize="off" autoCorrect="off" autoFocus />
          <input placeholder="Context / where you saw it (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn primary" disabled={busy || !term.trim()}>{busy ? 'Saving…' : 'Save draft'}</button>
        </form>
      ) : (
        <VocabForm key={`${language}-${formKey}`} language={language} onSaved={() => setFormKey((k) => k + 1)} />
      )}
    </div>
  )
}

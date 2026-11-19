import { useEffect, useRef, useState } from 'react'
import { saveDisplayName, saveSettings } from '../lib/db'
import { formatInterval } from '../lib/format'
import { supabase } from '../lib/supabase'
import { errorMessage, useData } from '../state/data'
import type { Settings } from '../types'

/** Changes are saved on their own, shortly after the last edit (so typing "14" does not save "1" first). */
const SAVE_DELAY = 700

export function SettingsScreen() {
  const { settings, profile, userId, setSettings, setProfile, toast } = useData()
  const [draft, setDraft] = useState<Settings>(settings)
  const [name, setName] = useState(profile.display_name)
  const [status, setStatus] = useState<'saved' | 'saving' | null>(null)

  const intervals = draft.phase_intervals
  const valid = intervals.length > 0 && intervals.every((d) => Number.isInteger(d) && d > 0) && draft.session_size > 0
  const changed = JSON.stringify(draft) !== JSON.stringify(settings)

  async function save(next: Settings) {
    setStatus('saving')
    try {
      await saveSettings(userId, next)
      setSettings(next)
      setStatus('saved')
    } catch (e) {
      setStatus(null)
      toast(errorMessage(e))
    }
  }

  // Refs let the timer and the save on leaving the screen use the latest values.
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })
  /** A valid change that is waiting for its save. */
  const pending = useRef<Settings | null>(null)

  useEffect(() => {
    if (!changed || !valid) {
      pending.current = null
      return
    }
    pending.current = draft
    const timer = window.setTimeout(() => {
      pending.current = null
      saveRef.current(draft)
    }, SAVE_DELAY)
    return () => window.clearTimeout(timer)
  }, [draft, changed, valid])

  // Leaving the screen right after a change still saves it.
  useEffect(() => () => {
    if (pending.current) saveRef.current(pending.current)
  }, [])

  function setPhaseDays(i: number, value: string) {
    setDraft((d) => ({ ...d, phase_intervals: d.phase_intervals.map((x, j) => (j === i ? Number(value) : x)) }))
  }

  async function saveName() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === profile.display_name) {
      setName(profile.display_name)
      return
    }
    try {
      await saveDisplayName(userId, trimmed)
      setProfile({ ...profile, display_name: trimmed })
      toast('Name saved.')
    } catch (e) {
      toast(errorMessage(e))
    }
  }

  return (
    <div className="page settings">
      <h1>Settings</h1>
      <p className="muted small save-status" role="status">
        {!valid ? 'Not saved: every phase and the session size need a number above 0.'
          : changed || status === 'saving' ? 'Saving…'
          : status === 'saved' ? 'All changes saved.'
          : 'Changes are saved automatically.'}
      </p>

      <section>
        <h2>Phases</h2>
        <p className="muted small">
          How long a word waits in each phase before it is asked again. After passing the last phase it counts as learned.
        </p>
        <ol className="phase-list">
          {intervals.map((days, i) => (
            <li key={i}>
              <span className="phase-name">Phase {i + 1}</span>
              <input type="number" min={1} inputMode="numeric" value={days || ''} onChange={(e) => setPhaseDays(i, e.target.value)} />
              <span className="muted small">{days > 0 ? `days (${formatInterval(days)})` : 'days'}</span>
            </li>
          ))}
        </ol>
        <div className="row-buttons">
          <button className="btn small" onClick={() =>
            setDraft((d) => ({ ...d, phase_intervals: [...d.phase_intervals, (d.phase_intervals.at(-1) ?? 1) * 2] }))}>
            + Add phase
          </button>
          <button className="btn small ghost" disabled={intervals.length <= 1} onClick={() =>
            setDraft((d) => ({ ...d, phase_intervals: d.phase_intervals.slice(0, -1) }))}>
            Remove last phase
          </button>
        </div>
      </section>

      <section>
        <h2>Learning</h2>
        <label className="setting-row">
          <span>Words per session</span>
          <input type="number" min={1} inputMode="numeric" value={draft.session_size || ''}
            onChange={(e) => setDraft({ ...draft, session_size: Number(e.target.value) })} />
        </label>
        <label className="setting-row">
          <span>
            Confirm other translations
            <span className="muted small">When your answer is right but other valid answers exist, show them and let me choose.</span>
          </span>
          <input type="checkbox" checked={draft.confirm_alternatives}
            onChange={(e) => setDraft({ ...draft, confirm_alternatives: e.target.checked })} />
        </label>
        <label className="setting-row">
          <span>
            New words due immediately
            <span className="muted small">Otherwise newly activated words wait for the phase 1 interval.</span>
          </span>
          <input type="checkbox" checked={draft.new_cards_due_immediately}
            onChange={(e) => setDraft({ ...draft, new_cards_due_immediately: e.target.checked })} />
        </label>
      </section>

      <section>
        <h2>Account</h2>
        <label className="setting-row">
          <span>Display name<span className="muted small">Visible to friends (leaderboard). Saved when you leave the field.</span></span>
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} enterKeyHint="done" />
        </label>
        <div className="row-buttons">
          <button className="btn small ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
        {profile.is_admin && <p className="muted small">You are the admin of the shared word pool.</p>}
      </section>
    </div>
  )
}

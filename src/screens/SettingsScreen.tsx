import { useState } from 'react'
import { saveDisplayName, saveSettings } from '../lib/db'
import { formatInterval } from '../lib/format'
import { supabase } from '../lib/supabase'
import { errorMessage, useData } from '../state/data'
import type { Settings } from '../types'

export function SettingsScreen() {
  const { settings, profile, userId, setSettings, setProfile, toast } = useData()
  const [draft, setDraft] = useState<Settings>(settings)
  const [name, setName] = useState(profile.display_name)
  const [busy, setBusy] = useState(false)

  const intervals = draft.phase_intervals
  const valid = intervals.length > 0 && intervals.every((d) => Number.isInteger(d) && d > 0) && draft.session_size > 0
  const changed = JSON.stringify(draft) !== JSON.stringify(settings)

  function setPhaseDays(i: number, value: string) {
    setDraft((d) => ({ ...d, phase_intervals: d.phase_intervals.map((x, j) => (j === i ? Number(value) : x)) }))
  }

  async function save() {
    setBusy(true)
    try {
      await saveSettings(userId, draft)
      setSettings(draft)
      toast('Settings saved.')
    } catch (e) {
      toast(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveName() {
    try {
      await saveDisplayName(userId, name.trim())
      setProfile({ ...profile, display_name: name.trim() })
      toast('Name saved.')
    } catch (e) {
      toast(errorMessage(e))
    }
  }

  return (
    <div className="page settings">
      <h1>Settings</h1>

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

      <div className="row-buttons">
        <button className="btn primary" disabled={!changed || !valid || busy} onClick={save}>Save settings</button>
        {changed && <button className="btn ghost" onClick={() => setDraft(settings)}>Discard</button>}
      </div>

      <section>
        <h2>Account</h2>
        <label className="setting-row">
          <span>Display name<span className="muted small">Visible to friends (leaderboard).</span></span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="row-buttons">
          <button className="btn small" disabled={!name.trim() || name.trim() === profile.display_name} onClick={saveName}>Save name</button>
          <button className="btn small ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
        {profile.is_admin && <p className="muted small">You are the admin of the shared word pool.</p>}
      </section>
    </div>
  )
}

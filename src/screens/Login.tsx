import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setBusy(false)
  }

  return (
    <form className="center-card form" onSubmit={submit}>
      <h1>Vokabelapp</h1>
      <input type="email" placeholder="Email" autoComplete="username" value={email}
        onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Password" autoComplete="current-password" value={password}
        onChange={(e) => setPassword(e.target.value)} required />
      <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      {error && <p className="error">{error}</p>}
    </form>
  )
}

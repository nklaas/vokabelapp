import { useEffect, useState } from 'react'
import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { Session as AuthSession } from '@supabase/supabase-js'
import { isConfigured, supabase } from './lib/supabase'
import { Add } from './screens/Add'
import { LearnHome } from './screens/LearnHome'
import { Login } from './screens/Login'
import { Pool } from './screens/Pool'
import { Session } from './screens/Session'
import { SettingsScreen } from './screens/SettingsScreen'
import { DataProvider } from './state/DataProvider'

const TABS = [
  { to: '/', label: 'Learn', icon: '◎' },
  { to: '/pool', label: 'Pool', icon: '☰' },
  { to: '/add', label: 'Add', icon: '+' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]

function Shell() {
  const { pathname } = useLocation()
  const inSession = pathname.startsWith('/learn/')

  return (
    <div className={inSession ? 'shell in-session' : 'shell'}>
      <main>
        <Routes>
          <Route path="/" element={<LearnHome />} />
          <Route path="/learn/:language/:direction" element={<Session />} />
          <Route path="/pool" element={<Pool />} />
          <Route path="/add" element={<Add />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!inSession && (
        <nav className="tabbar">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.to === '/'}>
              <span className="tab-icon" aria-hidden>{t.icon}</span>
              <span>{t.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<AuthSession | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!isConfigured) {
    return (
      <div className="center-card">
        <h1>Vokabelapp</h1>
        <p className="error">Supabase is not configured: create <code>.env.local</code> from <code>.env.example</code>.</p>
      </div>
    )
  }
  if (session === undefined) return null
  if (!session) return <Login />

  return (
    <DataProvider key={session.user.id} userId={session.user.id}>
      <HashRouter>
        <Shell />
      </HashRouter>
    </DataProvider>
  )
}

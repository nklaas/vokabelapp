// Supabase connection for the laptop scripts. Values come from .env.local
// (scripts are started with `node --env-file=.env.local`, see package.json).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function env(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`Missing ${name} in .env.local (see .env.example).`)
    process.exit(1)
  }
  return value
}

const options = { auth: { persistSession: false, autoRefreshToken: false } }

/** Logged in as you: row level security applies exactly as in the app. */
export async function connectAsUser(): Promise<SupabaseClient> {
  const client = createClient(env('VITE_SUPABASE_URL'), env('VITE_SUPABASE_KEY'), options)
  const { error } = await client.auth.signInWithPassword({
    email: env('VOCAB_EMAIL'),
    password: env('VOCAB_PASSWORD'),
  })
  if (error) {
    console.error(`Login failed: ${error.message}`)
    process.exit(1)
  }
  return client
}

/** With the secret key: bypasses row level security, sees every account's data. Laptop only. */
export function connectAsAdmin(): SupabaseClient | null {
  const secret = process.env.SUPABASE_SECRET_KEY
  return secret ? createClient(env('VITE_SUPABASE_URL'), secret, options) : null
}

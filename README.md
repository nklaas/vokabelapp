# Vokabelapp

Personal English and Spanish vocabulary trainer with adjustable spaced-repetition phases.
See [docs/SPEC.md](docs/SPEC.md) for what it does.

## Run locally

1. Copy `.env.example` to `.env.local` and fill in the Supabase values.
2. `npm install`
3. `npm run dev`, then open the printed URL.

## Database

Run [supabase/schema.sql](supabase/schema.sql) once in the Supabase SQL Editor.

- **Backup:** `npm run backup` saves everything to `backups/` (git-ignored). Add `SUPABASE_SECRET_KEY` to
  `.env.local` to include all accounts, not only your own progress.
- **Keep-alive:** [.github/workflows/keepalive.yml](.github/workflows/keepalive.yml) pings the database every 3 days
  so the free project never pauses. Needs the repository secrets `SUPABASE_URL` and `SUPABASE_KEY`.

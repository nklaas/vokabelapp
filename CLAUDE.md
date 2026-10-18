# Vokabelapp

Personal English/Spanish vocabulary trainer (PWA). The full agreed specification is in [docs/SPEC.md](docs/SPEC.md) –
read it before changing behaviour, and ask the user before deviating from it or deciding open questions on your own.

- Stack: React + TypeScript + Vite, `vite-plugin-pwa`, `react-router-dom`, Supabase (`@supabase/supabase-js`).
- Database schema: [supabase/schema.sql](supabase/schema.sql); TypeScript mirror in [src/types.ts](src/types.ts).
- Multi-user: the word pool is shared, learning progress is personal, only the admin edits words (see SPEC).
- Config: `.env.local` (git-ignored), template in `.env.example`.
- Commands: `npm run dev`, `npm run build`, `npm run lint`, `npm run backup`.
- **Adding vocab** ("add words about …", "complete my drafts"): follow [docs/VOCAB_RULES.md](docs/VOCAB_RULES.md)
  exactly – check existing terms, write a file in `vocab/`, show the user a review table, import only after approval
  (`npm run pool`, `npm run import`).
- The user does not program in this project; explain changes in plain terms.

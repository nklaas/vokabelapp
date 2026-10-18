# Vokabelapp – agreed specification

Personal vocabulary trainer (German native speaker, B2 in English and Spanish, focus on advanced vocabulary).
Free to run: web app (PWA) on GitHub Pages, data in Supabase (free tier), AI work done through Claude Code on the laptop.

## Platform
- PWA installed on the iPhone home screen, same app in the laptop browser, synced via Supabase.
- Email + password login, row level security on every table. Interface language: English.

## Sharing with friends
- Several accounts (all German native speakers). Public sign-up is off; the admin creates friends' accounts in Supabase.
- **Shared:** the word pool (`vocab`) and clusters. **Personal:** activations/phases (`cards`), answer history
  (`reviews`), settings, personal notes on a word (`vocab_notes`).
- Everyone can add words (friends' quick adds become drafts that the admin completes via Claude Code).
- Only the admin (the user, first account created) can edit or delete words and create clusters.
- Each account has a profile with a display name, visible to the others (for the leaderboard).

## Vocab pool
- Language pairs: German ↔ English and German ↔ Spanish only. Never English ↔ Spanish.
- Words live in a pool. Not activated = phase 0 (inactive).
- Grouping: each word belongs to one **cluster** (thematic, textbook-style, per language) plus any number of **tags**
  (word type, level B2/C1/C2, region, "quick add", free tags).
- An entry holds everything needed to use the word correctly:
  - German translations, each with a context hint where meaning depends on context (several allowed)
  - English: IPA in **American English**; irregular verb forms
  - Spanish: nouns with article, gender and (irregular) plural; verbs with irregular conjugations; no IPA (phonetic language)
  - region marker when a word is typical for only one region (e.g. Spain vs. Latin America); American spelling for English
  - obvious synonyms, an example sentence (with German translation) where useful
- Adding:
  - Laptop: Claude Code generates full entries (single words, lists, pasted text, photos) and imports them.
  - Phone: quick add (word only, flagged as draft, completed later by Claude Code) and a full manual form.

## Activation
- Bulk activation from the pool: filter → select all / deselect some → activate in a chosen direction.
- A word can be active at most once per direction. Activating again shows which words are already active and in which
  phase, with the option to reset them to phase 1 or skip them.
- Learned words can be reactivated (back to phase 1).
- Activation is manual for now. Later idea: an agent that proposes new words for review and activation.

## Learning
- Four folders: DE→EN, EN→DE, DE→ES, ES→DE, each showing how many words are due.
- The answer is typed.
- Exactly correct → next word immediately.
- Otherwise (typo, missing accent, wrong word) → show the correct answer with differences highlighted plus the full entry,
  and offer three choices: **count as correct / drop one phase / back to phase 1**.
- Correct but other translations exist → show them and offer the same three choices (setting `confirm_alternatives`,
  on by default).
- Any listed translation (or synonym) counts as a valid answer.
- Spanish nouns: article required. English verbs: "to" optional. German nouns: article optional.
- Wrongly answered words come back at the end of the session until answered correctly (does not change the phase again).
- Session length is capped (setting, default 30); due words are shuffled.
- A repeated (previously wrong) word offers two choices: count as correct / repeat again.
- An empty answer counts as wrong. Answers are saved in the background (no offline practice yet).
- A word can be deactivated per direction (back to phase 0, progress in that direction is lost).

## Phases
- Number of phases and their intervals are adjustable. Defaults (days): 1, 3, 7, 14, 30, 90, 180, 365, 1095.
- A card entering phase k is due after interval k, counted in calendar days from the start of today (a word reviewed
  in the evening is due again on the morning of its due day). Passing the last phase (3 years) marks the word as **learned**.
- Newly activated words are due immediately by default (setting `new_cards_due_immediately`).

## Later features (data model already prepared via the `reviews` log)
- Statistics, streaks, daily goals, reminder notifications, word-suggestion agent.
- Leaderboard and streak comparison between friends (expose only aggregates, never raw answers).
- Offline practice (answers queued and synced when back online).
- More visual polish and playful interactivity, Duolingo as inspiration (details to be discussed).
- Dropped: Instagram reward timer (iOS does not allow a web app to open and close other apps).

## Build order
1. Setup: project, Supabase schema (`supabase/schema.sql`), backup script, keep-alive workflow. ← done
2. Core app: login, pool with bulk activation, learning sessions, settings. ← done
3. Claude Code workflow: vocab rulebook (`docs/VOCAB_RULES.md`), import script, example cluster (Spanish,
   "Environment & Climate", ~25 words). ← done
4. Deploy to GitHub Pages (public repo), PNG icons, install on iPhone.
5. Later features.

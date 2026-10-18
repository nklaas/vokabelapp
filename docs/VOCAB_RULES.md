# Rulebook for vocab entries

How Claude Code creates and imports words for the shared pool. Learners: German native speakers at B2 in English
and Spanish who want to reach C1 and beyond.

## Workflow

1. **Check what exists:** `npm run pool -- terms <en|es>` (avoid duplicates) and `npm run pool -- clusters`.
2. **Write a file** `vocab/<yyyy-mm-dd>-<language>-<topic>.json` (folder is git-ignored; the database is the source of truth).
3. **Show the user a compact review table** (term · type · level · translations) and point out anything noteworthy
   (irregular forms, regional words, false friends). Never import without the user's approval.
4. **Dry run, then import:** `npm run import -- <file> --dry-run`, then without `--dry-run`. Report the summary.
5. To correct words that are already in the pool, import a file with the corrected entries using `--update`.

### Completing drafts (quick adds from the phone)

`npm run pool -- drafts` lists them (with the context the person typed). Write a normal file containing those terms;
the import completes each draft in place. If a draft is a typo or unclear, ask the user instead of guessing.

## Choosing words

- Level **B2 to C2**, mostly C1. Skip basic words a B2 learner certainly knows (*la casa*, *to buy*), unless the user
  asks for them.
- **Use every word type that fits the topic**, not only nouns, verbs and adjectives. Every batch should also
  contain, where the topic offers them: adverbs (*nevertheless*, *a regañadientes*), prepositions and prepositional
  phrases (*notwithstanding*, *en aras de*), conjunctions and connectors (*whereas*, *puesto que*), discourse
  markers (*by the same token*, *de hecho*), idioms and set phrases (*to cut corners*, *estar hasta las narices*),
  collocations and phrasal verbs. Use `phrase` for multi-word expressions and `other` for anything that fits no
  category.
- Prefer words that are genuinely used in news, books, work and conversation over rare curiosities.
- Group words into **clusters** = topics with English names ("Environment & Climate", "Work & Career").
  Reuse an existing cluster when it fits; a cluster typically holds 20–40 words.

## File format

```json
{
  "language": "es",
  "cluster": "Environment & Climate",
  "cluster_description": "Climate change, pollution, nature, energy",
  "words": [
    {
      "term": "la sequía",
      "word_type": "noun",
      "level": "B2",
      "gender": "f",
      "translations": [{ "de": "die Dürre" }, { "de": "die Trockenheit" }],
      "example": "La sequía ha arruinado gran parte de la cosecha este año.",
      "example_de": "Die Dürre hat dieses Jahr einen Großteil der Ernte vernichtet."
    }
  ]
}
```

A word may set its own `"cluster"` to override the file's cluster.

## Fields

| Field | Required | Rules |
|---|---|---|
| `term` | always | Exactly what the learner must type. Spanish nouns **with article** (`la sequía`, `el/la ecologista` for common gender). English verbs **with "to"** (`to relinquish`). Lower case unless a proper noun. |
| `word_type` | always | `noun`, `verb`, `adjective`, `adverb`, `preposition`, `conjunction`, `phrase`, `other` |
| `level` | always | `B1`, `B2`, `C1`, `C2` (CEFR estimate) |
| `translations` | always | German meanings, most common first. Nouns **with article** (`die Dürre`). One entry per distinct meaning, each a single answer the learner could type (no "a, b" lists in one entry). Add `context` (in German, short) whenever the meaning depends on context: `{ "de": "die Ausstrahlung", "context": "Radio, TV" }`. Optional parts in parentheses are ignored when checking: `(etw.) abtreten`. |
| `gender` | Spanish nouns | `m`, `f`, `m/f` |
| `plural` | if noteworthy | Irregular or tricky plurals only: accent changes (`las emisiones`), z→c (`las escaseces`), compound nouns (`los combustibles fósiles`). |
| `forms` | if irregular | Object of label → forms, labels in the target language. Spanish verbs: only the irregular tenses, e.g. `"presente": "me derrito, te derrites, …"`, `"indefinido": "…"`, spelling changes (`"indefinido (yo)": "mitigué"`). English: `"past": "…", "past participle": "…"`. |
| `ipa` | English, always | **American** pronunciation, slashes and stress marks: `/rɪˈlɪŋkwɪʃ/`. Never for Spanish. |
| `region` | only if regional | Where the word is (mainly) used: `"Spain"`, `"Latin America"`, `"Mexico"`, `"Argentina"`, `"US"`. Leave out for words used everywhere. English uses American spelling. |
| `synonyms` | if obvious | Close synonyms in the target language, written like `term`. They are accepted as answers. |
| `example` / `example_de` | recommended | One natural, idiomatic sentence showing typical use (collocations!), plus a natural German translation. |
| `notes` | optional | Short usage hints in English: false friends, prepositions (`perjudicial para`), register, gender traps (`el ecosistema` is masculine). |
| `tags` | optional | Free labels, e.g. `"false friend"`. |

## Verification pass (mandatory, every batch)

The user expects **zero errors**. After writing the file, go through it again word by word as a separate step –
never skip this or do it superficially. For each entry check:

- **Spelling and accents** of the term, synonyms, plural and every form (`la canción`, not `la cancion`).
- **Gender and article**, especially traps (`el ecosistema`, `el agua`, `la mano`).
- **Plural:** only listed when noteworthy, and then correct (accent shifts, z→c).
- **Every conjugated form** listed in `forms`, person by person; spelling changes (g→gu, c→qu, z→c) included.
- **IPA** (English): American, correct stress mark, matches the word type (e.g. *record* noun vs. verb).
- **Translations:** each is what a German would really say, fits the term in a real context, has the right German
  article, and context hints separate meanings clearly. No translation that only loosely matches.
- **Level:** a realistic CEFR estimate for how common and advanced the word is – not inflated, not deflated.
- **Region:** only set when the word is clearly regional; never mark a word as regional on a hunch.
- **Example sentence:** grammatical, idiomatic, natural for a native speaker, uses the word in the sense of the
  first translation; the German translation is accurate and natural. **No factual claims that could be wrong**
  (numbers, dates, events) unless they are certainly true – prefer neutral sentences.
- **Duplicates** with existing pool words (check step 1) and within the file.

If anything is uncertain (a rare form, a disputed gender, regional usage), say so in the review message and ask the
user instead of guessing.

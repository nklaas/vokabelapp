import { useState, type FormEvent } from 'react'
import { insertCluster, insertVocab, isDuplicateError, updateVocab, type VocabInput } from '../lib/db'
import { errorMessage, useData } from '../state/data'
import type { Language, Translation, Vocab, WordType } from '../types'

const WORD_TYPES: WordType[] = ['noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'phrase', 'other']
const NEW_CLUSTER = '__new__'

const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)
const orNull = (s: string) => s.trim() || null

function formsToText(forms: Record<string, string> | null): string {
  return Object.entries(forms ?? {}).map(([k, v]) => `${k}: ${v}`).join('\n')
}

function textToForms(text: string): Record<string, string> | null {
  const entries = text
    .split('\n')
    .map((line) => line.split(/:(.*)/s).map((x) => x.trim()))
    .filter(([k, v]) => k && v)
  return entries.length ? Object.fromEntries(entries) : null
}

/** Full entry form: adding a word, or editing one (admin). */
export function VocabForm({ language, initial, onSaved }: {
  language: Language
  initial?: Vocab
  onSaved: (vocab: Vocab) => void
}) {
  const { clusters, profile, putCluster, putVocab, toast } = useData()
  const [term, setTerm] = useState(initial?.term ?? '')
  const [wordType, setWordType] = useState<string>(initial?.word_type ?? '')
  const [translations, setTranslations] = useState<Translation[]>(
    initial?.translations.length ? initial.translations : [{ de: '', context: '' }],
  )
  const [clusterId, setClusterId] = useState(initial?.cluster_id ?? '')
  const [level, setLevel] = useState<string>(initial?.level ?? '')
  const [ipa, setIpa] = useState(initial?.ipa ?? '')
  const [gender, setGender] = useState<string>(initial?.gender ?? '')
  const [plural, setPlural] = useState(initial?.plural ?? '')
  const [forms, setForms] = useState(formsToText(initial?.forms ?? null))
  const [region, setRegion] = useState(initial?.region ?? '')
  const [synonyms, setSynonyms] = useState(initial?.synonyms.join(', ') ?? '')
  const [example, setExample] = useState(initial?.example ?? '')
  const [exampleDe, setExampleDe] = useState(initial?.example_de ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '')
  const [busy, setBusy] = useState(false)

  const languageClusters = clusters.filter((c) => c.language === language)

  async function chooseCluster(value: string) {
    if (value !== NEW_CLUSTER) return setClusterId(value)
    const name = window.prompt('Name of the new cluster')?.trim()
    if (!name) return
    try {
      const cluster = await insertCluster(language, name)
      putCluster(cluster)
      setClusterId(cluster.id)
    } catch (e) {
      toast(errorMessage(e))
    }
  }

  function setTranslation(i: number, patch: Partial<Translation>) {
    setTranslations((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const cleanTranslations = translations
      .map((t) => ({ de: t.de.trim(), ...(t.context?.trim() ? { context: t.context.trim() } : {}) }))
      .filter((t) => t.de)
    if (!term.trim()) return toast('The word is missing.')
    if (cleanTranslations.length === 0) return toast('Add at least one German translation.')

    const input: VocabInput = {
      language,
      term: term.trim(),
      word_type: (wordType || null) as WordType | null,
      translations: cleanTranslations,
      cluster_id: clusterId || null,
      level: (level || null) as Vocab['level'],
      ipa: language === 'en' ? orNull(ipa) : null,
      gender: language === 'es' && wordType === 'noun' ? ((gender || null) as Vocab['gender']) : null,
      plural: orNull(plural),
      forms: textToForms(forms),
      region: orNull(region),
      synonyms: list(synonyms),
      example: orNull(example),
      example_de: orNull(exampleDe),
      notes: orNull(notes),
      tags: list(tags).filter((t) => t !== 'quick add'),
      is_draft: false,
    }

    setBusy(true)
    try {
      const saved = initial ? await updateVocab(initial.id, input) : await insertVocab(input)
      putVocab(saved)
      toast(initial ? 'Saved.' : `Added “${saved.term}”.`)
      onSaved(saved)
    } catch (e) {
      toast(isDuplicateError(e) ? `“${term.trim()}” is already in the pool.` : errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <label>
        Word{language === 'es' && wordType === 'noun' ? ' (with article)' : ''}
        <input value={term} onChange={(e) => setTerm(e.target.value)} autoCapitalize="off" autoCorrect="off" required />
      </label>

      <div className="row">
        <label>
          Type
          <select value={wordType} onChange={(e) => setWordType(e.target.value)}>
            <option value="">–</option>
            {WORD_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label>
          Level
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">–</option>
            {['B1', 'B2', 'C1', 'C2'].map((l) => <option key={l}>{l}</option>)}
          </select>
        </label>
      </div>

      <fieldset>
        <legend>German translations</legend>
        {translations.map((t, i) => (
          <div className="row" key={i}>
            <input placeholder="Übersetzung" value={t.de} onChange={(e) => setTranslation(i, { de: e.target.value })} />
            <input placeholder="Context (optional)" value={t.context ?? ''}
              onChange={(e) => setTranslation(i, { context: e.target.value })} />
            {translations.length > 1 && (
              <button type="button" className="btn ghost icon" aria-label="Remove"
                onClick={() => setTranslations((ts) => ts.filter((_, j) => j !== i))}>✕</button>
            )}
          </div>
        ))}
        <button type="button" className="btn ghost small"
          onClick={() => setTranslations((ts) => [...ts, { de: '', context: '' }])}>+ Translation</button>
      </fieldset>

      <label>
        Cluster
        <select value={clusterId} onChange={(e) => chooseCluster(e.target.value)}>
          <option value="">–</option>
          {languageClusters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          {profile.is_admin && <option value={NEW_CLUSTER}>+ New cluster…</option>}
        </select>
      </label>

      {language === 'en' && (
        <label>
          Pronunciation (IPA, American)
          <input value={ipa} onChange={(e) => setIpa(e.target.value)} placeholder="/rɪˈlʌktənt/" />
        </label>
      )}

      {wordType === 'noun' && (
        <div className="row">
          {language === 'es' && (
            <label>
              Gender
              <select value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">–</option>
                <option value="m">masculine</option>
                <option value="f">feminine</option>
                <option value="m/f">both</option>
              </select>
            </label>
          )}
          <label>
            Plural (if irregular)
            <input value={plural} onChange={(e) => setPlural(e.target.value)} />
          </label>
        </div>
      )}

      {wordType === 'verb' && (
        <label>
          Irregular forms (one per line, “label: forms”)
          <textarea rows={3} value={forms} onChange={(e) => setForms(e.target.value)}
            placeholder={language === 'es' ? 'presente: tengo, tienes, tiene, …' : 'past: went\npast participle: gone'} />
        </label>
      )}

      <label>
        Synonyms (comma separated)
        <input value={synonyms} onChange={(e) => setSynonyms(e.target.value)} />
      </label>
      <label>
        Example sentence
        <input value={example} onChange={(e) => setExample(e.target.value)} />
      </label>
      <label>
        Example in German
        <input value={exampleDe} onChange={(e) => setExampleDe(e.target.value)} />
      </label>
      <div className="row">
        <label>
          Region (only if regional)
          <input value={region} onChange={(e) => setRegion(e.target.value)}
            placeholder={language === 'es' ? 'Spain, Latin America, …' : 'UK, …'} />
        </label>
        <label>
          Tags (comma separated)
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
      </div>
      <label>
        Usage notes (shared)
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : initial ? 'Save changes' : 'Add word'}</button>
    </form>
  )
}

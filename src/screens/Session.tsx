import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { WordDetail } from '../components/WordDetail'
import { checkAnswer, diff, type CheckResult, type DiffChar } from '../lib/answer'
import { saveReview } from '../lib/db'
import { formatDue, formatTranslation, LANGUAGE_NAME } from '../lib/format'
import { introducedState, isDue, needsIntro, nextState, upcoming } from '../lib/srs'
import { errorMessage, useData } from '../state/data'
import { FOLDERS, type Card, type Direction, type Language, type ReviewResult } from '../types'

interface Item {
  cardId: string
  /** 'intro' shows the full card of a new word (guided tour), 'ask' asks for the answer. */
  kind: 'intro' | 'ask'
  /** Asked right after its intro: the word stays in phase 1 and comes back tomorrow. */
  fresh: boolean
  /** A word answered wrongly earlier in this session; repeating it no longer changes the phase. */
  retry: boolean
}

interface Feedback {
  check: CheckResult
  typed: string
  mode: 'wrong' | 'alternatives' | 'retry-wrong'
}

/** New words are introduced in batches of this size, each followed by its questions. */
const TOUR_BATCH = 5

const SPANISH_CHARS = ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ', '¿', '¡']

function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Tour of 5 new words, then those 5 mixed with a share of the known words, then the next 5, … */
function buildQueue(picked: Card[]): Item[] {
  const ask = (c: Card, fresh: boolean): Item => ({ cardId: c.id, kind: 'ask', fresh, retry: false })
  const fresh = picked.filter(needsIntro)
  const known = picked.filter((c) => !needsIntro(c))
  if (fresh.length === 0) return known.map((c) => ask(c, false))

  const batches = Math.ceil(fresh.length / TOUR_BATCH)
  const share = Math.ceil(known.length / batches)
  const queue: Item[] = []
  for (let b = 0; b < batches; b++) {
    const batch = fresh.slice(b * TOUR_BATCH, (b + 1) * TOUR_BATCH)
    const others = known.slice(b * share, (b + 1) * share)
    queue.push(...batch.map((c): Item => ({ cardId: c.id, kind: 'intro', fresh: true, retry: false })))
    queue.push(...shuffle([...batch.map((c) => ask(c, true)), ...others.map((c) => ask(c, false))]))
  }
  return queue
}

export function Session() {
  const params = useParams()
  const language = params.language as Language
  const direction = params.direction as Direction
  const folder = FOLDERS.find((f) => f.language === language && f.direction === direction)
  const { cards, vocabById, settings, putCards, toast } = useData()
  const navigate = useNavigate()

  // The session is fixed when it starts: due cards of this folder, shuffled, capped.
  const [now] = useState(() => new Date())
  const [queue, setQueue] = useState<Item[]>(() => {
    const due = cards.filter(
      (c) => c.direction === direction && isDue(c, now) && vocabById.get(c.vocab_id)?.language === language,
    )
    return buildQueue(shuffle(due).slice(0, settings.session_size))
  })
  const [total] = useState(() => new Set(queue.map((i) => i.cardId)).size)
  const [typed, setTyped] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [stats, setStats] = useState({ right: 0, wrong: 0 })
  const [flash, setFlash] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const current = queue[0]
  const card = current ? cards.find((c) => c.id === current.cardId) : undefined
  const vocab = card ? vocabById.get(card.vocab_id) : undefined
  // Progress counts finished words: a wrong word stays open until it is answered correctly.
  const done = total - new Set(queue.map((i) => i.cardId)).size

  function advance(requeue: boolean) {
    setQueue(([head, ...rest]) =>
      requeue ? [...rest, { cardId: head.cardId, kind: 'ask', fresh: false, retry: true }] : rest,
    )
    setTyped('')
    setFeedback(null)
    inputRef.current?.focus() // inside the tap/keypress, so the iPhone keyboard stays open
  }

  /** Saves in the background so the next word appears instantly. */
  function record(c: Card, result: ReviewResult, answer: string) {
    const next = current.fresh ? introducedState(settings) : nextState(c, result, settings)
    putCards([{ ...c, ...next, last_reviewed_at: new Date().toISOString() }])
    saveReview(c, next, { language, answer, result }).catch((e) =>
      toast(`Could not save “${vocab?.term}”: ${errorMessage(e)}`),
    )
    const wrong = result === 'down_one' || result === 'reset'
    setStats((s) => (wrong ? { ...s, wrong: s.wrong + 1 } : { ...s, right: s.right + 1 }))
    advance(wrong)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!card || !vocab || feedback || current.kind === 'intro') return
    const check = checkAnswer(typed, vocab, direction)

    if (current.retry) {
      if (check.exact) advance(false)
      else setFeedback({ check, typed, mode: 'retry-wrong' })
      return
    }
    if (check.exact && !(settings.confirm_alternatives && check.alternatives.length > 0)) {
      setFlash(true)
      window.setTimeout(() => setFlash(false), 600)
      record(card, 'correct', typed)
    } else {
      setFeedback({ check, typed, mode: check.exact ? 'alternatives' : 'wrong' })
    }
  }

  const choices: { label: string; run: () => void; kind: string }[] =
    !feedback || !card
      ? []
      : current.fresh
        ? feedback.mode === 'alternatives'
          ? [{ label: 'Continue', kind: 'good', run: () => record(card, 'correct', feedback.typed) }]
          : [
              { label: 'Count as correct', kind: 'good', run: () => record(card, 'accepted', feedback.typed) },
              { label: 'Repeat again', kind: 'bad', run: () => record(card, 'reset', feedback.typed) },
            ]
        : feedback.mode === 'retry-wrong'
          ? [
              { label: 'Count as correct', kind: 'good', run: () => advance(false) },
              { label: 'Repeat again', kind: 'bad', run: () => advance(true) },
            ]
          : [
              {
                label: 'Count as correct',
                kind: 'good',
                run: () => record(card, feedback.mode === 'alternatives' ? 'correct' : 'accepted', feedback.typed),
              },
              { label: 'One phase back', kind: 'warn', run: () => record(card, 'down_one', feedback.typed) },
              { label: 'Back to phase 1', kind: 'bad', run: () => record(card, 'reset', feedback.typed) },
            ]

  // Laptop shortcuts: 1 / 2 / 3 pick a choice, Enter closes an intro card.
  useEffect(() => {
    const isIntro = current?.kind === 'intro'
    if (!choices.length && !isIntro) return
    const onKey = (e: KeyboardEvent) => {
      if (isIntro && (e.key === 'Enter' || e.key === '1')) {
        e.preventDefault()
        advance(false)
        return
      }
      const choice = choices[Number(e.key) - 1]
      if (choice) {
        e.preventDefault()
        choice.run()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function insertChar(ch: string) {
    const el = inputRef.current
    if (!el || feedback) return
    const start = el.selectionStart ?? typed.length
    const end = el.selectionEnd ?? start
    setTyped(typed.slice(0, start) + ch + typed.slice(end))
    requestAnimationFrame(() => el.setSelectionRange(start + 1, start + 1))
  }

  if (!folder) return <div className="page"><p>Unknown folder.</p><Link to="/">Back</Link></div>

  if (!card || !vocab) {
    const own = cards.filter((c) => c.direction === direction && vocabById.get(c.vocab_id)?.language === language)
    const stillDue = own.filter((c) => isDue(c, now)).length
    const next = upcoming(own, now)
    return (
      <div className="page session-done">
        <h1>{total ? 'Done!' : 'Nothing due'}</h1>
        {total > 0 && (
          <p>
            {total} words · <span className="good-text">{stats.right} right</span> ·{' '}
            <span className="bad-text">{stats.wrong} wrong</span>
          </p>
        )}
        {stillDue > 0 && <p><strong>{stillDue}</strong> more word{stillDue === 1 ? ' is' : 's are'} due now.</p>}
        {next.length > 0 && (
          <div className="up-next">
            <h2>Up next</h2>
            <ul>
              {next.map((n) => (
                <li key={n.day}>
                  <span>{formatDue(n.day, now)}</span>
                  <strong>{n.count} word{n.count === 1 ? '' : 's'}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button className="btn primary" onClick={() => navigate('/')}>Back to folders</button>
      </div>
    )
  }

  const hint =
    direction === 'to_german'
      ? 'Deutsch'
      : `${LANGUAGE_NAME[language]}${language === 'es' && vocab.word_type === 'noun' ? ' (with article)' : ''}`

  return (
    <div className="page session">
      <div className="session-top">
        <button className="btn ghost icon" onClick={() => navigate('/')} aria-label="End session">✕</button>
        <div className="progress"><div style={{ width: `${(done / total) * 100}%` }} /></div>
        <span className="muted small">{done}/{total}</span>
      </div>

      <div className={`prompt ${flash ? 'flash' : ''}`}>
        <span className="muted small">
          {folder.label} · {current.kind === 'intro' ? 'new word' : current.fresh ? 'new word, first try' : `phase ${card.phase}`}
          {current.retry && ' · repeat'}
        </span>
        {direction === 'to_german' ? (
          <>
            <span className="prompt-word">{vocab.term}</span>
            {vocab.ipa && <span className="wd-ipa">{vocab.ipa}</span>}
          </>
        ) : (
          <ul className="prompt-translations">
            {vocab.translations.map((t, i) => <li key={i}>{formatTranslation(t)}</li>)}
          </ul>
        )}
        {vocab.word_type && <span className="badge">{vocab.word_type}</span>}
      </div>

      {current.kind === 'intro' ? (
        <div className="intro">
          <WordDetail vocab={vocab} />
          <button className="btn primary" onClick={() => advance(false)}>Got it</button>
        </div>
      ) : (
        <>
          <form onSubmit={submit} className="answer-form">
            <input
              ref={inputRef}
              className={`answer ${feedback ? (feedback.check.exact ? 'is-right' : 'is-wrong') : ''}`}
              value={typed}
              onChange={(e) => !feedback && setTyped(e.target.value)}
              placeholder={hint}
              autoFocus
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="done"
            />
            {!feedback && <button className="btn primary">Check</button>}
          </form>

          {language === 'es' && direction === 'to_foreign' && !feedback && (
            <div className="char-keys">
              {SPANISH_CHARS.map((ch) => (
                <button key={ch} type="button" className="btn ghost small" tabIndex={-1}
                  onPointerDown={(e) => e.preventDefault()} onClick={() => insertChar(ch)}>{ch}</button>
              ))}
            </div>
          )}

          {feedback && (
            <div className="feedback">
              {feedback.check.exact ? (
                <p className="good-text"><strong>✓ Correct.</strong> Other valid answers:</p>
              ) : (
                <div className="diff">
                  {feedback.typed.trim() && (
                    <p><span className="muted">Your answer</span> <Chars chars={diff(feedback.typed, feedback.check.expected).typed} kind="extra" /></p>
                  )}
                  <p><span className="muted">Correct</span> <Chars chars={diff(feedback.typed, feedback.check.expected).expected} kind="missing" /></p>
                </div>
              )}
              {feedback.check.alternatives.length > 0 && (
                <p className="alternatives">
                  {!feedback.check.exact && <span className="muted">Also accepted: </span>}
                  {feedback.check.alternatives.join(' · ')}
                </p>
              )}

              <div className="choices">
                {choices.map((c, i) => (
                  <button key={c.label} className={`btn choice ${c.kind}`} onClick={c.run}>
                    <kbd>{i + 1}</kbd> {c.label}
                  </button>
                ))}
              </div>

              <WordDetail vocab={vocab} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Chars({ chars, kind }: { chars: DiffChar[]; kind: 'extra' | 'missing' }) {
  return (
    <span className="chars">
      {chars.map((c, i) => <span key={i} className={c.ok ? '' : kind}>{c.ch}</span>)}
    </span>
  )
}

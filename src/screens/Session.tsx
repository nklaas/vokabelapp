import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { WordDetail } from '../components/WordDetail'
import { checkAnswer, diff, type CheckResult, type DiffChar } from '../lib/answer'
import { saveReview } from '../lib/db'
import { formatTranslation, LANGUAGE_NAME } from '../lib/format'
import { isDue, nextState } from '../lib/srs'
import { errorMessage, useData } from '../state/data'
import { FOLDERS, type Card, type Direction, type Language, type ReviewResult } from '../types'

interface Item {
  cardId: string
  /** A word answered wrongly earlier in this session; repeating it no longer changes the phase. */
  retry: boolean
}

interface Feedback {
  check: CheckResult
  typed: string
  mode: 'wrong' | 'alternatives' | 'retry-wrong'
}

const SPANISH_CHARS = ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ', '¿', '¡']

function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function Session() {
  const params = useParams()
  const language = params.language as Language
  const direction = params.direction as Direction
  const folder = FOLDERS.find((f) => f.language === language && f.direction === direction)
  const { cards, vocabById, settings, putCards, toast } = useData()
  const navigate = useNavigate()

  // The session is fixed when it starts: due cards of this folder, shuffled, capped.
  const [queue, setQueue] = useState<Item[]>(() => {
    const now = new Date()
    const due = cards.filter(
      (c) => c.direction === direction && isDue(c, now) && vocabById.get(c.vocab_id)?.language === language,
    )
    return shuffle(due).slice(0, settings.session_size).map((c) => ({ cardId: c.id, retry: false }))
  })
  const [total] = useState(queue.length)
  const [typed, setTyped] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [stats, setStats] = useState({ right: 0, wrong: 0 })
  const [flash, setFlash] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const current = queue[0]
  const card = current ? cards.find((c) => c.id === current.cardId) : undefined
  const vocab = card ? vocabById.get(card.vocab_id) : undefined
  const remainingFirst = queue.filter((i) => !i.retry).length

  function advance(requeue: boolean) {
    setQueue(([head, ...rest]) => (requeue ? [...rest, { cardId: head.cardId, retry: true }] : rest))
    setTyped('')
    setFeedback(null)
    inputRef.current?.focus() // inside the tap/keypress, so the iPhone keyboard stays open
  }

  /** Saves in the background so the next word appears instantly. */
  function record(c: Card, result: ReviewResult, answer: string) {
    const next = nextState(c, result, settings)
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
    if (!card || !vocab || feedback) return
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

  // Laptop shortcuts: 1 / 2 / 3 pick a choice.
  useEffect(() => {
    if (!choices.length) return
    const onKey = (e: KeyboardEvent) => {
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
    return (
      <div className="page session-done">
        <h1>{total ? 'Done!' : 'Nothing due'}</h1>
        {total > 0 && (
          <p>
            {total} words · <span className="good-text">{stats.right} right</span> ·{' '}
            <span className="bad-text">{stats.wrong} wrong</span>
          </p>
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
        <div className="progress"><div style={{ width: `${((total - remainingFirst) / total) * 100}%` }} /></div>
        <span className="muted small">{total - remainingFirst}/{total}</span>
      </div>

      <div className={`prompt ${flash ? 'flash' : ''}`}>
        <span className="muted small">
          {folder.label} · phase {card.phase}
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

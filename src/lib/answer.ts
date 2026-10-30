// Answer checking (see docs/SPEC.md, "Learning").
// Case, surrounding punctuation, hyphens and extra spaces never matter; accents always do.
// Spanish nouns need their article, English verbs and infinitive phrases may omit "to",
// German nouns may omit the article.
import type { Direction, Vocab } from '../types'

export interface CheckResult {
  exact: boolean
  /** The listed answer that was matched, or the closest one if nothing matched. */
  expected: string
  /** All other valid answers, shown for confirmation. */
  alternatives: string[]
  /** Wrong, but close to the expected answer (typo, accent, article): the differences are marked. */
  close: boolean
  /** A word from the "also correct" list: right meaning, but not the word being learned (= expected). */
  alsoCorrect: boolean
}

const GERMAN_ARTICLE = /^(der|die|das)\s+/

function normalize(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\([^)]*\)/g, ' ') // "(etw.) aufgeben" -> "aufgeben"
    .replace(/[.,;:!?¡¿"-]/g, ' ') // "falling-out" = "falling out"
    .replace(/\s+/g, ' ')
    .trim()
}

function key(s: string, vocab: Vocab, direction: Direction): string {
  let k = normalize(s)
  if (direction === 'to_german') k = k.replace(GERMAN_ARTICLE, '')
  // "to" is optional for verbs and infinitive phrases ("to cut corners").
  else if (vocab.language === 'en' && /^to\s/i.test(vocab.term)) k = k.replace(/^to\s+/, '')
  return k
}

/**
 * "el/la periodista" is accepted as "el periodista", "la periodista" and as written;
 * "(vor Wut) kochen" as "kochen" and as "vor Wut kochen".
 */
function variants(answer: string): string[] {
  const m = answer.match(/^(el|la|los|las)\/(el|la|los|las)\s+(.+)$/i)
  const forms = m ? [answer, `${m[1]} ${m[3]}`, `${m[2]} ${m[3]}`] : [answer]
  return answer.includes('(') ? [...forms, ...forms.map((f) => f.replace(/[()]/g, ''))] : forms
}

export function validAnswers(vocab: Vocab, direction: Direction): string[] {
  return direction === 'to_foreign' ? [vocab.term, ...vocab.synonyms] : vocab.translations.map((t) => t.de)
}

export function checkAnswer(typed: string, vocab: Vocab, direction: Direction): CheckResult {
  const answers = validAnswers(vocab, direction)
  const typedKey = key(typed, vocab, direction)

  const matched = answers.find((a) => variants(a).some((v) => key(v, vocab, direction) === typedKey))
  if (matched !== undefined) {
    return { exact: true, expected: matched, alternatives: answers.filter((a) => a !== matched), close: false, alsoCorrect: false }
  }

  const same = (a: string) => variants(a).some((v) => key(v, vocab, direction) === typedKey)
  if (direction === 'to_foreign' && (vocab.also_correct ?? []).some(same)) {
    return { exact: false, expected: vocab.term, alternatives: [], close: false, alsoCorrect: true }
  }

  let closest = answers[0] ?? ''
  let best = Infinity
  let length = 0
  for (const a of answers) {
    for (const v of variants(a)) {
      const k = key(v, vocab, direction)
      const d = levenshtein(typedKey, k)
      if (d < best) [best, closest, length] = [d, a, k.length]
    }
  }
  // Up to one wrong letter in four is a near miss; anything further off is a different word.
  const close = typedKey !== '' && best <= Math.max(1, Math.floor(length / 4))
  return { exact: false, expected: closest, alternatives: answers.filter((a) => a !== closest), close, alsoCorrect: false }
}

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = up
    }
  }
  return prev[b.length]
}

export interface DiffChar {
  ch: string
  ok: boolean
}

/**
 * The expected answer with the places where a near miss differs from it, for display.
 * Optional parts (German article, English "to", parentheses) are never marked, a mostly wrong word is marked whole.
 */
export function marks(typed: string, expected: string, vocab: Vocab, direction: Direction): DiffChar[] {
  let t = typed.trim()
  let e = expected
  let head: DiffChar[] = []
  const optional =
    direction === 'to_german' ? /^(der|die|das)\s+/i : vocab.language === 'en' && /^to\s/i.test(vocab.term) ? /^to\s+/i : null
  const pair = e.match(/^(el|la|los|las)\/(el|la|los|las)\s+/i)
  if (optional?.test(e)) {
    // Not required, and any German article is accepted, so it is never marked.
    head = [...e.match(optional)![0]].map((ch) => ({ ch, ok: true }))
    e = e.replace(optional, '')
    t = t.replace(optional, '')
  } else if (pair) {
    // "el/la periodista": either article is right.
    const article = t.match(/^(el|la|los|las)\s+/i)
    const ok = article !== null && [pair[1], pair[2]].some((a) => a.toLowerCase() === article[1].toLowerCase())
    head = [...pair[0]].map((ch) => ({ ch, ok }))
    e = e.slice(pair[0].length)
    if (article) t = t.slice(article[0].length)
  }

  const out = [...head, ...wholeWords(diff(t, e))]
  let depth = 0
  return out.map((c, i) => {
    if (c.ch === '(') depth++
    const inParens = depth > 0 || (c.ch === ' ' && (out[i - 1]?.ch === ')' || out[i + 1]?.ch === '('))
    if (c.ch === ')') depth = Math.max(0, depth - 1)
    return inParens ? { ...c, ok: true } : c
  })
}

/** A word that is at least half wrong is marked as a whole instead of letter by letter. */
function wholeWords(chars: DiffChar[]): DiffChar[] {
  const out = [...chars]
  let start = 0
  for (let i = 0; i <= out.length; i++) {
    if (i < out.length && out[i].ch !== ' ') continue
    const word = out.slice(start, i)
    if (word.length && word.filter((c) => !c.ok).length * 2 >= word.length) {
      for (let j = start; j < i; j++) out[j] = { ...out[j], ok: false }
    }
    start = i + 1
  }
  return out
}

/** Character diff: the expected chars, flagged where the typed answer does not have them. */
function diff(typed: string, expected: string): DiffChar[] {
  const a = [...typed.trim()]
  const b = [...expected]
  const same = (x: string, y: string) => x.toLowerCase() === y.toLowerCase()

  // Longest common subsequence table.
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = same(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const out: DiffChar[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (same(a[i], b[j])) {
      out.push({ ch: b[j++], ok: true })
      i++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++
    } else {
      out.push({ ch: b[j++], ok: false })
    }
  }
  while (j < b.length) out.push({ ch: b[j++], ok: false })
  return out
}

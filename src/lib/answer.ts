// Answer checking (see docs/SPEC.md, "Learning").
// Case, surrounding punctuation and extra spaces never matter; accents always do.
// Spanish nouns need their article, English verbs and infinitive phrases may omit "to",
// German nouns may omit the article.
import type { Direction, Vocab } from '../types'

export interface CheckResult {
  exact: boolean
  /** The listed answer that was matched, or the closest one if nothing matched. */
  expected: string
  /** All other valid answers, shown for confirmation. */
  alternatives: string[]
}

const GERMAN_ARTICLE = /^(der|die|das)\s+/

function normalize(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\([^)]*\)/g, ' ') // "(etw.) aufgeben" -> "aufgeben"
    .replace(/[.,;:!?¡¿"]/g, ' ')
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

/** "el/la periodista" is accepted as "el periodista", "la periodista" and as written. */
function variants(answer: string): string[] {
  const m = answer.match(/^(el|la|los|las)\/(el|la|los|las)\s+(.+)$/i)
  return m ? [answer, `${m[1]} ${m[3]}`, `${m[2]} ${m[3]}`] : [answer]
}

export function validAnswers(vocab: Vocab, direction: Direction): string[] {
  return direction === 'to_foreign' ? [vocab.term, ...vocab.synonyms] : vocab.translations.map((t) => t.de)
}

export function checkAnswer(typed: string, vocab: Vocab, direction: Direction): CheckResult {
  const answers = validAnswers(vocab, direction)
  const typedKey = key(typed, vocab, direction)

  const matched = answers.find((a) => variants(a).some((v) => key(v, vocab, direction) === typedKey))
  if (matched !== undefined) {
    return { exact: true, expected: matched, alternatives: answers.filter((a) => a !== matched) }
  }

  let closest = answers[0] ?? ''
  let best = Infinity
  for (const a of answers) {
    const d = levenshtein(typedKey, key(a, vocab, direction))
    if (d < best) [best, closest] = [d, a]
  }
  return { exact: false, expected: closest, alternatives: answers.filter((a) => a !== closest) }
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

/** Character diff for display: which typed chars are wrong, which expected chars were missed. */
export function diff(typed: string, expected: string): { typed: DiffChar[]; expected: DiffChar[] } {
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

  const outA: DiffChar[] = []
  const outB: DiffChar[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (same(a[i], b[j])) {
      outA.push({ ch: a[i++], ok: true })
      outB.push({ ch: b[j++], ok: true })
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      outA.push({ ch: a[i++], ok: false })
    } else {
      outB.push({ ch: b[j++], ok: false })
    }
  }
  while (i < a.length) outA.push({ ch: a[i++], ok: false })
  while (j < b.length) outB.push({ ch: b[j++], ok: false })
  return { typed: outA, expected: outB }
}

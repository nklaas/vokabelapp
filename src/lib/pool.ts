// Grouping and ordering of the word pool (see docs/SPEC.md, "Vocab pool" and "Activation").
import type { Card, Direction, Vocab } from '../types'

/** The direction new words are learned in from the pool; the other one is offered as a small option. */
export const MAIN_DIRECTION: Direction = 'to_foreign'

export const LEVELS = ['B1', 'B2', 'C1', 'C2'] as const

export type CardsByVocab = Map<string, Partial<Record<Direction, Card>>>

export function cardsByVocab(cards: Card[]): CardsByVocab {
  const map: CardsByVocab = new Map()
  for (const c of cards) map.set(c.vocab_id, { ...map.get(c.vocab_id), [c.direction]: c })
  return map
}

/** Not a draft and not yet learned (active or finished) in the main direction. */
export function isNew(v: Vocab, cards: CardsByVocab): boolean {
  return !v.is_draft && !cards.get(v.id)?.[MAIN_DIRECTION]
}

function levelRank(v: Vocab): number {
  const i = v.level ? LEVELS.indexOf(v.level) : -1
  return i < 0 ? LEVELS.length : i
}

/** New words first, easiest level first; then the words already being learned; drafts last. */
export function poolOrder(words: Vocab[], cards: CardsByVocab): Vocab[] {
  const group = (v: Vocab) => (v.is_draft ? 2 : isNew(v, cards) ? 0 : 1)
  return [...words].sort((a, b) => group(a) - group(b) || levelRank(a) - levelRank(b) || a.term.localeCompare(b.term, 'es'))
}

export interface TopicStats {
  total: number
  learning: number
  /** e.g. "B1–C2", empty when no word has a level. */
  levels: string
}

export function topicStats(words: Vocab[], cards: CardsByVocab): TopicStats {
  const usable = words.filter((v) => !v.is_draft)
  const ranks = usable.map(levelRank).filter((r) => r < LEVELS.length)
  const lo = LEVELS[Math.min(...ranks)]
  const hi = LEVELS[Math.max(...ranks)]
  return {
    total: usable.length,
    learning: usable.filter((v) => !isNew(v, cards)).length,
    levels: ranks.length ? (lo === hi ? lo : `${lo}–${hi}`) : '',
  }
}

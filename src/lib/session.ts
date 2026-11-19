// An unfinished learning session, kept on this device (see docs/SPEC.md, "Learning").
import { isActive, isDue, needsIntro, startOfToday } from './srs'
import { loadJson } from './storage'
import type { Card, Direction, Language } from '../types'

export interface Item {
  cardId: string
  /** 'intro' shows the full card of a new word (guided tour), 'ask' asks for the answer. */
  kind: 'intro' | 'ask'
  /** Asked right after its intro: the word stays in phase 1 and comes back tomorrow. */
  fresh: boolean
  /** A word answered wrongly earlier in this session; repeating it no longer changes the phase. */
  retry: boolean
  /** A new word introduced in this session: when wrong, it is repeated before the next batch of new words. */
  tour: boolean
}

/** An unfinished session, kept on this device so closing the app mid-session loses nothing. */
export interface SavedSession {
  day: string
  queue: Item[]
  total: number
  stats: { right: number; wrong: number }
}

export function sessionKey(userId: string, language: Language, direction: Direction): string {
  return `session.${userId}.${language}.${direction}`
}

/** Today's unfinished session, without the words that were meanwhile answered elsewhere. */
export function resumeSession(key: string, cards: Card[], now: Date): SavedSession | null {
  const saved = loadJson<SavedSession>(key)
  if (!saved || saved.day !== startOfToday(now).toISOString()) return null
  const byId = new Map(cards.map((c) => [c.id, c]))
  const queue = saved.queue.filter((i) => {
    const c = byId.get(i.cardId)
    if (!c || !isActive(c)) return false
    if (i.retry) return true
    return i.tour ? needsIntro(c) : isDue(c, now)
  })
  return queue.length ? { ...saved, queue } : null
}

/** Words of a folder still open today: everything due plus the words of an unfinished session still to repeat. */
export function openToday(folderCards: Card[], key: string, allCards: Card[], now: Date): number {
  const open = new Set(folderCards.filter((c) => isDue(c, now)).map((c) => c.id))
  for (const i of resumeSession(key, allCards, now)?.queue ?? []) open.add(i.cardId)
  return open.size
}

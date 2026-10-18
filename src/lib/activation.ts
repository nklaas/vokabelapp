import { insertCards, resetCards } from './db'
import { activationDue } from './srs'
import type { Card, Direction, Settings } from '../types'

const CHUNK = 500

/** Activates new words and resets already active/learned cards to phase 1. Returns all written cards. */
export async function activate(
  settings: Settings,
  direction: Direction,
  vocabIds: string[],
  cardIdsToReset: string[],
): Promise<Card[]> {
  const due = activationDue(settings)
  const written: Card[] = []
  for (let i = 0; i < vocabIds.length; i += CHUNK) {
    written.push(...(await insertCards(vocabIds.slice(i, i + CHUNK), direction, due)))
  }
  for (let i = 0; i < cardIdsToReset.length; i += CHUNK) {
    written.push(...(await resetCards(cardIdsToReset.slice(i, i + CHUNK), due)))
  }
  return written
}

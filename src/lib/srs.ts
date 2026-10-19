// Spaced repetition rules (see docs/SPEC.md, "Phases").
// A card entering phase k is due interval[k-1] days later, counted from the start of today,
// so a word reviewed in the evening is due again in the morning of its due day.
import type { Card, ReviewResult, Settings } from '../types'

export function startOfToday(now = new Date()): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d
}

export function dueAfter(days: number, now = new Date()): string {
  const d = startOfToday(now)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

/** Phase clamped to the configured number of phases (phases can be removed in the settings). */
export function effectivePhase(card: Pick<Card, 'phase'>, settings: Settings): number {
  return Math.min(Math.max(card.phase, 1), settings.phase_intervals.length)
}

export function isActive(card: Card): boolean {
  return card.learned_at === null && card.phase > 0
}

export function isDue(card: Card, now = new Date()): boolean {
  return isActive(card) && new Date(card.due_at) <= now
}

export function activationDue(settings: Settings, now = new Date()): string {
  return settings.new_cards_due_immediately ? now.toISOString() : dueAfter(settings.phase_intervals[0], now)
}

export function nextState(
  card: Card,
  result: ReviewResult,
  settings: Settings,
  now = new Date(),
): Pick<Card, 'phase' | 'due_at' | 'learned_at'> {
  const intervals = settings.phase_intervals
  const phase = effectivePhase(card, settings)

  if (result === 'correct' || result === 'accepted') {
    if (phase >= intervals.length) return { phase, due_at: card.due_at, learned_at: now.toISOString() }
    return { phase: phase + 1, due_at: dueAfter(intervals[phase], now), learned_at: null }
  }

  const newPhase = result === 'reset' ? 1 : Math.max(1, phase - 1)
  return { phase: newPhase, due_at: dueAfter(intervals[newPhase - 1], now), learned_at: null }
}

/** Never answered since it was (re)activated: the session first shows its full card (guided tour). */
export function needsIntro(card: Card): boolean {
  return card.last_reviewed_at === null || new Date(card.last_reviewed_at) < new Date(card.activated_at)
}

/** The first answer right after the tour proves little: the word stays in phase 1 and is asked again tomorrow. */
export function introducedState(settings: Settings, now = new Date()): Pick<Card, 'phase' | 'due_at' | 'learned_at'> {
  return { phase: 1, due_at: dueAfter(settings.phase_intervals[0], now), learned_at: null }
}

/** Active cards due later, grouped by calendar day, soonest first. */
export function upcoming(cards: Card[], now = new Date(), days = 3): { day: string; count: number }[] {
  const byDay = new Map<string, number>()
  for (const c of cards) {
    if (!isActive(c) || isDue(c, now)) continue
    const day = startOfToday(new Date(c.due_at)).toISOString()
    byDay.set(day, (byDay.get(day) ?? 0) + 1)
  }
  return [...byDay].sort(([a], [b]) => a.localeCompare(b)).slice(0, days).map(([day, count]) => ({ day, count }))
}

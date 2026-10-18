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

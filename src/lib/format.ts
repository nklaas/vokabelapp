import type { Language, Translation } from '../types'

export const LANGUAGE_NAME: Record<Language, string> = { en: 'English', es: 'Spanish' }

export function formatInterval(days: number): string {
  if (days < 7) return days === 1 ? '1 day' : `${days} days`
  if (days < 30) return days % 7 === 0 ? plural(days / 7, 'week') : `${days} days`
  if (days < 365) return days % 30 === 0 ? plural(days / 30, 'month') : `${days} days`
  return days % 365 === 0 ? plural(days / 365, 'year') : `${days} days`
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'}`
}

export function formatTranslation(t: Translation): string {
  return t.context ? `${t.de} (${t.context})` : t.de
}

export function formatDue(iso: string, now = new Date()): string {
  const due = new Date(iso)
  const days = Math.round((startOfDay(due) - startOfDay(now)) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days < 30) return `in ${days} days`
  return due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

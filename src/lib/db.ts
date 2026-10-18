// All database reads and writes of the app.
import { supabase } from './supabase'
import type { Card, Cluster, Direction, Language, Profile, ReviewResult, Settings, Vocab } from '../types'

const PAGE = 1000 // Supabase returns at most 1000 rows per request

async function fetchAll<T>(table: string, orderBy: string): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').order(orderBy).range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...(data as T[]))
    if (data.length < PAGE) return rows
  }
}

export interface Snapshot {
  profile: Profile
  settings: Settings
  clusters: Cluster[]
  vocab: Vocab[]
  cards: Card[]
  notes: Map<string, string>
}

export async function loadEverything(userId: string): Promise<Snapshot> {
  const [profiles, settings, clusters, vocab, cards, notes] = await Promise.all([
    fetchAll<Profile>('profiles', 'user_id'),
    fetchAll<Settings & { user_id: string }>('settings', 'user_id'),
    fetchAll<Cluster>('clusters', 'name'),
    fetchAll<Vocab>('vocab', 'id'),
    fetchAll<Card>('cards', 'id'),
    fetchAll<{ vocab_id: string; note: string }>('vocab_notes', 'vocab_id'),
  ])
  const profile = profiles.find((p) => p.user_id === userId)
  const ownSettings = settings.find((s) => s.user_id === userId)
  if (!profile || !ownSettings) throw new Error('Profile or settings missing for this account.')
  vocab.sort((a, b) => a.term.localeCompare(b.term, 'es'))
  return {
    profile,
    settings: ownSettings,
    clusters,
    vocab,
    cards,
    notes: new Map(notes.map((n) => [n.vocab_id, n.note])),
  }
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export async function insertCards(vocabIds: string[], direction: Direction, dueAt: string): Promise<Card[]> {
  if (vocabIds.length === 0) return []
  const rows = vocabIds.map((vocab_id) => ({ vocab_id, direction, phase: 1, due_at: dueAt }))
  const { data, error } = await supabase.from('cards').insert(rows).select()
  if (error) throw error
  return data as Card[]
}

export async function resetCards(cardIds: string[], dueAt: string): Promise<Card[]> {
  if (cardIds.length === 0) return []
  const { data, error } = await supabase
    .from('cards')
    .update({ phase: 1, due_at: dueAt, learned_at: null, activated_at: new Date().toISOString() })
    .in('id', cardIds)
    .select()
  if (error) throw error
  return data as Card[]
}

export async function deleteCards(cardIds: string[]): Promise<void> {
  for (let i = 0; i < cardIds.length; i += 100) {
    const { error } = await supabase.from('cards').delete().in('id', cardIds.slice(i, i + 100))
    if (error) throw error
  }
}

export async function saveReview(
  card: Card,
  next: Pick<Card, 'phase' | 'due_at' | 'learned_at'>,
  review: { language: Language; answer: string; result: ReviewResult },
): Promise<Card> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('cards')
    .update({ ...next, last_reviewed_at: now })
    .eq('id', card.id)
    .select()
    .single()
  if (error) throw error
  const { error: reviewError } = await supabase.from('reviews').insert({
    card_id: card.id,
    direction: card.direction,
    phase_before: card.phase,
    phase_after: next.phase,
    ...review,
  })
  if (reviewError) throw reviewError
  return data as Card
}

// ---------------------------------------------------------------------------
// Vocab, clusters, notes
// ---------------------------------------------------------------------------

export type VocabInput = Omit<Vocab, 'id' | 'created_by'>

export function isDuplicateError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'
}

export async function insertVocab(input: Partial<VocabInput> & Pick<VocabInput, 'language' | 'term'>): Promise<Vocab> {
  const { data, error } = await supabase.from('vocab').insert(input).select().single()
  if (error) throw error
  return data as Vocab
}

export async function updateVocab(id: string, input: Partial<VocabInput>): Promise<Vocab> {
  const { data, error } = await supabase.from('vocab').update(input).eq('id', id).select().single()
  if (error) throw error
  return data as Vocab
}

export async function deleteVocab(id: string): Promise<void> {
  const { error } = await supabase.from('vocab').delete().eq('id', id)
  if (error) throw error
}

export async function insertCluster(language: Language, name: string): Promise<Cluster> {
  const { data, error } = await supabase.from('clusters').insert({ language, name }).select().single()
  if (error) throw error
  return data as Cluster
}

export async function saveNote(userId: string, vocabId: string, note: string): Promise<void> {
  const { error } = note.trim()
    ? await supabase.from('vocab_notes').upsert({ user_id: userId, vocab_id: vocabId, note: note.trim() })
    : await supabase.from('vocab_notes').delete().eq('user_id', userId).eq('vocab_id', vocabId)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Settings and profile
// ---------------------------------------------------------------------------

export async function saveSettings(userId: string, settings: Settings): Promise<void> {
  const { phase_intervals, session_size, confirm_alternatives, new_cards_due_immediately } = settings
  const { error } = await supabase
    .from('settings')
    .update({ phase_intervals, session_size, confirm_alternatives, new_cards_due_immediately })
    .eq('user_id', userId)
  if (error) throw error
}

export async function saveDisplayName(userId: string, name: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ display_name: name }).eq('user_id', userId)
  if (error) throw error
}

// Mirrors supabase/schema.sql.

export type Language = 'en' | 'es'
export type Direction = 'to_foreign' | 'to_german'
export type ReviewResult = 'correct' | 'accepted' | 'down_one' | 'reset'

export type WordType =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'preposition'
  | 'conjunction'
  | 'phrase'
  | 'other'

export interface Translation {
  de: string
  context?: string
}

export interface Cluster {
  id: string
  language: Language
  name: string
  description: string | null
}

export interface Vocab {
  id: string
  language: Language
  cluster_id: string | null
  term: string
  word_type: WordType | null
  translations: Translation[]
  ipa: string | null
  gender: 'm' | 'f' | 'm/f' | null
  plural: string | null
  forms: Record<string, string> | null
  region: string | null
  synonyms: string[]
  example: string | null
  example_de: string | null
  notes: string | null
  level: 'B1' | 'B2' | 'C1' | 'C2' | null
  tags: string[]
  is_draft: boolean
  created_by: string | null
}

export interface Profile {
  user_id: string
  display_name: string
  is_admin: boolean
}

export interface VocabNote {
  vocab_id: string
  note: string
}

export interface Card {
  id: string
  vocab_id: string
  direction: Direction
  phase: number
  due_at: string
  learned_at: string | null
  activated_at: string
  last_reviewed_at: string | null
}

export interface Settings {
  phase_intervals: number[]
  session_size: number
  confirm_alternatives: boolean
  new_cards_due_immediately: boolean
}

// The four learning folders.
export const FOLDERS: { language: Language; direction: Direction; label: string }[] = [
  { language: 'en', direction: 'to_foreign', label: 'German → English' },
  { language: 'en', direction: 'to_german', label: 'English → German' },
  { language: 'es', direction: 'to_foreign', label: 'German → Spanish' },
  { language: 'es', direction: 'to_german', label: 'Spanish → German' },
]

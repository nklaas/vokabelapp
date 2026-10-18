import { createContext, useContext } from 'react'
import type { Card, Cluster, Profile, Settings, Vocab } from '../types'

export interface Data {
  userId: string
  profile: Profile
  settings: Settings
  clusters: Cluster[]
  vocab: Vocab[]
  vocabById: Map<string, Vocab>
  cards: Card[]
  notes: Map<string, string>

  reload: () => Promise<void>
  /** Replace or add cards in local state after a successful write. */
  putCards: (cards: Card[]) => void
  removeCards: (cardIds: string[]) => void
  putVocab: (vocab: Vocab) => void
  removeVocab: (vocabId: string) => void
  putCluster: (cluster: Cluster) => void
  setNote: (vocabId: string, note: string) => void
  setSettings: (settings: Settings) => void
  setProfile: (profile: Profile) => void
  toast: (message: string) => void
}

export const DataContext = createContext<Data | null>(null)

export function useData(): Data {
  const data = useContext(DataContext)
  if (!data) throw new Error('useData outside DataProvider')
  return data
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) return String(error.message)
  return String(error)
}

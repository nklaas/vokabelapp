// Format and validation of vocab import files (see docs/VOCAB_RULES.md).
import type { Language, Translation, WordType } from '../../src/types.ts'

export interface WordIn {
  term: string
  word_type: WordType
  translations: Translation[]
  level: 'B1' | 'B2' | 'C1' | 'C2'
  cluster?: string
  ipa?: string
  gender?: 'm' | 'f' | 'm/f'
  plural?: string
  forms?: Record<string, string>
  region?: string
  synonyms?: string[]
  example?: string
  example_de?: string
  notes?: string
  tags?: string[]
}

export interface VocabFile {
  language: Language
  cluster?: string
  cluster_description?: string
  words: WordIn[]
}

const WORD_TYPES = ['noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'phrase', 'other']
const LEVELS = ['B1', 'B2', 'C1', 'C2']
const SPANISH_ARTICLE = /^(el|la|los|las|el\/la|los\/las) /

/** Returns a list of problems; empty means the file can be imported. */
export function validate(file: VocabFile): string[] {
  const problems: string[] = []
  if (file.language !== 'en' && file.language !== 'es') problems.push(`language must be "en" or "es"`)
  if (!Array.isArray(file.words) || file.words.length === 0) problems.push('words must be a non-empty list')

  const seen = new Set<string>()
  for (const [i, w] of (file.words ?? []).entries()) {
    const at = `#${i + 1} "${w.term ?? '?'}"`
    const bad = (msg: string) => problems.push(`${at}: ${msg}`)

    if (!w.term?.trim()) bad('term is missing')
    if (!WORD_TYPES.includes(w.word_type)) bad(`word_type must be one of ${WORD_TYPES.join(', ')}`)
    if (!LEVELS.includes(w.level)) bad(`level must be one of ${LEVELS.join(', ')}`)
    if (!Array.isArray(w.translations) || w.translations.length === 0 || w.translations.some((t) => !t.de?.trim())) {
      bad('needs at least one translation, each with "de"')
    }
    if (!w.cluster && !file.cluster) bad('no cluster (set "cluster" on the file or the word)')
    if (w.forms && Object.values(w.forms).some((v) => typeof v !== 'string')) bad('forms values must be strings')

    if (file.language === 'es') {
      if (w.ipa) bad('Spanish words get no IPA')
      if (w.word_type === 'noun') {
        if (!SPANISH_ARTICLE.test(w.term)) bad('Spanish nouns must start with their article')
        if (!w.gender) bad('Spanish nouns need gender')
      }
    } else {
      if (!w.ipa) bad('English words need IPA (American)')
      if (w.gender) bad('English words get no gender')
      if (w.word_type === 'verb' && !w.term.startsWith('to ')) bad('English verbs are written with "to"')
    }

    const key = `${w.term?.toLowerCase()}|${w.word_type}`
    if (seen.has(key)) bad('appears twice in this file')
    seen.add(key)
  }
  return problems
}

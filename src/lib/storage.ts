// Small per-device preferences (e.g. last chosen language). Never essential: failures are ignored.

export function loadPref<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const value = localStorage.getItem(`vokabelapp.${key}`) as T | null
    return value && allowed.includes(value) ? value : fallback
  } catch {
    return fallback
  }
}

export function savePref(key: string, value: string): void {
  try {
    localStorage.setItem(`vokabelapp.${key}`, value)
  } catch {
    // private mode or blocked storage: the preference just isn't remembered
  }
}

export function loadJson<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(`vokabelapp.${key}`)
    return value ? (JSON.parse(value) as T) : null
  } catch {
    return null
  }
}

export function saveJson(key: string, value: unknown): void {
  savePref(key, JSON.stringify(value))
}

export function removePref(key: string): void {
  try {
    localStorage.removeItem(`vokabelapp.${key}`)
  } catch {
    // nothing stored, nothing to remove
  }
}

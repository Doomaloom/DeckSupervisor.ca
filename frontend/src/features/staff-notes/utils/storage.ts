import { getScopedKey } from '../../../lib/storageScope'
import type { TabKey } from '../types'

const NOTES_STORAGE_PREFIX = () => getScopedKey('notes')

export const buildStorageKey = (sessionId: string, tab: TabKey) =>
  `${NOTES_STORAGE_PREFIX()}::${sessionId}::${tab}`

export const loadJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') {
    return fallback
  }
  try {
    const value = window.localStorage.getItem(key)
    if (!value) {
      return fallback
    }
    return JSON.parse(value) as T
  } catch (error) {
    console.error(`Failed to parse ${key} from localStorage`, error)
    return fallback
  }
}

export const saveJson = <T,>(key: string, value: T) => {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(key, JSON.stringify(value))
}

import { getScopedKey } from './storageScope'

const sessionsKey = () => getScopedKey('sessions')
const currentSessionKey = () => getScopedKey('currentSessionId')

export type StoredSessionEntry = {
  id: string
  sessionDay: string
  sessionSeason: string
  startDate: string
  endDate: string
  instructors: { name: string }[]
  rosterFileName?: string
}

export function loadSessions(): StoredSessionEntry[] {
  if (typeof window === 'undefined') {
    return []
  }
  const stored = window.localStorage.getItem(sessionsKey())
  if (!stored) {
    return []
  }
  try {
    return JSON.parse(stored) as StoredSessionEntry[]
  } catch (error) {
    console.error('Failed to parse stored sessions', error)
    return []
  }
}

export function saveSessions(sessions: StoredSessionEntry[]) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(sessionsKey(), JSON.stringify(sessions))
}

export function getCurrentSessionId(): string {
  if (typeof window === 'undefined') {
    return ''
  }
  return window.localStorage.getItem(currentSessionKey()) ?? ''
}

export function setCurrentSessionId(id: string) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(currentSessionKey(), id)
}

export function clearCurrentSessionId() {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(currentSessionKey())
}

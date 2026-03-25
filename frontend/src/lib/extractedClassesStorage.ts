import type { ExtractedClass } from '../types/app'
import { getStoredItem, setStoredItem } from './browserStorage'
import { getScopedKey } from './storageScope'

const extractedClassesKey = () => getScopedKey('extractedClassesByScope')
const extractedClassesUpdatedEvent = () => getScopedKey('extracted-classes-updated')
const extractedClassesBySessionKey = () => getScopedKey('extractedClassesBySession')
const extractedClassesBySessionUpdatedEvent = () => getScopedKey('extracted-classes-by-session-updated')

type ExtractedClassesByScope = Record<string, ExtractedClass[]>
type ExtractedClassesBySession = Record<string, ExtractedClass[]>

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const value = getStoredItem(key)
    if (!value) {
      return fallback
    }
    return JSON.parse(value) as T
  } catch (error) {
    console.error(`Failed to parse ${key} from session storage`, error)
    return fallback
  }
}

function saveJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') {
    return
  }
  setStoredItem(key, JSON.stringify(value))
}

function toScopeKey(teamId: string, termKey: string) {
  return `${teamId}::${termKey}`
}

export function getExtractedClassesByScope(): ExtractedClassesByScope {
  return loadJson(extractedClassesKey(), {})
}

export function getExtractedClassesForScope(teamId: string, termKey: string): ExtractedClass[] {
  if (!teamId || !termKey) {
    return []
  }
  const all = getExtractedClassesByScope()
  return all[toScopeKey(teamId, termKey)] ?? []
}

export function getExtractedClassesBySession(): ExtractedClassesBySession {
  return loadJson(extractedClassesBySessionKey(), {})
}

export function getExtractedClassesForSession(sessionId: string): ExtractedClass[] {
  if (!sessionId) {
    return []
  }
  const all = getExtractedClassesBySession()
  return all[sessionId] ?? []
}

export function setExtractedClassesForScope(teamId: string, termKey: string, classes: ExtractedClass[]) {
  if (!teamId || !termKey) {
    return
  }
  const all = getExtractedClassesByScope()
  const scopeKey = toScopeKey(teamId, termKey)
  all[scopeKey] = classes
  saveJson(extractedClassesKey(), all)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(extractedClassesUpdatedEvent(), { detail: { scopeKey } }))
  }
}

export function setExtractedClassesForSession(sessionId: string, classes: ExtractedClass[]) {
  if (!sessionId) {
    return
  }
  const all = getExtractedClassesBySession()
  all[sessionId] = classes
  saveJson(extractedClassesBySessionKey(), all)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(extractedClassesBySessionUpdatedEvent(), { detail: { sessionId } }))
  }
}

export function onExtractedClassesUpdated(handler: (scopeKey: string) => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }
  const listener = (event: Event) => {
    const custom = event as CustomEvent<{ scopeKey?: string }>
    handler(custom.detail?.scopeKey ?? '')
  }
  const eventName = extractedClassesUpdatedEvent()
  window.addEventListener(eventName, listener)
  return () => window.removeEventListener(eventName, listener)
}

export function onExtractedClassesBySessionUpdated(handler: (sessionId: string) => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }
  const listener = (event: Event) => {
    const custom = event as CustomEvent<{ sessionId?: string }>
    handler(custom.detail?.sessionId ?? '')
  }
  const eventName = extractedClassesBySessionUpdatedEvent()
  window.addEventListener(eventName, listener)
  return () => window.removeEventListener(eventName, listener)
}

import { getStoredItem, setStoredItem } from './browserStorage'
import { getScopedKey } from './storageScope'

// Roster rows are stored by day elsewhere in the app. Retain their session
// provenance so two sessions on the same weekday cannot be exported together.
const key = (day: string) => getScopedKey(`loadedRosterSession:${day}`)
export function getLoadedRosterSession(day: string) { return getStoredItem(key(day)) ?? '' }
export function setLoadedRosterSession(day: string, sessionId: string) { setStoredItem(key(day), sessionId) }

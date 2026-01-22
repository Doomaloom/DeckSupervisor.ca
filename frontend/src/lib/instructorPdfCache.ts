import { getStudentsForDay } from './storage'
import { buildRosterGroups, sanitizeLevel } from '../features/rosters/utils'

const DB_NAME = 'decksupervisor-pdf-cache'
const DB_VERSION = 1
const STORE_NAME = 'instructorPackets'

const SESSIONS_STORAGE_KEY = 'decksupervisor.sessions'
const CURRENT_SESSION_KEY = 'decksupervisor.currentSessionId'
const FALLBACK_SESSION_NAME = 'Summer 2025'

type SessionEntry = {
  id: string
  sessionDay: string
  sessionSeason: string
  startDate: string
}

type InstructorPdfEntry = {
  name: string
  blob: Blob
}

export type InstructorPdfPacket = {
  key: string
  sessionId: string
  day: string
  generatedAt: number
  instructors: InstructorPdfEntry[]
}

const pendingPrefetches = new Map<string, Promise<void>>()

function openDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB not available'))
  }
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
    request.onsuccess = () => resolve(request.result)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)
    const request = fn(store)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => db.close()
    transaction.onabort = () => db.close()
  })
}

export function getCurrentSessionId(): string {
  if (typeof window === 'undefined') {
    return ''
  }
  return localStorage.getItem(CURRENT_SESSION_KEY) ?? ''
}

export function getCurrentSessionName(): string {
  if (typeof window === 'undefined') {
    return ''
  }
  const currentSessionId = localStorage.getItem(CURRENT_SESSION_KEY) ?? ''
  const stored = localStorage.getItem(SESSIONS_STORAGE_KEY)
  if (!currentSessionId || !stored) {
    return ''
  }
  try {
    const sessions = JSON.parse(stored) as SessionEntry[]
    const session = sessions.find(item => item.id === currentSessionId)
    if (!session) {
      return ''
    }
    const dayNames: Record<string, string> = {
      Mo: 'Monday',
      Tu: 'Tuesday',
      We: 'Wednesday',
      Th: 'Thursday',
      Fr: 'Friday',
      Sa: 'Saturday',
      Su: 'Sunday',
    }
    const dayLabel = session.sessionDay ? dayNames[session.sessionDay] ?? session.sessionDay : ''
    const season = session.sessionSeason?.trim()
    const year = session.startDate ? new Date(session.startDate).getFullYear() : NaN
    const yearLabel = Number.isFinite(year) && year > 0 ? String(year) : ''
    const parts = [dayLabel, season, yearLabel].filter(Boolean)
    return parts.length ? parts.join(' ') : ''
  } catch (error) {
    console.error('Failed to parse stored sessions', error)
    return ''
  }
}

function getPacketKey(sessionId: string, day: string) {
  return `${sessionId}::${day}`
}

export async function saveInstructorPacket(packet: InstructorPdfPacket): Promise<void> {
  await withStore('readwrite', store => store.put(packet))
}

export async function getInstructorPacket(
  sessionId: string,
  day: string,
): Promise<InstructorPdfPacket | null> {
  try {
    const key = getPacketKey(sessionId, day)
    const packet = await withStore<InstructorPdfPacket | undefined>('readonly', store =>
      store.get(key),
    )
    return packet ?? null
  } catch (error) {
    console.error('Failed to read cached instructor PDFs', error)
    return null
  }
}

export async function upsertInstructorPdf(
  sessionId: string,
  day: string,
  instructor: string,
  blob: Blob,
): Promise<void> {
  try {
    const existing = await getInstructorPacket(sessionId, day)
    const key = getPacketKey(sessionId, day)
    const next: InstructorPdfPacket = existing ?? {
      key,
      sessionId,
      day,
      generatedAt: Date.now(),
      instructors: [],
    }
    const updated = next.instructors.filter(item => item.name !== instructor)
    updated.push({ name: instructor, blob })
    next.instructors = updated
    next.generatedAt = Date.now()
    await saveInstructorPacket(next)
  } catch (error) {
    console.error('Failed to cache instructor PDF', error)
  }
}

export async function getCachedInstructorPdf(
  sessionId: string,
  day: string,
  instructor: string,
): Promise<Blob | null> {
  const packet = await getInstructorPacket(sessionId, day)
  if (!packet) {
    return null
  }
  const match = packet.instructors.find(entry => entry.name === instructor)
  return match?.blob ?? null
}

export async function prefetchInstructorPacket(day: string): Promise<void> {
  if (typeof window === 'undefined') {
    return
  }
  const sessionId = getCurrentSessionId()
  if (!sessionId || !day) {
    return
  }
  const key = getPacketKey(sessionId, day)
  const existing = pendingPrefetches.get(key)
  if (existing) {
    return existing
  }

  const promise = (async () => {
    const students = getStudentsForDay(day)
    const rosterGroups = buildRosterGroups(students)
    const grouped = new Map<string, typeof rosterGroups>()
    rosterGroups.forEach(roster => {
      const name = roster.instructor?.trim()
      if (!name) {
        return
      }
      const existingGroup = grouped.get(name)
      if (existingGroup) {
        existingGroup.push(roster)
      } else {
        grouped.set(name, [roster])
      }
    })

    const sessionName = getCurrentSessionName() || FALLBACK_SESSION_NAME
    const entries: InstructorPdfEntry[] = []

    for (const [name, rosters] of grouped.entries()) {
      const response = await fetch('/api/attendance-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session: sessionName,
          filename: name,
          rosters: rosters.map(roster => ({
            template: sanitizeLevel(roster.level),
            roster: {
              code: roster.code,
              level: roster.level,
              serviceName: roster.serviceName,
              time: roster.time,
              instructor: roster.instructor,
              location: roster.location,
              schedule: roster.schedule,
              students: roster.students.map(student => ({
                name: student.name,
              })),
            },
          })),
        }),
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || `Failed to prefetch instructor packet for ${name}`)
      }
      const pdfBlob = await response.blob()
      entries.push({ name, blob: pdfBlob })
    }

    const packet: InstructorPdfPacket = {
      key,
      sessionId,
      day,
      generatedAt: Date.now(),
      instructors: entries,
    }
    await saveInstructorPacket(packet)
  })()
    .catch(error => {
      console.error('Failed to prefetch instructor PDFs', error)
    })
    .finally(() => {
      pendingPrefetches.delete(key)
    })

  pendingPrefetches.set(key, promise)
  return promise
}

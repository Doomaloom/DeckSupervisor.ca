import { getCustomRosterDayKey, getCustomRostersForDay, getStudentsForDay } from './storage'
import { getCurrentSessionId as getStoredCurrentSessionId } from './sessionStorage'
import { getStorageScope } from './storageScope'
import {
  buildAttendancePrintItems,
  buildCustomRosterGroups,
  buildRosterGroups,
} from '../features/rosters/utils'
import type { RosterGroup } from '../features/rosters/types'
import { ATTENDANCE_RENDERER_VERSION } from '../features/pdf/types'

const DB_NAME = 'decksupervisor-pdf-cache'
const DB_VERSION = 7
const PDF_STORE_NAME = 'instructorPdfs'
const DIRTY_STORE_NAME = 'dirtyInstructorSets'
const LEGACY_PACKET_STORE_NAME = 'instructorPackets'
const CACHE_UPDATED_EVENT = 'decksupervisor:instructor-pdf-cache-updated'

const DEFAULT_SESSION_NAME = 'Session'
const DEFAULT_PREFETCH_CONCURRENCY = 1
const suppressedSessionPrefetches = new Set<string>()

type InstructorPdfEntry = {
  name: string
  blob: Blob
}

type InstructorPdfCacheEntry = {
  key: string
  sessionId: string
  day: string
  instructor: string
  sessionName: string
  blob: Blob
  generatedAt: number
}

type DirtyInstructorSet = {
  key: string
  sessionId: string
  day: string
  instructors: string[]
  updatedAt: number
}

export type InstructorPdfPacket = {
  key: string
  sessionId: string
  day: string
  generatedAt: number
  instructors: InstructorPdfEntry[]
}

type PrefetchProgress = {
  name: string
  completed: number
  total: number
}

type PrefetchOptions = {
  concurrency?: number
  force?: boolean
  instructors?: string[]
  sessionName?: string
  onStart?: (total: number) => void
  onProgress?: (progress: PrefetchProgress) => void
}

export type PrefetchResult = {
  total: number
  completed: number
  failed: string[]
}

type CacheUpdateDetail = {
  sessionId: string
  day: string
}

const pendingGenerations = new Map<string, Promise<Blob>>()

function normalizeStoredSessionName(entry: { sessionName?: string | null }) {
  return entry.sessionName?.trim() ?? ''
}

const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  if (items.length === 0) {
    return []
  }

  const workerCount = Math.max(1, Math.min(items.length, Math.floor(concurrency) || 1))
  const results = new Array<R>(items.length)
  let nextIndex = 0

  const worker = async () => {
    while (true) {
      const currentIndex = nextIndex
      nextIndex += 1
      if (currentIndex >= items.length) {
        return
      }
      results[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

function getPacketKey(sessionId: string, day: string) {
  return `${sessionId}::${day}`
}

export function buildInstructorPdfCacheKey(sessionId: string, day: string, instructor: string) {
  return `${ATTENDANCE_RENDERER_VERSION}::${getPacketKey(sessionId, day)}::${instructor}`
}

function normalizeInstructorName(name: string) {
  return name.trim()
}

function normalizeInstructorNames(names: string[]) {
  return Array.from(
    new Set(
      names
        .map(normalizeInstructorName)
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right, 'en', { sensitivity: 'base' }))
}

function normalizeSessionPrefetchKey(sessionId: string) {
  return sessionId.trim()
}

function getPrintableRosterGroupsForDay(sessionId: string, day: string): RosterGroup[] {
  const students = getStudentsForDay(day)
  const rosterGroups = buildRosterGroups(students)
  if (!day) {
    return rosterGroups
  }
  const customDayKey = getCustomRosterDayKey(day, sessionId, getStorageScope() === 'guest')
  const customRosters = getCustomRostersForDay(customDayKey)
  if (customRosters.length === 0) {
    return rosterGroups
  }
  const rosterByCode = new Map(rosterGroups.map(roster => [roster.code, roster]))
  const studentsById = new Map(students.map(student => [student.id, student]))
  const customGroups = buildCustomRosterGroups(customRosters, rosterByCode, studentsById)
  return [...rosterGroups, ...customGroups]
}

function groupPrintableRostersByInstructor(sessionId: string, day: string) {
  const grouped = new Map<string, RosterGroup[]>()
  getPrintableRosterGroupsForDay(sessionId, day).forEach(roster => {
    const instructor = normalizeInstructorName(roster.instructor)
    if (!instructor) {
      return
    }
    const existing = grouped.get(instructor)
    if (existing) {
      existing.push(roster)
      return
    }
    grouped.set(instructor, [roster])
  })
  return grouped
}

function getPrintableInstructorNames(sessionId: string, day: string) {
  return Array.from(groupPrintableRostersByInstructor(sessionId, day).keys()).sort((left, right) =>
    left.localeCompare(right, 'en', { sensitivity: 'base' }),
  )
}

function buildPdfRequestBody(sessionName: string, instructor: string, rosters: RosterGroup[]) {
  return {
    session: sessionName,
    filename: instructor,
    title: `Instructor - ${instructor}`,
    rosters: rosters.flatMap(roster => buildAttendancePrintItems(roster)),
  }
}

function openDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB not available'))
  }
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      const transaction = request.transaction
      if (db.objectStoreNames.contains(LEGACY_PACKET_STORE_NAME)) {
        db.deleteObjectStore(LEGACY_PACKET_STORE_NAME)
      }
      if (!db.objectStoreNames.contains(PDF_STORE_NAME)) {
        db.createObjectStore(PDF_STORE_NAME, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(DIRTY_STORE_NAME)) {
        db.createObjectStore(DIRTY_STORE_NAME, { keyPath: 'key' })
      }
      if (request.oldVersion < 7) {
        if (db.objectStoreNames.contains(PDF_STORE_NAME)) {
          transaction?.objectStore(PDF_STORE_NAME).clear()
        }
        if (db.objectStoreNames.contains(DIRTY_STORE_NAME)) {
          transaction?.objectStore(DIRTY_STORE_NAME).clear()
        }
      }
    }
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
    request.onsuccess = () => resolve(request.result)
  })
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
    const request = fn(store)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => db.close()
    transaction.onabort = () => db.close()
  })
}

function buildDayRange(prefix: string) {
  return IDBKeyRange.bound(prefix, `${prefix}\uffff`)
}

async function readInstructorPdfEntry(
  sessionId: string,
  day: string,
  instructor: string,
): Promise<InstructorPdfCacheEntry | null> {
  try {
    const entry = await withStore<InstructorPdfCacheEntry | undefined>(PDF_STORE_NAME, 'readonly', store =>
      store.get(buildInstructorPdfCacheKey(sessionId, day, instructor)),
    )
    return entry ?? null
  } catch (error) {
    console.error('Failed to read cached instructor PDF', error)
    return null
  }
}

async function readInstructorPdfEntriesForDay(sessionId: string, day: string): Promise<InstructorPdfCacheEntry[]> {
  try {
    const prefix = `${ATTENDANCE_RENDERER_VERSION}::${getPacketKey(sessionId, day)}::`
    const entries = await withStore<InstructorPdfCacheEntry[]>(PDF_STORE_NAME, 'readonly', store =>
      store.getAll(buildDayRange(prefix)),
    )
    return entries ?? []
  } catch (error) {
    console.error('Failed to read instructor PDF cache entries', error)
    return []
  }
}

async function writeInstructorPdfEntry(entry: InstructorPdfCacheEntry): Promise<void> {
  await withStore(PDF_STORE_NAME, 'readwrite', store => store.put(entry))
}

async function deleteInstructorPdfEntry(sessionId: string, day: string, instructor: string): Promise<void> {
  await withStore(PDF_STORE_NAME, 'readwrite', store =>
    store.delete(buildInstructorPdfCacheKey(sessionId, day, instructor)),
  )
}

async function readDirtyInstructorSet(sessionId: string, day: string): Promise<DirtyInstructorSet | null> {
  try {
    const set = await withStore<DirtyInstructorSet | undefined>(DIRTY_STORE_NAME, 'readonly', store =>
      store.get(getPacketKey(sessionId, day)),
    )
    return set ?? null
  } catch (error) {
    console.error('Failed to read dirty instructor set', error)
    return null
  }
}

async function getDirtyInstructorNames(sessionId: string, day: string): Promise<string[]> {
  const dirtySet = await readDirtyInstructorSet(sessionId, day)
  return dirtySet?.instructors ?? []
}

async function saveDirtyInstructorNames(sessionId: string, day: string, instructors: string[]): Promise<void> {
  const normalized = normalizeInstructorNames(instructors)
  if (normalized.length === 0) {
    await withStore(DIRTY_STORE_NAME, 'readwrite', store => store.delete(getPacketKey(sessionId, day)))
    return
  }
  await withStore(DIRTY_STORE_NAME, 'readwrite', store =>
    store.put({
      key: getPacketKey(sessionId, day),
      sessionId,
      day,
      instructors: normalized,
      updatedAt: Date.now(),
    } satisfies DirtyInstructorSet),
  )
}

function emitCacheUpdate(sessionId: string, day: string) {
  if (typeof window === 'undefined') {
    return
  }
  window.dispatchEvent(new CustomEvent<CacheUpdateDetail>(CACHE_UPDATED_EVENT, { detail: { sessionId, day } }))
}

async function clearDirtyInstructorNames(sessionId: string, day: string, instructors: string[]) {
  const existing = new Set(await getDirtyInstructorNames(sessionId, day))
  let changed = false
  normalizeInstructorNames(instructors).forEach(name => {
    if (existing.delete(name)) {
      changed = true
    }
  })
  if (!changed) {
    return
  }
  await saveDirtyInstructorNames(sessionId, day, Array.from(existing))
  emitCacheUpdate(sessionId, day)
}

async function generateInstructorPdf(
  sessionName: string,
  instructor: string,
  rosters: RosterGroup[],
): Promise<Blob> {
  const { generateAttendancePdf } = await import('../features/pdf')
  return (
    await generateAttendancePdf(
      buildPdfRequestBody(sessionName.trim() || DEFAULT_SESSION_NAME, instructor, rosters),
    )
  ).blob
}

export function getCurrentSessionId(): string {
  return getStoredCurrentSessionId()
}

export function onInstructorPdfCacheUpdated(handler: (detail: CacheUpdateDetail) => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }
  const listener = (event: Event) => {
    const custom = event as CustomEvent<CacheUpdateDetail>
    const detail = custom.detail
    if (!detail) {
      return
    }
    handler(detail)
  }
  window.addEventListener(CACHE_UPDATED_EVENT, listener)
  return () => window.removeEventListener(CACHE_UPDATED_EVENT, listener)
}

export async function getInstructorPacket(
  sessionId: string,
  day: string,
  options: { sessionName?: string } = {},
): Promise<InstructorPdfPacket | null> {
  const [entries, dirtyInstructors] = await Promise.all([
    readInstructorPdfEntriesForDay(sessionId, day),
    getDirtyInstructorNames(sessionId, day),
  ])
  const printableNames = new Set(getPrintableInstructorNames(sessionId, day))
  const dirtySet = new Set(dirtyInstructors)
  const expectedSessionName = options.sessionName?.trim() ?? ''
  const visibleEntries = entries
    .filter(entry => {
      if (!printableNames.has(entry.instructor) || dirtySet.has(entry.instructor)) {
        return false
      }
      if (expectedSessionName && normalizeStoredSessionName(entry) !== expectedSessionName) {
        void deleteInstructorPdfEntry(sessionId, day, entry.instructor)
        return false
      }
      return true
    })
    .sort((left, right) => left.instructor.localeCompare(right.instructor, 'en', { sensitivity: 'base' }))

  if (visibleEntries.length === 0) {
    return null
  }

  return {
    key: getPacketKey(sessionId, day),
    sessionId,
    day,
    generatedAt: Math.max(...visibleEntries.map(entry => entry.generatedAt)),
    instructors: visibleEntries.map(entry => ({
      name: entry.instructor,
      blob: entry.blob,
    })),
  }
}

export async function upsertInstructorPdf(
  sessionId: string,
  day: string,
  instructor: string,
  blob: Blob,
  sessionName = DEFAULT_SESSION_NAME,
): Promise<void> {
  const normalizedInstructor = normalizeInstructorName(instructor)
  if (!sessionId || !day || !normalizedInstructor) {
    return
  }

  await writeInstructorPdfEntry({
    key: getPdfEntryKey(sessionId, day, normalizedInstructor),
    sessionId,
    day,
    instructor: normalizedInstructor,
    sessionName,
    blob,
    generatedAt: Date.now(),
  })
  await clearDirtyInstructorNames(sessionId, day, [normalizedInstructor])
  emitCacheUpdate(sessionId, day)
}

export async function getCachedInstructorPdf(
  sessionId: string,
  day: string,
  instructor: string,
  options: { sessionName?: string } = {},
): Promise<Blob | null> {
  const normalizedInstructor = normalizeInstructorName(instructor)
  if (!sessionId || !day || !normalizedInstructor) {
    return null
  }

  const dirtySet = new Set(await getDirtyInstructorNames(sessionId, day))
  if (dirtySet.has(normalizedInstructor)) {
    return null
  }

  const entry = await readInstructorPdfEntry(sessionId, day, normalizedInstructor)
  if (!entry) {
    return null
  }
  const expectedSessionName = options.sessionName?.trim() ?? ''
  if (expectedSessionName && normalizeStoredSessionName(entry) !== expectedSessionName) {
    await deleteInstructorPdfEntry(sessionId, day, normalizedInstructor)
    emitCacheUpdate(sessionId, day)
    return null
  }

  const printableNames = new Set(getPrintableInstructorNames(sessionId, day))
  if (!printableNames.has(normalizedInstructor)) {
    await deleteInstructorPdfEntry(sessionId, day, normalizedInstructor)
    emitCacheUpdate(sessionId, day)
    return null
  }

  return entry.blob
}

export async function invalidateInstructorPdfs(
  sessionId: string,
  day: string,
  instructors: string[],
): Promise<void> {
  const normalized = normalizeInstructorNames(instructors)
  if (!sessionId || !day || normalized.length === 0) {
    return
  }

  const printableSet = new Set(getPrintableInstructorNames(sessionId, day))
  const dirtySet = new Set(await getDirtyInstructorNames(sessionId, day))

  await Promise.all(
    normalized.map(async instructor => {
      await deleteInstructorPdfEntry(sessionId, day, instructor)
      if (printableSet.has(instructor)) {
        dirtySet.add(instructor)
      } else {
        dirtySet.delete(instructor)
      }
    }),
  )

  await saveDirtyInstructorNames(sessionId, day, Array.from(dirtySet))
  emitCacheUpdate(sessionId, day)
}

export async function ensureInstructorPdf(
  sessionId: string,
  day: string,
  instructor: string,
  options: { force?: boolean; sessionName?: string } = {},
): Promise<Blob> {
  const normalizedInstructor = normalizeInstructorName(instructor)
  if (!sessionId || !day || !normalizedInstructor) {
    throw new Error('Missing instructor PDF context.')
  }

  const pendingKey = getPdfEntryKey(sessionId, day, normalizedInstructor)
  const pending = pendingGenerations.get(pendingKey)
  if (pending) {
    return pending
  }

  if (!options.force) {
    const cached = await getCachedInstructorPdf(sessionId, day, normalizedInstructor, {
      sessionName: options.sessionName,
    })
    if (cached) {
      return cached
    }
  }

  const groups = groupPrintableRostersByInstructor(sessionId, day)
  const rosters = groups.get(normalizedInstructor) ?? []
  if (rosters.length === 0) {
    await deleteInstructorPdfEntry(sessionId, day, normalizedInstructor)
    await clearDirtyInstructorNames(sessionId, day, [normalizedInstructor])
    throw new Error(`No classes found for ${normalizedInstructor}.`)
  }

  const generation = generateInstructorPdf(
    options.sessionName ?? DEFAULT_SESSION_NAME,
    normalizedInstructor,
    rosters,
  )
    .then(async blob => {
      await writeInstructorPdfEntry({
        key: pendingKey,
        sessionId,
        day,
        instructor: normalizedInstructor,
        sessionName: options.sessionName?.trim() || DEFAULT_SESSION_NAME,
        blob,
        generatedAt: Date.now(),
      })
      await clearDirtyInstructorNames(sessionId, day, [normalizedInstructor])
      emitCacheUpdate(sessionId, day)
      return blob
    })
    .finally(() => {
      pendingGenerations.delete(pendingKey)
    })

  pendingGenerations.set(pendingKey, generation)
  return generation
}

export async function prefetchInstructorPacket(
  sessionId: string,
  day: string,
  options: PrefetchOptions = {},
): Promise<PrefetchResult> {
  if (typeof window === 'undefined' || !sessionId || !day) {
    return { total: 0, completed: 0, failed: [] }
  }

  const printableSet = new Set(getPrintableInstructorNames(sessionId, day))
  const requested = options.instructors?.length
    ? normalizeInstructorNames(options.instructors)
    : Array.from(printableSet).sort((left, right) =>
        left.localeCompare(right, 'en', { sensitivity: 'base' }),
      )
  const targetInstructors = requested.filter(name => printableSet.has(name))
  const removedInstructors = requested.filter(name => !printableSet.has(name))

  if (removedInstructors.length > 0) {
    await Promise.all(removedInstructors.map(name => deleteInstructorPdfEntry(sessionId, day, name)))
    await clearDirtyInstructorNames(sessionId, day, removedInstructors)
  }

  options.onStart?.(targetInstructors.length)

  let completed = 0
  const failed: string[] = []

  await mapWithConcurrency(
    targetInstructors,
    options.concurrency ?? DEFAULT_PREFETCH_CONCURRENCY,
    async name => {
      try {
        await ensureInstructorPdf(sessionId, day, name, {
          force: options.force,
          sessionName: options.sessionName,
        })
        completed += 1
        options.onProgress?.({
          name,
          completed,
          total: targetInstructors.length,
        })
      } catch (error) {
        failed.push(name)
        console.error(`Failed to prefetch instructor PDF for ${name}`, error)
      }
    },
  )

  return {
    total: targetInstructors.length,
    completed,
    failed,
  }
}

export function suppressNextPrefetchForSession(sessionId: string): void {
  const normalizedSessionId = normalizeSessionPrefetchKey(sessionId)
  if (!normalizedSessionId) {
    return
  }
  suppressedSessionPrefetches.add(normalizedSessionId)
}

export function consumeSuppressedPrefetchForSession(sessionId: string): boolean {
  const normalizedSessionId = normalizeSessionPrefetchKey(sessionId)
  if (!normalizedSessionId || !suppressedSessionPrefetches.has(normalizedSessionId)) {
    return false
  }
  suppressedSessionPrefetches.delete(normalizedSessionId)
  return true
}

export async function flushDirtyInstructorPdfs(
  sessionId: string,
  day: string,
  options: { concurrency?: number; sessionName?: string } = {},
): Promise<PrefetchResult> {
  if (typeof window === 'undefined' || !sessionId || !day) {
    return { total: 0, completed: 0, failed: [] }
  }

  const dirtyInstructors = normalizeInstructorNames(await getDirtyInstructorNames(sessionId, day))
  if (dirtyInstructors.length === 0) {
    return { total: 0, completed: 0, failed: [] }
  }

  return prefetchInstructorPacket(sessionId, day, {
    concurrency: options.concurrency ?? DEFAULT_PREFETCH_CONCURRENCY,
    force: true,
    instructors: dirtyInstructors,
    sessionName: options.sessionName,
  })
}

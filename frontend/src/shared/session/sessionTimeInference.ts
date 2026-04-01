import type { ExtractedClass, ExtractedSession } from '../../types/app'
import { normalizeSessionLocationKey, normalizeSessionLocations } from './sourceLocations'

export type SessionIdentityCriteria = {
  dayOfWeek?: string | null
  sessionSeason?: string | null
  sessionYear?: number | null
  location?: string | null
  locations?: string[] | null
}

export type InferredSessionWindow = {
  sessionStartTime24: string
  sessionEndTime24: string
  classCount: number
}

type SessionIdentityShape = {
  dayOfWeek: string
  sessionSeason: string
  sessionYear: number
  location: string
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function normalizeDay(value: string | null | undefined) {
  return (value ?? '').trim()
}

function hasIdentityCriteria(criteria: SessionIdentityCriteria) {
  const locations = normalizeSessionLocations(criteria.locations ?? [])
  return Boolean(
    normalizeDay(criteria.dayOfWeek) ||
      normalizeText(criteria.sessionSeason) ||
      (criteria.sessionYear ?? 0) > 0 ||
      normalizeText(criteria.location) ||
      locations.length > 0,
  )
}

export function matchesSessionIdentity(
  value: SessionIdentityShape,
  criteria: SessionIdentityCriteria,
) {
  const dayOfWeek = normalizeDay(criteria.dayOfWeek)
  if (dayOfWeek && normalizeDay(value.dayOfWeek) !== dayOfWeek) {
    return false
  }

  const sessionSeason = normalizeText(criteria.sessionSeason)
  if (sessionSeason && normalizeText(value.sessionSeason) !== sessionSeason) {
    return false
  }

  const sessionYear = criteria.sessionYear ?? 0
  if (sessionYear > 0 && value.sessionYear !== sessionYear) {
    return false
  }

  const location = normalizeText(criteria.location)
  if (location && normalizeText(value.location) !== location) {
    return false
  }

  const locations = normalizeSessionLocations(criteria.locations ?? [])
  if (locations.length > 0) {
    const valueKey = normalizeSessionLocationKey(value.location)
    if (!locations.some(locationValue => normalizeSessionLocationKey(locationValue) === valueKey)) {
      return false
    }
  }

  return true
}

export function filterExtractedSessionsByIdentity(
  sessions: ExtractedSession[],
  criteria: SessionIdentityCriteria,
) {
  if (!hasIdentityCriteria(criteria)) {
    return sessions
  }

  return sessions.filter(session =>
    matchesSessionIdentity(
      {
        dayOfWeek: session.dayOfWeek,
        sessionSeason: session.sessionSeason,
        sessionYear: session.sessionYear,
        location: session.location,
      },
      criteria,
    ),
  )
}

export function findSingleMatchingExtractedSession(
  sessions: ExtractedSession[],
  criteria: SessionIdentityCriteria,
) {
  const matches = filterExtractedSessionsByIdentity(sessions, criteria)
  return matches.length === 1 ? matches[0] : null
}

export function inferSessionWindowsFromClasses(
  classes: ExtractedClass[],
  criteria: SessionIdentityCriteria = {},
) {
  const filtered = classes
    .filter(classEntry =>
      matchesSessionIdentity(
        {
          dayOfWeek: classEntry.dayOfWeek,
          sessionSeason: classEntry.sessionSeason,
          sessionYear: classEntry.sessionYear,
          location: classEntry.location,
        },
        criteria,
      ),
    )
    .slice()
    .sort((left, right) => {
      if (left.startTime24 !== right.startTime24) {
        return left.startTime24.localeCompare(right.startTime24)
      }
      if (left.endTime24 !== right.endTime24) {
        return left.endTime24.localeCompare(right.endTime24)
      }
      return left.courseCode.localeCompare(right.courseCode)
    })

  if (filtered.length === 0) {
    return [] as InferredSessionWindow[]
  }

  const windows: InferredSessionWindow[] = []
  let currentWindow: InferredSessionWindow = {
    sessionStartTime24: filtered[0].startTime24,
    sessionEndTime24: filtered[0].endTime24,
    classCount: 1,
  }
  let currentEndMinutes = time24ToMinutes(filtered[0].endTime24)

  for (const classEntry of filtered.slice(1)) {
    const startMinutes = time24ToMinutes(classEntry.startTime24)
    if (startMinutes-currentEndMinutes > 30) {
      windows.push(currentWindow)
      currentWindow = {
        sessionStartTime24: classEntry.startTime24,
        sessionEndTime24: classEntry.endTime24,
        classCount: 1,
      }
      currentEndMinutes = time24ToMinutes(classEntry.endTime24)
      continue
    }

    currentWindow = {
      ...currentWindow,
      sessionEndTime24:
        time24ToMinutes(classEntry.endTime24) > currentEndMinutes
          ? classEntry.endTime24
          : currentWindow.sessionEndTime24,
      classCount: currentWindow.classCount + 1,
    }
    if (time24ToMinutes(classEntry.endTime24) > currentEndMinutes) {
      currentEndMinutes = time24ToMinutes(classEntry.endTime24)
    }
  }

  windows.push(currentWindow)
  return windows
}

export function inferSingleSessionWindowFromClasses(
  classes: ExtractedClass[],
  criteria: SessionIdentityCriteria = {},
) {
  const windows = inferSessionWindowsFromClasses(classes, criteria)
  return windows.length === 1 ? windows[0] : null
}

function time24ToMinutes(value: string) {
  const [hours = '0', minutes = '0'] = value.trim().split(':')
  const parsedHours = Number.parseInt(hours, 10)
  const parsedMinutes = Number.parseInt(minutes, 10)
  if (!Number.isFinite(parsedHours) || !Number.isFinite(parsedMinutes)) {
    return 0
  }
  return parsedHours * 60 + parsedMinutes
}

import type { ClassRoster, ExtractedClass } from '../types/app'
import { normalizeSessionLocationKey, normalizeSessionLocations } from '../shared/session/sourceLocations'
import type { CsvImportDataset } from './csvImportDatasetStorage'

export type CsvReconcileTarget = {
  sessionDay: string
  sessionSeason?: string | null
  sessionYear?: number | null
  sourceLocations: string[]
  sessionStartTime24?: string | null
  sessionEndTime24?: string | null
}

export type CsvReconcileResult = {
  classes: ExtractedClass[]
  rosters: ClassRoster[]
  courseCodes: string[]
}

function normalizeSeason(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function toMinutes(value: string | null | undefined) {
  const trimmed = (value ?? '').trim()
  if (!trimmed) {
    return null
  }
  const [hours = '0', minutes = '0'] = trimmed.split(':')
  const parsedHours = Number.parseInt(hours, 10)
  const parsedMinutes = Number.parseInt(minutes, 10)
  if (!Number.isFinite(parsedHours) || !Number.isFinite(parsedMinutes)) {
    return null
  }
  return parsedHours * 60 + parsedMinutes
}

function isWithinTimeWindow(
  startTime24: string,
  endTime24: string,
  targetStartTime24?: string | null,
  targetEndTime24?: string | null,
) {
  const targetStart = toMinutes(targetStartTime24)
  const targetEnd = toMinutes(targetEndTime24)
  if (targetStart === null || targetEnd === null) {
    return true
  }

  const start = toMinutes(startTime24)
  const end = toMinutes(endTime24)
  if (start === null || end === null) {
    return true
  }

  return start >= targetStart && end <= targetEnd
}

function dedupeBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>()
  return items.filter(item => {
    const key = getKey(item)
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

export function deriveCsvDataForSession(
  target: CsvReconcileTarget,
  dataset: CsvImportDataset,
): CsvReconcileResult {
  const locationKeys = new Set(
    normalizeSessionLocations(target.sourceLocations)
      .map(location => normalizeSessionLocationKey(location))
      .filter(Boolean),
  )

  const classes = dedupeBy(
    Object.values(dataset.classesBySession ?? {})
      .flat()
      .filter(classEntry => {
        if ((classEntry.dayOfWeek ?? '').trim() !== target.sessionDay.trim()) {
          return false
        }
        if (
          normalizeSeason(target.sessionSeason) &&
          normalizeSeason(classEntry.sessionSeason) !== normalizeSeason(target.sessionSeason)
        ) {
          return false
        }
        if ((target.sessionYear ?? 0) > 0 && classEntry.sessionYear !== target.sessionYear) {
          return false
        }
        if (
          locationKeys.size > 0 &&
          !locationKeys.has(normalizeSessionLocationKey(classEntry.location))
        ) {
          return false
        }
        if (
          !isWithinTimeWindow(
            classEntry.startTime24,
            classEntry.endTime24,
            target.sessionStartTime24,
            target.sessionEndTime24,
          )
        ) {
          return false
        }
        return classEntry.courseCode.trim().length > 0
      })
      .sort((left, right) => {
        if (left.startTime24 !== right.startTime24) {
          return left.startTime24.localeCompare(right.startTime24)
        }
        if (left.endTime24 !== right.endTime24) {
          return left.endTime24.localeCompare(right.endTime24)
        }
        return left.courseCode.localeCompare(right.courseCode)
      }),
    classEntry =>
      [
        classEntry.dayOfWeek.trim(),
        classEntry.courseCode.trim(),
        normalizeSessionLocationKey(classEntry.location),
        classEntry.startTime24.trim(),
        classEntry.endTime24.trim(),
      ].join('|'),
  )

  const allowedRosterKeys = new Set(
    classes.map(classEntry =>
      [
        classEntry.dayOfWeek.trim(),
        classEntry.courseCode.trim(),
        normalizeSessionLocationKey(classEntry.location),
      ].join('|'),
    ),
  )

  const rosters = dedupeBy(
    Object.values(dataset.rostersByCandidate ?? {})
      .flat()
      .filter(roster => {
        const rosterKey = [
          roster.day.trim(),
          roster.code.trim(),
          normalizeSessionLocationKey(roster.location),
        ].join('|')
        return allowedRosterKeys.has(rosterKey)
      })
      .sort((left, right) => {
        if (left.day !== right.day) {
          return left.day.localeCompare(right.day)
        }
        if (left.time !== right.time) {
          return left.time.localeCompare(right.time)
        }
        return left.code.localeCompare(right.code)
      }),
    roster =>
      [
        roster.day.trim(),
        roster.code.trim(),
        normalizeSessionLocationKey(roster.location),
        roster.time.trim(),
      ].join('|'),
  )

  const courseCodes = Array.from(
    new Set(classes.map(classEntry => classEntry.courseCode.trim()).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right))

  return {
    classes,
    rosters,
    courseCodes,
  }
}

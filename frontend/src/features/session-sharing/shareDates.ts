import type { DbSessionEntry } from '../session-management/types'

export type ShareDateMode = 'single' | 'range'

type ResolveShareDatesArgs = {
  mode: ShareDateMode
  singleDate: string
  rangeStartDate: string
  rangeEndDate: string
  session: DbSessionEntry | null
  today: string
}

type ResolveShareDatesResult = {
  dates: string[]
  validationMessage: string
}

const weekdayLookup: Record<string, number> = {
  su: 0,
  sunday: 0,
  sa: 6,
  saturday: 6,
  mo: 1,
  monday: 1,
  tu: 2,
  tuesday: 2,
  we: 3,
  wednesday: 3,
  th: 4,
  thursday: 4,
  fr: 5,
  friday: 5,
}

const weekdayDisplayLookup: Record<string, string> = {
  su: 'Sunday',
  sunday: 'Sunday',
  sa: 'Saturday',
  saturday: 'Saturday',
  mo: 'Monday',
  monday: 'Monday',
  tu: 'Tuesday',
  tuesday: 'Tuesday',
  we: 'Wednesday',
  wednesday: 'Wednesday',
  th: 'Thursday',
  thursday: 'Thursday',
  fr: 'Friday',
  friday: 'Friday',
}

function normalizeDate(value: string) {
  return value.trim()
}

function normalizeSessionDay(value: string) {
  return value.trim().toLowerCase()
}

function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function toDateParts(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return { year, month, day }
}

function getIsoWeekday(value: string) {
  const { year, month, day } = toDateParts(value)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

function isWithinSessionWindow(date: string, session: DbSessionEntry) {
  const startDate = session.start_date?.trim() ?? ''
  const endDate = session.end_date?.trim() ?? ''
  if (startDate && date < startDate) {
    return false
  }
  if (endDate && date > endDate) {
    return false
  }
  return true
}

function expandDateRange(startDate: string, endDate: string) {
  const dates: string[] = []
  const startParts = toDateParts(startDate)
  const endParts = toDateParts(endDate)
  let cursor = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day))
  const end = new Date(Date.UTC(endParts.year, endParts.month - 1, endParts.day))
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  }
  return dates
}

export function resolveShareDates({
  mode,
  singleDate,
  rangeStartDate,
  rangeEndDate,
  session,
  today,
}: ResolveShareDatesArgs): ResolveShareDatesResult {
  if (!session) {
    return { dates: [], validationMessage: 'Select a session first.' }
  }

  const normalizedSessionDay = normalizeSessionDay(session.session_day)
  const sessionWeekday = weekdayLookup[normalizedSessionDay]
  const sessionWeekdayLabel = weekdayDisplayLookup[normalizedSessionDay] ?? session.session_day
  if (sessionWeekday === undefined) {
    return { dates: [], validationMessage: 'This session has an invalid day and cannot be shared.' }
  }

  if (mode === 'single') {
    const normalizedDate = normalizeDate(singleDate)
    if (!normalizedDate) {
      return { dates: [], validationMessage: 'Choose a share date.' }
    }
    if (!isValidIsoDate(normalizedDate)) {
      return { dates: [], validationMessage: 'Choose a valid share date.' }
    }
    if (normalizedDate < today) {
      return { dates: [], validationMessage: 'Share dates cannot be in the past.' }
    }
    if (getIsoWeekday(normalizedDate) !== sessionWeekday) {
      return {
        dates: [],
        validationMessage: `Share dates must fall on ${sessionWeekdayLabel}.`,
      }
    }
    if (!isWithinSessionWindow(normalizedDate, session)) {
      return { dates: [], validationMessage: 'Share dates must stay within the session date range.' }
    }
    return { dates: [normalizedDate], validationMessage: '' }
  }

  const normalizedStart = normalizeDate(rangeStartDate)
  const normalizedEnd = normalizeDate(rangeEndDate)
  if (!normalizedStart || !normalizedEnd) {
    return { dates: [], validationMessage: 'Choose a start and end date.' }
  }
  if (!isValidIsoDate(normalizedStart) || !isValidIsoDate(normalizedEnd)) {
    return { dates: [], validationMessage: 'Choose valid range dates.' }
  }
  if (normalizedStart > normalizedEnd) {
    return { dates: [], validationMessage: 'The range end must be on or after the start date.' }
  }
  if (normalizedEnd < today) {
    return { dates: [], validationMessage: 'Share dates cannot be in the past.' }
  }

  const allDates = expandDateRange(normalizedStart, normalizedEnd)
  const matchingDates = allDates.filter(date => {
    if (date < today) {
      return false
    }
    if (getIsoWeekday(date) !== sessionWeekday) {
      return false
    }
    return isWithinSessionWindow(date, session)
  })

  if (matchingDates.length === 0) {
    return {
      dates: [],
      validationMessage: `No ${sessionWeekdayLabel} dates in that range can be shared for this session.`,
    }
  }

  return { dates: matchingDates, validationMessage: '' }
}

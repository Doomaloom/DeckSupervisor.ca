const dayNames: Record<string, string> = {
  Mo: 'Monday',
  Tu: 'Tuesday',
  We: 'Wednesday',
  Th: 'Thursday',
  Fr: 'Friday',
  Sa: 'Saturday',
  Su: 'Sunday',
}

type SessionDisplayInput = {
  sessionDay?: string | null
  dayOverride?: string | null
  includeDay?: boolean
  sessionSeason?: string | null
  sessionYear?: number | null
  startDate?: string | null
  termSeason?: string | null
  termYear?: number | null
  sessionStartTime24?: string | null
  sessionEndTime24?: string | null
  includeTimeRange?: boolean
  fallback?: string
}

export function getDayLabel(day: string | null | undefined) {
  const trimmed = (day ?? '').trim()
  if (!trimmed) {
    return ''
  }
  return dayNames[trimmed] ?? trimmed
}

export function getYearFromDate(value: string | null | undefined) {
  if (!value) {
    return null
  }
  const dateOnlyMatch = value.match(/^(\d{4})-\d{2}-\d{2}$/)
  if (dateOnlyMatch?.[1]) {
    const parsed = Number.parseInt(dateOnlyMatch[1], 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }
  const year = new Date(value).getFullYear()
  return Number.isFinite(year) && year > 0 ? year : null
}

export function resolveSessionYear(
  yearInput: string,
  startDate: string | null | undefined,
  endDate: string | null | undefined,
) {
  const trimmed = yearInput.trim()
  if (trimmed) {
    const parsed = Number.parseInt(trimmed, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }
  return getYearFromDate(startDate) ?? getYearFromDate(endDate)
}

export function formatSessionTermLabel(
  sessionSeason: string | null | undefined,
  sessionYear: number | null | undefined,
  startDate: string | null | undefined,
) {
  const normalizedSeason = sessionSeason?.trim() ?? ''
  const season = normalizedSeason
    ? normalizedSeason.slice(0, 1).toUpperCase() + normalizedSeason.slice(1).toLowerCase()
    : ''
  const year = sessionYear ?? getYearFromDate(startDate)
  const yearLabel = year ? String(year) : ''
  return [season, yearLabel].filter(Boolean).join(' ')
}

export function formatSessionTimeLabel(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) {
    return ''
  }
  const parts = trimmed.split(':')
  if (parts.length !== 2) {
    return trimmed
  }
  const parsedHour = Number.parseInt(parts[0], 10)
  const parsedMinute = Number.parseInt(parts[1], 10)
  if (!Number.isFinite(parsedHour) || !Number.isFinite(parsedMinute)) {
    return trimmed
  }
  const suffix = parsedHour >= 12 ? 'PM' : 'AM'
  const normalizedHour = parsedHour % 12 || 12
  return `${normalizedHour}:${String(parsedMinute).padStart(2, '0')} ${suffix}`
}

export function formatSessionTimeRange(
  sessionStartTime24: string | null | undefined,
  sessionEndTime24: string | null | undefined,
) {
  const start = formatSessionTimeLabel(sessionStartTime24)
  const end = formatSessionTimeLabel(sessionEndTime24)
  if (!start || !end) {
    return ''
  }
  return `${start}-${end}`
}

export function formatSessionDisplayName({
  sessionDay,
  dayOverride,
  includeDay = true,
  sessionSeason,
  sessionYear,
  startDate,
  termSeason,
  termYear,
  sessionStartTime24,
  sessionEndTime24,
  includeTimeRange = true,
  fallback = 'Session',
}: SessionDisplayInput) {
  const dayLabel = includeDay ? getDayLabel(dayOverride ?? sessionDay) : ''
  const sessionTermLabel = formatSessionTermLabel(sessionSeason, sessionYear, startDate)
  const fallbackTermLabel = formatSessionTermLabel(termSeason, termYear, null)
  const label = [dayLabel, sessionTermLabel || fallbackTermLabel].filter(Boolean).join(' ')
  const timeRange = formatSessionTimeRange(sessionStartTime24, sessionEndTime24)
  if (label) {
    if (!includeTimeRange) {
      return label
    }
    return timeRange ? `${label} | ${timeRange}` : label
  }
  if (!includeTimeRange) {
    return fallback
  }
  return timeRange || fallback
}

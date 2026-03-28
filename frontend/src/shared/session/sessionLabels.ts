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
  sessionSeason?: string | null
  sessionYear?: number | null
  startDate?: string | null
  sessionStartTime24?: string | null
  sessionEndTime24?: string | null
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
  const season = sessionSeason?.trim() ?? ''
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
  sessionSeason,
  sessionYear,
  startDate,
  sessionStartTime24,
  sessionEndTime24,
  fallback = 'Session',
}: SessionDisplayInput) {
  const dayLabel = getDayLabel(sessionDay)
  const season = sessionSeason?.trim() ?? ''
  const year = sessionYear ?? getYearFromDate(startDate)
  const yearLabel = year ? String(year) : ''
  const label = [dayLabel, season, yearLabel].filter(Boolean).join(' ')
  const timeRange = formatSessionTimeRange(sessionStartTime24, sessionEndTime24)
  if (label) {
    return timeRange ? `${label} | ${timeRange}` : label
  }
  return timeRange || fallback
}

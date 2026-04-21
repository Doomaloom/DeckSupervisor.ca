import { createTermKey, formatTermLabel } from '../../../app/useCurrentTerm'
import { formatSessionDisplayName, getYearFromDate } from '../../../shared/session/sessionLabels'
import { getEffectiveSourceLocations } from '../../../shared/session/sourceLocations'
import type {
  DbSessionEntry,
  LocalSessionEntry,
  SessionListItem,
  SessionTermOption,
  TeamTermSessionRow,
} from '../types'

const seasonRank: Record<string, number> = {
  winter: 0,
  spring: 1,
  summer: 2,
  fall: 3,
}

export function buildFullTimeSessionTerms(teamTermSessions: TeamTermSessionRow[]) {
  const grouped = new Map<string, SessionTermOption>()

  teamTermSessions.forEach(session => {
    const season = session.session_season?.trim() ?? ''
    const year = session.session_year ?? getYearFromDate(session.start_date)
    if (!season || !year) {
      return
    }
    const normalizedSeason = season.toLowerCase()
    const key = createTermKey(normalizedSeason, year)
    if (!key) {
      return
    }
    const existing = grouped.get(key)
    if (existing) {
      grouped.set(key, { ...existing, sessionCount: existing.sessionCount + 1 })
      return
    }
    grouped.set(key, {
      key,
      season: normalizedSeason,
      year,
      label: formatTermLabel(season, year),
      sessionCount: 1,
    })
  })

  return Array.from(grouped.values()).sort((a, b) => {
    if (a.year !== b.year) {
      return b.year - a.year
    }
    const rankA = seasonRank[a.season] ?? 99
    const rankB = seasonRank[b.season] ?? 99
    if (rankA !== rankB) {
      return rankA - rankB
    }
    return a.label.localeCompare(b.label)
  })
}

export function buildFullTimeTermYears(currentDate: string, count = 5) {
  const currentYear = Number.parseInt(currentDate.slice(0, 4), 10)
  if (!Number.isFinite(currentYear) || currentYear <= 0) {
    return [] as number[]
  }
  return Array.from({ length: count }, (_, index) => currentYear - index)
}

export function filterTermsForYear(terms: SessionTermOption[], selectedYear: number | null) {
  if (!selectedYear) {
    return [] as SessionTermOption[]
  }
  return terms.filter(term => term.year === selectedYear)
}

export function findDefaultTermForYear(terms: SessionTermOption[], selectedYear: number | null) {
  if (!selectedYear) {
    return null
  }
  return terms.find(term => term.year === selectedYear) ?? null
}

type SessionListGroup = {
  key: string
  label: string
  year: number | null
  seasonRank: number
  items: SessionListItem[]
}

function getSessionTermParts(item: SessionListItem) {
  const session = item.session
  const isLocal = item.kind === 'local'
  const season = isLocal
    ? (session as LocalSessionEntry).sessionSeason?.trim() ?? ''
    : (session as DbSessionEntry).session_season?.trim() ?? ''
  const year =
    (isLocal
      ? (session as LocalSessionEntry).sessionYear ?? getYearFromDate((session as LocalSessionEntry).startDate)
      : (session as DbSessionEntry).session_year ?? getYearFromDate((session as DbSessionEntry).start_date)) ??
    null
  const normalizedSeason = season.toLowerCase()

  if (!season || !year) {
    return {
      key: 'other-sessions',
      label: 'Other Sessions',
      year: null,
      seasonRank: -1,
    }
  }

  return {
    key: `${normalizedSeason}-${year}`,
    label: formatTermLabel(season, year),
    year,
    seasonRank: seasonRank[normalizedSeason] ?? -1,
  }
}

function getSessionStartTimestamp(item: SessionListItem) {
  const session = item.session
  const startDate =
    item.kind === 'local'
      ? (session as LocalSessionEntry).startDate
      : (session as DbSessionEntry).start_date
  return startDate ? new Date(startDate).getTime() : 0
}

export function groupSessionListItemsByTerm(items: SessionListItem[]) {
  const grouped = new Map<string, SessionListGroup>()

  items.forEach(item => {
    const groupMeta = getSessionTermParts(item)
    const existing = grouped.get(groupMeta.key)
    if (existing) {
      existing.items.push(item)
      return
    }
    grouped.set(groupMeta.key, {
      ...groupMeta,
      items: [item],
    })
  })

  return Array.from(grouped.values())
    .map(group => ({
      ...group,
      items: group.items.slice().sort((a, b) => getSessionStartTimestamp(b) - getSessionStartTimestamp(a)),
    }))
    .sort((a, b) => {
      const yearA = a.year ?? -1
      const yearB = b.year ?? -1
      if (yearA !== yearB) {
        return yearB - yearA
      }
      if (a.seasonRank !== b.seasonRank) {
        return b.seasonRank - a.seasonRank
      }
      return a.label.localeCompare(b.label)
    })
}

function getLocalSessionDisplayName(session: LocalSessionEntry) {
  return formatSessionDisplayName({
    sessionDay: session.sessionDay,
    sessionSeason: session.sessionSeason,
    sessionYear: session.sessionYear ?? null,
    startDate: session.startDate,
    sessionStartTime24: session.sessionStartTime24 ?? null,
    sessionEndTime24: session.sessionEndTime24 ?? null,
  })
}

function getDbSessionDisplayName(session: DbSessionEntry) {
  return formatSessionDisplayName({
    sessionDay: session.session_day,
    sessionSeason: session.session_season,
    sessionYear: session.session_year,
    startDate: session.start_date,
    sessionStartTime24: session.session_start_time24,
    sessionEndTime24: session.session_end_time24,
  })
}

export function getSessionListDisplayMeta(item: SessionListItem) {
  if (item.kind === 'local') {
    const { session } = item
    const sourceLocations = getEffectiveSourceLocations({
      location: session.location ?? null,
      source_locations: session.sourceLocations ?? [],
    })
    return {
      title: getLocalSessionDisplayName(session),
      startDate: session.startDate || 'Start date',
      endDate: session.endDate || 'End date',
      instructorCount: session.instructors.length,
      location: session.location ?? '',
      sourceLocations,
      rosterFileName: session.rosterFileName ?? '',
      shareDate: '',
    }
  }

  const session = item.kind === 'shared' ? item.session : item.session
  const sourceLocations = getEffectiveSourceLocations(session)
  return {
    title: getDbSessionDisplayName(session),
    startDate: session.start_date || 'Start date',
    endDate: session.end_date || 'End date',
    instructorCount: session.instructors?.length ?? 0,
    location: session.location ?? '',
    sourceLocations,
    rosterFileName: '',
    shareDate: item.kind === 'shared' ? item.entry.share_date : '',
  }
}

import type { SessionIdentityCriteria } from '../../../shared/session/sessionTimeInference'
import {
  getEffectiveSourceLocations,
  normalizeSessionLocations,
} from '../../../shared/session/sourceLocations'
import type {
  DbSessionEntry,
  LocalSessionEntry,
  ResolvedSourceLocations,
  SessionIdentityInput,
} from '../types'

export function buildSessionIdentityCriteria(
  input: SessionIdentityInput,
): SessionIdentityCriteria {
  const sessionYearValue =
    typeof input.sessionYear === 'number'
      ? input.sessionYear
      : Number.parseInt((input.sessionYear ?? '').trim(), 10)

  return {
    dayOfWeek: input.sessionDay?.trim() ?? '',
    sessionSeason: input.sessionSeason?.trim() ?? '',
    sessionYear: Number.isFinite(sessionYearValue) && sessionYearValue > 0 ? sessionYearValue : null,
    location: input.location?.trim() ?? '',
    locations: input.locations ?? [],
  }
}

export function hasIdentityCriteria(criteria: SessionIdentityCriteria) {
  const locations = normalizeSessionLocations(criteria.locations ?? [])
  return Boolean(
    (criteria.dayOfWeek ?? '').trim() ||
      (criteria.sessionSeason ?? '').trim() ||
      (criteria.location ?? '').trim() ||
      (criteria.sessionYear ?? 0) > 0 ||
      locations.length > 0,
  )
}

export function resolveDisplayAndSourceLocations(input: {
  location?: string | null
  sourceLocations?: string[]
}): ResolvedSourceLocations {
  const sourceLocations = normalizeSessionLocations(input.sourceLocations ?? [input.location ?? ''])
  const displayLocation =
    (input.location ?? '').trim() ||
    (sourceLocations.length === 1 ? sourceLocations[0] : '')

  return {
    sourceLocations,
    displayLocation,
    validationMessage:
      sourceLocations.length > 1 && !displayLocation
        ? 'Enter a display location when combining multiple raw locations.'
        : '',
  }
}

export function sortLocalSessionsByStartDateDesc(sessions: LocalSessionEntry[]) {
  return sessions.slice().sort((a, b) => {
    const aTime = a.startDate ? new Date(a.startDate).getTime() : 0
    const bTime = b.startDate ? new Date(b.startDate).getTime() : 0
    return bTime - aTime
  })
}

export function sortDbSessionsByStartDateDesc(sessions: DbSessionEntry[]) {
  return sessions.slice().sort((a, b) => {
    const aTime = a.start_date ? new Date(a.start_date).getTime() : 0
    const bTime = b.start_date ? new Date(b.start_date).getTime() : 0
    return bTime - aTime
  })
}

export function getSessionSourceLocations(session: LocalSessionEntry | DbSessionEntry) {
  if ('session_day' in session) {
    return getEffectiveSourceLocations(session)
  }
  return getEffectiveSourceLocations({
    location: session.location ?? null,
    source_locations: session.sourceLocations ?? [],
  })
}

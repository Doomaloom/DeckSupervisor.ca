import { formatSessionDisplayName } from '../../../shared/session/sessionLabels'
import { getEffectiveSourceLocations } from '../../../shared/session/sourceLocations'
import type { DbSessionEntry, LocalSessionEntry } from '../types'

type SessionSummaryCardProps = {
  isGuest: boolean
  currentSession: LocalSessionEntry | DbSessionEntry | null
  teamName?: string
}

function SessionSummaryCard({
  isGuest,
  currentSession,
  teamName = '',
}: SessionSummaryCardProps) {
  if (!currentSession) {
    return null
  }

  const title = isGuest
    ? formatSessionDisplayName({
        sessionDay: (currentSession as LocalSessionEntry).sessionDay,
        sessionSeason: (currentSession as LocalSessionEntry).sessionSeason,
        sessionYear: (currentSession as LocalSessionEntry).sessionYear ?? null,
        startDate: (currentSession as LocalSessionEntry).startDate,
        sessionStartTime24: (currentSession as LocalSessionEntry).sessionStartTime24 ?? null,
        sessionEndTime24: (currentSession as LocalSessionEntry).sessionEndTime24 ?? null,
      })
    : formatSessionDisplayName({
        sessionDay: (currentSession as DbSessionEntry).session_day,
        sessionSeason: (currentSession as DbSessionEntry).session_season,
        sessionYear: (currentSession as DbSessionEntry).session_year,
        startDate: (currentSession as DbSessionEntry).start_date,
        sessionStartTime24: (currentSession as DbSessionEntry).session_start_time24,
        sessionEndTime24: (currentSession as DbSessionEntry).session_end_time24,
      })

  const sourceLocations = isGuest
    ? getEffectiveSourceLocations({
        location: (currentSession as LocalSessionEntry).location ?? null,
        source_locations: (currentSession as LocalSessionEntry).sourceLocations ?? [],
      })
    : getEffectiveSourceLocations(currentSession as DbSessionEntry)

  return (
    <div className="mb-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p>
        {isGuest
          ? (currentSession as LocalSessionEntry).startDate || 'Start date'
          : (currentSession as DbSessionEntry).start_date || 'Start date'}{' '}
        -{' '}
        {isGuest
          ? (currentSession as LocalSessionEntry).endDate || 'End date'
          : (currentSession as DbSessionEntry).end_date || 'End date'}
      </p>
      <p>
        {isGuest
          ? (currentSession as LocalSessionEntry).instructors.length
          : (currentSession as DbSessionEntry).instructors?.length ?? 0}{' '}
        instructors
      </p>
      {isGuest && (currentSession as LocalSessionEntry).rosterFileName ? (
        <p>Roster: {(currentSession as LocalSessionEntry).rosterFileName}</p>
      ) : null}
      {!isGuest && teamName ? <p>Team: {teamName}</p> : null}
      {(currentSession as LocalSessionEntry | DbSessionEntry).location ? (
        <p>Location: {(currentSession as LocalSessionEntry | DbSessionEntry).location}</p>
      ) : null}
      {sourceLocations.length > 1 ? (
        <p className="text-sm text-secondary/70">Includes: {sourceLocations.join(', ')}</p>
      ) : null}
    </div>
  )
}

export default SessionSummaryCard

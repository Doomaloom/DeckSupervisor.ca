import type { SessionIdentityCriteria } from '../../shared/session/sessionTimeInference'

export type InstructorEntry = { name: string }

export const NO_TEAM_VALUE = '__no_team__'
export const SESSION_SEASON_OPTIONS = ['Winter', 'Spring', 'Summer', 'Fall']

export type LocalSessionEntry = {
  id: string
  sessionDay: string
  sessionSeason: string
  sessionYear?: number | null
  startDate: string
  endDate: string
  sessionStartTime24?: string | null
  sessionEndTime24?: string | null
  location?: string | null
  sourceLocations?: string[]
  instructors: InstructorEntry[]
  rosterFileName?: string
}

export type DbSessionEntry = {
  id: string
  team_id: string | null
  created_by: string
  session_day: string
  session_season: string | null
  session_year: number | null
  start_date: string | null
  end_date: string | null
  location: string | null
  source_locations: string[]
  session_start_time24: string | null
  session_end_time24: string | null
  instructors: InstructorEntry[]
}

export type SharedSessionEntry = {
  id: string
  share_date: string
  allow_roster_edits: boolean
  sessions?: DbSessionEntry | null
}

export type TeamTermSessionRow = {
  id: string
  session_season: string | null
  session_year: number | null
  start_date: string | null
}

export type SessionTermOption = {
  key: string
  season: string
  year: number
  label: string
  sessionCount: number
}

export type SessionListItem =
  | { kind: 'local'; session: LocalSessionEntry }
  | { kind: 'db'; session: DbSessionEntry }
  | { kind: 'shared'; entry: SharedSessionEntry; session: DbSessionEntry }

export type SessionIdentityInput = {
  sessionDay?: string | null
  sessionSeason?: string | null
  sessionYear?: string | number | null
  location?: string | null
  locations?: string[]
}

export type SessionFormState = {
  sessionDay: string
  sessionSeason: string
  sessionYear: string
  startDate: string
  endDate: string
  sessionStartTime24: string
  sessionEndTime24: string
  location: string
  sourceLocations: string[]
  instructors: InstructorEntry[]
  rosterFile: File | null
}

export type ResolvedSourceLocations = {
  sourceLocations: string[]
  displayLocation: string
  validationMessage: string
}

export type SessionIdentityResult = SessionIdentityCriteria

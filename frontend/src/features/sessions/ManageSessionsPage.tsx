import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDay } from '../../app/DayContext'
import { useAuth } from '../../app/AuthContext'
import { useCurrentTeam } from '../../app/useCurrentTeam'
import { createTermKey } from '../../app/useCurrentTerm'
import { useCurrentSession } from '../../app/useCurrentSession'
import {
  getExtractedClassesForScope,
  getExtractedClassesForSession,
} from '../../lib/extractedClassesStorage'
import {
  formatSessionDisplayName,
  formatSessionTermLabel,
  getYearFromDate,
  resolveSessionYear,
} from '../../shared/session/sessionLabels'
import {
  inferSingleSessionWindowFromClasses,
  type SessionIdentityCriteria,
} from '../../shared/session/sessionTimeInference'
import {
  clearCurrentSessionId,
  getCurrentSessionId,
  loadSessions,
  onCurrentSessionChanged,
  saveSessions,
  setCurrentSessionId,
} from '../../lib/sessionStorage'
import { deleteSession, fetchCurrentTeams, fetchMySessions, updateSession } from '../../lib/serverApi'
import { onStorageScopeChanged } from '../../lib/storageScope'
import SourceLocationsInput from '../../components/SourceLocationsInput'
import {
  getEffectiveSourceLocations,
  normalizeSessionLocationKey,
  normalizeSessionLocations,
} from '../../shared/session/sourceLocations'

type InstructorEntry = { name: string }
type SessionEntry = {
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

type TeamEntry = {
  id: string
  name: string
  available_locations: string[]
}
const NO_TEAM_VALUE = '__no_team__'

function getSessionName(session: SessionEntry) {
  return formatSessionDisplayName({
    sessionDay: session.sessionDay,
    sessionSeason: session.sessionSeason,
    sessionYear: session.sessionYear ?? null,
    startDate: session.startDate,
    sessionStartTime24: session.sessionStartTime24 ?? null,
    sessionEndTime24: session.sessionEndTime24 ?? null,
  })
}

function getDbSessionName(
  sessionDay: string,
  sessionSeason: string | null,
  sessionYear: number | null,
  startDate: string | null,
  sessionStartTime24?: string | null,
  sessionEndTime24?: string | null,
) {
  return formatSessionDisplayName({
    sessionDay,
    sessionSeason,
    sessionYear,
    startDate,
    sessionStartTime24,
    sessionEndTime24,
  })
}

function buildSessionIdentityCriteria(input: {
  sessionDay?: string | null
  sessionSeason?: string | null
  sessionYear?: number | null
  location?: string | null
  locations?: string[]
}): SessionIdentityCriteria {
  return {
    dayOfWeek: input.sessionDay?.trim() ?? '',
    sessionSeason: input.sessionSeason?.trim() ?? '',
    sessionYear: input.sessionYear ?? null,
    location: input.location?.trim() ?? '',
    locations: input.locations ?? [],
  }
}

function ManageSessionsPage() {
  const navigate = useNavigate()
  const { setSelectedDay } = useDay()
  const { isGuest, user } = useAuth()
  const { teams, loading: teamsLoading } = useCurrentTeam()
  const { session: currentSessionRecord, access } = useCurrentSession()
  const [editSessionDay, setEditSessionDay] = useState('')
  const [editSessionSeason, setEditSessionSeason] = useState('')
  const [editSessionYear, setEditSessionYear] = useState('')
  const [editTeamId, setEditTeamId] = useState(NO_TEAM_VALUE)
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editSessionStartTime24, setEditSessionStartTime24] = useState('')
  const [editSessionEndTime24, setEditSessionEndTime24] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editSourceLocations, setEditSourceLocations] = useState<string[]>([])
  const [availableLocations, setAvailableLocations] = useState<string[]>([])
  const [teamName, setTeamName] = useState('')
  const [editInstructors, setEditInstructors] = useState<InstructorEntry[]>([{ name: '' }])
  const [editRosterFile, setEditRosterFile] = useState<File | null>(null)
  const [editRosterFileName, setEditRosterFileName] = useState<string | undefined>(undefined)
  const [editMessage, setEditMessage] = useState('')
  const [editMessageTone, setEditMessageTone] = useState<'success' | 'error'>('success')
  const [isSaving, setIsSaving] = useState(false)
  const [sessionsVersion, setSessionsVersion] = useState(0)
  const [ownedSessions, setOwnedSessions] = useState<Array<{
    id: string
    session_day: string
    session_season: string | null
    session_year: number | null
    start_date: string | null
    location: string | null
    source_locations: string[]
    session_start_time24: string | null
    session_end_time24: string | null
  }>>([])
  const [currentSessionId, setCurrentSessionIdState] = useState(() => getCurrentSessionId())
  const lastLoadedSessionIdRef = useRef('')
  const inferredTimesSessionIdRef = useRef('')

  const seasonOptions = ['Winter', 'Spring', 'Summer', 'Fall']

  const sessions = useMemo(() => {
    if (!isGuest) {
      return [] as SessionEntry[]
    }
    const items = loadSessions()
    return items.sort((a, b) => {
      const aTime = a.startDate ? new Date(a.startDate).getTime() : 0
      const bTime = b.startDate ? new Date(b.startDate).getTime() : 0
      return bTime - aTime
    })
  }, [isGuest, sessionsVersion])

  const currentSession = useMemo(() => {
    if (isGuest) {
      return sessions.find(session => session.id === currentSessionId) ?? null
    }
    return currentSessionRecord
  }, [currentSessionId, currentSessionRecord, isGuest, sessions])

  const addEditInstructor = () => {
    setEditInstructors(current => [...current, { name: '' }])
  }

  const removeEditInstructor = (index: number) => {
    setEditInstructors(current => {
      if (current.length === 1) {
        return [{ name: '' }]
      }
      return current.filter((_, i) => i !== index)
    })
  }

  const updateEditInstructor = (index: number, value: string) => {
    setEditInstructors(current => {
      const next = [...current]
      next[index] = { name: value }
      return next
    })
  }

  useEffect(() => {
    if (!currentSession) {
      return
    }
    const loadedSessionId = isGuest
      ? (currentSession as SessionEntry).id
      : currentSessionRecord?.id ?? ''
    const didSessionChange = loadedSessionId !== lastLoadedSessionIdRef.current
    lastLoadedSessionIdRef.current = loadedSessionId
    if (isGuest) {
      const localSession = currentSession as SessionEntry
      setEditSessionDay(localSession.sessionDay)
      setEditSessionSeason(localSession.sessionSeason ?? '')
      setEditSessionYear(localSession.sessionYear ? String(localSession.sessionYear) : '')
      setEditTeamId(NO_TEAM_VALUE)
      setEditStartDate(localSession.startDate)
      setEditEndDate(localSession.endDate)
      setEditSessionStartTime24(localSession.sessionStartTime24 ?? '')
      setEditSessionEndTime24(localSession.sessionEndTime24 ?? '')
      setEditLocation(localSession.location ?? '')
      setEditSourceLocations(normalizeSessionLocations(localSession.sourceLocations ?? [localSession.location ?? '']))
      setEditInstructors(localSession.instructors.length ? localSession.instructors : [{ name: '' }])
      setEditRosterFile(null)
      setEditRosterFileName(localSession.rosterFileName)
      if (didSessionChange) {
        setEditMessage('')
      }
      return
    }
    const dbSession = currentSessionRecord
    setEditSessionDay(dbSession?.session_day ?? '')
    setEditSessionSeason(dbSession?.session_season ?? '')
    const dbYear = dbSession?.session_year
    const startYear = dbSession?.start_date ? getYearFromDate(dbSession.start_date) : null
    setEditSessionYear(dbYear ? String(dbYear) : startYear ? String(startYear) : '')
    setEditTeamId(dbSession?.team_id ?? NO_TEAM_VALUE)
    setEditStartDate(dbSession?.start_date ?? '')
    setEditEndDate(dbSession?.end_date ?? '')
    setEditSessionStartTime24(dbSession?.session_start_time24 ?? '')
    setEditSessionEndTime24(dbSession?.session_end_time24 ?? '')
    setEditLocation(dbSession?.location ?? '')
    setEditSourceLocations(getEffectiveSourceLocations(dbSession))
    setEditInstructors(dbSession?.instructors?.length ? dbSession.instructors : [{ name: '' }])
    setEditRosterFile(null)
    setEditRosterFileName(undefined)
    if (didSessionChange) {
      setEditMessage('')
    }
  }, [currentSession, currentSessionRecord, isGuest])

  useEffect(() => {
    if (isGuest || !editTeamId || editTeamId === NO_TEAM_VALUE) {
      setAvailableLocations([])
      setTeamName('')
      return
    }
    const selectedTeam = teams.find(team => team.id === editTeamId)
    if (selectedTeam) {
      setTeamName(selectedTeam.name)
      setAvailableLocations(selectedTeam.available_locations ?? [])
      return
    }
    const loadTeam = async () => {
      const response = await fetchCurrentTeams()
      const data = response.teams.find(team => team.id === editTeamId)
      if (!data) {
        setAvailableLocations([])
        setTeamName('')
        return
      }
      const team = data as TeamEntry
      setTeamName(team.name)
      setAvailableLocations(team.available_locations ?? [])
    }
    void loadTeam()
  }, [editTeamId, isGuest, teams])

  useEffect(() => {
    if (!currentSessionId) {
      setSelectedDay('')
    }
  }, [currentSessionId, setSelectedDay])

  useEffect(() => {
    const unsubscribe = onCurrentSessionChanged(id => {
      setCurrentSessionIdState(id)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    return onStorageScopeChanged(() => {
      setCurrentSessionIdState(getCurrentSessionId())
      setSessionsVersion(version => version + 1)
    })
  }, [])

  useEffect(() => {
    if (isGuest || !user) {
      setOwnedSessions([])
      return
    }
    let active = true
    const loadOwnedSessions = async () => {
      try {
        const response = await fetchMySessions()
        if (!active) {
          return
        }
        setOwnedSessions((response.sessions ?? []) as typeof ownedSessions)
      } catch (error) {
        console.error('Failed to load owned sessions', error)
        setOwnedSessions([])
      }
    }
    void loadOwnedSessions()
    return () => {
      active = false
    }
  }, [isGuest, sessionsVersion, user])

  useEffect(() => {
    const sessionId = currentSessionId.trim()
    if (!sessionId || inferredTimesSessionIdRef.current === sessionId) {
      return
    }
    if (!currentSession) {
      return
    }

    const hasSavedTimes = isGuest
      ? Boolean(
          (currentSession as SessionEntry).sessionStartTime24 ||
            (currentSession as SessionEntry).sessionEndTime24,
        )
      : Boolean(
          currentSessionRecord?.session_start_time24 ||
            currentSessionRecord?.session_end_time24,
        )
    if (hasSavedTimes) {
      return
    }
    if (!isGuest && access.mode !== 'owner') {
      return
    }

    let extractedClasses = getExtractedClassesForSession(sessionId)
    if (!isGuest) {
      const teamID = currentSessionRecord?.team_id ?? ''
      const sessionSeason = currentSessionRecord?.session_season ?? ''
      const sessionYear = currentSessionRecord?.session_year ?? getYearFromDate(currentSessionRecord?.start_date)
      const termKey = createTermKey(sessionSeason, sessionYear ?? 0)
      if (teamID && termKey) {
        extractedClasses = getExtractedClassesForScope(teamID, termKey)
      }
    }
    if (extractedClasses.length === 0) {
      return
    }

    const criteria = isGuest
      ? buildSessionIdentityCriteria({
          sessionDay: (currentSession as SessionEntry).sessionDay,
          sessionSeason: (currentSession as SessionEntry).sessionSeason,
          sessionYear: (currentSession as SessionEntry).sessionYear ?? null,
          location: '',
          locations: normalizeSessionLocations(
            (currentSession as SessionEntry).sourceLocations ?? [(currentSession as SessionEntry).location ?? ''],
          ),
        })
      : buildSessionIdentityCriteria({
          sessionDay: currentSessionRecord?.session_day ?? null,
          sessionSeason: currentSessionRecord?.session_season ?? null,
          sessionYear: currentSessionRecord?.session_year ?? null,
          location: '',
          locations: getEffectiveSourceLocations(currentSessionRecord),
        })

    const inferredWindow = inferSingleSessionWindowFromClasses(extractedClasses, criteria)
    if (!inferredWindow) {
      return
    }

    inferredTimesSessionIdRef.current = sessionId
    setEditSessionStartTime24(inferredWindow.sessionStartTime24)
    setEditSessionEndTime24(inferredWindow.sessionEndTime24)

    const persist = async () => {
      if (isGuest) {
        const updatedSessions = loadSessions().map(session =>
          session.id === sessionId
            ? {
                ...session,
                sessionStartTime24: inferredWindow.sessionStartTime24,
                sessionEndTime24: inferredWindow.sessionEndTime24,
              }
            : session,
        )
        saveSessions(updatedSessions)
        setSessionsVersion(version => version + 1)
        setEditMessageTone('success')
        setEditMessage('Session times autofilled from stored roster data.')
        return
      }

      try {
        await updateSession(sessionId, {
          session_start_time24: inferredWindow.sessionStartTime24,
          session_end_time24: inferredWindow.sessionEndTime24,
          updated_at: new Date().toISOString(),
        })
        setCurrentSessionId(sessionId)
        setCurrentSessionIdState(sessionId)
        setEditMessageTone('success')
        setEditMessage('Session times autofilled from stored roster data.')
      } catch (error) {
        inferredTimesSessionIdRef.current = ''
        setEditMessageTone('error')
        setEditMessage(error instanceof Error ? error.message : 'Failed to autofill session times.')
      }
    }

    void persist()
  }, [access.mode, currentSession, currentSessionId, currentSessionRecord, isGuest])

  const handleUpdateSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!currentSessionId) {
      return
    }
    if (Boolean(editSessionStartTime24) !== Boolean(editSessionEndTime24)) {
      setEditMessageTone('error')
      setEditMessage('Enter both session start and end time, or leave both blank.')
      return
    }
    const normalizedSourceLocations = normalizeSessionLocations(
      editSourceLocations.length > 0 ? editSourceLocations : [editLocation],
    )
    const resolvedDisplayLocation =
      editLocation.trim() || (normalizedSourceLocations.length === 1 ? normalizedSourceLocations[0] : '')
    if (normalizedSourceLocations.length > 1 && !editLocation.trim()) {
      setEditMessageTone('error')
      setEditMessage('Enter a display location when combining multiple raw locations.')
      return
    }
    setIsSaving(true)
    if (isGuest) {
      const sessionsToUpdate = loadSessions()
      const updatedSessions = sessionsToUpdate.map(session => {
        if (session.id !== currentSessionId) {
          return session
        }
        return {
          ...session,
          sessionDay: editSessionDay,
          sessionSeason: editSessionSeason,
          sessionYear: resolveSessionYear(editSessionYear, editStartDate, editEndDate),
          startDate: editStartDate,
          endDate: editEndDate,
          sessionStartTime24: editSessionStartTime24 || null,
          sessionEndTime24: editSessionEndTime24 || null,
          location: resolvedDisplayLocation || null,
          sourceLocations: normalizedSourceLocations,
          instructors: editInstructors.filter(instructor => instructor.name.trim().length > 0),
          rosterFileName: editRosterFile ? editRosterFile.name : editRosterFileName,
        }
      })
      saveSessions(updatedSessions)
      setEditMessageTone('success')
      setEditMessage('Session updated.')
      setSessionsVersion(version => version + 1)
      setCurrentSessionId(currentSessionId)
      setCurrentSessionIdState(currentSessionId)
      setSelectedDay(editSessionDay || '')
      setIsSaving(false)
      return
    }

    if (!user) {
      setEditMessageTone('error')
      setEditMessage('You must be signed in to update this session.')
      setIsSaving(false)
      return
    }
    if (!currentSessionRecord) {
      setEditMessageTone('error')
      setEditMessage('Session data is not ready yet. Please try again.')
      setIsSaving(false)
      return
    }

    const previousTeamId = currentSessionRecord.team_id ?? null
    const previousSessionDay = currentSessionRecord.session_day ?? ''
    const previousSessionLabel = formatSessionTermLabel(
      currentSessionRecord.session_season,
      currentSessionRecord.session_year,
      currentSessionRecord.start_date,
    )

    const sessionYearValue = resolveSessionYear(editSessionYear, editStartDate, editEndDate)
    const nextTeamId = editTeamId && editTeamId !== NO_TEAM_VALUE ? editTeamId : null
    const nextSessionDay = editSessionDay
    const nextSessionLabel = formatSessionTermLabel(
      editSessionSeason || null,
      sessionYearValue,
      editStartDate,
    )

    const didReportCardScopeChange =
      previousTeamId !== nextTeamId ||
      previousSessionDay !== nextSessionDay ||
      previousSessionLabel !== nextSessionLabel

    const updateTimestamp = new Date().toISOString()

    try {
      await updateSession(currentSessionId, {
        team_id: nextTeamId,
        session_day: editSessionDay,
        session_season: editSessionSeason || null,
        session_year: sessionYearValue,
        start_date: editStartDate || null,
        end_date: editEndDate || null,
        session_start_time24: editSessionStartTime24 || null,
        session_end_time24: editSessionEndTime24 || null,
        location: resolvedDisplayLocation || null,
        source_locations: normalizedSourceLocations,
        instructors: editInstructors.filter(instructor => instructor.name.trim().length > 0),
        updated_at: updateTimestamp,
        report_card_sync: didReportCardScopeChange
          ? {
              previousTeamId,
              previousSessionDay,
              previousSessionLabel,
              nextTeamId,
              nextSessionDay,
              nextSessionLabel,
            }
          : undefined,
      })
    } catch (error) {
      setEditMessageTone('error')
      setEditMessage(error instanceof Error ? error.message : 'Failed to update session')
      setIsSaving(false)
      return
    }

    setEditMessageTone('success')
    setEditMessage('Session updated.')
    setCurrentSessionId(currentSessionId)
    setCurrentSessionIdState(currentSessionId)
    setSelectedDay(editSessionDay || '')
    setIsSaving(false)
  }

  const handleDeleteSession = async () => {
    if (!currentSessionId) {
      return
    }
    if (!confirm('Delete this session? This action cannot be undone.')) {
      return
    }
    if (isGuest) {
      const sessionsToUpdate = loadSessions()
      const updatedSessions = sessionsToUpdate.filter(session => session.id !== currentSessionId)
      saveSessions(updatedSessions)
      clearCurrentSessionId()
      setSessionsVersion(version => version + 1)
      setEditMessage('Session deleted.')
      setSelectedDay('')
      navigate('/')
      return
    }

    if (!user) {
      return
    }
    try {
      await deleteSession(currentSessionId)
    } catch (error) {
      setEditMessage(error instanceof Error ? error.message : 'Failed to delete session')
      return
    }
    clearCurrentSessionId()
    setEditMessage('Session deleted.')
    setSelectedDay('')
    navigate('/')
  }

  const overlapWarning = useMemo(() => {
    if (!currentSessionId) {
      return ''
    }
    const candidateYear = resolveSessionYear(editSessionYear, editStartDate, editEndDate)
    const candidateLocations = normalizeSessionLocations(
      editSourceLocations.length > 0 ? editSourceLocations : [editLocation],
    )
    if (
      !editSessionDay.trim() ||
      !editSessionSeason.trim() ||
      !candidateYear ||
      !editSessionStartTime24.trim() ||
      !editSessionEndTime24.trim() ||
      candidateLocations.length === 0
    ) {
      return ''
    }

    const sessionsToCompare = isGuest
      ? loadSessions().map(session => ({
          id: session.id,
          session_day: session.sessionDay,
          session_season: session.sessionSeason ?? null,
          session_year: session.sessionYear ?? null,
          start_date: session.startDate ?? null,
          location: session.location ?? null,
          source_locations: session.sourceLocations ?? [],
          session_start_time24: session.sessionStartTime24 ?? null,
          session_end_time24: session.sessionEndTime24 ?? null,
        }))
      : ownedSessions

    const overlapping = sessionsToCompare.find(session => {
      if (session.id === currentSessionId) {
        return false
      }
      const sessionYear = session.session_year ?? getYearFromDate(session.start_date)
      if (session.session_day !== editSessionDay) {
        return false
      }
      if ((session.session_season ?? '').trim().toLowerCase() !== editSessionSeason.trim().toLowerCase()) {
        return false
      }
      if (sessionYear !== candidateYear) {
        return false
      }
      if ((session.session_start_time24 ?? '') !== editSessionStartTime24) {
        return false
      }
      if ((session.session_end_time24 ?? '') !== editSessionEndTime24) {
        return false
      }
      const sessionLocations = getEffectiveSourceLocations(session)
      return sessionLocations.some(location =>
        candidateLocations.some(candidate => normalizeSessionLocationKey(candidate) === normalizeSessionLocationKey(location)),
      )
    })

    if (!overlapping) {
      return ''
    }

    return `Warning: another saved session overlaps this same day, term, time, and raw location scope.`
  }, [
    currentSessionId,
    editEndDate,
    editLocation,
    editSessionDay,
    editSessionEndTime24,
    editSessionSeason,
    editSessionStartTime24,
    editSessionYear,
    editSourceLocations,
    isGuest,
    ownedSessions,
    editStartDate,
  ])

  return (
    <div id="manage-sessions-page" data-component="manage-sessions-page" className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <h2 className="text-2xl font-semibold text-secondary">Manage Sessions</h2>
      {!currentSession ? (
        <p className="mt-2 font-semibold text-secondary">
          No session selected. Choose one from Home → Select Existing Session.
        </p>
      ) : (
        <div className="rounded-card border-2 border-secondary/20 bg-accent p-5 text-secondary shadow-md">
          <div className="mb-4">
            {isGuest ? (
              <>
                <h3 className="text-lg font-semibold">
                  {getSessionName(currentSession as SessionEntry)}
                </h3>
                <p>
                  {(currentSession as SessionEntry).startDate || 'Start date'} -
                  {(currentSession as SessionEntry).endDate || 'End date'}
                </p>
                <p>{(currentSession as SessionEntry).instructors.length} instructors</p>
                {(currentSession as SessionEntry).rosterFileName ? (
                  <p>Roster: {(currentSession as SessionEntry).rosterFileName}</p>
                ) : null}
                {getEffectiveSourceLocations({
                  location: (currentSession as SessionEntry).location ?? null,
                  source_locations: (currentSession as SessionEntry).sourceLocations ?? [],
                }).length > 1 ? (
                  <p className="text-sm text-secondary/70">
                    Includes: {getEffectiveSourceLocations({
                      location: (currentSession as SessionEntry).location ?? null,
                      source_locations: (currentSession as SessionEntry).sourceLocations ?? [],
                    }).join(', ')}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold">
                  {getDbSessionName(
                    currentSessionRecord?.session_day ?? '',
                    currentSessionRecord?.session_season ?? null,
                    currentSessionRecord?.session_year ?? null,
                    currentSessionRecord?.start_date ?? null,
                    currentSessionRecord?.session_start_time24 ?? null,
                    currentSessionRecord?.session_end_time24 ?? null,
                  )}
                </h3>
                <p>
                  {currentSessionRecord?.start_date || 'Start date'} -
                  {currentSessionRecord?.end_date || 'End date'}
                </p>
                <p>{currentSessionRecord?.instructors?.length ?? 0} instructors</p>
                {teamName ? <p>Team: {teamName}</p> : null}
                {currentSessionRecord?.location ? <p>Location: {currentSessionRecord.location}</p> : null}
                {getEffectiveSourceLocations(currentSessionRecord).length > 1 ? (
                  <p className="text-sm text-secondary/70">
                    Includes: {getEffectiveSourceLocations(currentSessionRecord).join(', ')}
                  </p>
                ) : null}
              </>
            )}
          </div>
          {!isGuest && access.mode !== 'owner' ? (
            <div className="rounded-2xl border border-secondary/20 bg-bg p-4 text-sm text-secondary">
              You are viewing a shared session. Editing is disabled.
            </div>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={handleUpdateSession}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 font-semibold text-secondary">
                  Session Day
                  <select
                    className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                    value={editSessionDay}
                    onChange={event => setEditSessionDay(event.target.value)}
                  >
                    <option value="">Select a day</option>
                    <option value="Mo">Monday</option>
                    <option value="Tu">Tuesday</option>
                    <option value="We">Wednesday</option>
                    <option value="Th">Thursday</option>
                    <option value="Fr">Friday</option>
                    <option value="Sa">Saturday</option>
                    <option value="Su">Sunday</option>
                  </select>
                </label>
                <label className="flex flex-col gap-2 font-semibold text-secondary">
                  Session Season
                  <select
                    className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                    value={editSessionSeason}
                    onChange={event => setEditSessionSeason(event.target.value)}
                  >
                    <option value="">Select a season</option>
                    {seasonOptions.map(season => (
                      <option key={season} value={season}>
                        {season}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 font-semibold text-secondary">
                  Session Year
                  <input
                    className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                    type="number"
                    min={2000}
                    max={2100}
                    value={editSessionYear}
                    onChange={event => setEditSessionYear(event.target.value)}
                    placeholder="e.g. 2026"
                  />
                </label>
                <label className="flex flex-col gap-2 font-semibold text-secondary">
                  Start Date
                  <input
                    className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                    type="date"
                    value={editStartDate}
                    onChange={event => setEditStartDate(event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-2 font-semibold text-secondary">
                  End Date
                  <input
                    className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                    type="date"
                    value={editEndDate}
                    onChange={event => setEditEndDate(event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-2 font-semibold text-secondary">
                  Session Start Time
                  <input
                    className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                    type="time"
                    value={editSessionStartTime24}
                    onChange={event => setEditSessionStartTime24(event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-2 font-semibold text-secondary">
                  Session End Time
                  <input
                    className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                    type="time"
                    value={editSessionEndTime24}
                    onChange={event => setEditSessionEndTime24(event.target.value)}
                  />
                </label>
                {!isGuest ? (
                  <label className="flex flex-col gap-2 font-semibold text-secondary">
                    Team
                    <select
                      className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                      value={editTeamId}
                      onChange={event => setEditTeamId(event.target.value)}
                      disabled={teamsLoading}
                    >
                      <option value={NO_TEAM_VALUE}>No team</option>
                      {teams.map(team => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="flex flex-col gap-2 font-semibold text-secondary">
                  Display Location
                  <input
                    className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                    type="text"
                    value={editLocation}
                    onChange={event => setEditLocation(event.target.value)}
                    list={availableLocations.length > 0 ? 'manage-session-location-options' : undefined}
                    placeholder="Shown across the app"
                  />
                  {availableLocations.length > 0 ? (
                    <datalist id="manage-session-location-options">
                      {availableLocations.map(option => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                  ) : null}
                </label>
                <SourceLocationsInput
                  values={editSourceLocations}
                  suggestions={availableLocations}
                  inputId="manage-session-source-location-options"
                  helperText="These raw CSV locations will be treated as one session."
                  onChange={setEditSourceLocations}
                />
                {availableLocations.length > 0 ? (
                  <span className="text-xs font-medium text-secondary/70">
                    Team locations are suggestions only. The display location and raw locations are saved independently.
                  </span>
                ) : null}
                <div className="flex flex-col gap-2">
                  <span className="font-semibold text-secondary">Upload Roster (optional)</span>
                  <label className="relative flex h-12 items-center justify-center rounded-[10px] border-2 border-dashed border-secondary bg-bg px-2 text-center text-sm font-medium text-secondary transition hover:-translate-y-0.5 hover:border-secondary">
                    <span>
                      {editRosterFile
                        ? editRosterFile.name
                        : editRosterFileName ?? 'Click or drop a .csv file'}
                    </span>
                    <input
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      type="file"
                      accept=".csv"
                      onChange={event => setEditRosterFile(event.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <p className="font-semibold text-secondary">Instructors</p>
                {editInstructors.map((instructor, index) => (
                  <div key={`edit-${currentSessionId}-${index}`} className="flex gap-3">
                    <input
                      className="flex-1 rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                      type="text"
                      placeholder="Instructor name"
                      value={instructor.name}
                      onChange={event => updateEditInstructor(index, event.target.value)}
                    />
                    <button
                      type="button"
                      className="rounded-2xl bg-secondary px-3 py-2 text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
                      onClick={() => removeEditInstructor(index)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="w-fit rounded-2xl bg-secondary px-3 py-2 text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
                  onClick={addEditInstructor}
                >
                  Add Instructor
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                {overlapWarning ? (
                  <div className="w-full rounded-2xl border border-secondary/20 bg-bg px-4 py-3 text-sm text-secondary">
                    {overlapWarning}
                  </div>
                ) : null}
                <button
                  type="submit"
                  className="rounded-2xl bg-primary px-5 py-2 text-white transition hover:-translate-y-0.5 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="rounded-2xl bg-danger px-5 py-2 text-accent transition hover:-translate-y-0.5 hover:bg-dangerHover"
                  onClick={handleDeleteSession}
                >
                  Delete Session
                </button>
                {editMessage ? (
                  <span className={`font-semibold ${editMessageTone === 'error' ? 'text-danger' : 'text-primary'}`}>
                    {editMessage}
                  </span>
                ) : null}
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

export default ManageSessionsPage

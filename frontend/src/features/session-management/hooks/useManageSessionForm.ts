import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../app/AuthContext'
import { createTermKey } from '../../../app/useCurrentTerm'
import { useCurrentSession } from '../../../app/useCurrentSession'
import { useCurrentTeam } from '../../../app/useCurrentTeam'
import {
  getExtractedClassesForScope,
  getExtractedClassesForSession,
} from '../../../lib/extractedClassesStorage'
import {
  clearCurrentSessionId,
  loadSessions,
  saveSessions,
  setCurrentSessionId,
} from '../../../lib/sessionStorage'
import {
  deleteSession,
  fetchCurrentTeams,
  fetchMySessions,
  updateSession,
} from '../../../lib/serverApi'
import { formatSessionTermLabel, getYearFromDate, resolveSessionYear } from '../../../shared/session/sessionLabels'
import { inferSingleSessionWindowFromClasses } from '../../../shared/session/sessionTimeInference'
import {
  getEffectiveSourceLocations,
  normalizeSessionLocationKey,
  normalizeSessionLocations,
} from '../../../shared/session/sourceLocations'
import { NO_TEAM_VALUE, SESSION_SEASON_OPTIONS, type InstructorEntry, type LocalSessionEntry } from '../types'
import { buildSessionIdentityCriteria, resolveDisplayAndSourceLocations } from '../utils/sessionIdentity'

type TeamEntry = {
  id: string
  name: string
  available_locations: string[]
}

type OwnedSessionRow = Array<{
  id: string
  session_day: string
  session_season: string | null
  session_year: number | null
  start_date: string | null
  location: string | null
  source_locations: string[]
  session_start_time24: string | null
  session_end_time24: string | null
}>[number]

type UseManageSessionFormParams = {
  currentSessionId: string
  scopeVersion: number
  refreshScope: () => void
  selectSessionAndSyncDay: (sessionId: string, sessionDay?: string | null) => void
}

export function useManageSessionForm({
  currentSessionId,
  scopeVersion,
  refreshScope,
  selectSessionAndSyncDay,
}: UseManageSessionFormParams) {
  const navigate = useNavigate()
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
  const [ownedSessions, setOwnedSessions] = useState<OwnedSessionRow[]>([])
  const lastLoadedSessionIdRef = useRef('')
  const inferredTimesSessionIdRef = useRef('')

  const currentSession = useMemo(() => {
    if (isGuest) {
      return loadSessions().find(session => session.id === currentSessionId) ?? null
    }
    return currentSessionRecord
  }, [currentSessionId, currentSessionRecord, isGuest, scopeVersion])

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
      ? (currentSession as LocalSessionEntry).id
      : currentSessionRecord?.id ?? ''
    const didSessionChange = loadedSessionId !== lastLoadedSessionIdRef.current
    lastLoadedSessionIdRef.current = loadedSessionId
    if (isGuest) {
      const localSession = currentSession as LocalSessionEntry
      setEditSessionDay(localSession.sessionDay)
      setEditSessionSeason(localSession.sessionSeason ?? '')
      setEditSessionYear(localSession.sessionYear ? String(localSession.sessionYear) : '')
      setEditTeamId(NO_TEAM_VALUE)
      setEditStartDate(localSession.startDate)
      setEditEndDate(localSession.endDate)
      setEditSessionStartTime24(localSession.sessionStartTime24 ?? '')
      setEditSessionEndTime24(localSession.sessionEndTime24 ?? '')
      setEditLocation(localSession.location ?? '')
      setEditSourceLocations(
        normalizeSessionLocations(localSession.sourceLocations ?? [localSession.location ?? '']),
      )
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
        setOwnedSessions((response.sessions ?? []) as OwnedSessionRow[])
      } catch (error) {
        console.error('Failed to load owned sessions', error)
        setOwnedSessions([])
      }
    }
    void loadOwnedSessions()
    return () => {
      active = false
    }
  }, [isGuest, scopeVersion, user])

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
          (currentSession as LocalSessionEntry).sessionStartTime24 ||
            (currentSession as LocalSessionEntry).sessionEndTime24,
        )
      : Boolean(
          currentSessionRecord?.session_start_time24 || currentSessionRecord?.session_end_time24,
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
      const sessionYear =
        currentSessionRecord?.session_year ?? getYearFromDate(currentSessionRecord?.start_date)
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
          sessionDay: (currentSession as LocalSessionEntry).sessionDay,
          sessionSeason: (currentSession as LocalSessionEntry).sessionSeason,
          sessionYear: (currentSession as LocalSessionEntry).sessionYear ?? null,
          location: '',
          locations: normalizeSessionLocations(
            (currentSession as LocalSessionEntry).sourceLocations ?? [
              (currentSession as LocalSessionEntry).location ?? '',
            ],
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
        refreshScope()
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
        setEditMessageTone('success')
        setEditMessage('Session times autofilled from stored roster data.')
      } catch (error) {
        inferredTimesSessionIdRef.current = ''
        setEditMessageTone('error')
        setEditMessage(
          error instanceof Error ? error.message : 'Failed to autofill session times.',
        )
      }
    }

    void persist()
  }, [access.mode, currentSession, currentSessionId, currentSessionRecord, isGuest, refreshScope])

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
    const resolvedLocations = resolveDisplayAndSourceLocations({
      location: editLocation,
      sourceLocations: editSourceLocations,
    })
    if (resolvedLocations.validationMessage) {
      setEditMessageTone('error')
      setEditMessage(resolvedLocations.validationMessage)
      return
    }
    setIsSaving(true)
    if (isGuest) {
      const updatedSessions = loadSessions().map(session => {
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
          location: resolvedLocations.displayLocation || null,
          sourceLocations: resolvedLocations.sourceLocations,
          instructors: editInstructors.filter(instructor => instructor.name.trim().length > 0),
          rosterFileName: editRosterFile ? editRosterFile.name : editRosterFileName,
        }
      })
      saveSessions(updatedSessions)
      setEditMessageTone('success')
      setEditMessage('Session updated.')
      refreshScope()
      selectSessionAndSyncDay(currentSessionId, editSessionDay)
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
        location: resolvedLocations.displayLocation || null,
        source_locations: resolvedLocations.sourceLocations,
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
    selectSessionAndSyncDay(currentSessionId, editSessionDay)
    setIsSaving(false)
  }

  const handleDeleteSession = async () => {
    if (!currentSessionId) {
      return
    }
    if (!window.confirm('Delete this session? This action cannot be undone.')) {
      return
    }
    if (isGuest) {
      const updatedSessions = loadSessions().filter(session => session.id !== currentSessionId)
      saveSessions(updatedSessions)
      clearCurrentSessionId()
      refreshScope()
      setEditMessage('Session deleted.')
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
      if (
        (session.session_season ?? '').trim().toLowerCase() !==
        editSessionSeason.trim().toLowerCase()
      ) {
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
        candidateLocations.some(
          candidate => normalizeSessionLocationKey(candidate) === normalizeSessionLocationKey(location),
        ),
      )
    })

    if (!overlapping) {
      return ''
    }

    return 'Warning: another saved session overlaps this same day, term, time, and raw location scope.'
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

  return {
    seasonOptions: SESSION_SEASON_OPTIONS,
    currentSession,
    currentSessionRecord,
    access,
    teams,
    teamsLoading,
    teamName,
    availableLocations,
    editSessionDay,
    editSessionSeason,
    editSessionYear,
    editTeamId,
    editStartDate,
    editEndDate,
    editSessionStartTime24,
    editSessionEndTime24,
    editLocation,
    editSourceLocations,
    editInstructors,
    editRosterFile,
    editRosterFileName,
    editMessage,
    editMessageTone,
    isSaving,
    overlapWarning,
    setEditSessionDay,
    setEditSessionSeason,
    setEditSessionYear,
    setEditTeamId,
    setEditStartDate,
    setEditEndDate,
    setEditSessionStartTime24,
    setEditSessionEndTime24,
    setEditLocation,
    setEditSourceLocations,
    setEditRosterFile,
    addEditInstructor,
    removeEditInstructor,
    updateEditInstructor,
    handleUpdateSession,
    handleDeleteSession,
  }
}

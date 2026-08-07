import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CurrentTerm } from '../../../app/useCurrentTerm'
import { createSession, fetchCsvAnalyze } from '../../../lib/serverApi'
import { extractClassesFromCsv } from '../../../lib/api'
import { loadSessions, saveSessions } from '../../../lib/sessionStorage'
import { getYearFromDate, resolveSessionYear } from '../../../shared/session/sessionLabels'
import { findSingleMatchingExtractedSession } from '../../../shared/session/sessionTimeInference'
import { getEffectiveSourceLocations } from '../../../shared/session/sourceLocations'
import type { TeamRecord } from '../../../app/useCurrentTeam'
import type { ExtractedSession } from '../../../types/app'
import {
  NO_TEAM_VALUE,
  SESSION_SEASON_OPTIONS,
  type InstructorEntry,
  type LocalSessionEntry,
} from '../types'
import {
  buildSessionIdentityCriteria,
  hasIdentityCriteria,
  resolveDisplayAndSourceLocations,
} from '../utils/sessionIdentity'

type UseNewSessionFormParams = {
  accountType: 'part_time' | 'full_time'
  isGuest: boolean
  user: { id: string } | null
  currentTeamId: string
  currentTerm: CurrentTerm | null
  teams: TeamRecord[]
  selectSessionAndSyncDay: (sessionId: string, sessionDay?: string | null) => void
  refreshScope: () => void
}

export function useNewSessionForm({
  accountType,
  isGuest,
  user,
  currentTeamId,
  currentTerm,
  teams,
  selectSessionAndSyncDay,
  refreshScope,
}: UseNewSessionFormParams) {
  const navigate = useNavigate()
  const [sessionDay, setSessionDay] = useState('')
  const [sessionSeason, setSessionSeason] = useState('')
  const [sessionYear, setSessionYear] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sessionStartTime24, setSessionStartTime24] = useState('')
  const [sessionEndTime24, setSessionEndTime24] = useState('')
  const [newSessionExtractedSessions, setNewSessionExtractedSessions] = useState<ExtractedSession[]>([])
  const [newSessionTimeMessage, setNewSessionTimeMessage] = useState('')
  const [isInspectingRosterFile, setIsInspectingRosterFile] = useState(false)
  const [instructors, setInstructors] = useState<InstructorEntry[]>([{ name: '' }])
  const [saveMessage, setSaveMessage] = useState('')
  const [rosterFile, setRosterFile] = useState<File | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [location, setLocation] = useState('')
  const [sourceLocations, setSourceLocations] = useState<string[]>([])
  const didManuallyEditSessionTimesRef = useRef(false)
  const didAutofillSessionTimesRef = useRef(false)

  const availableLocations = useMemo(() => {
    if (!selectedTeamId || selectedTeamId === NO_TEAM_VALUE) {
      return [] as string[]
    }
    return teams.find(team => team.id === selectedTeamId)?.available_locations ?? []
  }, [selectedTeamId, teams])

  const sourceLocationOptions = useMemo(() => {
    const locations = Array.from(
      new Set(
        newSessionExtractedSessions
          .map(session => session.location.trim())
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right, 'en', { sensitivity: 'base' }))

    return locations.filter(
      option => !sourceLocations.some(selected => selected.trim().toLowerCase() === option.toLowerCase()),
    )
  }, [newSessionExtractedSessions, sourceLocations])

  const inspectNewSessionRosterFile = async (file: File) => {
    setIsInspectingRosterFile(true)
    setNewSessionTimeMessage('')
    try {
      const extracted = isGuest
        ? await extractClassesFromCsv(file)
        : (
            await fetchCsvAnalyze(
              file,
              accountType === 'full_time' && currentTeamId
                ? {
                    teamId: currentTeamId,
                    termSeason: currentTerm?.season,
                    termYear: currentTerm?.year,
                  }
                : undefined,
            )
          ).extracted
      const sessions = extracted.sessions ?? []
      setNewSessionExtractedSessions(sessions)
      if (sessions.length === 0) {
        setNewSessionTimeMessage('No session times were found in this CSV.')
      }
    } catch (error) {
      setNewSessionExtractedSessions([])
      setNewSessionTimeMessage(
        error instanceof Error ? error.message : 'Failed to inspect the roster CSV.',
      )
    } finally {
      setIsInspectingRosterFile(false)
    }
  }

  const addInstructor = () => {
    setInstructors(current => [...current, { name: '' }])
  }

  const updateInstructor = (index: number, value: string) => {
    setInstructors(current => {
      const next = [...current]
      next[index] = { name: value }
      return next
    })
  }

  const handleRosterFileChange = (file: File | null) => {
    setRosterFile(file)
    setNewSessionExtractedSessions([])
    setNewSessionTimeMessage('')
    didManuallyEditSessionTimesRef.current = false
    didAutofillSessionTimesRef.current = false
    if (!file) {
      return
    }
    void inspectNewSessionRosterFile(file)
  }

  const handleSaveSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isGuest && !user) {
      return
    }
    if (Boolean(sessionStartTime24) !== Boolean(sessionEndTime24)) {
      setSaveMessage('Enter both session start and end time, or leave both blank.')
      return
    }
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const resolvedLocations = resolveDisplayAndSourceLocations({ location, sourceLocations })
    if (resolvedLocations.validationMessage) {
      setSaveMessage(resolvedLocations.validationMessage)
      return
    }

    if (isGuest) {
      const nextSession: LocalSessionEntry = {
        id,
        sessionDay,
        sessionSeason,
        sessionYear: resolveSessionYear(sessionYear, startDate, endDate),
        startDate,
        endDate,
        sessionStartTime24: sessionStartTime24 || null,
        sessionEndTime24: sessionEndTime24 || null,
        location: resolvedLocations.displayLocation || null,
        sourceLocations: resolvedLocations.sourceLocations,
        instructors: instructors.filter(instructor => instructor.name.trim().length > 0),
        rosterFileName: rosterFile?.name,
      }

      const sessions = loadSessions()
      sessions.push(nextSession)
      saveSessions(sessions)
      selectSessionAndSyncDay(id, sessionDay)
      setSaveMessage('Session saved.')
      refreshScope()
      navigate('/manage-sessions')
      return
    }

    if (!selectedTeamId) {
      setSaveMessage('Select a team or choose No team before saving.')
      return
    }

    const hasTeam = selectedTeamId !== NO_TEAM_VALUE
    const sessionYearValue = resolveSessionYear(sessionYear, startDate, endDate)

    const payload = {
      id,
      team_id: hasTeam ? selectedTeamId : null,
      created_by: user!.id,
      session_day: sessionDay,
      session_season: sessionSeason || null,
      session_year: sessionYearValue,
      start_date: startDate || null,
      end_date: endDate || null,
      location: resolvedLocations.displayLocation || null,
      source_locations: resolvedLocations.sourceLocations,
      session_start_time24: sessionStartTime24 || null,
      session_end_time24: sessionEndTime24 || null,
      instructors: instructors.filter(instructor => instructor.name.trim().length > 0),
    }

    try {
      await createSession(payload)
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Failed to save session')
      return
    }
    selectSessionAndSyncDay(id, sessionDay)
    setSaveMessage('Session saved.')
    refreshScope()
    navigate('/manage-sessions')
  }

  useEffect(() => {
    if (sessionYear || !startDate) {
      return
    }
    const derivedYear = getYearFromDate(startDate)
    if (derivedYear) {
      setSessionYear(String(derivedYear))
    }
  }, [sessionYear, startDate])

  useEffect(() => {
    if (didManuallyEditSessionTimesRef.current) {
      return
    }
    if (!didAutofillSessionTimesRef.current && (sessionStartTime24 || sessionEndTime24)) {
      return
    }
    if (newSessionExtractedSessions.length === 0) {
      return
    }

    const identityCriteria = buildSessionIdentityCriteria({
      sessionDay,
      sessionSeason,
      sessionYear,
      location: '',
      locations: sourceLocations.length > 0 ? sourceLocations : location ? [location] : [],
    })
    const match = hasIdentityCriteria(identityCriteria)
      ? findSingleMatchingExtractedSession(newSessionExtractedSessions, identityCriteria)
      : newSessionExtractedSessions.length === 1
        ? newSessionExtractedSessions[0]
        : null

    if (match) {
      setSessionStartTime24(match.sessionStartTime24)
      setSessionEndTime24(match.sessionEndTime24)
      didAutofillSessionTimesRef.current = true
      setNewSessionTimeMessage('Session times autofilled from the roster CSV.')
      return
    }

    if (didAutofillSessionTimesRef.current) {
      setSessionStartTime24('')
      setSessionEndTime24('')
      didAutofillSessionTimesRef.current = false
    }

    if (!hasIdentityCriteria(identityCriteria) && newSessionExtractedSessions.length > 1) {
      setNewSessionTimeMessage(
        'CSV has multiple session windows. Fill session details to narrow it down.',
      )
      return
    }

    if (hasIdentityCriteria(identityCriteria)) {
      setNewSessionTimeMessage(
        'CSV did not resolve to one session window with the current session details.',
      )
    }
  }, [
    newSessionExtractedSessions,
    sessionDay,
    sessionEndTime24,
    sessionSeason,
    sessionStartTime24,
    sessionYear,
    location,
    sourceLocations,
  ])

  useEffect(() => {
    if (isGuest) {
      return
    }
    const hasSelected = teams.some(team => team.id === selectedTeamId)
    if (hasSelected) {
      return
    }
    if (currentTeamId && teams.some(team => team.id === currentTeamId)) {
      setSelectedTeamId(currentTeamId)
      return
    }
    if (teams.length > 0) {
      setSelectedTeamId(teams[0].id)
      return
    }
    setSelectedTeamId('')
  }, [currentTeamId, isGuest, selectedTeamId, teams])

  return {
    seasonOptions: SESSION_SEASON_OPTIONS,
    sessionDay,
    sessionSeason,
    sessionYear,
    startDate,
    endDate,
    sessionStartTime24,
    sessionEndTime24,
    newSessionTimeMessage,
    isInspectingRosterFile,
    instructors,
    saveMessage,
    rosterFile,
    selectedTeamId,
    availableLocations,
    location,
    sourceLocations,
    sourceLocationOptions,
    setSessionDay,
    setSessionSeason,
    setSessionYear,
    setStartDate,
    setEndDate,
    setSelectedTeamId,
    setLocation,
    setSourceLocations,
    handleRosterFileChange,
    handleSaveSession,
    addInstructor,
    updateInstructor,
    setSessionStartTime24: (value: string) => {
      didManuallyEditSessionTimesRef.current = true
      didAutofillSessionTimesRef.current = false
      setSessionStartTime24(value)
      setNewSessionTimeMessage('')
    },
    setSessionEndTime24: (value: string) => {
      didManuallyEditSessionTimesRef.current = true
      didAutofillSessionTimesRef.current = false
      setSessionEndTime24(value)
      setNewSessionTimeMessage('')
    },
  }
}

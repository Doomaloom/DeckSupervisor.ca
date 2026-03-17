import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDay } from '../../app/DayContext'
import { useAuth } from '../../app/AuthContext'
import { createTermKey, formatTermLabel, useCurrentTerm } from '../../app/useCurrentTerm'
import { useCurrentTeam } from '../../app/useCurrentTeam'
import { getTorontoDate } from '../../lib/torontoDate'
import { createSession, fetchMySessions, fetchSharedSessionsToday, fetchTeamSessions } from '../../lib/serverApi'
import {
  clearCurrentSessionId,
  getCurrentSessionId,
  loadSessions,
  saveSessions,
  setCurrentSessionId,
} from '../../lib/sessionStorage'
import { onStorageScopeChanged } from '../../lib/storageScope'

type InstructorEntry = { name: string }
type SessionEntry = {
  id: string
  sessionDay: string
  sessionSeason: string
  startDate: string
  endDate: string
  instructors: InstructorEntry[]
  rosterFileName?: string
}

type DbSessionEntry = {
  id: string
  team_id: string | null
  created_by: string
  session_day: string
  session_season: string | null
  session_year: number | null
  start_date: string | null
  end_date: string | null
  location: string | null
  instructors: InstructorEntry[]
}

type TeamTermSessionRow = {
  id: string
  session_season: string | null
  session_year: number | null
  start_date: string | null
}

type SessionTermOption = {
  key: string
  season: string
  year: number
  label: string
  sessionCount: number
}

type SharedSessionEntry = {
  id: string
  share_date: string
  allow_roster_edits: boolean
  sessions?: DbSessionEntry | null
}


const dayNames: Record<string, string> = {
  Mo: 'Monday',
  Tu: 'Tuesday',
  We: 'Wednesday',
  Th: 'Thursday',
  Fr: 'Friday',
  Sa: 'Saturday',
  Su: 'Sunday',
}

const NO_TEAM_VALUE = '__no_team__'

const seasonRank: Record<string, number> = {
  winter: 0,
  spring: 1,
  summer: 2,
  fall: 3,
}

function getYearFromDate(value: string | null) {
  if (!value) {
    return null
  }
  const parsed = new Date(value).getFullYear()
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function resolveSessionYear(yearInput: string, startDate: string, endDate: string) {
  const trimmed = yearInput.trim()
  if (trimmed) {
    const parsed = Number.parseInt(trimmed, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }
  return getYearFromDate(startDate) ?? getYearFromDate(endDate)
}

function getSessionName(session: SessionEntry) {
  const dayLabel = session.sessionDay ? dayNames[session.sessionDay] ?? session.sessionDay : ''
  const season = session.sessionSeason?.trim()
  const year = session.startDate ? new Date(session.startDate).getFullYear() : NaN
  const yearLabel = Number.isFinite(year) && year > 0 ? String(year) : ''
  const parts = [dayLabel, season, yearLabel].filter(Boolean)
  return parts.length ? parts.join(' ') : 'Session'
}

function getDbSessionName(session: DbSessionEntry) {
  const dayLabel = session.session_day ? dayNames[session.session_day] ?? session.session_day : ''
  const season = session.session_season?.trim()
  const year = session.session_year ?? getYearFromDate(session.start_date)
  const yearLabel = year ? String(year) : ''
  const parts = [dayLabel, season, yearLabel].filter(Boolean)
  return parts.length ? parts.join(' ') : 'Session'
}

function Dashboard() {
  const navigate = useNavigate()
  const { setSelectedDay } = useDay()
  const { accountType, isGuest, user } = useAuth()
  const { teams, currentTeamId, setCurrentTeamId, loading: teamsLoading } = useCurrentTeam()
  const { currentTerm, currentTermKey, setCurrentTermKey, clearCurrentTerm } = useCurrentTerm()
  const [activePanel, setActivePanel] = useState<'options' | 'new-session' | 'select-session'>(
    'options',
  )
  const [sessionDay, setSessionDay] = useState('')
  const [sessionSeason, setSessionSeason] = useState('')
  const [sessionYear, setSessionYear] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [instructors, setInstructors] = useState<InstructorEntry[]>([{ name: '' }])
  const [saveMessage, setSaveMessage] = useState('')
  const [rosterFile, setRosterFile] = useState<File | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [availableLocations, setAvailableLocations] = useState<string[]>([])
  const [location, setLocation] = useState('')
  const [dbSessions, setDbSessions] = useState<DbSessionEntry[]>([])
  const [teamTermSessions, setTeamTermSessions] = useState<TeamTermSessionRow[]>([])
  const [teamTermSessionsLoading, setTeamTermSessionsLoading] = useState(false)
  const [sharedSessions, setSharedSessions] = useState<SharedSessionEntry[]>([])
  const [currentSessionId, setCurrentSessionIdState] = useState(() => getCurrentSessionId())
  const [selectMessage, setSelectMessage] = useState('')
  const [sessionsVersion, setSessionsVersion] = useState(0)

  const seasonOptions = ['Winter', 'Spring', 'Summer', 'Fall']

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


  const handleSaveSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isGuest && !user) {
      return
    }
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`

    if (isGuest) {
      const nextSession: SessionEntry = {
        id,
        sessionDay,
        sessionSeason,
        startDate,
        endDate,
        instructors: instructors.filter(instructor => instructor.name.trim().length > 0),
        rosterFileName: rosterFile?.name,
      }

      const sessions = loadSessions()
      sessions.push(nextSession)
      saveSessions(sessions)
      setCurrentSessionId(id)
      setCurrentSessionIdState(id)
      setSaveMessage('Session saved.')
      setSessionsVersion(version => version + 1)
      if (sessionDay) {
        setSelectedDay(sessionDay)
      }
      navigate('/manage-sessions')
      return
    }

    if (!selectedTeamId) {
      setSaveMessage('Select a team or choose No team before saving.')
      return
    }

    const hasTeam = selectedTeamId !== NO_TEAM_VALUE
    const sessionYearValue = resolveSessionYear(sessionYear, startDate, endDate)

    if (hasTeam && !location) {
      setSaveMessage('Select a location before saving.')
      return
    }

    const payload = {
      id,
      team_id: hasTeam ? selectedTeamId : null,
      created_by: user!.id,
      session_day: sessionDay,
      session_season: sessionSeason || null,
      session_year: sessionYearValue,
      start_date: startDate || null,
      end_date: endDate || null,
      location: location || null,
      instructors: instructors.filter(instructor => instructor.name.trim().length > 0),
    }

    try {
      await createSession(payload)
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Failed to save session')
      return
    }
    setCurrentSessionId(id)
    setCurrentSessionIdState(id)
    setSaveMessage('Session saved.')
    setSessionsVersion(version => version + 1)
    if (sessionDay) {
      setSelectedDay(sessionDay)
    }
    navigate('/manage-sessions')
  }

  const handleSelectLocalSession = (session: SessionEntry) => {
    setCurrentSessionId(session.id)
    setCurrentSessionIdState(session.id)
    setSelectMessage('Current session set.')
    if (session.sessionDay) {
      setSelectedDay(session.sessionDay)
    } else {
      setSelectedDay('')
    }
    navigate('/manage-sessions')
  }

  const handleSelectDbSession = (session: DbSessionEntry) => {
    setCurrentSessionId(session.id)
    setCurrentSessionIdState(session.id)
    setSelectMessage('Current session set.')
    if (session.session_day) {
      setSelectedDay(session.session_day)
    } else {
      setSelectedDay('')
    }
    navigate('/manage-sessions')
  }

  const handleOpenSharedSession = (entry: SharedSessionEntry) => {
    if (!entry.sessions) {
      return
    }
    handleSelectDbSession(entry.sessions)
  }

  const resetCurrentSessionScope = () => {
    clearCurrentSessionId()
    setCurrentSessionIdState('')
    setSelectedDay('')
  }

  const handleSelectFullTimeTeam = (teamId: string) => {
    setCurrentTeamId(teamId)
    clearCurrentTerm()
    resetCurrentSessionScope()
  }

  const sessions = useMemo(() => {
    if (isGuest) {
      const items = loadSessions()
      return items.sort((a, b) => {
        const aTime = a.startDate ? new Date(a.startDate).getTime() : 0
        const bTime = b.startDate ? new Date(b.startDate).getTime() : 0
        return bTime - aTime
      })
    }
    return dbSessions
      .slice()
      .sort((a, b) => {
        const aTime = a.start_date ? new Date(a.start_date).getTime() : 0
        const bTime = b.start_date ? new Date(b.start_date).getTime() : 0
        return bTime - aTime
      })
  }, [dbSessions, isGuest, sessionsVersion, activePanel])

  const fullTimeSessionTerms = useMemo(() => {
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
  }, [teamTermSessions])

  const fullTimeTermYears = useMemo(() => {
    const years = new Set<number>()
    fullTimeSessionTerms.forEach(term => years.add(term.year))
    return Array.from(years).sort((a, b) => b - a)
  }, [fullTimeSessionTerms])

  const selectedFullTimeTermYear = currentTerm?.year ?? null

  const fullTimeTermsForSelectedYear = useMemo(() => {
    if (!selectedFullTimeTermYear) {
      return []
    }
    return fullTimeSessionTerms.filter(term => term.year === selectedFullTimeTermYear)
  }, [fullTimeSessionTerms, selectedFullTimeTermYear])

  const handleSelectFullTimeYear = (yearInput: string) => {
    if (!yearInput) {
      clearCurrentTerm()
      resetCurrentSessionScope()
      return
    }
    const parsedYear = Number.parseInt(yearInput, 10)
    if (!Number.isFinite(parsedYear) || parsedYear <= 0) {
      return
    }
    const nextTerm = fullTimeSessionTerms.find(term => term.year === parsedYear)
    if (!nextTerm) {
      clearCurrentTerm()
      resetCurrentSessionScope()
      return
    }
    setCurrentTermKey(nextTerm.key)
    resetCurrentSessionScope()
  }

  const handleSelectFullTimeSeason = (season: string) => {
    if (!season) {
      clearCurrentTerm()
      resetCurrentSessionScope()
      return
    }
    const year = selectedFullTimeTermYear
    if (!year) {
      return
    }
    const nextKey = createTermKey(season, year)
    if (!nextKey || !fullTimeSessionTerms.some(term => term.key === nextKey)) {
      return
    }
    setCurrentTermKey(nextKey)
    resetCurrentSessionScope()
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
    if (!currentSessionId) {
      setSelectedDay('')
    }
  }, [currentSessionId, setSelectedDay])

  useEffect(() => {
    if (accountType === 'full_time' && activePanel !== 'options') {
      setActivePanel('options')
    }
  }, [accountType, activePanel])

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

  useEffect(() => {
    if (accountType !== 'full_time' || !currentTeamId) {
      setTeamTermSessions([])
      setTeamTermSessionsLoading(false)
      return
    }
    let active = true
    const loadTeamSessions = async () => {
      setTeamTermSessionsLoading(true)
      try {
        const response = await fetchTeamSessions(currentTeamId, 'id,session_season,session_year,start_date')
        if (!active) {
          return
        }
        setTeamTermSessions((response.sessions ?? []) as TeamTermSessionRow[])
      } catch (error) {
        console.error('Failed to load team terms', error)
        setTeamTermSessions([])
      }
      setTeamTermSessionsLoading(false)
    }
    void loadTeamSessions()
    return () => {
      active = false
    }
  }, [accountType, currentTeamId])

  useEffect(() => {
    if (accountType !== 'full_time') {
      return
    }
    if (!currentTeamId || fullTimeSessionTerms.length === 0) {
      clearCurrentTerm()
      return
    }
    const hasCurrentTerm = fullTimeSessionTerms.some(term => term.key === currentTermKey)
    if (!hasCurrentTerm) {
      setCurrentTermKey(fullTimeSessionTerms[0].key)
    }
  }, [
    accountType,
    clearCurrentTerm,
    currentTeamId,
    currentTermKey,
    fullTimeSessionTerms,
    setCurrentTermKey,
  ])

  useEffect(() => {
    if (isGuest || !user) {
      return
    }
    const loadSessionsFromDb = async () => {
      const data = await fetchMySessions()
      setDbSessions((data.sessions ?? []) as DbSessionEntry[])
    }
    void loadSessionsFromDb()
  }, [isGuest, user, sessionsVersion])

  useEffect(() => {
    if (isGuest || !user) {
      return
    }
    const loadShared = async () => {
      const today = getTorontoDate()
      const data = await fetchSharedSessionsToday()
      setSharedSessions((data.sharedSessions ?? []).filter((item: SharedSessionEntry) => item.share_date === today))
    }
    void loadShared()
  }, [isGuest, user])

  useEffect(() => {
    if (!selectedTeamId || selectedTeamId === NO_TEAM_VALUE) {
      setAvailableLocations([])
      setLocation('')
      return
    }
    const selected = teams.find(team => team.id === selectedTeamId)
    const options = selected?.available_locations ?? []
    setAvailableLocations(options)
    if (options.length === 0) {
      setLocation('')
      return
    }
    if (!location || !options.includes(location)) {
      setLocation(options[0])
    }
  }, [location, selectedTeamId, teams])

  useEffect(() => {
    return onStorageScopeChanged(() => {
      setCurrentSessionIdState(getCurrentSessionId())
      setSessionsVersion(version => version + 1)
    })
  }, [])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {accountType !== 'full_time' && activePanel !== 'options' && (
        <button
          type="button"
          className="flex w-fit items-center gap-2 rounded-full bg-secondary px-4 py-2 text-accent transition hover:-translate-y-0.5 hover:bg-primary"
          onClick={() => setActivePanel('options')}
        >
          ← Back
        </button>
      )}
      <div className="flex min-h-[75vh] w-full flex-col items-center justify-center gap-6">
        {activePanel === 'options' ? (
          <>
            {accountType === 'full_time' ? (
              <div className="w-full max-w-3xl rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary/70">
                  Full-Time Scope
                </p>
                <h2 className="mt-2 text-xl font-semibold">Select Team + Session Term</h2>
                <p className="mt-2 text-sm text-secondary/80">
                  Choose the team and session term for your full-time view. Terms are season and year
                  only.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
                    Select Team
                    <select
                      className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                      value={currentTeamId}
                      onChange={event => handleSelectFullTimeTeam(event.target.value)}
                      disabled={teamsLoading}
                    >
                      <option value="">Select a team</option>
                      {teams.map(team => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
                    Select Year
                    <select
                      className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                      value={selectedFullTimeTermYear ? String(selectedFullTimeTermYear) : ''}
                      onChange={event => handleSelectFullTimeYear(event.target.value)}
                      disabled={!currentTeamId || teamTermSessionsLoading || fullTimeTermYears.length === 0}
                    >
                      <option value="">Select a year</option>
                      {fullTimeTermYears.map(year => (
                        <option key={year} value={String(year)}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
                    Select Season
                    <select
                      className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                      value={currentTerm?.season ?? ''}
                      onChange={event => handleSelectFullTimeSeason(event.target.value)}
                      disabled={!currentTeamId || teamTermSessionsLoading || fullTimeTermsForSelectedYear.length === 0}
                    >
                      <option value="">Select a season</option>
                      {seasonOptions.map(season => {
                        const normalizedSeason = season.toLowerCase()
                        const hasSeason = fullTimeTermsForSelectedYear.some(
                          term => term.season === normalizedSeason,
                        )
                        return (
                          <option key={season} value={normalizedSeason} disabled={!hasSeason}>
                            {season}
                          </option>
                        )
                      })}
                    </select>
                  </label>
                </div>
                {!currentTeamId ? (
                  <p className="mt-3 text-sm text-secondary/70">Select a team to load session terms.</p>
                ) : teamTermSessionsLoading ? (
                  <p className="mt-3 text-sm text-secondary/70">Loading session terms...</p>
                ) : fullTimeSessionTerms.length === 0 ? (
                  <p className="mt-3 text-sm text-secondary/70">
                    No session terms found for this team yet.
                  </p>
                ) : currentTerm ? (
                  <p className="mt-3 text-sm font-semibold text-secondary">
                    Current term: {currentTerm.label}
                  </p>
                ) : null}
              </div>
            ) : null}
            {accountType !== 'full_time' ? (
              <>
                <button
                  type="button"
                  className="w-80 rounded-card border-2 border-secondary/20 bg-accent px-8 py-10 text-center text-xl font-semibold text-secondary shadow-md transition hover:-translate-y-0.5 hover:border-secondary"
                  onClick={() => setActivePanel('new-session')}
                >
                  Start New Session
                </button>
                <button
                  type="button"
                  className="w-80 rounded-card border-2 border-secondary/20 bg-accent px-8 py-10 text-center text-xl font-semibold text-secondary shadow-md transition hover:-translate-y-0.5 hover:border-secondary"
                  onClick={() => setActivePanel('select-session')}
                >
                  Select Existing Session
                </button>
              </>
            ) : null}
          </>
        ) : activePanel === 'new-session' ? (
          <div className="w-full max-w-5xl">
            <h2 className="text-2xl font-semibold text-secondary">Start New Session</h2>
            <form className="mt-6 flex flex-col gap-6" onSubmit={handleSaveSession}>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-4 rounded-card border-2 border-secondary/20 bg-accent p-6 shadow-md">
                  <h3 className="text-base font-semibold text-secondary">Session Dates</h3>
                  <label className="flex flex-col gap-2 font-semibold text-secondary">
                    Session Day
                    <select
                      className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                      value={sessionDay}
                      onChange={event => setSessionDay(event.target.value)}
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
                      value={sessionSeason}
                      onChange={event => setSessionSeason(event.target.value)}
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
                      value={sessionYear}
                      onChange={event => setSessionYear(event.target.value)}
                      placeholder="e.g. 2026"
                    />
                  </label>
                  <label className="flex flex-col gap-2 font-semibold text-secondary">
                    Start Date
                    <input
                      className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                      type="date"
                      value={startDate}
                      onChange={event => setStartDate(event.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-2 font-semibold text-secondary">
                    End Date
                    <input
                      className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                      type="date"
                      value={endDate}
                      onChange={event => setEndDate(event.target.value)}
                    />
                  </label>
                  {!isGuest ? (
                    <>
                      <label className="flex flex-col gap-2 font-semibold text-secondary">
                        Team
                        <select
                          className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                          value={selectedTeamId}
                          onChange={event => setSelectedTeamId(event.target.value)}
                        >
                          <option value="">Select a team</option>
                          <option value={NO_TEAM_VALUE}>No team</option>
                          {teams.map(team => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-2 font-semibold text-secondary">
                        Location
                        <select
                          className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                          value={location}
                          onChange={event => setLocation(event.target.value)}
                          disabled={!selectedTeamId || selectedTeamId === NO_TEAM_VALUE}
                        >
                          <option value="">Select a location</option>
                          {availableLocations.map(option => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : null}
                  <div className="flex flex-col gap-2">
                    <span className="font-semibold text-secondary">Upload Roster (optional)</span>
                    <label className="relative flex h-12 items-center justify-center rounded-[10px] border-2 border-dashed border-secondary bg-bg px-2 text-center text-sm font-medium text-secondary transition hover:-translate-y-0.5 hover:border-secondary">
                      <span>{rosterFile ? rosterFile.name : 'Click or drop a .csv file'}</span>
                      <input
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        type="file"
                        accept=".csv"
                        onChange={event => setRosterFile(event.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>
                </div>
                <div className="flex flex-col gap-4 rounded-card border-2 border-secondary/20 bg-accent p-6 shadow-md">
                  <h3 className="text-base font-semibold text-secondary">Instructors on Shift</h3>
                  {instructors.map((instructor, index) => (
                    <input
                      key={`instructor-${index}`}
                      className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                      type="text"
                      placeholder="Instructor name"
                      value={instructor.name}
                      onChange={event => updateInstructor(index, event.target.value)}
                    />
                  ))}
                  <button
                    type="button"
                    className="mt-1 rounded-2xl bg-secondary px-4 py-2 text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
                    onClick={addInstructor}
                  >
                    Add Instructor
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-center gap-4">
                <button
                  type="submit"
                  className="rounded-2xl bg-primary px-6 py-3 text-white transition hover:-translate-y-0.5 hover:bg-secondary"
                >
                  Save Session
                </button>
                {saveMessage ? (
                  <span className="font-semibold text-secondary">{saveMessage}</span>
                ) : null}
              </div>
            </form>
          </div>
        ) : (
          <div className="w-full max-w-5xl">
            <h2 className="text-2xl font-semibold text-secondary">Select Existing Session</h2>
            {!isGuest && sharedSessions.length > 0 ? (
              <div className="mt-4">
                <h3 className="text-lg font-semibold text-secondary">Covering Today</h3>
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {sharedSessions.map(entry => {
                    const session = entry.sessions
                    if (!session) {
                      return null
                    }
                    const sessionName = getDbSessionName(session)
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        className="flex flex-col gap-2 rounded-card border-2 border-secondary/20 bg-accent p-5 text-left text-secondary shadow-md transition hover:-translate-y-0.5"
                        onClick={() => handleOpenSharedSession(entry)}
                      >
                        <h3 className="text-lg font-semibold">{sessionName}</h3>
                        <p>
                          {session.start_date || 'Start date'} - {session.end_date || 'End date'}
                        </p>
                        <p>{session.instructors?.length ?? 0} instructors</p>
                        <p className="text-sm text-secondary/70">
                          Shared for {entry.share_date}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {sessions.length === 0 ? (
              <p className="mt-4 font-semibold text-secondary">No existing sessions.</p>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                {sessions.map(session => {
                  const isCurrent = currentSessionId === session.id
                  if (isGuest) {
                    const localSession = session as SessionEntry
                    const sessionName = getSessionName(localSession)
                    return (
                      <button
                        key={localSession.id}
                        type="button"
                        className={`flex flex-col gap-2 rounded-card border-2 bg-accent p-5 text-left text-secondary shadow-md transition hover:-translate-y-0.5 ${
                          isCurrent ? 'border-secondary' : 'border-secondary/20'
                        }`}
                        onClick={() => handleSelectLocalSession(localSession)}
                      >
                        <h3 className="text-lg font-semibold">{sessionName}</h3>
                        <p>
                          {localSession.startDate || 'Start date'} - {localSession.endDate || 'End date'}
                        </p>
                        <p>{localSession.instructors.length} instructors</p>
                        {localSession.rosterFileName ? (
                          <p>Roster: {localSession.rosterFileName}</p>
                        ) : null}
                        {isCurrent ? (
                          <p className="font-semibold text-secondary">Current session</p>
                        ) : null}
                      </button>
                    )
                  }

                  const dbSession = session as DbSessionEntry
                  const sessionName = getDbSessionName(dbSession)
                  return (
                    <button
                      key={dbSession.id}
                      type="button"
                      className={`flex flex-col gap-2 rounded-card border-2 bg-accent p-5 text-left text-secondary shadow-md transition hover:-translate-y-0.5 ${
                        isCurrent ? 'border-secondary' : 'border-secondary/20'
                      }`}
                      onClick={() => handleSelectDbSession(dbSession)}
                    >
                      <h3 className="text-lg font-semibold">{sessionName}</h3>
                      <p>
                        {dbSession.start_date || 'Start date'} - {dbSession.end_date || 'End date'}
                      </p>
                      <p>{dbSession.instructors?.length ?? 0} instructors</p>
                      <p className="text-sm text-secondary/70">
                        {dbSession.location || 'No location set'}
                      </p>
                      {isCurrent ? <p className="font-semibold text-secondary">Current session</p> : null}
                    </button>
                  )
                })}
              </div>
            )}
            {selectMessage ? (
              <p className="mt-4 font-semibold text-secondary">{selectMessage}</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard

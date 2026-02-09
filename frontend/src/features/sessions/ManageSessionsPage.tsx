import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDay } from '../../app/DayContext'
import { useAuth } from '../../app/AuthContext'
import { useCurrentSession } from '../../app/useCurrentSession'
import { supabase } from '../../lib/supabaseClient'
import { clearCurrentSessionId, getCurrentSessionId, loadSessions, saveSessions } from '../../lib/sessionStorage'
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

type TeamEntry = {
  id: string
  name: string
  available_locations: string[]
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

function getSessionName(session: SessionEntry) {
  const dayLabel = session.sessionDay ? dayNames[session.sessionDay] ?? session.sessionDay : ''
  const season = session.sessionSeason?.trim()
  const year = session.startDate ? new Date(session.startDate).getFullYear() : NaN
  const yearLabel = Number.isFinite(year) && year > 0 ? String(year) : ''
  const parts = [dayLabel, season, yearLabel].filter(Boolean)
  return parts.length ? parts.join(' ') : 'Session'
}

function getDbSessionName(sessionDay: string, sessionSeason: string | null, startDate: string | null) {
  const dayLabel = sessionDay ? dayNames[sessionDay] ?? sessionDay : ''
  const season = sessionSeason?.trim()
  const year = startDate ? new Date(startDate).getFullYear() : NaN
  const yearLabel = Number.isFinite(year) && year > 0 ? String(year) : ''
  const parts = [dayLabel, season, yearLabel].filter(Boolean)
  return parts.length ? parts.join(' ') : 'Session'
}

function ManageSessionsPage() {
  const navigate = useNavigate()
  const { setSelectedDay } = useDay()
  const { isGuest, user } = useAuth()
  const { session: currentSessionRecord, access } = useCurrentSession()
  const [editSessionDay, setEditSessionDay] = useState('')
  const [editSessionSeason, setEditSessionSeason] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [availableLocations, setAvailableLocations] = useState<string[]>([])
  const [teamName, setTeamName] = useState('')
  const [editInstructors, setEditInstructors] = useState<InstructorEntry[]>([{ name: '' }])
  const [editRosterFile, setEditRosterFile] = useState<File | null>(null)
  const [editRosterFileName, setEditRosterFileName] = useState<string | undefined>(undefined)
  const [editMessage, setEditMessage] = useState('')
  const [sessionsVersion, setSessionsVersion] = useState(0)
  const [currentSessionId, setCurrentSessionIdState] = useState(() => getCurrentSessionId())

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
    if (isGuest) {
      const localSession = currentSession as SessionEntry
      setEditSessionDay(localSession.sessionDay)
      setEditSessionSeason(localSession.sessionSeason ?? '')
      setEditStartDate(localSession.startDate)
      setEditEndDate(localSession.endDate)
      setEditInstructors(localSession.instructors.length ? localSession.instructors : [{ name: '' }])
      setEditRosterFile(null)
      setEditRosterFileName(localSession.rosterFileName)
      setEditMessage('')
      return
    }
    const dbSession = currentSessionRecord
    setEditSessionDay(dbSession?.session_day ?? '')
    setEditSessionSeason(dbSession?.session_season ?? '')
    setEditStartDate(dbSession?.start_date ?? '')
    setEditEndDate(dbSession?.end_date ?? '')
    setEditLocation(dbSession?.location ?? '')
    setEditInstructors(dbSession?.instructors?.length ? dbSession.instructors : [{ name: '' }])
    setEditRosterFile(null)
    setEditRosterFileName(undefined)
    setEditMessage('')
  }, [currentSession])

  useEffect(() => {
    if (isGuest || !currentSessionRecord?.team_id) {
      setAvailableLocations([])
      setTeamName('')
      return
    }
    const loadTeam = async () => {
      const { data } = await supabase
        .from('teams')
        .select('id,name,available_locations')
        .eq('id', currentSessionRecord.team_id)
        .maybeSingle()
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
  }, [currentSessionRecord, isGuest])

  useEffect(() => {
    if (!currentSessionId) {
      setSelectedDay('')
    }
  }, [currentSessionId, setSelectedDay])

  useEffect(() => {
    return onStorageScopeChanged(() => {
      setCurrentSessionIdState(getCurrentSessionId())
      setSessionsVersion(version => version + 1)
    })
  }, [])

  const handleUpdateSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!currentSessionId) {
      return
    }
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
          startDate: editStartDate,
          endDate: editEndDate,
          instructors: editInstructors.filter(instructor => instructor.name.trim().length > 0),
          rosterFileName: editRosterFile ? editRosterFile.name : editRosterFileName,
        }
      })
      saveSessions(updatedSessions)
      setEditMessage('Session updated.')
      setSessionsVersion(version => version + 1)
      return
    }

    if (!user) {
      return
    }
    const { error } = await supabase
      .from('sessions')
      .update({
        session_day: editSessionDay,
        session_season: editSessionSeason || null,
        start_date: editStartDate || null,
        end_date: editEndDate || null,
        location: editLocation || currentSessionRecord?.location,
        instructors: editInstructors.filter(instructor => instructor.name.trim().length > 0),
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentSessionId)
      .eq('created_by', user.id)

    if (error) {
      setEditMessage(error.message)
      return
    }
    setEditMessage('Session updated.')
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
    const { error } = await supabase.from('sessions').delete().eq('id', currentSessionId)
    if (error) {
      setEditMessage(error.message)
      return
    }
    clearCurrentSessionId()
    setEditMessage('Session deleted.')
    setSelectedDay('')
    navigate('/')
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
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
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold">
                  {getDbSessionName(
                    currentSessionRecord?.session_day ?? '',
                    currentSessionRecord?.session_season ?? null,
                    currentSessionRecord?.start_date ?? null,
                  )}
                </h3>
                <p>
                  {currentSessionRecord?.start_date || 'Start date'} -
                  {currentSessionRecord?.end_date || 'End date'}
                </p>
                <p>{currentSessionRecord?.instructors?.length ?? 0} instructors</p>
                {teamName ? <p>Team: {teamName}</p> : null}
                {currentSessionRecord?.location ? <p>Location: {currentSessionRecord.location}</p> : null}
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
                {!isGuest ? (
                  <label className="flex flex-col gap-2 font-semibold text-secondary">
                    Location
                    <select
                      className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-primary"
                      value={editLocation}
                      onChange={event => setEditLocation(event.target.value)}
                    >
                      <option value="">Select a location</option>
                      {availableLocations.map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
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
                <button
                  type="submit"
                  className="rounded-2xl bg-primary px-5 py-2 text-white transition hover:-translate-y-0.5 hover:bg-secondary"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  className="rounded-2xl bg-danger px-5 py-2 text-accent transition hover:-translate-y-0.5 hover:bg-dangerHover"
                  onClick={handleDeleteSession}
                >
                  Delete Session
                </button>
                {editMessage ? <span className="font-semibold text-secondary">{editMessage}</span> : null}
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

export default ManageSessionsPage

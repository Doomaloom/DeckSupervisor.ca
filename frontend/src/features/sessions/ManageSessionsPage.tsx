import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDay } from '../../app/DayContext'

type InstructorEntry = { name: string }
type SessionEntry = {
  id: string
  sessionDay: string
  startDate: string
  endDate: string
  instructors: InstructorEntry[]
  rosterFileName?: string
}

const STORAGE_KEY = 'decksupervisor.sessions'
const CURRENT_SESSION_KEY = 'decksupervisor.currentSessionId'

function loadSessions(): SessionEntry[] {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) {
    return []
  }
  try {
    return JSON.parse(stored) as SessionEntry[]
  } catch (error) {
    console.error('Failed to parse stored sessions', error)
    return []
  }
}

function ManageSessionsPage() {
  const navigate = useNavigate()
  const { setSelectedDay } = useDay()
  const [editSessionDay, setEditSessionDay] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editInstructors, setEditInstructors] = useState<InstructorEntry[]>([{ name: '' }])
  const [editRosterFile, setEditRosterFile] = useState<File | null>(null)
  const [editRosterFileName, setEditRosterFileName] = useState<string | undefined>(undefined)
  const [editMessage, setEditMessage] = useState('')
  const [sessionsVersion, setSessionsVersion] = useState(0)
  const [currentSessionId] = useState(() => {
    if (typeof window === 'undefined') {
      return ''
    }
    return localStorage.getItem(CURRENT_SESSION_KEY) ?? ''
  })

  const sessions = useMemo(() => {
    const items = loadSessions()
    return items.sort((a, b) => {
      const aTime = a.startDate ? new Date(a.startDate).getTime() : 0
      const bTime = b.startDate ? new Date(b.startDate).getTime() : 0
      return bTime - aTime
    })
  }, [sessionsVersion])

  const currentSession = useMemo(
    () => sessions.find(session => session.id === currentSessionId) ?? null,
    [sessions, currentSessionId],
  )

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
    setEditSessionDay(currentSession.sessionDay)
    setEditStartDate(currentSession.startDate)
    setEditEndDate(currentSession.endDate)
    setEditInstructors(currentSession.instructors.length ? currentSession.instructors : [{ name: '' }])
    setEditRosterFile(null)
    setEditRosterFileName(currentSession.rosterFileName)
    setEditMessage('')
  }, [currentSession])

  useEffect(() => {
    if (!currentSessionId) {
      setSelectedDay('')
    }
  }, [currentSessionId, setSelectedDay])

  const handleUpdateSession = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!currentSessionId) {
      return
    }
    const sessionsToUpdate = loadSessions()
    const updatedSessions = sessionsToUpdate.map(session => {
      if (session.id !== currentSessionId) {
        return session
      }
      return {
        ...session,
        sessionDay: editSessionDay,
        startDate: editStartDate,
        endDate: editEndDate,
        instructors: editInstructors.filter(instructor => instructor.name.trim().length > 0),
        rosterFileName: editRosterFile ? editRosterFile.name : editRosterFileName,
      }
    })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions))
    setEditMessage('Session updated.')
    setSessionsVersion(version => version + 1)
  }

  const handleDeleteSession = () => {
    if (!currentSessionId) {
      return
    }
    if (!confirm('Delete this session? This action cannot be undone.')) {
      return
    }
    const sessionsToUpdate = loadSessions()
    const updatedSessions = sessionsToUpdate.filter(session => session.id !== currentSessionId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions))
    localStorage.removeItem(CURRENT_SESSION_KEY)
    setSessionsVersion(version => version + 1)
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
            <h3 className="text-lg font-semibold">{currentSession.sessionDay || 'Session Day'}</h3>
            <p>
              {currentSession.startDate || 'Start date'} - {currentSession.endDate || 'End date'}
            </p>
            <p>{currentSession.instructors.length} instructors</p>
            {currentSession.rosterFileName ? <p>Roster: {currentSession.rosterFileName}</p> : null}
          </div>
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
                <div key={`edit-${currentSession.id}-${index}`} className="flex gap-3">
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
        </div>
      )}
    </div>
  )
}

export default ManageSessionsPage

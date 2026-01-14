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

function Dashboard() {
  const navigate = useNavigate()
  const { setSelectedDay } = useDay()
  const [activePanel, setActivePanel] = useState<'options' | 'new-session' | 'select-session'>(
    'options',
  )
  const [sessionDay, setSessionDay] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [instructors, setInstructors] = useState<InstructorEntry[]>([{ name: '' }])
  const [saveMessage, setSaveMessage] = useState('')
  const [rosterFile, setRosterFile] = useState<File | null>(null)
  const [currentSessionId, setCurrentSessionId] = useState(() => {
    if (typeof window === 'undefined') {
      return ''
    }
    return localStorage.getItem(CURRENT_SESSION_KEY) ?? ''
  })
  const [selectMessage, setSelectMessage] = useState('')
  const [sessionsVersion, setSessionsVersion] = useState(0)

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


  const handleSaveSession = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`

    const nextSession: SessionEntry = {
      id,
      sessionDay,
      startDate,
      endDate,
      instructors: instructors.filter(instructor => instructor.name.trim().length > 0),
      rosterFileName: rosterFile?.name,
    }

    const sessions = loadSessions()
    sessions.push(nextSession)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
    localStorage.setItem(CURRENT_SESSION_KEY, id)
    setCurrentSessionId(id)
    setSaveMessage('Session saved.')
    setSessionsVersion(version => version + 1)
    if (sessionDay) {
      setSelectedDay(sessionDay)
    }
    navigate('/manage-sessions')
  }

  const handleSelectSession = (session: SessionEntry) => {
    localStorage.setItem(CURRENT_SESSION_KEY, session.id)
    setCurrentSessionId(session.id)
    setSelectMessage('Current session set.')
    if (session.sessionDay) {
      setSelectedDay(session.sessionDay)
    } else {
      setSelectedDay('')
    }
    navigate('/manage-sessions')
  }


  const sessions = useMemo(() => {
    const items = loadSessions()
    return items.sort((a, b) => {
      const aTime = a.startDate ? new Date(a.startDate).getTime() : 0
      const bTime = b.startDate ? new Date(b.startDate).getTime() : 0
      return bTime - aTime
    })
  }, [sessionsVersion, activePanel])

  useEffect(() => {
    if (!currentSessionId) {
      setSelectedDay('')
    }
  }, [currentSessionId, setSelectedDay])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {activePanel !== 'options' && (
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
            {sessions.length === 0 ? (
              <p className="mt-4 font-semibold text-secondary">No existing sessions.</p>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                {sessions.map(session => {
                  const isCurrent = currentSessionId === session.id
                  return (
                    <button
                      key={session.id}
                      type="button"
                      className={`flex flex-col gap-2 rounded-card border-2 bg-accent p-5 text-left text-secondary shadow-md transition hover:-translate-y-0.5 ${
                        isCurrent ? 'border-secondary' : 'border-secondary/20'
                      }`}
                      onClick={() => handleSelectSession(session)}
                    >
                      <h3 className="text-lg font-semibold">{session.sessionDay || 'Session Day'}</h3>
                      <p>
                        {session.startDate || 'Start date'} - {session.endDate || 'End date'}
                      </p>
                      <p>{session.instructors.length} instructors</p>
                      {session.rosterFileName ? <p>Roster: {session.rosterFileName}</p> : null}
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

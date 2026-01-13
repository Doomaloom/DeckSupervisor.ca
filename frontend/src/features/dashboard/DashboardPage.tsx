import { useMemo, useState } from 'react'

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
  const [activePanel, setActivePanel] = useState<'options' | 'new-session' | 'select-session'>('options')
  const [sessionDay, setSessionDay] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [instructors, setInstructors] = useState<InstructorEntry[]>([{ name: '' }])
  const [saveMessage, setSaveMessage] = useState('')
  const [rosterFile, setRosterFile] = useState<File | null>(null)
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
    setSaveMessage('Session saved.')
    setSessionsVersion(version => version + 1)
  }

  const sessions = useMemo(() => {
    const items = loadSessions()
    return items.sort((a, b) => {
      const aTime = a.startDate ? new Date(a.startDate).getTime() : 0
      const bTime = b.startDate ? new Date(b.startDate).getTime() : 0
      return bTime - aTime
    })
  }, [sessionsVersion, activePanel])

  return (
    <div className="dashboard">
      {activePanel !== 'options' && (
        <button
          type="button"
          className="dashboard-back"
          onClick={() => setActivePanel('options')}
        >
          ← Back
        </button>
      )}
      <div className="container">
        {activePanel === 'options' ? (
          <>
            <button
              type="button"
              className="DashboardSelector"
              onClick={() => setActivePanel('new-session')}
            >
              <h2>Start New Session</h2>
            </button>
            <button
              type="button"
              className="DashboardSelector"
              onClick={() => setActivePanel('select-session')}
            >
              <h2>Select Existing Session</h2>
            </button>
          </>
        ) : activePanel === 'new-session' ? (
          <div className="dashboard-form">
            <h2 className="dashboard-form__title">Start New Session</h2>
            <form className="session-form" onSubmit={handleSaveSession}>
              <div className="session-form__row">
                <div className="session-form__panel">
                  <h3>Session Dates</h3>
                  <label>
                    Session Day
                    <select
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
                  <label>
                    Start Date
                    <input
                      type="date"
                      value={startDate}
                      onChange={event => setStartDate(event.target.value)}
                    />
                  </label>
                  <label>
                    End Date
                    <input
                      type="date"
                      value={endDate}
                      onChange={event => setEndDate(event.target.value)}
                    />
                  </label>
                  <div className="session-form__upload">
                    <span className="session-form__label">Upload Roster (optional)</span>
                    <label className="drop-zone-header session-upload">
                      <span>{rosterFile ? rosterFile.name : 'Click or drop a .csv file'}</span>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={event => setRosterFile(event.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>
                </div>
                <div className="session-form__panel">
                  <h3>Instructors on Shift</h3>
                  {instructors.map((instructor, index) => (
                    <input
                      key={`instructor-${index}`}
                      type="text"
                      placeholder="Instructor name"
                      value={instructor.name}
                      onChange={event => updateInstructor(index, event.target.value)}
                    />
                  ))}
                  <button type="button" className="btn" onClick={addInstructor}>
                    Add Instructor
                  </button>
                </div>
              </div>
              <div className="session-form__actions">
                <button type="submit" className="btn">
                  Save Session
                </button>
                {saveMessage ? <span className="session-form__message">{saveMessage}</span> : null}
              </div>
            </form>
          </div>
        ) : (
          <div className="dashboard-form">
            <h2 className="dashboard-form__title">Select Existing Session</h2>
            {sessions.length === 0 ? (
              <p className="session-empty">No existing sessions.</p>
            ) : (
              <div className="session-list">
                {sessions.map(session => (
                  <div key={session.id} className="session-card">
                    <h3>{session.sessionDay || 'Session Day'}</h3>
                    <p>
                      {session.startDate || 'Start date'} - {session.endDate || 'End date'}
                    </p>
                    <p>{session.instructors.length} instructors</p>
                    {session.rosterFileName ? (
                      <p>Roster: {session.rosterFileName}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../app/AuthContext'
import { useCurrentSession } from '../../app/useCurrentSession'
import { useCurrentTeam } from '../../app/useCurrentTeam'
import { useCurrentTerm } from '../../app/useCurrentTerm'
import { getCurrentSessionId } from '../../lib/instructorPdfCache'
import { getScopedKey } from '../../lib/storageScope'
import { supabase } from '../../lib/supabaseClient'
import { useSessionInstructors } from '../print/hooks/useSessionInstructors'

type NoteTabKey = 'general' | 'recognition' | 'feedback' | 'coaching'
type TabKey = NoteTabKey | 'todo'

type NoteItem = {
  id: string
  createdAt: string
  text: string
  employeeName?: string
  authorName?: string
  sessionContext?: string
}

type TodoItem = {
  id: string
  createdAt: string
  text: string
  done: boolean
}

type TabConfig = {
  key: TabKey
  label: string
  type: 'note' | 'todo'
  showEmployee?: boolean
}

const NOTES_STORAGE_PREFIX = () => getScopedKey('notes')

const tabs: TabConfig[] = [
  { key: 'general', label: 'General Session Notes', type: 'note' },
  { key: 'recognition', label: 'Employee Recognition', type: 'note', showEmployee: true },
  { key: 'feedback', label: 'Employee Feedback', type: 'note', showEmployee: true },
  { key: 'coaching', label: 'Employee Coaching', type: 'note', showEmployee: true },
  { key: 'todo', label: 'Todo', type: 'todo' },
]

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

const buildStorageKey = (sessionId: string, tab: TabKey) =>
  `${NOTES_STORAGE_PREFIX()}::${sessionId}::${tab}`

const loadJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') {
    return fallback
  }
  try {
    const value = window.localStorage.getItem(key)
    if (!value) {
      return fallback
    }
    return JSON.parse(value) as T
  } catch (error) {
    console.error(`Failed to parse ${key} from localStorage`, error)
    return fallback
  }
}

const saveJson = <T,>(key: string, value: T) => {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(key, JSON.stringify(value))
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

const normalizeSeason = (value: string | null | undefined) => (value ?? '').trim().toLowerCase()

const getSessionYear = (sessionYear: number | null, startDate: string | null) => {
  if (sessionYear && Number.isFinite(sessionYear) && sessionYear > 0) {
    return sessionYear
  }
  if (!startDate) {
    return null
  }
  const parsed = new Date(startDate).getFullYear()
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const formatSessionContext = (day: string | null, location: string | null) => {
  const dayLabel = day ? dayNames[day] ?? day : ''
  const locationLabel = (location ?? '').trim()
  const parts = [dayLabel, locationLabel].filter(Boolean)
  return parts.join(' | ')
}

function StaffNotesPage() {
  const { accountType, isGuest, user } = useAuth()
  const { sessionId: currentSessionId, access } = useCurrentSession()
  const { currentTeamId } = useCurrentTeam()
  const { currentTerm } = useCurrentTerm()
  const isFullTime = accountType === 'full_time'
  const sessionId = isGuest ? getCurrentSessionId() : currentSessionId
  const isSessionReady = isFullTime ? Boolean(currentTeamId && currentTerm) : Boolean(sessionId)
  const instructorNames = useSessionInstructors(true)
  const [activeTab, setActiveTab] = useState<TabKey>('general')
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [noteText, setNoteText] = useState('')
  const [employeeName, setEmployeeName] = useState('')
  const [todoText, setTodoText] = useState('')

  const activeConfig = useMemo(
    () => tabs.find(tab => tab.key === activeTab) ?? tabs[0],
    [activeTab],
  )

  const visibleTabs = useMemo(
    () => (isFullTime ? tabs.filter(tab => tab.key !== 'todo') : tabs),
    [isFullTime],
  )

  useEffect(() => {
    if (visibleTabs.some(tab => tab.key === activeTab)) {
      return
    }
    setActiveTab(visibleTabs[0]?.key ?? 'general')
  }, [activeTab, visibleTabs])

  useEffect(() => {
    if (!sessionId) {
      setNotes([])
      setTodos([])
      if (!isFullTime) {
        return
      }
    }
    if (isGuest) {
      const storageKey = buildStorageKey(sessionId, activeTab)
      if (activeTab === 'todo') {
        setTodos(loadJson<TodoItem[]>(storageKey, []))
      } else {
        setNotes(loadJson<NoteItem[]>(storageKey, []))
      }
      return
    }

    if (isFullTime) {
      if (!currentTeamId || !currentTerm) {
        setNotes([])
        setTodos([])
        return
      }

      let active = true
      const loadTeamTermNotes = async () => {
        const [{ data: teamData, error: teamError }, { data: memberData, error: memberError }, { data: sessionData, error: sessionError }] = await Promise.all([
          supabase.from('teams').select('owner_id').eq('id', currentTeamId).maybeSingle(),
          supabase.from('team_members').select('user_id').eq('team_id', currentTeamId),
          supabase
            .from('sessions')
            .select('id,session_day,session_season,session_year,start_date,location')
            .eq('team_id', currentTeamId),
        ])

        if (!active) {
          return
        }

        if (teamError || memberError || sessionError) {
          console.error('Failed to load full-time notes scope', teamError ?? memberError ?? sessionError)
          setNotes([])
          setTodos([])
          return
        }

        const scopedSessions = (sessionData ?? []).filter(session => {
          const season = normalizeSeason(session.session_season)
          const year = getSessionYear(session.session_year ?? null, session.start_date ?? null)
          return season === currentTerm.season && year === currentTerm.year
        })

        if (scopedSessions.length === 0) {
          setNotes([])
          setTodos([])
          return
        }

        const sessionMap = new Map(
          scopedSessions.map(session => [
            session.id,
            formatSessionContext(session.session_day ?? null, session.location ?? null),
          ]),
        )
        const sessionIds = scopedSessions.map(session => session.id)

        const allowedAuthorIds = new Set<string>()
        const ownerId = teamData?.owner_id ?? ''
        if (ownerId) {
          allowedAuthorIds.add(ownerId)
        }
        ;(memberData ?? []).forEach(row => {
          const userId = (row.user_id ?? '').trim()
          if (userId) {
            allowedAuthorIds.add(userId)
          }
        })

        const { data: noteData, error: noteError } = await supabase
          .from('session_notes')
          .select('id,session_id,created_by,created_at,note_type,text,employee_name,done')
          .in('session_id', sessionIds)
          .order('created_at', { ascending: false })

        if (!active) {
          return
        }

        if (noteError) {
          console.error('Failed to load full-time team notes', noteError)
          setNotes([])
          setTodos([])
          return
        }

        const teamNotes = (noteData ?? []).filter(row => allowedAuthorIds.has(row.created_by))
        const filteredRows = teamNotes.filter(row => row.note_type === activeTab)
        if (filteredRows.length === 0) {
          setNotes([])
          setTodos([])
          return
        }

        const authorIds = Array.from(new Set(filteredRows.map(row => row.created_by).filter(Boolean)))
        const { data: authorProfiles, error: authorError } = authorIds.length
          ? await supabase
              .from('profiles')
              .select('id,first_name,last_name,email')
              .in('id', authorIds)
          : { data: [], error: null }

        if (!active) {
          return
        }

        if (authorError) {
          console.error('Failed to load note author profiles', authorError)
        }

        const authorNameById = new Map(
          (authorProfiles ?? []).map(profile => {
            const fullName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
            return [profile.id, fullName || profile.email || 'Unknown author']
          }),
        )

        setNotes(
          filteredRows.map(row => ({
            id: row.id,
            createdAt: row.created_at,
            text: row.text,
            employeeName: row.employee_name ?? undefined,
            authorName: authorNameById.get(row.created_by) ?? 'Unknown author',
            sessionContext: sessionMap.get(row.session_id) ?? undefined,
          })),
        )
        setTodos([])
      }

      void loadTeamTermNotes()
      return () => {
        active = false
      }
    }

    const loadFromDb = async () => {
      const { data } = await supabase
        .from('session_notes')
        .select('id,created_at,note_type,text,employee_name,done')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })

      const rows = data ?? []
      if (activeTab === 'todo') {
        setTodos(
          rows
            .filter(row => row.note_type === 'todo')
            .map(row => ({
              id: row.id,
              createdAt: row.created_at,
              text: row.text,
              done: row.done ?? false,
            })),
        )
      } else {
        setNotes(
          rows
            .filter(row => row.note_type === activeTab)
            .map(row => ({
              id: row.id,
              createdAt: row.created_at,
              text: row.text,
              employeeName: row.employee_name ?? undefined,
            })),
        )
      }
    }
    void loadFromDb()
  }, [activeTab, currentTeamId, currentTerm, isFullTime, isGuest, sessionId])

  useEffect(() => {
    if (!employeeName) {
      return
    }
    if (!instructorNames.includes(employeeName)) {
      setEmployeeName('')
    }
  }, [employeeName, instructorNames])

  const handleAddNote = async () => {
    if (!sessionId) {
      return
    }
    if (activeTab === 'todo') {
      return
    }
    const trimmed = noteText.trim()
    if (!trimmed) {
      return
    }
    const entry: NoteItem = {
      id: createId(),
      createdAt: new Date().toISOString(),
      text: trimmed,
      employeeName: employeeName.trim() || undefined,
    }
    if (isGuest) {
      const next = [entry, ...notes]
      setNotes(next)
      saveJson(buildStorageKey(sessionId, activeTab), next)
    } else if (user?.id && (access.mode === 'owner' || access.mode === 'shared')) {
      const { data, error } = await supabase
        .from('session_notes')
        .insert({
          session_id: sessionId,
          created_by: user.id,
          note_type: activeTab,
          text: trimmed,
          employee_name: employeeName.trim() || null,
        })
        .select('id,created_at,text,employee_name')
        .single()
      if (error || !data) {
        console.error('Failed to add note', error)
        alert(`Failed to add note: ${error?.message ?? 'Unknown error'}`)
        return
      }
      setNotes(current => [
        {
          id: data.id,
          createdAt: data.created_at,
          text: data.text,
          employeeName: data.employee_name ?? undefined,
        },
        ...current,
      ])
    }
    setNoteText('')
    setEmployeeName('')
  }

  const handleDeleteNote = (id: string) => {
    if (!sessionId) {
      return
    }
    if (isGuest) {
      const next = notes.filter(item => item.id !== id)
      setNotes(next)
      saveJson(buildStorageKey(sessionId, activeTab), next)
      return
    }
    void supabase.from('session_notes').delete().eq('id', id)
    setNotes(current => current.filter(item => item.id !== id))
  }

  const handleAddTodo = async () => {
    if (!sessionId) {
      return
    }
    const trimmed = todoText.trim()
    if (!trimmed) {
      return
    }
    const entry: TodoItem = {
      id: createId(),
      createdAt: new Date().toISOString(),
      text: trimmed,
      done: false,
    }
    if (isGuest) {
      const next = [entry, ...todos]
      setTodos(next)
      saveJson(buildStorageKey(sessionId, activeTab), next)
    } else if (user?.id && (access.mode === 'owner' || access.mode === 'shared')) {
      const { data, error } = await supabase
        .from('session_notes')
        .insert({
          session_id: sessionId,
          created_by: user.id,
          note_type: 'todo',
          text: trimmed,
          done: false,
        })
        .select('id,created_at,text,done')
        .single()
      if (error || !data) {
        console.error('Failed to add todo', error)
        alert(`Failed to add todo: ${error?.message ?? 'Unknown error'}`)
        return
      }
      setTodos(current => [
        {
          id: data.id,
          createdAt: data.created_at,
          text: data.text,
          done: data.done ?? false,
        },
        ...current,
      ])
    }
    setTodoText('')
  }

  const handleToggleTodo = (id: string) => {
    if (!sessionId) {
      return
    }
    if (isGuest) {
      const next = todos.map(item => (item.id === id ? { ...item, done: !item.done } : item))
      setTodos(next)
      saveJson(buildStorageKey(sessionId, activeTab), next)
      return
    }
    const updated = todos.map(item => (item.id === id ? { ...item, done: !item.done } : item))
    const target = updated.find(item => item.id === id)
    if (target) {
      void supabase.from('session_notes').update({ done: target.done }).eq('id', id)
    }
    setTodos(updated)
  }

  const handleDeleteTodo = (id: string) => {
    if (!sessionId) {
      return
    }
    if (isGuest) {
      const next = todos.filter(item => item.id !== id)
      setTodos(next)
      saveJson(buildStorageKey(sessionId, activeTab), next)
      return
    }
    void supabase.from('session_notes').delete().eq('id', id)
    setTodos(current => current.filter(item => item.id !== id))
  }

  const tabButtonClass = (tabKey: TabKey) =>
    [
      'rounded-2xl border px-4 py-2 text-sm font-semibold transition',
      tabKey === activeTab
        ? 'border-secondary bg-secondary text-accent'
        : 'border-secondary/30 bg-bg text-secondary hover:bg-accent',
    ].join(' ')

  const listEmptyLabel =
    activeConfig.type === 'todo'
      ? 'No todo items yet.'
      : isFullTime
      ? 'No team member notes found for this tab in the selected term.'
      : 'No notes yet.'
  const canWriteDbNotes = !isFullTime && Boolean(user?.id) && (access.mode === 'owner' || access.mode === 'shared')
  const isEditable = isGuest || canWriteDbNotes
  const isAddNoteDisabled = !isSessionReady || noteText.trim() === '' || !isEditable
  const isAddTodoDisabled = !isSessionReady || todoText.trim() === '' || !isEditable

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="rounded-card border-2 border-secondary/20 bg-accent p-8 text-secondary shadow-md">
        <h2 className="text-2xl font-semibold">Notes</h2>
        <p className="mt-2 text-base">Capture session notes, employee updates, and todo items.</p>
      </div>

      {!isSessionReady ? (
        <div className="rounded-card border-2 border-secondary/30 bg-bg p-4 text-sm font-semibold text-secondary">
          {isFullTime ? 'Select a team and session term on Home to view notes.' : 'Select a session to add notes.'}
        </div>
      ) : null}

      <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
        <div className="flex flex-wrap gap-2">
          {visibleTabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              className={tabButtonClass(tab.key)}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {activeConfig.type === 'todo' ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  className="flex-1 rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                  type="text"
                  value={todoText}
                  onChange={event => setTodoText(event.target.value)}
                  placeholder="Add a todo item"
                  disabled={!isSessionReady}
                />
                <button
                  type="button"
                  className="rounded-2xl bg-secondary px-5 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleAddTodo}
                  disabled={isAddTodoDisabled}
                >
                  Add Todo
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {todos.length === 0 ? (
                  <p className="text-sm text-secondary/70">{listEmptyLabel}</p>
                ) : (
                  todos.map(item => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-secondary/20 bg-bg p-4"
                    >
                      <label className="flex flex-1 items-start gap-3">
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => handleToggleTodo(item.id)}
                          disabled={!isSessionReady}
                        />
                        <div>
                          <p
                            className={`text-sm font-semibold ${
                              item.done ? 'text-secondary/50 line-through' : 'text-secondary'
                            }`}
                          >
                            {item.text}
                          </p>
                          <p className="mt-1 text-xs text-secondary/60">
                            {new Date(item.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </label>
                      {isEditable ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-secondary/70 transition hover:text-secondary"
                          onClick={() => handleDeleteTodo(item.id)}
                          disabled={!isSessionReady}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {isEditable ? (
                <div className="flex flex-col gap-3">
                  {activeConfig.showEmployee ? (
                    <select
                      className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                      value={employeeName}
                      onChange={event => setEmployeeName(event.target.value)}
                      disabled={!isSessionReady}
                    >
                      {instructorNames.length === 0 ? (
                        <option value="">No instructors found</option>
                      ) : (
                        <option value="">Select employee (optional)</option>
                      )}
                      {instructorNames.map(name => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <textarea
                    className="min-h-[120px] rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                    value={noteText}
                    onChange={event => setNoteText(event.target.value)}
                    placeholder="Write a note"
                    disabled={!isSessionReady}
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="rounded-2xl bg-secondary px-5 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={handleAddNote}
                      disabled={isAddNoteDisabled}
                    >
                      Add Note
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm font-semibold text-secondary/70">
                  Full-time view is read-only. You are viewing notes written by team members for the selected
                  term.
                </p>
              )}

              <div className="flex flex-col gap-3">
                {notes.length === 0 ? (
                  <p className="text-sm text-secondary/70">{listEmptyLabel}</p>
                ) : (
                  notes.map(item => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-secondary/20 bg-bg p-4"
                    >
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-secondary/60">
                          {new Date(item.createdAt).toLocaleString()}
                        </p>
                        {item.authorName ? (
                          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-secondary/70">
                            Author: {item.authorName}
                          </p>
                        ) : null}
                        {item.sessionContext ? (
                          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-secondary/70">
                            Session: {item.sessionContext}
                          </p>
                        ) : null}
                        {item.employeeName ? (
                          <p className="mt-1 text-sm font-semibold text-secondary">
                            {item.employeeName}
                          </p>
                        ) : null}
                        <p className="mt-2 whitespace-pre-wrap text-sm text-secondary">{item.text}</p>
                      </div>
                      {isEditable ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-secondary/70 transition hover:text-secondary"
                          onClick={() => handleDeleteNote(item.id)}
                          disabled={!isSessionReady}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StaffNotesPage

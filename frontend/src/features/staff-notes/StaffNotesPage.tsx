import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../app/AuthContext'
import { useCurrentSession } from '../../app/useCurrentSession'
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

function StaffNotesPage() {
  const { isGuest } = useAuth()
  const { sessionId: currentSessionId, access } = useCurrentSession()
  const sessionId = isGuest ? getCurrentSessionId() : currentSessionId
  const isSessionReady = Boolean(sessionId)
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

  useEffect(() => {
    if (!sessionId) {
      setNotes([])
      setTodos([])
      return
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
  }, [activeTab, isGuest, sessionId])

  useEffect(() => {
    if (!employeeName) {
      return
    }
    if (!instructorNames.includes(employeeName)) {
      setEmployeeName('')
    }
  }, [employeeName, instructorNames])

  const handleAddNote = () => {
    if (!sessionId) {
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
    } else if (access.mode === 'owner' || access.mode === 'shared') {
      void supabase.from('session_notes').insert({
        session_id: sessionId,
        note_type: activeTab,
        text: trimmed,
        employee_name: employeeName.trim() || null,
      })
      setNotes(current => [entry, ...current])
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

  const handleAddTodo = () => {
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
    } else if (access.mode === 'owner' || access.mode === 'shared') {
      void supabase.from('session_notes').insert({
        session_id: sessionId,
        note_type: 'todo',
        text: trimmed,
        done: false,
      })
      setTodos(current => [entry, ...current])
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

  const listEmptyLabel = activeConfig.type === 'todo' ? 'No todo items yet.' : 'No notes yet.'
  const isEditable = isGuest || access.mode === 'owner' || access.mode === 'shared'
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
          Select a session to add notes.
        </div>
      ) : null}

      <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
        <div className="flex flex-wrap gap-2">
          {tabs.map(tab => (
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
                      <button
                        type="button"
                        className="text-xs font-semibold text-secondary/70 transition hover:text-secondary"
                        onClick={() => handleDeleteTodo(item.id)}
                        disabled={!isSessionReady}
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
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
                        {item.employeeName ? (
                          <p className="mt-1 text-sm font-semibold text-secondary">
                            {item.employeeName}
                          </p>
                        ) : null}
                        <p className="mt-2 whitespace-pre-wrap text-sm text-secondary">{item.text}</p>
                      </div>
                      <button
                        type="button"
                        className="text-xs font-semibold text-secondary/70 transition hover:text-secondary"
                        onClick={() => handleDeleteNote(item.id)}
                        disabled={!isSessionReady}
                      >
                        Delete
                      </button>
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

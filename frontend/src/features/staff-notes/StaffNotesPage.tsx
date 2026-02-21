import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../app/AuthContext'
import { useCurrentSession } from '../../app/useCurrentSession'
import { useCurrentTeam } from '../../app/useCurrentTeam'
import { useCurrentTerm } from '../../app/useCurrentTerm'
import { getCurrentSessionId } from '../../lib/instructorPdfCache'
import { supabase } from '../../lib/supabaseClient'
import { useSessionInstructors } from '../print/hooks/useSessionInstructors'
import NoteTab from './components/NoteTab'
import ReportTab from './components/report/ReportTab'
import TabBar from './components/TabBar'
import TodoTab from './components/TodoTab'
import { formatSessionContext, getSessionYear, normalizeSeason, tabs } from './constants'
import { useSessionReports } from './hooks/useSessionReports'
import type { NoteItem, ReportItem, TabKey, TodoItem } from './types'
import { normalizeReportData } from './utils/reportData'
import { buildStorageKey, loadJson, saveJson } from './utils/storage'

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

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

  const {
    reports,
    activeReportId,
    reportTitle,
    reportDraft,
    reportStatus,
    selectedReport,
    canCreateReports,
    canEditSelectedReport,
    isReportInputDisabled,
    reportInstructorOptions,
    updateReportDraft,
    handleReportTitleChange,
    handleSelectReport,
    handleCreateReport,
    handleDeleteReport,
    handleExportReport,
    isExportingReport,
    setLoadedReports,
    clearReports,
  } = useSessionReports({
    activeTab,
    sessionId,
    isSessionReady,
    isGuest,
    isFullTime,
    userId: user?.id ?? null,
    accessMode: access.mode,
    instructorNames,
  })

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
      clearReports()
      if (!isFullTime) {
        return
      }
    }
    if (isGuest) {
      const storageKey = buildStorageKey(sessionId, activeTab)
      if (activeTab === 'todo') {
        setTodos(loadJson<TodoItem[]>(storageKey, []))
        setNotes([])
        clearReports()
      } else if (activeTab === 'report') {
        const stored = loadJson<ReportItem[]>(storageKey, [])
        const normalized = stored
          .map(item => {
            const createdAt = item.createdAt || new Date().toISOString()
            const updatedAt = item.updatedAt || createdAt
            return {
              id: item.id,
              createdAt,
              updatedAt,
              title: item.title || 'Untitled report',
              reportData: normalizeReportData(item.reportData, instructorNames),
              createdBy: item.createdBy,
              authorName: item.authorName ?? 'Guest',
              sessionContext: item.sessionContext,
            }
          })
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        setLoadedReports(normalized)
        setNotes([])
        setTodos([])
      } else {
        setNotes(loadJson<NoteItem[]>(storageKey, []))
        setTodos([])
        clearReports()
      }
      return
    }

    if (isFullTime) {
      if (!currentTeamId || !currentTerm) {
        setNotes([])
        setTodos([])
        clearReports()
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
          clearReports()
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
          clearReports()
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

        if (activeTab === 'report') {
          const { data: reportData, error: reportError } = await supabase
            .from('session_reports')
            .select('id,session_id,created_by,title,report_data,created_at,updated_at')
            .in('session_id', sessionIds)
            .order('updated_at', { ascending: false })

          if (!active) {
            return
          }

          if (reportError) {
            console.error('Failed to load full-time reports', reportError)
            setNotes([])
            setTodos([])
            clearReports()
            return
          }

          const teamReports = (reportData ?? []).filter(row => allowedAuthorIds.has(row.created_by))
          if (teamReports.length === 0) {
            setNotes([])
            setTodos([])
            clearReports()
            return
          }

          const authorIds = Array.from(new Set(teamReports.map(row => row.created_by).filter(Boolean)))
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
            console.error('Failed to load report author profiles', authorError)
          }

          const authorNameById = new Map(
            (authorProfiles ?? []).map(profile => {
              const fullName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
              return [profile.id, fullName || profile.email || 'Unknown author']
            }),
          )

          const mappedReports: ReportItem[] = teamReports.map(row => ({
            id: row.id,
            createdAt: row.created_at,
            updatedAt: row.updated_at ?? row.created_at,
            title: row.title ?? 'Untitled report',
            reportData: normalizeReportData(row.report_data, []),
            createdBy: row.created_by,
            authorName: authorNameById.get(row.created_by) ?? 'Unknown author',
            sessionContext: sessionMap.get(row.session_id) ?? undefined,
          }))

          setLoadedReports(mappedReports)
          setNotes([])
          setTodos([])
          return
        }

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
          clearReports()
          return
        }

        const teamNotes = (noteData ?? []).filter(row => allowedAuthorIds.has(row.created_by))
        const filteredRows = teamNotes.filter(row => row.note_type === activeTab)
        if (filteredRows.length === 0) {
          setNotes([])
          setTodos([])
          clearReports()
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
        clearReports()
      }

      void loadTeamTermNotes()
      return () => {
        active = false
      }
    }

    const loadFromDb = async () => {
      if (activeTab === 'report') {
        const { data, error } = await supabase
          .from('session_reports')
          .select('id,session_id,created_by,title,report_data,created_at,updated_at')
          .eq('session_id', sessionId)
          .order('updated_at', { ascending: false })

        if (error) {
          console.error('Failed to load reports', error)
          setNotes([])
          setTodos([])
          clearReports()
          return
        }

        const rows = data ?? []
        const authorIds = Array.from(new Set(rows.map(row => row.created_by).filter(Boolean)))
        const { data: authorProfiles, error: authorError } = authorIds.length
          ? await supabase
              .from('profiles')
              .select('id,first_name,last_name,email')
              .in('id', authorIds)
          : { data: [], error: null }

        if (authorError) {
          console.error('Failed to load report author profiles', authorError)
        }

        const authorNameById = new Map(
          (authorProfiles ?? []).map(profile => {
            const fullName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
            return [profile.id, fullName || profile.email || 'Unknown author']
          }),
        )

        const mappedReports: ReportItem[] = rows.map(row => ({
          id: row.id,
          createdAt: row.created_at,
          updatedAt: row.updated_at ?? row.created_at,
          title: row.title ?? 'Untitled report',
          reportData: normalizeReportData(row.report_data, instructorNames),
          createdBy: row.created_by,
          authorName: authorNameById.get(row.created_by) ?? 'Unknown author',
        }))

        setLoadedReports(mappedReports)
        setNotes([])
        setTodos([])
        return
      }

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
        setNotes([])
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
        setTodos([])
      }
      clearReports()
    }
    void loadFromDb()
  }, [
    activeTab,
    clearReports,
    currentTeamId,
    currentTerm,
    instructorNames,
    isFullTime,
    isGuest,
    sessionId,
    setLoadedReports,
  ])

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
    if (activeConfig.type !== 'note') {
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

  const canWriteDbNotes =
    !isFullTime && Boolean(user?.id) && (access.mode === 'owner' || access.mode === 'shared')
  const isEditable = isGuest || canWriteDbNotes

  const listEmptyLabel =
    activeConfig.type === 'todo'
      ? 'No todo items yet.'
      : activeConfig.type === 'report'
      ? isFullTime
        ? 'No team member reports found for the selected term.'
        : 'No reports yet.'
      : isFullTime
      ? 'No team member notes found for this tab in the selected term.'
      : 'No notes yet.'
  const isAddNoteDisabled = !isSessionReady || noteText.trim() === '' || !isEditable
  const isAddTodoDisabled = !isSessionReady || todoText.trim() === '' || !isEditable

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="rounded-card border-2 border-secondary/20 bg-accent p-8 text-secondary shadow-md">
        <h2 className="text-2xl font-semibold">Notes</h2>
        <p className="mt-2 text-base">Capture session notes, employee updates, todos, and reports.</p>
      </div>

      {!isSessionReady ? (
        <div className="rounded-card border-2 border-secondary/30 bg-bg p-4 text-sm font-semibold text-secondary">
          {isFullTime ? 'Select a team and session term on Home to view notes.' : 'Select a session to add notes.'}
        </div>
      ) : null}

      <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
        <TabBar visibleTabs={visibleTabs} activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="mt-6">
          {activeConfig.type === 'todo' ? (
            <TodoTab
              isSessionReady={isSessionReady}
              isEditable={isEditable}
              todoText={todoText}
              setTodoText={setTodoText}
              onAddTodo={handleAddTodo}
              isAddTodoDisabled={isAddTodoDisabled}
              todos={todos}
              listEmptyLabel={listEmptyLabel}
              onToggleTodo={handleToggleTodo}
              onDeleteTodo={handleDeleteTodo}
            />
          ) : activeConfig.type === 'report' ? (
            <ReportTab
              isSessionReady={isSessionReady}
              reports={reports}
              activeReportId={activeReportId}
              onSelectReport={handleSelectReport}
              canCreateReports={canCreateReports}
              onCreateReport={handleCreateReport}
              selectedReport={selectedReport}
              canEditSelectedReport={canEditSelectedReport}
              onDeleteReport={handleDeleteReport}
              onExportReport={handleExportReport}
              isExportingReport={isExportingReport}
              reportStatus={reportStatus}
              reportTitle={reportTitle}
              onReportTitleChange={handleReportTitleChange}
              isReportInputDisabled={isReportInputDisabled}
              listEmptyLabel={listEmptyLabel}
              reportDraft={reportDraft}
              updateReportDraft={updateReportDraft}
              reportInstructorOptions={reportInstructorOptions}
            />
          ) : (
            <NoteTab
              isSessionReady={isSessionReady}
              isEditable={isEditable}
              isFullTime={isFullTime}
              showEmployee={Boolean(activeConfig.showEmployee)}
              instructorNames={instructorNames}
              employeeName={employeeName}
              setEmployeeName={setEmployeeName}
              noteText={noteText}
              setNoteText={setNoteText}
              onAddNote={handleAddNote}
              isAddNoteDisabled={isAddNoteDisabled}
              notes={notes}
              listEmptyLabel={listEmptyLabel}
              onDeleteNote={handleDeleteNote}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default StaffNotesPage

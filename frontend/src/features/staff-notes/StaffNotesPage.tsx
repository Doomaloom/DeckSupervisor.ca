import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../app/AuthContext'
import { useCurrentSession } from '../../app/useCurrentSession'
import { useCurrentTeam } from '../../app/useCurrentTeam'
import { useCurrentTerm } from '../../app/useCurrentTerm'
import { getCurrentSessionId } from '../../lib/instructorPdfCache'
import {
  createSessionNote,
  deleteSessionNote,
  fetchSessionNotes,
  fetchTeamSessions,
  fetchTeamTermSessionNotes,
  fetchTeamTermSessionReports,
  updateSessionNote,
} from '../../lib/serverApi'
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

type FullTimeNotesScopeSummary = {
  teamId: string
  teamName: string
  termLabel: string
  sessionCount: number
  rawNoteCount: number
  rawReportCount: number
  activeTabCount: number
  locations: string[]
}

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

function StaffNotesPage() {
  const { accountType, isGuest, user } = useAuth()
  const { sessionId: currentSessionId, session: currentSession, access } = useCurrentSession()
  const { currentTeam, currentTeamId } = useCurrentTeam()
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
  const [fullTimeScopeSummary, setFullTimeScopeSummary] =
    useState<FullTimeNotesScopeSummary | null>(null)

  const currentSessionContext = useMemo(
    () =>
      formatSessionContext(
        currentSession?.session_day ?? null,
        currentSession?.location ?? null,
        currentSession?.session_season ?? null,
        currentSession?.session_year ?? null,
        currentSession?.start_date ?? null,
      ),
    [
      currentSession?.location,
      currentSession?.session_day,
      currentSession?.session_season,
      currentSession?.session_year,
      currentSession?.start_date,
    ],
  )

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
    currentSessionContext,
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

  const visibleTabs = tabs

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
              sessionContext: item.sessionContext || currentSessionContext || undefined,
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
        setFullTimeScopeSummary(null)
        clearReports()
        return
      }

      let active = true
      const loadTeamTermNotes = async () => {
        let sessionData: any[] = []
        try {
          const response = await fetchTeamSessions(
            currentTeamId,
            'id,session_day,session_season,session_year,start_date,location',
          )
          sessionData = response.sessions ?? []
        } catch (error) {
          if (!active) {
            return
          }
          console.error('Failed to load full-time notes scope', error)
          setNotes([])
          setTodos([])
          setFullTimeScopeSummary(null)
          clearReports()
          return
        }

        if (!active) {
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
          setFullTimeScopeSummary({
            teamId: currentTeamId,
            teamName: currentTeam?.name ?? 'Selected team',
            termLabel: currentTerm.label,
            sessionCount: 0,
            rawNoteCount: 0,
            rawReportCount: 0,
            activeTabCount: 0,
            locations: [],
          })
          clearReports()
          return
        }

        const sessionMap = new Map(
          scopedSessions.map(session => [
            session.id,
            formatSessionContext(
              session.session_day ?? null,
              session.location ?? null,
              session.session_season ?? null,
              session.session_year ?? null,
              session.start_date ?? null,
            ),
          ]),
        )
        const fallbackSessionContext = `${currentTerm.label} | ${currentTeam?.name ?? 'Selected team'}`
        const sessionIds = scopedSessions.map(session => session.id)
        const locations = Array.from(
          new Set(
            scopedSessions
              .map(session => (session.location ?? '').trim())
              .filter(Boolean),
          ),
        ).sort()

        const baseScopeSummary: FullTimeNotesScopeSummary = {
          teamId: currentTeamId,
          teamName: currentTeam?.name ?? 'Selected team',
          termLabel: currentTerm.label,
          sessionCount: scopedSessions.length,
          rawNoteCount: 0,
          rawReportCount: 0,
          activeTabCount: 0,
          locations,
        }

        if (activeTab === 'report') {
          console.info('Staff Notes full-time term report scope', {
            currentTeamId,
            currentTeamName: currentTeam?.name ?? null,
            currentTerm,
            scopedSessionIds: sessionIds,
            query: {
              table: 'session_reports',
              team_id: currentTeamId,
              session_season: currentTerm.season,
              session_year: currentTerm.year,
            },
          })
          let reportData: any[] = []
          try {
            const response = await fetchTeamTermSessionReports(currentTeamId, currentTerm.season, currentTerm.year)
            reportData = response.reports ?? []
          } catch (error) {
            if (!active) {
              return
            }
            console.error('Failed to load full-time reports', error)
            setNotes([])
            setTodos([])
            setFullTimeScopeSummary({ ...baseScopeSummary, rawReportCount: 0, activeTabCount: 0 })
            clearReports()
            return
          }

          if (!active) {
            return
          }

          const teamReports = reportData ?? []
          setFullTimeScopeSummary({
            ...baseScopeSummary,
            rawReportCount: teamReports.length,
            activeTabCount: teamReports.length,
          })
          if (teamReports.length === 0) {
            console.info('Full-time reports scope empty', {
              currentTeamId,
              currentTeamName: currentTeam?.name ?? null,
              currentTerm,
              scopedSessionIds: sessionIds,
              scopedSessionCount: scopedSessions.length,
              rawReportCount: reportData?.length ?? 0,
            })
            setNotes([])
            setTodos([])
            clearReports()
            return
          }

          const mappedReports: ReportItem[] = teamReports.map(row => ({
            id: row.id,
            createdAt: row.created_at,
            updatedAt: row.updated_at ?? row.created_at,
            title: row.title ?? 'Untitled report',
            reportData: normalizeReportData(row.report_data, []),
            createdBy: row.created_by,
            sessionContext: sessionMap.get(row.session_id) ?? fallbackSessionContext,
          }))

          setLoadedReports(mappedReports)
          setNotes([])
          setTodos([])
          return
        }

        console.info('Staff Notes full-time term note scope', {
          currentTeamId,
          currentTeamName: currentTeam?.name ?? null,
          currentTerm,
          scopedSessionIds: sessionIds,
          query: {
            table: 'session_notes',
            team_id: currentTeamId,
            session_season: currentTerm.season,
            session_year: currentTerm.year,
          },
        })
        let noteData: any[] = []
        try {
          const response = await fetchTeamTermSessionNotes(currentTeamId, currentTerm.season, currentTerm.year)
          noteData = response.notes ?? []
        } catch (error) {
          if (!active) {
            return
          }
          console.error('Failed to load full-time team notes', error)
          setNotes([])
          setTodos([])
          setFullTimeScopeSummary({ ...baseScopeSummary, rawNoteCount: 0, activeTabCount: 0 })
          clearReports()
          return
        }

        if (!active) {
          return
        }

        const teamNotes = noteData ?? []
        const filteredRows = teamNotes.filter(row => row.note_type === activeTab)
        setFullTimeScopeSummary({
          ...baseScopeSummary,
          rawNoteCount: teamNotes.length,
          activeTabCount: filteredRows.length,
        })
        if (filteredRows.length === 0) {
          console.info('Full-time notes scope empty', {
            currentTeamId,
            currentTeamName: currentTeam?.name ?? null,
            currentTerm,
            activeTab,
            scopedSessionIds: sessionIds,
            scopedSessionCount: scopedSessions.length,
            rawNoteCount: noteData?.length ?? 0,
            filteredTabCount: filteredRows.length,
          })
          setNotes([])
          setTodos([])
          clearReports()
          return
        }

        if (activeTab === 'todo') {
          setTodos(
            filteredRows.map(row => ({
              id: row.id,
              createdAt: row.created_at,
              text: row.text,
              done: row.done ?? false,
            })),
          )
          setNotes([])
          clearReports()
          return
        }

        setNotes(
          filteredRows.map(row => ({
            id: row.id,
            createdAt: row.created_at,
            text: row.text,
            employeeName: row.employee_name ?? undefined,
            sessionContext: sessionMap.get(row.session_id) ?? fallbackSessionContext,
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
      if (!supabase && activeTab === 'report') {
        setNotes([])
        setTodos([])
        clearReports()
        return
      }
      const data = await fetchSessionNotes(sessionId)
      const rows = data.notes ?? []
      if (activeTab === 'report') {
        if (!supabase) {
          setLoadedReports([])
          setNotes([])
          setTodos([])
          return
        }
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

        const reportRows = data ?? []
        const authorIds = Array.from(new Set(reportRows.map(row => row.created_by).filter(Boolean)))
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

        const mappedReports: ReportItem[] = reportRows.map(row => ({
          id: row.id,
          createdAt: row.created_at,
          updatedAt: row.updated_at ?? row.created_at,
          title: row.title ?? 'Untitled report',
          reportData: normalizeReportData(row.report_data, instructorNames),
          createdBy: row.created_by,
          authorName: authorNameById.get(row.created_by) ?? 'Unknown author',
          sessionContext: currentSessionContext || undefined,
        }))

        setLoadedReports(mappedReports)
        setNotes([])
        setTodos([])
        return
      }
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
    currentTeam?.name,
    currentTerm,
    currentSessionContext,
    instructorNames,
    isFullTime,
    isGuest,
    sessionId,
    setLoadedReports,
  ])

  useEffect(() => {
    if (isFullTime) {
      return
    }
    console.info('Staff Notes active session_id', { sessionId })
  }, [isFullTime, sessionId])

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
      try {
        const { note: data } = await createSessionNote({
          session_id: sessionId,
          note_type: activeTab,
          text: trimmed,
          employee_name: employeeName.trim() || null,
        })
        if (!data) {
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
      } catch (error) {
        console.error('Failed to add note', error)
        alert(`Failed to add note: ${error instanceof Error ? error.message : 'Unknown error'}`)
        return
      }
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
    void deleteSessionNote(id)
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
      try {
        const { note: data } = await createSessionNote({
          session_id: sessionId,
          note_type: 'todo',
          text: trimmed,
          done: false,
        })
        if (!data) {
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
      } catch (error) {
        console.error('Failed to add todo', error)
        alert(`Failed to add todo: ${error instanceof Error ? error.message : 'Unknown error'}`)
        return
      }
    }
    setTodoText('')
  }

  const handleToggleTodo = (id: string) => {
    if (!sessionId) {
      return
    }
    if (!isEditable) {
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
      void updateSessionNote(id, { done: target.done })
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
    void deleteSessionNote(id)
    setTodos(current => current.filter(item => item.id !== id))
  }

  const canWriteDbNotes =
    !isFullTime && Boolean(user?.id) && (access.mode === 'owner' || access.mode === 'shared')
  const isEditable = isGuest || canWriteDbNotes

  const activeTabLabel = activeConfig.label
  const fullTimeEmptyLabel = (() => {
    if (!currentTeamId) {
      return 'Select DeckSupervisor Demo Aquatics on Home to view demo notes.'
    }
    if (!currentTerm) {
      return 'Select Spring 2026 on Home to view demo notes for the source CSV.'
    }
    if (fullTimeScopeSummary?.sessionCount === 0) {
      return `No sessions found for this team in ${currentTerm.label}.`
    }
    if (fullTimeScopeSummary && fullTimeScopeSummary.activeTabCount === 0) {
      if (activeConfig.type === 'report') {
        return `${fullTimeScopeSummary.sessionCount} sessions found for ${fullTimeScopeSummary.termLabel}, but no reports were returned for team/term scope.`
      }
      if (fullTimeScopeSummary.rawNoteCount === 0) {
        return `${fullTimeScopeSummary.sessionCount} sessions found for ${fullTimeScopeSummary.termLabel}, but no notes were returned for team/term scope.`
      }
      const noteWord = activeTab === 'todo' ? 'todo items' : activeTabLabel
      return `${fullTimeScopeSummary.rawNoteCount} notes loaded for ${fullTimeScopeSummary.termLabel}, but no ${noteWord} were found.`
    }
    return activeConfig.type === 'report'
      ? 'No team member reports found for the selected term.'
      : 'No team member notes found for this tab in the selected term.'
  })()

  const listEmptyLabel =
    activeConfig.type === 'todo'
      ? isFullTime
        ? fullTimeEmptyLabel
        : 'No todo items yet.'
      : activeConfig.type === 'report'
      ? isFullTime
        ? fullTimeEmptyLabel
        : 'No reports yet.'
      : isFullTime
      ? fullTimeEmptyLabel
      : 'No notes yet.'
  const isAddNoteDisabled = !isSessionReady || noteText.trim() === '' || !isEditable
  const isAddTodoDisabled = !isSessionReady || todoText.trim() === '' || !isEditable

  return (
    <div id="staff-notes-page" data-component="staff-notes-page" className="mx-auto flex w-full max-w-5xl flex-col gap-6">
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
        {isFullTime ? (
          <div className="mb-5 rounded-2xl border border-secondary/20 bg-bg p-4 text-sm text-secondary">
            <p className="font-semibold">
              Viewing {fullTimeScopeSummary?.teamName ?? currentTeam?.name ?? 'selected team'} |{' '}
              {fullTimeScopeSummary?.termLabel ?? currentTerm?.label ?? 'No term selected'} |{' '}
              {fullTimeScopeSummary?.sessionCount ?? 0} sessions
              {fullTimeScopeSummary?.locations.length
                ? ` | ${fullTimeScopeSummary.locations.join(', ')}`
                : ''}
            </p>
            {fullTimeScopeSummary ? (
              <p className="mt-1 text-secondary/70">
                {activeConfig.type === 'report'
                  ? `${fullTimeScopeSummary.rawReportCount} reports loaded for ${fullTimeScopeSummary.teamName} | ${fullTimeScopeSummary.termLabel}.`
                  : `${fullTimeScopeSummary.rawNoteCount} notes loaded for ${fullTimeScopeSummary.teamName} | ${fullTimeScopeSummary.termLabel}. ${activeTabLabel}: ${fullTimeScopeSummary.activeTabCount}.`}
              </p>
            ) : (
              <p className="mt-1 text-secondary/70">
                Select a team and term on Home to load full-time notes.
              </p>
            )}
          </div>
        ) : null}

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

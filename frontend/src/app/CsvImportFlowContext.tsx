import React, { createContext, useContext, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useDay } from './DayContext'
import { useCurrentTeam } from './useCurrentTeam'
import { useCurrentTerm } from './useCurrentTerm'
import { extractClassesFromCsv, processCsvAndStore } from '../lib/api'
import { setExtractedClassesForScope, setExtractedClassesForSession } from '../lib/extractedClassesStorage'
import { getSessionTermLabel, syncReportCardsForDay } from '../lib/reportCardSync'
import { createSession, fetchCsvSessionCandidates } from '../lib/serverApi'
import {
  getInstructorsForDay,
  getStudentsForDay,
} from '../lib/storage'
import {
  loadSessions,
  saveSessions,
  setCurrentSessionId,
  type StoredSessionEntry,
} from '../lib/sessionStorage'
import type { CsvMatchedSession, CsvSessionCandidate, ExtractedClass, InstructorEntry } from '../types/app'
import CsvSessionImportModal from '../components/CsvSessionImportModal'

type CsvImportFlowContextValue = {
  requestCsvFile: () => void
}

type CsvSessionRecord = NonNullable<CsvMatchedSession['session']>

type ModalState = {
  open: boolean
  loading: boolean
  processing: boolean
  error: string
  file: File | null
  candidates: CsvSessionCandidate[]
  classesBySession: Record<string, ExtractedClass[]>
}

const CsvImportFlowContext = createContext<CsvImportFlowContextValue | undefined>(undefined)

const emptyState: ModalState = {
  open: false,
  loading: false,
  processing: false,
  error: '',
  file: null,
  candidates: [],
  classesBySession: {},
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

function createLocalId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function buildInstructorUploadConfig(day: string): InstructorEntry[] {
  const config = getInstructorsForDay(day)
  if (!config) {
    return []
  }

  const result: InstructorEntry[] = []
  const count = Math.max(config.names.length, config.codes.length)
  for (let index = 0; index < count; index += 1) {
    const name = (config.names[index] ?? '').trim()
    const codes = (config.codes[index] ?? '').trim()
    if (!name || !codes) {
      continue
    }
    result.push({ name, codes })
  }
  return result
}

function getCandidateLabel(candidate: CsvSessionCandidate) {
  const dayLabel = candidate.dayOfWeek ? dayNames[candidate.dayOfWeek] ?? candidate.dayOfWeek : ''
  const season = candidate.sessionSeason.trim()
  const year = candidate.sessionYear > 0 ? String(candidate.sessionYear) : ''
  const location = candidate.location.trim()
  return [dayLabel, season, year, location].filter(Boolean).join(' | ')
}

function toGuestCandidates(classesResponse: {
  sessions: Array<{
    sessionKey: string
    dayOfWeek: string
    sessionSeason: string
    sessionYear: number
    location: string
    classCount: number
    studentCount: number
    waitlistCount: number
    courseCodes: string[]
  }>
}): CsvSessionCandidate[] {
  return (classesResponse.sessions ?? []).map(session => ({
    ...session,
    matchedSession: null,
  }))
}

export function CsvImportFlowProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const { accountType, isGuest, user } = useAuth()
  const { setSelectedDay } = useDay()
  const { currentTeamId } = useCurrentTeam()
  const { currentTerm } = useCurrentTerm()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [state, setState] = useState<ModalState>(emptyState)

  const closeModal = () => setState(emptyState)

  const requestCsvFile = () => {
    if (accountType === 'full_time' && !currentTeamId) {
      alert('Select a team before uploading a roster CSV.')
      return
    }
    inputRef.current?.click()
  }

  const inspectCsv = async (file: File) => {
    setState({
      open: true,
      loading: true,
      processing: false,
      error: '',
      file,
      candidates: [],
      classesBySession: {},
    })

    try {
      if (isGuest) {
        const extracted = await extractClassesFromCsv(file)
        const candidates = toGuestCandidates(extracted)
        console.log('[csv-import] inferred session candidates', {
          fileName: file.name,
          accountType,
          scope: 'guest',
          sessions: candidates,
          classesBySession: extracted.classesBySession,
        })
        setState(current => ({
          ...current,
          loading: false,
          candidates,
          classesBySession: extracted.classesBySession ?? {},
          error: candidates.length === 0 ? 'No session candidates were found in this CSV.' : '',
        }))
        return
      }

      const response = await fetchCsvSessionCandidates(
        file,
        accountType === 'full_time' && currentTeamId
          ? {
              teamId: currentTeamId,
            }
          : undefined,
      )
      console.log('[csv-import] inferred session candidates', {
        fileName: file.name,
        accountType,
        scope:
          accountType === 'full_time'
            ? {
                teamId: currentTeamId,
                termKey: currentTerm?.key ?? null,
              }
            : 'part_time',
        sessions: response.sessions ?? [],
        classesBySession: response.classesBySession ?? {},
      })

      setState(current => ({
        ...current,
        loading: false,
        candidates: response.sessions ?? [],
        classesBySession: response.classesBySession ?? {},
        error:
          (response.sessions ?? []).length === 0
            ? 'No session candidates were found in this CSV.'
            : '',
      }))
    } catch (error) {
      setState(current => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to inspect the CSV file.',
      }))
    }
  }

  const createGuestSessionFromCandidate = (candidate: CsvSessionCandidate, fileName: string): CsvSessionRecord => {
    const id = createLocalId()
    const nextSession: StoredSessionEntry = {
      id,
      sessionDay: candidate.dayOfWeek,
      sessionSeason: candidate.sessionSeason,
      sessionYear: candidate.sessionYear || null,
      startDate: candidate.startDate || '',
      endDate: candidate.endDate || '',
      location: candidate.location || null,
      instructors: [],
      rosterFileName: fileName,
    }
    const sessions = loadSessions()
    sessions.push(nextSession)
    saveSessions(sessions)
    return {
      id,
      team_id: null,
      created_by: '',
      session_day: nextSession.sessionDay,
      session_season: nextSession.sessionSeason,
      session_year: nextSession.sessionYear ?? null,
      start_date: nextSession.startDate || null,
      end_date: nextSession.endDate || null,
      location: nextSession.location ?? null,
      instructors: [],
    }
  }

  const createRemoteSessionFromCandidate = async (candidate: CsvSessionCandidate): Promise<CsvSessionRecord> => {
    if (!user) {
      throw new Error('You must be signed in to create a session from CSV.')
    }

    const payload = {
      id: createLocalId(),
      team_id: accountType === 'full_time' ? currentTeamId : null,
      created_by: user.id,
      session_day: candidate.dayOfWeek,
      session_season: candidate.sessionSeason || null,
      session_year: candidate.sessionYear || null,
      start_date: candidate.startDate || null,
      end_date: candidate.endDate || null,
      location: candidate.location || null,
      instructors: [],
    }

    const response = await createSession(payload)
    return response.session as CsvSessionRecord
  }

  const syncPostImportState = async (day: string, session: CsvSessionRecord, ownedByUser: boolean) => {
    if (accountType === 'full_time' && currentTeamId && currentTerm) {
      const flattenedClasses = Object.values(state.classesBySession).flat()
      if (flattenedClasses.length > 0) {
        setExtractedClassesForScope(currentTeamId, currentTerm.key, flattenedClasses)
      }
    }

    if (accountType === 'full_time' || isGuest || !ownedByUser) {
      return
    }

    const sessionLabel = getSessionTermLabel(
      session.session_season,
      session.session_year,
      session.start_date,
    )
    if (!sessionLabel) {
      return
    }

    const students = getStudentsForDay(day)
    if (students.length === 0) {
      return
    }

    const result = await syncReportCardsForDay({
      day,
      students,
      sessionLabel,
      teamId: session.team_id,
    })

    if (result.status === 'blocked_unassigned') {
      alert(
        'Roster uploaded. Report card totals were not synced because some students are missing instructor assignments.',
      )
    }
  }

  const handleSelectCandidate = async (candidate: CsvSessionCandidate) => {
    if (!state.file) {
      return
    }

    setState(current => ({ ...current, processing: true, error: '' }))
    try {
      const matchedSession = candidate.matchedSession
      const targetSession = matchedSession
        ? matchedSession.session
        : isGuest
          ? createGuestSessionFromCandidate(candidate, state.file.name)
          : await createRemoteSessionFromCandidate(candidate)

      setCurrentSessionId(targetSession.id)
      setSelectedDay(candidate.dayOfWeek)

      const uploadInstructors = buildInstructorUploadConfig(candidate.dayOfWeek)
      await processCsvAndStore(state.file, candidate.dayOfWeek, uploadInstructors, {
        courseCodes: (state.classesBySession[candidate.sessionKey] ?? []).map(classEntry => classEntry.courseCode),
      })

      if (accountType !== 'full_time') {
        const extractedClassesForSession = state.classesBySession[candidate.sessionKey] ?? []
        if (extractedClassesForSession.length > 0) {
          setExtractedClassesForSession(targetSession.id, extractedClassesForSession)
        }
      }

      await syncPostImportState(
        candidate.dayOfWeek,
        targetSession,
        matchedSession ? matchedSession.ownedByUser : !isGuest,
      )

      const successLabel = matchedSession ? matchedSession.label : getCandidateLabel(candidate)
      closeModal()
      alert(`Roster uploaded for ${successLabel}.`)
      if (accountType !== 'full_time') {
        navigate('/manage-sessions')
      }
    } catch (error) {
      setState(current => ({
        ...current,
        processing: false,
        error: error instanceof Error ? error.message : 'Failed to import the selected session.',
      }))
    }
  }

  return (
    <CsvImportFlowContext.Provider value={{ requestCsvFile }}>
      {children}
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept=".csv"
        onChange={event => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) {
            return
          }
          void inspectCsv(file)
        }}
      />
      <CsvSessionImportModal
        open={state.open}
        loading={state.loading}
        processing={state.processing}
        error={state.error}
        fileName={state.file?.name ?? ''}
        candidates={state.candidates}
        onClose={closeModal}
        onSelectCandidate={candidate => {
          void handleSelectCandidate(candidate)
        }}
      />
    </CsvImportFlowContext.Provider>
  )
}

export function useCsvImportFlow() {
  const context = useContext(CsvImportFlowContext)
  if (!context) {
    throw new Error('useCsvImportFlow must be used within CsvImportFlowProvider')
  }
  return context
}

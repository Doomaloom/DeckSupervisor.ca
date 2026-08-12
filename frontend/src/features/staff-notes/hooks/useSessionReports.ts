import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { showAppNotice } from '../../../lib/appNotice'
import type { ReportItem, SessionReportData, TabKey } from '../types'
import {
  createEmptyReportData,
  defaultReportTitle,
  normalizeReportData,
  parseStrengthWeakness,
} from '../utils/reportData'
import { buildStorageKey, saveJson } from '../utils/storage'
import { useReportInstructorOptions } from './useReportInstructorOptions'

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

type UseSessionReportsArgs = {
  activeTab: TabKey
  sessionId: string | null
  currentSessionContext: string
  isSessionReady: boolean
  isGuest: boolean
  isFullTime: boolean
  userId: string | null
  accessMode: string | null | undefined
  instructorNames: string[]
}

type ExportStrengthWeaknessEntry = {
  instructor: string
  strengths: string[]
  weaknesses: string[]
}

type ExportPayload = {
  title: string
  sessionContext: string
  authorName: string
  createdAt: string
  updatedAt: string
  staff: {
    performance: { instructor: string; text: string }[]
    strengthWeakness: ExportStrengthWeaknessEntry[]
    successionPlans: { instructor: string; text: string }[]
    instructorCovers: { instructor: string; coveredBy: string; details: string }[]
  }
  lessonStructure: SessionReportData['lessonStructure']
  safetyFacility: SessionReportData['safetyFacility']
  parentCustomerFeedback: SessionReportData['parentCustomerFeedback']
  projectsInitiatives: SessionReportData['projectsInitiatives']
}

export function useSessionReports({
  activeTab,
  sessionId,
  currentSessionContext,
  isSessionReady,
  isGuest,
  isFullTime,
  userId,
  accessMode,
  instructorNames,
}: UseSessionReportsArgs) {
  const [reports, setReports] = useState<ReportItem[]>([])
  const [activeReportId, setActiveReportId] = useState('')
  const [reportTitle, setReportTitle] = useState('')
  const [reportDraft, setReportDraft] = useState<SessionReportData>(() => createEmptyReportData([]))
  const [reportStatus, setReportStatus] = useState('')
  const [isExportingReport, setIsExportingReport] = useState(false)
  const [reportRevision, setReportRevision] = useState(0)
  const [lastSavedReportRevision, setLastSavedReportRevision] = useState(0)
  const reportSaveTimerRef = useRef<number | null>(null)

  const hydrateReportSelection = useCallback(
    (item: ReportItem | null) => {
      if (!item) {
        setActiveReportId('')
        setReportTitle('')
        setReportDraft(createEmptyReportData(instructorNames))
        setReportRevision(0)
        setLastSavedReportRevision(0)
        setReportStatus('')
        return
      }
      setActiveReportId(item.id)
      setReportTitle(item.title)
      setReportDraft(isFullTime ? item.reportData : normalizeReportData(item.reportData, instructorNames))
      setReportRevision(0)
      setLastSavedReportRevision(0)
      setReportStatus('')
    },
    [instructorNames, isFullTime],
  )

  useEffect(
    () => () => {
      if (reportSaveTimerRef.current !== null) {
        window.clearTimeout(reportSaveTimerRef.current)
      }
    },
    [],
  )

  const selectedReport = useMemo(
    () => reports.find(item => item.id === activeReportId) ?? null,
    [activeReportId, reports],
  )

  const canWriteDbReports =
    !isFullTime && Boolean(userId) && (accessMode === 'owner' || accessMode === 'shared')
  const isEditable = isGuest || canWriteDbReports
  const canCreateReports = isEditable && !isFullTime
  const canEditSelectedReport =
    Boolean(selectedReport) &&
    (isGuest ||
      (!isFullTime && Boolean(userId) && (accessMode === 'owner' || selectedReport?.createdBy === userId)))
  const isReportInputDisabled = !isSessionReady || !canEditSelectedReport

  const updateReportDraft = useCallback(
    (updater: (current: SessionReportData) => SessionReportData) => {
      if (!selectedReport || !canEditSelectedReport) {
        return
      }
      setReportDraft(current => {
        const next = updater(current)
        if (next === current) {
          return current
        }
        setReportRevision(value => value + 1)
        setReportStatus('Saving...')
        setReports(rows =>
          rows.map(row => (row.id === selectedReport.id ? { ...row, title: reportTitle, reportData: next } : row)),
        )
        return next
      })
    },
    [canEditSelectedReport, reportTitle, selectedReport],
  )

  const persistReport = useCallback(
    async (revisionToSave: number) => {
      if (activeTab !== 'report') {
        return
      }
      if (!sessionId || !selectedReport || !canEditSelectedReport) {
        return
      }
      if (revisionToSave <= lastSavedReportRevision) {
        return
      }

      const nextTitle = reportTitle.trim() || 'Untitled report'
      const nowIso = new Date().toISOString()

      if (isGuest) {
        const nextReports = reports
          .map(item =>
            item.id === selectedReport.id
              ? {
                  ...item,
                  title: nextTitle,
                  reportData: reportDraft,
                  updatedAt: nowIso,
                }
              : item,
          )
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        setReports(nextReports)
        saveJson(buildStorageKey(sessionId, 'report'), nextReports)
        setLastSavedReportRevision(previous => Math.max(previous, revisionToSave))
        setReportStatus(`Saved locally at ${new Date(nowIso).toLocaleTimeString()}`)
        return
      }

      if (!supabase) {
        setReportStatus('Supabase is not configured for browser report saves.')
        return
      }

      const { data, error } = await supabase
        .from('session_reports')
        .update({
          title: nextTitle,
          report_data: reportDraft,
          updated_at: nowIso,
        })
        .eq('id', selectedReport.id)
        .select('updated_at,title')
        .single()

      if (error) {
        console.error('Failed to autosave report', error)
        setReportStatus(`Autosave failed: ${error.message}`)
        return
      }

      const updatedAt = data?.updated_at ?? nowIso
      setReports(current =>
        current
          .map(item =>
            item.id === selectedReport.id
              ? {
                  ...item,
                  title: data?.title ?? nextTitle,
                  reportData: reportDraft,
                  updatedAt,
                }
              : item,
          )
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
      )
      setReportTitle(data?.title ?? nextTitle)
      setLastSavedReportRevision(previous => Math.max(previous, revisionToSave))
      setReportStatus(`Saved at ${new Date(updatedAt).toLocaleTimeString()}`)
    },
    [
      activeTab,
      canEditSelectedReport,
      isGuest,
      lastSavedReportRevision,
      reportDraft,
      reportTitle,
      reports,
      selectedReport,
      sessionId,
    ],
  )

  const handleSelectReport = useCallback(
    (id: string) => {
      void (async () => {
        if (reportSaveTimerRef.current !== null) {
          window.clearTimeout(reportSaveTimerRef.current)
        }
        await persistReport(reportRevision)
        const next = reports.find(item => item.id === id) ?? null
        hydrateReportSelection(next)
      })()
    },
    [hydrateReportSelection, persistReport, reportRevision, reports],
  )

  const handleCreateReport = useCallback(async () => {
    if (!sessionId || !canCreateReports) {
      return
    }

    if (reportSaveTimerRef.current !== null) {
      window.clearTimeout(reportSaveTimerRef.current)
    }
    await persistReport(reportRevision)

    const nowIso = new Date().toISOString()
    const title = defaultReportTitle()
    const nextReportData = createEmptyReportData(instructorNames)

    if (isGuest) {
      const entry: ReportItem = {
        id: createId(),
        createdAt: nowIso,
        updatedAt: nowIso,
        title,
        reportData: nextReportData,
        authorName: 'Guest',
        sessionContext: currentSessionContext || undefined,
      }
      const next = [entry, ...reports]
      setReports(next)
      saveJson(buildStorageKey(sessionId, 'report'), next)
      hydrateReportSelection(entry)
      setReportStatus('Saved locally')
      return
    }

    if (!userId) {
      return
    }
    if (!supabase) {
      showAppNotice('Supabase is not configured for browser report saves.', 'error')
      return
    }

    const { data, error } = await supabase
      .from('session_reports')
      .insert({
        session_id: sessionId,
        created_by: userId,
        title,
        report_data: nextReportData,
      })
      .select('id,created_by,title,report_data,created_at,updated_at')
      .single()

    if (error || !data) {
      console.error('Failed to create report', error)
      showAppNotice(`Failed to create report: ${error?.message ?? 'Unknown error'}`, 'error')
      return
    }

    const entry: ReportItem = {
      id: data.id,
      createdAt: data.created_at,
      updatedAt: data.updated_at ?? data.created_at,
      title: data.title ?? 'Untitled report',
      reportData: normalizeReportData(data.report_data, instructorNames),
      createdBy: data.created_by,
      authorName: 'You',
      sessionContext: currentSessionContext || undefined,
    }

    setReports(current => [entry, ...current.filter(item => item.id !== entry.id)])
    hydrateReportSelection(entry)
    setReportStatus('Saved')
  }, [
    canCreateReports,
    hydrateReportSelection,
    instructorNames,
    isGuest,
    persistReport,
    currentSessionContext,
    reportRevision,
    reports,
    sessionId,
    userId,
  ])

  const handleDeleteReport = useCallback(async () => {
    if (!sessionId || !selectedReport || !canEditSelectedReport) {
      return
    }
    if (reportSaveTimerRef.current !== null) {
      window.clearTimeout(reportSaveTimerRef.current)
    }
    await persistReport(reportRevision)
    if (!confirm('Delete this report? This action cannot be undone.')) {
      return
    }

    if (isGuest) {
      const next = reports.filter(item => item.id !== selectedReport.id)
      setReports(next)
      saveJson(buildStorageKey(sessionId, 'report'), next)
      hydrateReportSelection(next[0] ?? null)
      return
    }

    if (!supabase) {
      showAppNotice('Supabase is not configured for browser report saves.', 'error')
      return
    }

    const { error } = await supabase.from('session_reports').delete().eq('id', selectedReport.id)
    if (error) {
      console.error('Failed to delete report', error)
      showAppNotice(`Failed to delete report: ${error.message}`, 'error')
      return
    }

    const next = reports.filter(item => item.id !== selectedReport.id)
    setReports(next)
    hydrateReportSelection(next[0] ?? null)
  }, [
    canEditSelectedReport,
    hydrateReportSelection,
    isGuest,
    persistReport,
    reportRevision,
    reports,
    selectedReport,
    sessionId,
  ])

  const handleExportReport = useCallback(async () => {
    if (!selectedReport) {
      return
    }

    if (reportSaveTimerRef.current !== null) {
      window.clearTimeout(reportSaveTimerRef.current)
    }
    await persistReport(reportRevision)

    const normalizedTitle = reportTitle.trim() || selectedReport.title || 'Session Report'
    const strengthWeakness = reportDraft.staff.strengthWeakness
      .map(entry => {
        const parsed = parseStrengthWeakness(entry.text)
        return {
          instructor: entry.instructor.trim(),
          strengths: parsed.strengths.map(item => item.trim()).filter(Boolean),
          weaknesses: parsed.weaknesses.map(item => item.trim()).filter(Boolean),
        }
      })
      .filter(entry => entry.instructor || entry.strengths.length > 0 || entry.weaknesses.length > 0)

    const payload: ExportPayload = {
      title: normalizedTitle,
      sessionContext: selectedReport.sessionContext || currentSessionContext,
      authorName: selectedReport.authorName ?? '',
      createdAt: selectedReport.createdAt,
      updatedAt: selectedReport.updatedAt,
      staff: {
        performance: reportDraft.staff.performance
          .map(entry => ({
            instructor: entry.instructor.trim(),
            text: entry.text,
          }))
          .filter(entry => entry.instructor || entry.text.trim()),
        strengthWeakness,
        successionPlans: reportDraft.staff.successionPlans
          .map(entry => ({
            instructor: entry.instructor.trim(),
            text: entry.text,
          }))
          .filter(entry => entry.instructor || entry.text.trim()),
        instructorCovers: reportDraft.staff.instructorCovers
          .map(entry => ({
            instructor: entry.instructor.trim(),
            coveredBy: entry.coveredBy.trim(),
            details: entry.details,
          }))
          .filter(entry => entry.instructor || entry.coveredBy || entry.details.trim()),
      },
      lessonStructure: reportDraft.lessonStructure,
      safetyFacility: reportDraft.safetyFacility,
      parentCustomerFeedback: reportDraft.parentCustomerFeedback,
      projectsInitiatives: reportDraft.projectsInitiatives,
    }

    setIsExportingReport(true)
    try {
      const { generateSessionReportPdf } = await import('../../pdf')
      const { blob: pdfBlob, filename } = await generateSessionReportPdf(payload)

      const blobURL = window.URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = blobURL
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(blobURL)
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : 'Failed to export report PDF.'
      showAppNotice(message, 'error')
    } finally {
      setIsExportingReport(false)
    }
  }, [currentSessionContext, persistReport, reportDraft, reportRevision, reportTitle, selectedReport])

  useEffect(() => {
    if (activeTab !== 'report') {
      return
    }
    if (!sessionId || !selectedReport || !canEditSelectedReport) {
      return
    }
    if (reportRevision === lastSavedReportRevision) {
      return
    }

    if (reportSaveTimerRef.current !== null) {
      window.clearTimeout(reportSaveTimerRef.current)
    }

    const revisionToSave = reportRevision
    const timeout = window.setTimeout(() => {
      void persistReport(revisionToSave)
    }, 1000)

    reportSaveTimerRef.current = timeout
    return () => {
      window.clearTimeout(timeout)
    }
  }, [
    activeTab,
    canEditSelectedReport,
    lastSavedReportRevision,
    persistReport,
    reportRevision,
    selectedReport,
    sessionId,
  ])

  const handleReportTitleChange = useCallback(
    (value: string) => {
      if (!canEditSelectedReport || !selectedReport) {
        return
      }
      setReportTitle(value)
      setReportRevision(count => count + 1)
      setReportStatus('Saving...')
      setReports(current =>
        current.map(row =>
          row.id === selectedReport.id ? { ...row, title: value, reportData: reportDraft } : row,
        ),
      )
    },
    [canEditSelectedReport, reportDraft, selectedReport],
  )

  const setLoadedReports = useCallback(
    (nextReports: ReportItem[]) => {
      setReports(nextReports)
      hydrateReportSelection(nextReports[0] ?? null)
    },
    [hydrateReportSelection],
  )

  const clearReports = useCallback(() => {
    setReports([])
    hydrateReportSelection(null)
  }, [hydrateReportSelection])

  const reportInstructorOptions = useReportInstructorOptions(instructorNames, reportDraft)

  return {
    reports,
    activeReportId,
    reportTitle,
    reportDraft,
    reportStatus,
    isExportingReport,
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
    setLoadedReports,
    clearReports,
  }
}

import { useEffect, useState } from 'react'
import { useAuth } from '../../app/AuthContext'
import { useDay } from '../../app/DayContext'
import { useCurrentSession } from '../../app/useCurrentSession'
import { useCurrentTerm } from '../../app/useCurrentTerm'
import PrintPopupBlockedNotice from '../../components/PrintPopupBlockedNotice'
import {
  getCustomRosterDayKey,
  getCustomRostersForDay,
  getFormatOptions,
  getMasterlistDraftOptions,
  getStudentsForDay,
  setMasterlistDraftOptions,
} from '../../lib/storage'
import { ensureCachedSchematicPdf } from '../../lib/printPdfCache'
import { getStorageScope } from '../../lib/storageScope'
import { getCurrentSessionId } from '../../lib/sessionStorage'
import { openAttendancePrintWindow } from '../attendance-print/openAttendancePrintWindow'
import { buildAttendancePrintItems, buildCustomRosterGroups, buildRosterGroups } from '../rosters/utils'
import { printOptions } from './constants'
import type {
  BooleanFormatOptionKey,
  FormatOptions,
  MasterlistAlphabeticalNameBasis,
  MasterlistLayout,
} from '../../types/app'
import type { PrintOptionKey } from './types'
import { openPdfPrintDialog, openPrintWindow } from '../../lib/browserPrint'
import { useSessionInstructors } from './hooks/useSessionInstructors'
import Day1OptionsModal from './components/Day1OptionsModal'
import InstructorOptionsModal from './components/InstructorOptionsModal'
import MasterlistOptionsModal from './components/MasterlistOptionsModal'
import PrintOptionButton from './components/PrintOptionButton'
import SchematicOptionsModal from './components/SchematicOptionsModal'
import { useSchematicSchedule } from '../schematic/hooks/useSchematicSchedule'
import { getCapacity } from '../schematic/utils/capacity'
import {
  fetchBlankPdf,
  fetchMasterlistPdf,
  fetchMasterlistPreviewPdf,
  fetchSchematicPdf,
} from './utils/printApi'
import {
  buildMasterlistRequestBody,
  buildDateRangeLabel,
  buildSessionTitle,
  buildWeeksLabel,
} from './utils/printPayloads'

const MASTERLIST_FONT_SIZE_MIN = 8
const MASTERLIST_FONT_SIZE_MAX = 18
const SCHEMATIC_SCALE_MIN = 60
const SCHEMATIC_SCALE_MAX = 120
const SCHEMATIC_SCALE_STEP = 5

const toFileToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const buildPdfFilename = (...parts: Array<string | null | undefined>) => {
  const filtered = parts.map(part => (part ? toFileToken(part) : '')).filter(Boolean)
  return `${filtered.join('-') || 'print'}.pdf`
}

const clampMasterlistFontSize = (value: number) =>
  Math.min(MASTERLIST_FONT_SIZE_MAX, Math.max(MASTERLIST_FONT_SIZE_MIN, Math.round(value)))

const clampSchematicScalePercent = (value: number) => {
  if (!Number.isFinite(value)) {
    return 100
  }
  const stepped = Math.round(value / SCHEMATIC_SCALE_STEP) * SCHEMATIC_SCALE_STEP
  return Math.min(SCHEMATIC_SCALE_MAX, Math.max(SCHEMATIC_SCALE_MIN, stepped))
}

type BlockedPrintJob = {
  jobLabel: string
  filename?: string
  pdfBlob?: Blob
  retry: () => void
}

function PrintPage() {
  const { profile } = useAuth()
  const { selectedDay } = useDay()
  const { session: currentSession } = useCurrentSession()
  const { currentTerm } = useCurrentTerm()
  const [activeInfo, setActiveInfo] = useState<PrintOptionKey | null>(null)
  const [activeModal, setActiveModal] = useState<PrintOptionKey | null>(null)
  const instructorNames = useSessionInstructors(
    activeModal === 'instructors' || activeModal === 'schematic',
  )
  const [day1Options, setDay1Options] = useState({
    schematicCoverPage: false,
    highlightInstructorName: false,
    customMasterlistFormat: false,
  })
  const [busyInstructors, setBusyInstructors] = useState<Record<string, boolean>>({})
  const [isPrintingAllInstructors, setIsPrintingAllInstructors] = useState(false)
  const [instructorExtras, setInstructorExtras] = useState({
    schematicCoverPage: false,
    highlightCoverInstructor: false,
  })
  const [instructorCoverOrientation, setInstructorCoverOrientation] = useState<
    'portrait' | 'landscape'
  >('portrait')
  const [masterlistExtras, setMasterlistExtras] = useState({
    schematicCoverPage: false,
  })
  const [coverOrientation, setCoverOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const [masterlistFormatOptions, setMasterlistFormatOptions] = useState<FormatOptions>(() =>
    getMasterlistDraftOptions(),
  )
  const [masterlistPreviewUrl, setMasterlistPreviewUrl] = useState<string | null>(null)
  const [isMasterlistPreviewLoading, setIsMasterlistPreviewLoading] = useState(false)
  const [masterlistPreviewError, setMasterlistPreviewError] = useState<string | null>(null)
  const [blockedPrintJob, setBlockedPrintJob] = useState<BlockedPrintJob | null>(null)
  const [schematicOptions, setSchematicOptions] = useState<{
    highlightInstructor: boolean
    selectedInstructor: string
    orientation: 'portrait' | 'landscape'
  }>({
    highlightInstructor: false,
    selectedInstructor: 'none',
    orientation: 'portrait',
  })
  const [schematicScalePercent, setSchematicScalePercent] = useState(100)
  const [schematicPreviewUrl, setSchematicPreviewUrl] = useState<string | null>(null)
  const [isSchematicPreviewLoading, setIsSchematicPreviewLoading] = useState(false)
  const [schematicPreviewError, setSchematicPreviewError] = useState<string | null>(null)
  const schematicPreview = useSchematicSchedule(selectedDay ?? null)
  const sessionInfo = currentSession
  const sessionTitle = buildSessionTitle(sessionInfo, selectedDay, currentTerm)
  const dateRange = buildDateRangeLabel(sessionInfo)
  const weeksLabel = buildWeeksLabel(sessionInfo)
  const deckSupervisorName = profile?.first_name?.trim() ?? ''

  useEffect(() => {
    if (!activeModal) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveModal(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeModal])

  useEffect(() => {
    if (activeModal !== 'masterlist') {
      return
    }
    setMasterlistFormatOptions(getMasterlistDraftOptions())
  }, [activeModal])

  useEffect(() => {
    if (activeModal !== 'masterlist') {
      setIsMasterlistPreviewLoading(false)
      setMasterlistPreviewError(null)
      setMasterlistPreviewUrl(current => {
        if (current) URL.revokeObjectURL(current)
        return null
      })
      return
    }

    if (!selectedDay) {
      setMasterlistPreviewUrl(current => {
        if (current) URL.revokeObjectURL(current)
        return null
      })
      setMasterlistPreviewError('Select a day to preview the masterlist.')
      setIsMasterlistPreviewLoading(false)
      return
    }

    const body = buildMasterlistRequestBody({
      day: selectedDay,
      sessionId: getCurrentSessionId(),
      session: currentSession,
      term: currentTerm,
      options: masterlistFormatOptions,
    })

    if (!body) {
      setMasterlistPreviewUrl(current => {
        if (current) URL.revokeObjectURL(current)
        return null
      })
      setMasterlistPreviewError('No roster data found for the selected day.')
      setIsMasterlistPreviewLoading(false)
      return
    }

    let active = true
    let objectUrl: string | null = null
    const timeoutId = window.setTimeout(() => {
      setIsMasterlistPreviewLoading(true)
      setMasterlistPreviewError(null)

      fetchMasterlistPreviewPdf(body)
        .then(blob => {
          objectUrl = URL.createObjectURL(blob)
          if (!active) {
            URL.revokeObjectURL(objectUrl)
            return
          }
          setMasterlistPreviewUrl(current => {
            if (current) URL.revokeObjectURL(current)
            return objectUrl
          })
          setMasterlistPreviewError(null)
        })
        .catch(error => {
          if (!active) {
            return
          }
          console.error(error)
          const message =
            error instanceof Error && error.message
              ? error.message
              : 'Unable to load the masterlist preview.'
          setMasterlistPreviewError(message)
        })
        .finally(() => {
          if (active) {
            setIsMasterlistPreviewLoading(false)
          }
        })
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timeoutId)
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [
    activeModal,
    currentSession,
    currentTerm,
    masterlistFormatOptions,
    selectedDay,
  ])

  useEffect(() => {
    if (!schematicOptions.highlightInstructor) {
      if (schematicOptions.selectedInstructor !== 'none') {
        setSchematicOptions(current => ({ ...current, selectedInstructor: 'none' }))
      }
      return
    }
    if (!instructorNames.length) {
      if (schematicOptions.selectedInstructor !== 'one-each') {
        setSchematicOptions(current => ({ ...current, selectedInstructor: 'one-each' }))
      }
      return
    }
    if (
      schematicOptions.selectedInstructor === 'one-each' ||
      instructorNames.includes(schematicOptions.selectedInstructor)
    ) {
      return
    }
    setSchematicOptions(current => ({ ...current, selectedInstructor: 'one-each' }))
  }, [
    instructorNames,
    schematicOptions.highlightInstructor,
    schematicOptions.selectedInstructor,
  ])

  const clearBlockedPrintJob = () => {
    setBlockedPrintJob(null)
  }

  const blockedPrintNotice = blockedPrintJob ? (
    <PrintPopupBlockedNotice
      jobLabel={blockedPrintJob.jobLabel}
      pdfBlob={blockedPrintJob.pdfBlob}
      filename={blockedPrintJob.filename}
      onRetry={blockedPrintJob.retry}
      onDismiss={clearBlockedPrintJob}
    />
  ) : null

  const handleToggleInfo = (key: PrintOptionKey) => {
    setActiveInfo(current => (current === key ? null : key))
  }

  const handleToggleDay1Option = (key: keyof typeof day1Options) => {
    setDay1Options(current => {
      if (key === 'schematicCoverPage') {
        const nextCoverPage = !current.schematicCoverPage
        return {
          ...current,
          schematicCoverPage: nextCoverPage,
          highlightInstructorName: nextCoverPage ? current.highlightInstructorName : false,
        }
      }
      if (key === 'highlightInstructorName' && !current.schematicCoverPage) {
        return current
      }
      return {
        ...current,
        [key]: !current[key],
      }
    })
  }

  const handleToggleMasterlistExtra = (key: keyof typeof masterlistExtras) => {
    setMasterlistExtras(current => ({
      ...current,
      [key]: !current[key],
    }))
  }

  const handleToggleInstructorCover = () => {
    setInstructorExtras(current => ({
      ...current,
      schematicCoverPage: !current.schematicCoverPage,
    }))
  }

  const handleToggleInstructorCoverHighlight = () => {
    setInstructorExtras(current => ({
      ...current,
      highlightCoverInstructor: !current.highlightCoverInstructor,
    }))
  }

  const handleToggleMasterlistOption = (key: BooleanFormatOptionKey) => {
    setMasterlistFormatOptions(current => {
      const next = {
        ...current,
        [key]: !current[key],
      }
      setMasterlistDraftOptions(next)
      return next
    })
  }

  const handleChangeMasterlistFontSize = (value: string) => {
    const parsed = Number(value)
    const nextFontSize = Number.isFinite(parsed)
      ? clampMasterlistFontSize(parsed)
      : MASTERLIST_FONT_SIZE_MIN

    setMasterlistFormatOptions(current => {
      const next = {
        ...current,
        font_size: nextFontSize,
      }
      setMasterlistDraftOptions(next)
      return next
    })
  }

  const handleChangeMasterlistLayout = (layout: MasterlistLayout) => {
    setMasterlistFormatOptions(current => {
      const next = { ...current, layout }
      setMasterlistDraftOptions(next)
      return next
    })
  }

  const handleChangeMasterlistAlphabeticalNameBasis = (
    alphabeticalNameBasis: MasterlistAlphabeticalNameBasis,
  ) => {
    setMasterlistFormatOptions(current => {
      const next = { ...current, alphabetical_name_basis: alphabeticalNameBasis }
      setMasterlistDraftOptions(next)
      return next
    })
  }

  const handleChangeSchematicScale = (value: number) => {
    setSchematicScalePercent(clampSchematicScalePercent(value))
  }

  const handleResetSchematicScale = () => {
    setSchematicScalePercent(100)
  }

  const handleToggleSchematicHighlight = () => {
    setSchematicOptions(current => {
      const nextHighlight = !current.highlightInstructor
      let nextSelected = current.selectedInstructor
      if (!nextHighlight) {
        nextSelected = 'none'
      } else if (nextSelected === 'none') {
        nextSelected = 'one-each'
      }
      return {
        ...current,
        highlightInstructor: nextHighlight,
        selectedInstructor: nextSelected,
      }
    })
  }

  const handleSelectSchematicOrientation = (value: 'portrait' | 'landscape') => {
    setSchematicOptions(current => ({
      ...current,
      orientation: value,
    }))
  }

  const buildSchematicPayload = (
    orientation: 'portrait' | 'landscape',
    highlightOptions: { highlightInstructor: boolean; selectedInstructor: string } = {
      highlightInstructor: false,
      selectedInstructor: 'none',
    },
    instructorsOverride?: string[],
  ) => ({
    orientation,
    scalePercent: schematicScalePercent,
    title: sessionTitle,
    dateRange,
    weeksLabel,
    deckSupervisorName,
    highlightInstructor: highlightOptions.highlightInstructor,
    selectedInstructor: highlightOptions.selectedInstructor,
    instructors: instructorsOverride ?? schematicPreview.instructors,
    columns: schematicPreview.columns.map(column =>
      column.map(course => ({
        code: course.code,
        level: course.level,
        startMinutes: course.startMinutes,
        durationMinutes: course.runningTime || course.endMinutes - course.startMinutes,
        studentCount: course.studentCount,
        capacity: getCapacity(course),
      })),
    ),
  })

  const getCachedSchematicPdf = async (payload: ReturnType<typeof buildSchematicPayload> & {
    rotateCounterClockwise90?: boolean
  }) => {
    if (!selectedDay) {
      throw new Error('Please select a day before printing the schematic.')
    }
    const sessionId = getCurrentSessionId()
    if (!sessionId) {
      throw new Error('Please select a session before printing.')
    }
    const requestKey = JSON.stringify(payload)
    return ensureCachedSchematicPdf(sessionId, selectedDay, requestKey, () => fetchSchematicPdf(payload))
  }

  useEffect(() => {
    if (activeModal !== 'schematic') {
      setIsSchematicPreviewLoading(false)
      setSchematicPreviewError(null)
      setSchematicPreviewUrl(current => {
        if (current) {
          URL.revokeObjectURL(current)
        }
        return null
      })
      return
    }

    setSchematicPreviewUrl(current => {
      if (current) {
        URL.revokeObjectURL(current)
      }
      return null
    })

    if (!selectedDay) {
      setSchematicPreviewError('Select a day to preview the schematic.')
      setIsSchematicPreviewLoading(false)
      return
    }

    if (schematicPreview.columns.length === 0) {
      setSchematicPreviewError('No schematic data found for the selected day.')
      setIsSchematicPreviewLoading(false)
      return
    }

    let active = true
    let objectUrl: string | null = null
    const timeoutId = window.setTimeout(() => {
      setIsSchematicPreviewLoading(true)
      setSchematicPreviewError(null)

      const highlightOptions =
        schematicOptions.highlightInstructor && schematicOptions.selectedInstructor !== 'one-each'
          ? {
              highlightInstructor: true,
              selectedInstructor: schematicOptions.selectedInstructor,
            }
          : {
              highlightInstructor: false,
              selectedInstructor: 'none',
            }

      const payload = buildSchematicPayload(schematicOptions.orientation, highlightOptions)

      getCachedSchematicPdf(payload)
        .then(blob => {
          objectUrl = URL.createObjectURL(blob)
          if (!active) {
            URL.revokeObjectURL(objectUrl)
            return
          }
          setSchematicPreviewUrl(current => {
            if (current) {
              URL.revokeObjectURL(current)
            }
            return objectUrl
          })
          setSchematicPreviewError(null)
        })
        .catch(error => {
          if (!active) {
            return
          }
          console.error(error)
          const message =
            error instanceof Error && error.message
              ? error.message
              : 'Unable to load the schematic preview.'
          setSchematicPreviewError(message)
        })
        .finally(() => {
          if (active) {
            setIsSchematicPreviewLoading(false)
          }
        })
    }, 300)

    return () => {
      active = false
      window.clearTimeout(timeoutId)
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [
    activeModal,
    dateRange,
    deckSupervisorName,
    schematicOptions.highlightInstructor,
    schematicOptions.orientation,
    schematicOptions.selectedInstructor,
    schematicPreview.columns,
    schematicPreview.instructors,
    schematicScalePercent,
    selectedDay,
    sessionTitle,
    weeksLabel,
  ])

  const fetchSchematicCoverWithBlank = async (
    orientation: 'portrait' | 'landscape',
    highlightOptions?: { highlightInstructor: boolean; selectedInstructor: string },
    rotateForInstructorSheets = false,
  ) => {
    if (schematicPreview.columns.length === 0) {
      throw new Error('No schematic data found for the selected day.')
    }

    const shouldRotateCounterClockwise90 =
      rotateForInstructorSheets && orientation === 'portrait'
    const schematicCover = await getCachedSchematicPdf({
      ...buildSchematicPayload(
        orientation,
        highlightOptions ?? { highlightInstructor: false, selectedInstructor: 'none' },
      ),
      rotateCounterClockwise90: shouldRotateCounterClockwise90,
    })
    const blankPage = await fetchBlankPdf({
      orientation,
      rotateCounterClockwise90: shouldRotateCounterClockwise90,
    })

    return { schematicCover, blankPage }
  }

  const handlePrintSchematic = async () => {
    if (!selectedDay) {
      alert('Please select a day before printing the schematic.')
      return
    }
    if (schematicPreview.columns.length === 0) {
      alert('No schematic data found for the selected day.')
      return
    }

    clearBlockedPrintJob()
    const printWindow = openPrintWindow('Schematic')

    try {
      const highlightOptions = {
        highlightInstructor: schematicOptions.highlightInstructor,
        selectedInstructor: schematicOptions.selectedInstructor,
      }

      if (
        highlightOptions.highlightInstructor &&
        highlightOptions.selectedInstructor === 'one-each'
      ) {
        const columnCount = Math.max(
          schematicPreview.columns.length,
          schematicPreview.instructors.length,
          1,
        )
        const instructorLabels = Array.from({ length: columnCount }).map((_, index) => {
          const name = schematicPreview.instructors[index]?.trim()
          return name || `Instructor ${index + 1}`
        })

        const pdfs: Blob[] = []
        for (const name of instructorLabels) {
          const payload = buildSchematicPayload(
            schematicOptions.orientation,
            { highlightInstructor: true, selectedInstructor: name },
            instructorLabels,
          )
          pdfs.push(await getCachedSchematicPdf(payload))
        }

        const combined = await concatPdfs(
          pdfs.map((pdf, index) => ({ blob: pdf, filename: `schematic-${index + 1}.pdf` })),
          { filename: 'schematic', title: 'Schematic' },
        )
        if (
          !printWindow ||
          !openPdfPrintDialog(combined, printWindow, {
            title: 'Schematic',
            filename: 'schematic.pdf',
          })
        ) {
          setBlockedPrintJob({
            jobLabel: 'Schematic',
            filename: 'schematic.pdf',
            pdfBlob: combined,
            retry: () => {
              void handlePrintSchematic()
            },
          })
        }
      } else {
        const payload = buildSchematicPayload(schematicOptions.orientation, highlightOptions)
        const pdfBlob = await getCachedSchematicPdf(payload)
        if (
          !printWindow ||
          !openPdfPrintDialog(pdfBlob, printWindow, {
            title: 'Schematic',
            filename: 'schematic.pdf',
          })
        ) {
          setBlockedPrintJob({
            jobLabel: 'Schematic',
            filename: 'schematic.pdf',
            pdfBlob,
            retry: () => {
              void handlePrintSchematic()
            },
          })
        }
      }
    } catch (error) {
      console.error(error)
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Unable to generate the schematic PDF. Please try again.'
      alert(message)
      printWindow?.close()
    }
  }

  const buildRosterGroupsForDay = (day: string) => {
    const students = getStudentsForDay(day)
    const rosterGroups = buildRosterGroups(students)
    if (!day) {
      return rosterGroups
    }
    const customDayKey = getCustomRosterDayKey(
      day,
      currentSession?.id ?? getCurrentSessionId(),
      getStorageScope() === 'guest',
    )
    const customRosters = getCustomRostersForDay(customDayKey)
    if (customRosters.length === 0) {
      return rosterGroups
    }
    const rosterByCode = new Map(rosterGroups.map(roster => [roster.code, roster]))
    const studentsById = new Map(students.map(student => [student.id, student]))
    const customGroups = buildCustomRosterGroups(customRosters, rosterByCode, studentsById)
    return [...rosterGroups, ...customGroups]
  }

  const concatPdfs = async (
    pdfs: Array<{ blob: Blob; filename: string }>,
    options: { filename: string; title: string },
  ) => {
    const { mergePdfs } = await import('../pdf')
    return mergePdfs(pdfs.map(pdf => pdf.blob), options)
  }

  const groupRostersByInstructor = (rosterGroups: ReturnType<typeof buildRosterGroups>) => {
    const grouped = new Map<string, typeof rosterGroups>()
    rosterGroups.forEach(roster => {
      const name = roster.instructor?.trim()
      if (!name) {
        return
      }
      const existing = grouped.get(name)
      if (existing) {
        existing.push(roster)
      } else {
        grouped.set(name, [roster])
      }
    })
    return grouped
  }

  const handlePrintAllInstructorSheets = async () => {
    if (!selectedDay) {
      alert('Please select a day before printing instructor sheets.')
      return
    }

    const rosterGroups = buildRosterGroupsForDay(selectedDay)
    if (rosterGroups.length === 0) {
      alert('No roster data found for the selected day.')
      return
    }

    clearBlockedPrintJob()
    const printWindow = openAttendancePrintWindow('Instructor Sheets')
    if (!printWindow) {
      setBlockedPrintJob({ jobLabel: 'Instructor Sheets', retry: () => { void handlePrintAllInstructorSheets() } })
      return
    }

    setIsPrintingAllInstructors(true)

    try {
      const grouped = groupRostersByInstructor(rosterGroups)
      const orderedNames =
        instructorNames.length > 0
          ? instructorNames.filter(name => grouped.has(name))
          : Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b))

      if (orderedNames.length === 0) {
        alert('No instructor sheets available to print.')
        printWindow?.close()
        return
      }

      const rosters = orderedNames.flatMap(name => (grouped.get(name) ?? []).flatMap(roster => buildAttendancePrintItems(roster)))
      const { printAttendanceHtml } = await import('../attendance-print/printAttendanceHtml')
      const result = await printAttendanceHtml({ session: sessionTitle, title: 'Instructor Sheets', rosters }, printWindow, {
        ...(instructorExtras.schematicCoverPage ? {
          schematicCover: {
            request: buildSchematicPayload(instructorCoverOrientation, { highlightInstructor: false, selectedInstructor: 'none' }),
            highlightEachInstructor: instructorExtras.highlightCoverInstructor,
            blankBack: true,
          },
        } : {}),
      })
      if (result.status === 'failed') throw result.error
    } catch (error) {
      console.error(error)
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Unable to generate instructor sheets. Please try again.'
      alert(message)
      printWindow?.close()
    } finally {
      setIsPrintingAllInstructors(false)
    }
  }

  const handlePrintInstructorSheet = async (name: string) => {
    if (!selectedDay) {
      alert('Please select a day before printing instructor sheets.')
      return
    }

    if (!name) {
      alert('Select an instructor to print.')
      return
    }

    const rosterGroups = buildRosterGroupsForDay(selectedDay)
    if (rosterGroups.length === 0) {
      alert('No roster data found for the selected day.')
      return
    }

    clearBlockedPrintJob()
    const printWindow = openAttendancePrintWindow(`Instructor - ${name}`)
    if (!printWindow) {
      setBlockedPrintJob({ jobLabel: `Instructor - ${name}`, retry: () => { void handlePrintInstructorSheet(name) } })
      return
    }

    setBusyInstructors(current => ({
      ...current,
      [name]: true,
    }))

    try {
      const grouped = groupRostersByInstructor(rosterGroups)
      const rosters = (grouped.get(name) ?? []).flatMap(roster => buildAttendancePrintItems(roster))
      const { printAttendanceHtml } = await import('../attendance-print/printAttendanceHtml')
      const result = await printAttendanceHtml({ session: sessionTitle, title: `Instructor - ${name}`, rosters }, printWindow, {
        ...(instructorExtras.schematicCoverPage ? {
          schematicCover: {
            request: buildSchematicPayload(instructorCoverOrientation, {
              highlightInstructor: instructorExtras.highlightCoverInstructor,
              selectedInstructor: instructorExtras.highlightCoverInstructor ? name : 'none',
            }),
            highlightEachInstructor: instructorExtras.highlightCoverInstructor,
            blankBack: true,
          },
        } : {}),
      })
      if (result.status === 'failed') throw result.error
    } catch (error) {
      console.error(error)
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Unable to generate instructor sheets. Please try again.'
      alert(message)
      printWindow?.close()
    } finally {
      setBusyInstructors(current => ({
        ...current,
        [name]: false,
      }))
    }
  }

  const handlePrintMasterlist = async () => {
    if (!selectedDay) {
      alert('Please select a day before printing the masterlist.')
      return
    }

    const rosterGroups = buildRosterGroupsForDay(selectedDay)
    if (rosterGroups.length === 0) {
      alert('No roster data found for the selected day.')
      return
    }

    clearBlockedPrintJob()
    const printWindow = openPrintWindow('Masterlist')

    try {
      const masterlistBody = buildMasterlistRequestBody({
        day: selectedDay,
        sessionId: getCurrentSessionId(),
        session: currentSession,
        term: currentTerm,
        options: masterlistFormatOptions,
      })
      if (!masterlistBody) {
        throw new Error('No roster data found for the selected day.')
      }
      let schematicCover: Blob | null = null
      let schematicBlank: Blob | null = null
      if (masterlistExtras.schematicCoverPage) {
        const result = await fetchSchematicCoverWithBlank(coverOrientation)
        schematicCover = result.schematicCover
        schematicBlank = result.blankPage
      }

      const masterlistBlob = await fetchMasterlistPdf(masterlistBody)

      if (schematicCover) {
        const combined = await concatPdfs(
          [
            { blob: schematicCover, filename: 'schematic-cover.pdf' },
            ...(schematicBlank ? [{ blob: schematicBlank, filename: 'schematic-blank.pdf' }] : []),
            { blob: masterlistBlob, filename: 'masterlist.pdf' },
          ],
          { filename: 'masterlist', title: 'Masterlist' },
        )
        if (
          !printWindow ||
          !openPdfPrintDialog(combined, printWindow, {
            title: 'Masterlist',
            filename: 'masterlist.pdf',
          })
        ) {
          setBlockedPrintJob({
            jobLabel: 'Masterlist',
            filename: 'masterlist.pdf',
            pdfBlob: combined,
            retry: () => {
              void handlePrintMasterlist()
            },
          })
        }
      } else {
        if (
          !printWindow ||
          !openPdfPrintDialog(masterlistBlob, printWindow, {
            title: 'Masterlist',
            filename: 'masterlist.pdf',
          })
        ) {
          setBlockedPrintJob({
            jobLabel: 'Masterlist',
            filename: 'masterlist.pdf',
            pdfBlob: masterlistBlob,
            retry: () => {
              void handlePrintMasterlist()
            },
          })
        }
      }
    } catch (error) {
      console.error(error)
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Unable to generate masterlist. Please try again.'
      alert(message)
      printWindow?.close()
    }
  }

  const buildDay1MasterlistBlob = async () => {
    if (!selectedDay) {
      throw new Error('Please select a day before printing Day 1 materials.')
    }

    const body = buildMasterlistRequestBody({
      day: selectedDay,
      sessionId: getCurrentSessionId(),
      session: currentSession,
      term: currentTerm,
      options: day1Options.customMasterlistFormat ? masterlistFormatOptions : getFormatOptions(),
    })
    if (!body) {
      throw new Error('No roster data found for the selected day.')
    }

    const masterlistBlob = await fetchMasterlistPdf(body)
    const pdfs: Array<{ blob: Blob; filename: string }> = []

    if (day1Options.schematicCoverPage) {
      const result = await fetchSchematicCoverWithBlank(coverOrientation)
      pdfs.push({ blob: result.schematicCover, filename: 'schematic-cover.pdf' })
      pdfs.push({ blob: result.blankPage, filename: 'schematic-blank.pdf' })
    }

    pdfs.push({ blob: masterlistBlob, filename: 'masterlist.pdf' })

    if (pdfs.length === 1) {
      return masterlistBlob
    }

    return concatPdfs(pdfs, { filename: 'day1-masterlist', title: 'Masterlist' })
  }

  const handlePrintDay1 = async () => {
    if (!selectedDay) {
      alert('Please select a day before printing Day 1 materials.')
      return
    }

    if (schematicPreview.columns.length === 0) {
      alert('No schematic data found for the selected day.')
      return
    }

    const rosterGroups = buildRosterGroupsForDay(selectedDay)
    if (rosterGroups.length === 0) {
      alert('No roster data found for the selected day.')
      return
    }

    const grouped = groupRostersByInstructor(rosterGroups)
    const orderedNames =
      instructorNames.length > 0
        ? instructorNames.filter(name => grouped.has(name))
        : Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b))

    if (orderedNames.length === 0) {
      alert('No instructor sheets available to print.')
      return
    }

    clearBlockedPrintJob()
    const printWindows = [
      openPrintWindow('Schematic'),
      openPrintWindow('Masterlist'),
      openAttendancePrintWindow('Day 1 Instructor Sheets'),
    ]
    const popupBlocked = printWindows.some(windowRef => !windowRef)

    if (popupBlocked) {
      printWindows.forEach(windowRef => windowRef?.close())
      setBlockedPrintJob({ jobLabel: 'Day 1 Materials', retry: () => { void handlePrintDay1() } })
      return
    }

    try {
      const schematicBlob = await getCachedSchematicPdf(
        buildSchematicPayload(schematicOptions.orientation, {
          highlightInstructor: false,
          selectedInstructor: 'none',
        }),
      )
      const masterlistBlob = await buildDay1MasterlistBlob()
      const attendanceRosters = orderedNames.flatMap(name =>
        (grouped.get(name) ?? []).flatMap(roster => buildAttendancePrintItems(roster)),
      )

      openPdfPrintDialog(schematicBlob, printWindows[0], {
        title: 'Schematic',
        filename: 'schematic.pdf',
      })
      openPdfPrintDialog(masterlistBlob, printWindows[1], {
        title: 'Masterlist',
        filename: 'masterlist.pdf',
      })
      const { printAttendanceHtml } = await import('../attendance-print/printAttendanceHtml')
      const attendanceResult = await printAttendanceHtml({
        session: sessionTitle,
        title: 'Day 1 Instructor Sheets',
        rosters: attendanceRosters,
      }, printWindows[2]!, {
        ...(day1Options.schematicCoverPage ? {
          schematicCover: {
            request: buildSchematicPayload(coverOrientation, { highlightInstructor: false, selectedInstructor: 'none' }),
            highlightEachInstructor: day1Options.highlightInstructorName,
            blankBack: true,
          },
        } : {}),
      })
      if (attendanceResult.status === 'failed') throw attendanceResult.error
    } catch (error) {
      console.error(error)
      printWindows.forEach(windowRef => windowRef?.close())
      alert(
        error instanceof Error && error.message
          ? error.message
          : 'Unable to generate Day 1 print materials.',
      )
    }
  }

  const handlePrint = () => {
    if (activeModal === 'day1') {
      void handlePrintDay1()
      return
    }
    if (activeModal === 'schematic') {
      void handlePrintSchematic()
    }
  }

  return (
    <div id="print-page" data-component="print-page" className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div className="relative overflow-hidden rounded-card border-2 border-secondary/20 bg-accent p-8 text-secondary shadow-md">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-secondary/15" />
        <div className="absolute -bottom-12 left-10 h-24 w-24 rounded-full bg-secondary/10" />
        <div className="relative">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary/70">Print Center</p>
          <h2 className="mt-3 text-2xl font-semibold">Pick a print tool</h2>
          <p className="mt-2 max-w-2xl text-secondary">
            Prepare attendance, instructor packets, master lists, and schematic snapshots from one place.
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {printOptions.map(option => (
          <PrintOptionButton
            key={option.key}
            option={option}
            isInfoOpen={activeInfo === option.key}
            onOpen={() => setActiveModal(option.key)}
            onToggleInfo={() => handleToggleInfo(option.key)}
            onCloseInfo={() => setActiveInfo(null)}
          />
        ))}
      </div>

      <Day1OptionsModal
        open={activeModal === 'day1'}
        options={day1Options}
        formatOptions={masterlistFormatOptions}
        schematicScalePercent={schematicScalePercent}
        scaleMin={SCHEMATIC_SCALE_MIN}
        scaleMax={SCHEMATIC_SCALE_MAX}
        scaleStep={SCHEMATIC_SCALE_STEP}
        notice={activeModal === 'day1' ? blockedPrintNotice : null}
        onClose={() => setActiveModal(null)}
        onToggle={handleToggleDay1Option}
        onToggleFormat={handleToggleMasterlistOption}
        onChangeLayout={handleChangeMasterlistLayout}
        onChangeAlphabeticalNameBasis={handleChangeMasterlistAlphabeticalNameBasis}
        onChangeFontSize={handleChangeMasterlistFontSize}
        onChangeSchematicScale={handleChangeSchematicScale}
        onResetSchematicScale={handleResetSchematicScale}
        onPrint={handlePrint}
      />
      <InstructorOptionsModal
        open={activeModal === 'instructors'}
        instructorNames={instructorNames}
        busyInstructors={busyInstructors}
        isPrintingAll={isPrintingAllInstructors}
        notice={activeModal === 'instructors' ? blockedPrintNotice : null}
        extras={instructorExtras}
        coverOrientation={instructorCoverOrientation}
        schematicScalePercent={schematicScalePercent}
        scaleMin={SCHEMATIC_SCALE_MIN}
        scaleMax={SCHEMATIC_SCALE_MAX}
        scaleStep={SCHEMATIC_SCALE_STEP}
        onClose={() => setActiveModal(null)}
        onPrintAll={handlePrintAllInstructorSheets}
        onPrintInstructor={handlePrintInstructorSheet}
        onToggleCover={handleToggleInstructorCover}
        onToggleCoverHighlight={handleToggleInstructorCoverHighlight}
        onSelectCoverOrientation={setInstructorCoverOrientation}
        onChangeSchematicScale={handleChangeSchematicScale}
        onResetSchematicScale={handleResetSchematicScale}
      />
      <MasterlistOptionsModal
        open={activeModal === 'masterlist'}
        extras={masterlistExtras}
        coverOrientation={coverOrientation}
        schematicScalePercent={schematicScalePercent}
        scaleMin={SCHEMATIC_SCALE_MIN}
        scaleMax={SCHEMATIC_SCALE_MAX}
        scaleStep={SCHEMATIC_SCALE_STEP}
        formatOptions={masterlistFormatOptions}
        notice={activeModal === 'masterlist' ? blockedPrintNotice : null}
        previewUrl={masterlistPreviewUrl}
        isPreviewLoading={isMasterlistPreviewLoading}
        previewError={masterlistPreviewError}
        onToggleFormat={handleToggleMasterlistOption}
        onChangeLayout={handleChangeMasterlistLayout}
        onChangeAlphabeticalNameBasis={handleChangeMasterlistAlphabeticalNameBasis}
        onChangeFontSize={handleChangeMasterlistFontSize}
        onClose={() => setActiveModal(null)}
        onToggle={handleToggleMasterlistExtra}
        onSelectCoverOrientation={setCoverOrientation}
        onChangeSchematicScale={handleChangeSchematicScale}
        onResetSchematicScale={handleResetSchematicScale}
        onPrint={handlePrintMasterlist}
      />
      <SchematicOptionsModal
        open={activeModal === 'schematic'}
        options={schematicOptions}
        instructorNames={instructorNames}
        scalePercent={schematicScalePercent}
        scaleMin={SCHEMATIC_SCALE_MIN}
        scaleMax={SCHEMATIC_SCALE_MAX}
        scaleStep={SCHEMATIC_SCALE_STEP}
        notice={activeModal === 'schematic' ? blockedPrintNotice : null}
        previewUrl={schematicPreviewUrl}
        isPreviewLoading={isSchematicPreviewLoading}
        previewError={schematicPreviewError}
        onClose={() => setActiveModal(null)}
        onToggleHighlight={handleToggleSchematicHighlight}
        onSelectOrientation={handleSelectSchematicOrientation}
        onSelectInstructor={value =>
          setSchematicOptions(current => ({
            ...current,
            selectedInstructor: value,
          }))
        }
        onChangeScale={handleChangeSchematicScale}
        onResetScale={handleResetSchematicScale}
        onPrint={handlePrint}
      />

    </div>
  )
}

export default PrintPage

import { useEffect, useState } from 'react'
import { useDay } from '../../app/DayContext'
import { useCurrentSession } from '../../app/useCurrentSession'
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
import {
  ensureInstructorPdf,
  getCurrentSessionId,
  getInstructorPacket,
  onInstructorPdfCacheUpdated,
  prefetchInstructorPacket,
} from '../../lib/instructorPdfCache'
import { buildCustomRosterGroups, buildRosterGroups } from '../rosters/utils'
import { printOptions } from './constants'
import type { FormatOptions } from '../../types/app'
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
import { fetchBlankPdf, fetchMasterlistPdf, fetchSchematicPdf } from './utils/printApi'
import {
  buildMasterlistRequestBody,
  buildDateRangeLabel,
  buildSessionTitle,
  buildWeeksLabel,
} from './utils/printPayloads'

const INSTRUCTOR_PDF_CONCURRENCY = 2

const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  if (items.length === 0) {
    return []
  }

  const workerCount = Math.max(1, Math.min(items.length, Math.floor(concurrency) || 1))
  const results = new Array<R>(items.length)
  let nextIndex = 0

  const worker = async () => {
    while (true) {
      const currentIndex = nextIndex
      nextIndex += 1
      if (currentIndex >= items.length) {
        return
      }
      results[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

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

type BlockedPrintJob = {
  jobLabel: string
  filename: string
  pdfBlob: Blob
  retry: () => void
}

function PrintPage() {
  const { selectedDay } = useDay()
  const { session: currentSession } = useCurrentSession()
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
  const [cachedInstructorPacket, setCachedInstructorPacket] = useState<Awaited<
    ReturnType<typeof getInstructorPacket>
  > | null>(null)
  const [busyInstructors, setBusyInstructors] = useState<Record<string, boolean>>({})
  const [isRefreshingInstructorPdfs, setIsRefreshingInstructorPdfs] = useState(false)
  const [refreshingCachedInstructors, setRefreshingCachedInstructors] = useState<
    Record<string, boolean>
  >({})
  const [refreshProgress, setRefreshProgress] = useState<{ completed: number; total: number } | null>(
    null,
  )
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
  const schematicPreview = useSchematicSchedule(selectedDay ?? null)
  const sessionInfo = currentSession
  const sessionTitle = buildSessionTitle(sessionInfo, selectedDay)
  const dateRange = buildDateRangeLabel(sessionInfo)
  const weeksLabel = buildWeeksLabel(sessionInfo)

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

  const handleToggleMasterlistOption = (key: keyof FormatOptions) => {
    setMasterlistFormatOptions(current => {
      const next = {
        ...current,
        [key]: !current[key],
      }
      setMasterlistDraftOptions(next)
      return next
    })
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
    title: sessionTitle,
    dateRange,
    weeksLabel,
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
    const formData = new FormData()
    pdfs.forEach(pdf => {
      formData.append('pdfs', pdf.blob, pdf.filename)
    })
    formData.append('filename', options.filename)
    formData.append('title', options.title)

    const response = await fetch('/api/concat-pdfs', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const message = await response.text()
      throw new Error(message || 'Failed to combine PDFs.')
    }

    return response.blob()
  }

  useEffect(() => {
    let isActive = true
    const loadPacket = async () => {
      if (!selectedDay) {
        setCachedInstructorPacket(null)
        return
      }
      const sessionId = getCurrentSessionId()
      if (!sessionId) {
        setCachedInstructorPacket(null)
        return
      }
      const packet = await getInstructorPacket(sessionId, selectedDay)
      if (isActive) {
        setCachedInstructorPacket(packet)
      }
    }

    void loadPacket()

    const sessionId = getCurrentSessionId()
    if (!selectedDay || !sessionId) {
      return () => {
        isActive = false
      }
    }

    const unsubscribe = onInstructorPdfCacheUpdated(detail => {
      if (detail.sessionId !== sessionId || detail.day !== selectedDay) {
        return
      }
      void loadPacket()
    })

    return () => {
      isActive = false
      unsubscribe()
    }
  }, [currentSession?.id, selectedDay])

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

  const refreshCachedPacket = async () => {
    if (!selectedDay) {
      setCachedInstructorPacket(null)
      return
    }
    const sessionId = getCurrentSessionId()
    if (!sessionId) {
      setCachedInstructorPacket(null)
      return
    }
    const packet = await getInstructorPacket(sessionId, selectedDay)
    setCachedInstructorPacket(packet)
  }

  const handleRefreshInstructorPdfs = async () => {
    if (!selectedDay) {
      alert('Please select a day before refreshing PDFs.')
      return
    }
    const sessionId = getCurrentSessionId()
    if (!sessionId) {
      alert('Please select a session before refreshing PDFs.')
      return
    }
    setIsRefreshingInstructorPdfs(true)
    setRefreshingCachedInstructors({})
    setRefreshProgress(null)
    try {
      const result = await prefetchInstructorPacket(sessionId, selectedDay, {
        concurrency: 1,
        force: true,
        onStart: total => {
          setRefreshProgress({ completed: 0, total })
        },
        onProgress: ({ name, completed, total }) => {
          setRefreshingCachedInstructors(current => ({
            ...current,
            [name]: true,
          }))
          setRefreshProgress({ completed, total })
        },
      })
      await refreshCachedPacket()
      if (result.failed.length > 0) {
        alert(`Some instructor PDFs could not be refreshed: ${result.failed.join(', ')}`)
      }
    } finally {
      setIsRefreshingInstructorPdfs(false)
      setRefreshProgress(null)
      setRefreshingCachedInstructors({})
    }
  }

  const handlePrintAllInstructorSheets = async () => {
    if (!selectedDay) {
      alert('Please select a day before printing instructor sheets.')
      return
    }

    const sessionId = getCurrentSessionId()
    if (!sessionId) {
      alert('Please select a session before printing.')
      return
    }

    const rosterGroups = buildRosterGroupsForDay(selectedDay)
    if (rosterGroups.length === 0) {
      alert('No roster data found for the selected day.')
      return
    }

    clearBlockedPrintJob()
    const printWindow = openPrintWindow('Instructor Sheets')

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

      const sheetResults = await mapWithConcurrency(
        orderedNames,
        INSTRUCTOR_PDF_CONCURRENCY,
        async name => {
          return {
            name,
            pdfBlob: await ensureInstructorPdf(sessionId, selectedDay, name),
          }
        },
      )

      const pdfs: Blob[] = []
      let baseSchematicCover: Blob | null = null
      let baseSchematicBlank: Blob | null = null

      if (instructorExtras.schematicCoverPage && !instructorExtras.highlightCoverInstructor) {
        const result = await fetchSchematicCoverWithBlank(
          instructorCoverOrientation,
          undefined,
          true,
        )
        baseSchematicCover = result.schematicCover
        baseSchematicBlank = result.blankPage
      }

      for (const result of sheetResults) {
        if (!result) {
          continue
        }
        const { name, pdfBlob } = result
        if (instructorExtras.schematicCoverPage) {
          if (instructorExtras.highlightCoverInstructor) {
            const result = await fetchSchematicCoverWithBlank(
              instructorCoverOrientation,
              { highlightInstructor: true, selectedInstructor: name },
              true,
            )
            pdfs.push(result.schematicCover)
            pdfs.push(result.blankPage)
          } else if (baseSchematicCover) {
            pdfs.push(baseSchematicCover)
            if (baseSchematicBlank) {
              pdfs.push(baseSchematicBlank)
            }
          }
        }
        pdfs.push(pdfBlob)
      }

      if (pdfs.length === 0) {
        alert('No instructor sheets available to print.')
        printWindow?.close()
        return
      }

      const formData = new FormData()
      pdfs.forEach((pdf, index) => {
        formData.append('pdfs', pdf, `instructor-${index + 1}.pdf`)
      })
      formData.append('filename', 'instructor-sheets')
      formData.append('title', 'Instructor Sheets')

      const concatResponse = await fetch('/api/concat-pdfs', {
        method: 'POST',
        body: formData,
      })

      if (!concatResponse.ok) {
        const message = await concatResponse.text()
        throw new Error(message || 'Failed to combine instructor PDFs.')
      }

      const combinedPdf = await concatResponse.blob()
      await refreshCachedPacket()
      if (
        !printWindow ||
        !openPdfPrintDialog(combinedPdf, printWindow, {
          title: 'Instructor Sheets',
          filename: 'instructor-sheets.pdf',
        })
      ) {
        setBlockedPrintJob({
          jobLabel: 'Instructor Sheets',
          filename: 'instructor-sheets.pdf',
          pdfBlob: combinedPdf,
          retry: () => {
            void handlePrintAllInstructorSheets()
          },
        })
      }
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

    const sessionId = getCurrentSessionId()
    if (!sessionId) {
      alert('Please select a session before printing.')
      return
    }

    clearBlockedPrintJob()
    const printWindow = openPrintWindow(`Instructor - ${name}`)

    setBusyInstructors(current => ({
      ...current,
      [name]: true,
    }))

    try {
      let schematicCover: Blob | null = null
      let schematicBlank: Blob | null = null
      if (instructorExtras.schematicCoverPage) {
        const highlight =
          instructorExtras.highlightCoverInstructor && name
            ? { highlightInstructor: true, selectedInstructor: name }
            : { highlightInstructor: false, selectedInstructor: 'none' }
        const result = await fetchSchematicCoverWithBlank(instructorCoverOrientation, highlight, true)
        schematicCover = result.schematicCover
        schematicBlank = result.blankPage
      }

      const pdfBlob = await ensureInstructorPdf(sessionId, selectedDay, name)
      await refreshCachedPacket()
      if (schematicCover) {
        const combined = await concatPdfs(
          [
            { blob: schematicCover, filename: 'schematic-cover.pdf' },
            ...(schematicBlank ? [{ blob: schematicBlank, filename: 'schematic-blank.pdf' }] : []),
            { blob: pdfBlob, filename: `instructor-${name}.pdf` },
          ],
          {
            filename: buildPdfFilename('instructor', name).replace(/\.pdf$/i, ''),
            title: `Instructor - ${name}`,
          },
        )
        if (
          !printWindow ||
          !openPdfPrintDialog(combined, printWindow, {
            title: `Instructor - ${name}`,
            filename: buildPdfFilename('instructor', name),
          })
        ) {
          setBlockedPrintJob({
            jobLabel: `Instructor - ${name}`,
            filename: buildPdfFilename('instructor', name),
            pdfBlob: combined,
            retry: () => {
              void handlePrintInstructorSheet(name)
            },
          })
        }
      } else {
        if (
          !printWindow ||
          !openPdfPrintDialog(pdfBlob, printWindow, {
            title: `Instructor - ${name}`,
            filename: buildPdfFilename('instructor', name),
          })
        ) {
          setBlockedPrintJob({
            jobLabel: `Instructor - ${name}`,
            filename: buildPdfFilename('instructor', name),
            pdfBlob,
            retry: () => {
              void handlePrintInstructorSheet(name)
            },
          })
        }
      }
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

  const buildDay1InstructorBlob = async (name: string) => {
    if (!selectedDay) {
      throw new Error('Please select a day before printing Day 1 materials.')
    }

    const sessionId = getCurrentSessionId()
    if (!sessionId) {
      throw new Error('Please select a session before printing.')
    }

    const rosterGroups = buildRosterGroupsForDay(selectedDay)
    const rostersToPrint = rosterGroups.filter(roster => roster.instructor === name)
    if (rostersToPrint.length === 0) {
      throw new Error(`No classes found for ${name}.`)
    }

    const pdfBlob = await ensureInstructorPdf(sessionId, selectedDay, name)

    if (!day1Options.schematicCoverPage) {
      return pdfBlob
    }

    const highlight = day1Options.highlightInstructorName
      ? { highlightInstructor: true, selectedInstructor: name }
      : undefined
    const result = await fetchSchematicCoverWithBlank(coverOrientation, highlight, true)
    return concatPdfs(
      [
        { blob: result.schematicCover, filename: 'schematic-cover.pdf' },
        { blob: result.blankPage, filename: 'schematic-blank.pdf' },
        { blob: pdfBlob, filename: `instructor-${name}.pdf` },
      ],
      {
        filename: buildPdfFilename('day1', 'instructor', name).replace(/\.pdf$/i, ''),
        title: `Instructor - ${name}`,
      },
    )
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
      ...orderedNames.map(name => openPrintWindow(`Instructor - ${name}`)),
    ]
    const popupBlocked = printWindows.some(windowRef => !windowRef)

    if (popupBlocked) {
      printWindows.forEach(windowRef => windowRef?.close())
    }

    try {
      const schematicBlob = await getCachedSchematicPdf(
        buildSchematicPayload(schematicOptions.orientation, {
          highlightInstructor: false,
          selectedInstructor: 'none',
        }),
      )
      const masterlistBlob = await buildDay1MasterlistBlob()
      const instructorBlobs: Array<{ name: string; blob: Blob }> = []

      for (const name of orderedNames) {
        const instructorBlob = await buildDay1InstructorBlob(name)
        instructorBlobs.push({ name, blob: instructorBlob })
      }

      if (popupBlocked) {
        const combinedDay1Blob = await concatPdfs(
          [
            { blob: schematicBlob, filename: 'schematic.pdf' },
            { blob: masterlistBlob, filename: 'masterlist.pdf' },
            ...instructorBlobs.map(entry => ({
              blob: entry.blob,
              filename: buildPdfFilename('instructor', entry.name),
            })),
          ],
          { filename: 'day1-materials', title: 'Day 1 Materials' },
        )
        setBlockedPrintJob({
          jobLabel: 'Day 1 Materials',
          filename: 'day1-materials.pdf',
          pdfBlob: combinedDay1Blob,
          retry: () => {
            void handlePrintDay1()
          },
        })
        return
      }

      openPdfPrintDialog(schematicBlob, printWindows[0], {
        title: 'Schematic',
        filename: 'schematic.pdf',
      })
      openPdfPrintDialog(masterlistBlob, printWindows[1], {
        title: 'Masterlist',
        filename: 'masterlist.pdf',
      })
      for (const [index, entry] of instructorBlobs.entries()) {
        openPdfPrintDialog(entry.blob, printWindows[index + 2], {
          title: `Instructor - ${entry.name}`,
          filename: buildPdfFilename('instructor', entry.name),
        })
      }
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
        notice={activeModal === 'day1' ? blockedPrintNotice : null}
        onClose={() => setActiveModal(null)}
        onToggle={handleToggleDay1Option}
        onToggleFormat={handleToggleMasterlistOption}
        onPrint={handlePrint}
      />
      <InstructorOptionsModal
        open={activeModal === 'instructors'}
        instructorNames={instructorNames}
        cachedInstructors={cachedInstructorPacket?.instructors.reduce<Record<string, boolean>>(
          (acc, entry) => {
            acc[entry.name] = true
            return acc
          },
          { ...refreshingCachedInstructors },
        ) ?? refreshingCachedInstructors}
        busyInstructors={busyInstructors}
        isRefreshing={isRefreshingInstructorPdfs}
        refreshLabel={
          isRefreshingInstructorPdfs && refreshProgress
            ? `Refreshing ${refreshProgress.completed}/${refreshProgress.total}`
            : undefined
        }
        isPrintingAll={isPrintingAllInstructors}
        notice={activeModal === 'instructors' ? blockedPrintNotice : null}
        extras={instructorExtras}
        coverOrientation={instructorCoverOrientation}
        onClose={() => setActiveModal(null)}
        onRefresh={handleRefreshInstructorPdfs}
        onPrintAll={handlePrintAllInstructorSheets}
        onPrintInstructor={handlePrintInstructorSheet}
        onToggleCover={handleToggleInstructorCover}
        onToggleCoverHighlight={handleToggleInstructorCoverHighlight}
        onSelectCoverOrientation={setInstructorCoverOrientation}
      />
      <MasterlistOptionsModal
        open={activeModal === 'masterlist'}
        extras={masterlistExtras}
        coverOrientation={coverOrientation}
        formatOptions={masterlistFormatOptions}
        notice={activeModal === 'masterlist' ? blockedPrintNotice : null}
        onToggleFormat={handleToggleMasterlistOption}
        onClose={() => setActiveModal(null)}
        onToggle={handleToggleMasterlistExtra}
        onSelectCoverOrientation={setCoverOrientation}
        onPrint={handlePrintMasterlist}
      />
      <SchematicOptionsModal
        open={activeModal === 'schematic'}
        options={schematicOptions}
        instructorNames={instructorNames}
        notice={activeModal === 'schematic' ? blockedPrintNotice : null}
        onClose={() => setActiveModal(null)}
        onToggleHighlight={handleToggleSchematicHighlight}
        onSelectOrientation={handleSelectSchematicOrientation}
        onSelectInstructor={value =>
          setSchematicOptions(current => ({
            ...current,
            selectedInstructor: value,
          }))
        }
        onPrint={handlePrint}
      />

    </div>
  )
}

export default PrintPage

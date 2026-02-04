import React, { useEffect, useState } from 'react'
import { useDay } from '../../app/DayContext'
import {
  getCustomRostersForDay,
  getMasterlistDraftOptions,
  getStudentsForDay,
  setMasterlistDraftOptions,
} from '../../lib/storage'
import {
  getCachedInstructorPdf,
  getCurrentSessionId,
  getCurrentSessionName,
  getInstructorPacket,
  prefetchInstructorPacket,
  upsertInstructorPdf,
} from '../../lib/instructorPdfCache'
import { buildCustomRosterGroups, buildRosterGroups, sanitizeLevel } from '../rosters/utils'
import { printOptions } from './constants'
import type { FormatOptions } from '../../types/app'
import type { PrintOptionKey } from './types'
import { useSessionInstructors } from './hooks/useSessionInstructors'
import Day1OptionsModal from './components/Day1OptionsModal'
import InstructorOptionsModal from './components/InstructorOptionsModal'
import MasterlistOptionsModal from './components/MasterlistOptionsModal'
import PrintOptionButton from './components/PrintOptionButton'
import SchematicOptionsModal from './components/SchematicOptionsModal'
import { dayNames } from '../schematic/constants'
import { useSchematicSchedule } from '../schematic/hooks/useSchematicSchedule'
import { getCapacity } from '../schematic/utils/capacity'

const SESSIONS_STORAGE_KEY = 'decksupervisor.sessions'
const CURRENT_SESSION_KEY = 'decksupervisor.currentSessionId'
const MS_PER_DAY = 1000 * 60 * 60 * 24

type SessionEntry = {
  id: string
  startDate: string
  endDate?: string
  sessionSeason?: string
}

const formatGeneratedDate = (date: Date) =>
  date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

const getCurrentSessionStartDate = () => {
  if (typeof window === 'undefined') {
    return ''
  }
  const currentSessionId = localStorage.getItem(CURRENT_SESSION_KEY) ?? ''
  if (!currentSessionId) {
    return ''
  }
  const stored = localStorage.getItem(SESSIONS_STORAGE_KEY)
  if (!stored) {
    return ''
  }
  try {
    const sessions = JSON.parse(stored) as SessionEntry[]
    const session = sessions.find(item => item.id === currentSessionId)
    return session?.startDate ?? ''
  } catch (error) {
    console.error('Failed to parse stored sessions', error)
    return ''
  }
}

const getCurrentSessionInfo = () => {
  if (typeof window === 'undefined') {
    return null
  }
  const currentSessionId = localStorage.getItem(CURRENT_SESSION_KEY) ?? ''
  if (!currentSessionId) {
    return null
  }
  const stored = localStorage.getItem(SESSIONS_STORAGE_KEY)
  if (!stored) {
    return null
  }
  try {
    const sessions = JSON.parse(stored) as SessionEntry[]
    const session = sessions.find(item => item.id === currentSessionId)
    return session ?? null
  } catch (error) {
    console.error('Failed to parse stored sessions', error)
    return null
  }
}

const getSessionWeek = (startDate: string, now = new Date()) => {
  if (!startDate) {
    return null
  }
  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) {
    return null
  }
  const diffDays = Math.floor((now.getTime() - start.getTime()) / MS_PER_DAY)
  const week = Math.floor(diffDays / 7) + 1
  return week < 1 ? 1 : week
}

const formatMonthDay = (value: string) => {
  if (!value) {
    return ''
  }
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const parsed = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function PrintPage() {
  const { selectedDay } = useDay()
  const [activeInfo, setActiveInfo] = useState<PrintOptionKey | null>(null)
  const [activeModal, setActiveModal] = useState<PrintOptionKey | null>(null)
  const instructorNames = useSessionInstructors(
    activeModal === 'instructors' || activeModal === 'schematic',
  )
  const [day1Options, setDay1Options] = useState({
    singlePrint: true,
    namePages: false,
    schematicCovers: false,
    extraMasterlistCopy: false,
  })
  const [cachedInstructorPacket, setCachedInstructorPacket] = useState<Awaited<
    ReturnType<typeof getInstructorPacket>
  > | null>(null)
  const [busyInstructors, setBusyInstructors] = useState<Record<string, boolean>>({})
  const [isRefreshingInstructorPdfs, setIsRefreshingInstructorPdfs] = useState(false)
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
  const [schematicOptions, setSchematicOptions] = useState({
    highlightInstructor: false,
    selectedInstructor: 'none',
    orientation: 'portrait' as const,
  })
  const schematicPreview = useSchematicSchedule(selectedDay ?? null)
  const sessionInfo = getCurrentSessionInfo()
  const dayLabel = selectedDay ? (dayNames[selectedDay] ?? selectedDay) : 'Select Day'
  const seasonLabel = sessionInfo?.sessionSeason?.trim() ?? ''
  const yearLabel = sessionInfo?.startDate ? new Date(sessionInfo.startDate).getFullYear() : NaN
  const sessionTitle = [dayLabel, seasonLabel, Number.isFinite(yearLabel) ? String(yearLabel) : '']
    .filter(Boolean)
    .join(' ')
  const dateRange = sessionInfo?.startDate && sessionInfo?.endDate
    ? `${formatMonthDay(sessionInfo.startDate)} - ${formatMonthDay(sessionInfo.endDate)}`
    : sessionInfo?.startDate
    ? formatMonthDay(sessionInfo.startDate)
    : 'Date range unavailable'
  const weeksLabel = (() => {
    if (!sessionInfo?.startDate || !sessionInfo?.endDate) {
      return ''
    }
    const start = new Date(sessionInfo.startDate)
    const end = new Date(sessionInfo.endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return ''
    }
    const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate())
    if (endDate < startDate) {
      return ''
    }
    const days = Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1
    const weeks = Math.floor((days + 6) / 7)
    return `# of weeks ${weeks} classes`
  })()

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

  const handleToggleInfo = (key: PrintOptionKey) => {
    setActiveInfo(current => (current === key ? null : key))
  }

  const handleToggleDay1Option = (key: keyof typeof day1Options) => {
    setDay1Options(current => ({
      ...current,
      [key]: !current[key],
    }))
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

  const fetchSchematicCoverWithBlank = async (
    orientation: 'portrait' | 'landscape',
    highlightOptions?: { highlightInstructor: boolean; selectedInstructor: string },
  ) => {
    if (schematicPreview.columns.length === 0) {
      throw new Error('No schematic data found for the selected day.')
    }

    const schematicResponse = await fetch('/api/schematic-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        buildSchematicPayload(
          orientation,
          highlightOptions ?? { highlightInstructor: false, selectedInstructor: 'none' },
        ),
      ),
    })

    if (!schematicResponse.ok) {
      const message = await schematicResponse.text()
      throw new Error(message || 'Failed to generate schematic cover.')
    }
    const schematicCover = await schematicResponse.blob()

    const blankResponse = await fetch('/api/blank-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orientation }),
    })

    if (!blankResponse.ok) {
      const message = await blankResponse.text()
      throw new Error(message || 'Failed to generate blank page.')
    }
    const blankPage = await blankResponse.blob()

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

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Pop-up blocked. Please allow pop-ups to print.')
      return
    }
    printWindow.document.write('<p style="font-family: sans-serif;">Preparing PDF...</p>')

    try {
      const highlightOptions = {
        highlightInstructor: schematicOptions.highlightInstructor,
        selectedInstructor: schematicOptions.selectedInstructor,
      }

      const fetchSchematicPdf = async (payload: ReturnType<typeof buildSchematicPayload>) => {
        const response = await fetch('/api/schematic-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const message = await response.text()
          throw new Error(message || 'Failed to generate schematic PDF.')
        }
        return response.blob()
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
          pdfs.push(await fetchSchematicPdf(payload))
        }

        const formData = new FormData()
        pdfs.forEach((pdf, index) => {
          formData.append('pdfs', pdf, `schematic-${index + 1}.pdf`)
        })
        formData.append('filename', 'schematic')

        const concatResponse = await fetch('/api/concat-pdfs', {
          method: 'POST',
          body: formData,
        })

        if (!concatResponse.ok) {
          const message = await concatResponse.text()
          throw new Error(message || 'Failed to combine schematic PDFs.')
        }

        const combined = await concatResponse.blob()
        openPdfPrintDialog(combined, printWindow)
      } else {
        const payload = buildSchematicPayload(schematicOptions.orientation, highlightOptions)
        const pdfBlob = await fetchSchematicPdf(payload)
        openPdfPrintDialog(pdfBlob, printWindow)
      }
    } catch (error) {
      console.error(error)
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Unable to generate the schematic PDF. Please try again.'
      alert(message)
      printWindow.close()
    }
  }

  const buildRosterGroupsForDay = (day: string) => {
    const students = getStudentsForDay(day)
    const rosterGroups = buildRosterGroups(students)
    if (!day) {
      return rosterGroups
    }
    const customRosters = getCustomRostersForDay(day)
    if (customRosters.length === 0) {
      return rosterGroups
    }
    const rosterByCode = new Map(rosterGroups.map(roster => [roster.code, roster]))
    const studentsById = new Map(students.map(student => [student.id, student]))
    const customGroups = buildCustomRosterGroups(customRosters, rosterByCode, studentsById)
    return [...rosterGroups, ...customGroups]
  }

  const openPdfPrintDialog = (pdfBlob: Blob, existingWindow?: Window | null) => {
    const blobUrl = window.URL.createObjectURL(pdfBlob)
    const printWindow = existingWindow ?? window.open(blobUrl, '_blank')

    if (!printWindow) {
      window.URL.revokeObjectURL(blobUrl)
      alert('Pop-up blocked. Please allow pop-ups to print.')
      return
    }

    if (existingWindow) {
      printWindow.location.href = blobUrl
    }

    const cleanup = () => {
      window.URL.revokeObjectURL(blobUrl)
    }

    printWindow.addEventListener('beforeunload', cleanup, { once: true })

    const triggerPrint = () => {
      printWindow.focus()
      printWindow.print()
    }

    printWindow.onload = () => {
      setTimeout(triggerPrint, 1000)
    }

    setTimeout(triggerPrint, 3000)
  }

  useEffect(() => {
    if (activeModal !== 'instructors') {
      return
    }
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
    return () => {
      isActive = false
    }
  }, [activeModal, selectedDay])

  const buildInstructorPayload = (
    rostersToPrint: ReturnType<typeof buildRosterGroups>,
    filename?: string,
  ) => {
    const sessionName = getCurrentSessionName() || 'Summer 2025'
    return {
      session: sessionName,
      filename,
      rosters: rostersToPrint.map(roster => ({
        template: sanitizeLevel(roster.level),
        roster: {
          code: roster.code,
          level: roster.level,
          serviceName: roster.serviceName,
          time: roster.time,
          instructor: roster.instructor,
          location: roster.location,
          schedule: roster.schedule,
          students: roster.students.map(student => ({
            name: student.name,
          })),
        },
      })),
    }
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
    try {
      await prefetchInstructorPacket(selectedDay)
      await refreshCachedPacket()
    } finally {
      setIsRefreshingInstructorPdfs(false)
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

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Pop-up blocked. Please allow pop-ups to print.')
      return
    }
    printWindow.document.write('<p style="font-family: sans-serif;">Preparing PDF...</p>')

    setIsPrintingAllInstructors(true)

    try {
      let schematicCover: Blob | null = null
      let schematicBlank: Blob | null = null
      if (instructorExtras.schematicCoverPage) {
        const result = await fetchSchematicCoverWithBlank(instructorCoverOrientation)
        schematicCover = result.schematicCover
        schematicBlank = result.blankPage
      }

      const grouped = groupRostersByInstructor(rosterGroups)
      const orderedNames =
        instructorNames.length > 0
          ? instructorNames.filter(name => grouped.has(name))
          : Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b))

      if (orderedNames.length === 0) {
        alert('No instructor sheets available to print.')
        printWindow.close()
        return
      }

      const pdfs: Blob[] = []
      let shouldRefresh = false

      for (const name of orderedNames) {
        let pdfBlob = await getCachedInstructorPdf(sessionId, selectedDay, name)
        if (!pdfBlob) {
          const rostersToPrint = grouped.get(name) ?? []
          if (rostersToPrint.length === 0) {
            continue
          }
          const response = await fetch('/api/attendance-pdf', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(buildInstructorPayload(rostersToPrint, name)),
          })

          if (!response.ok) {
            const message = await response.text()
            throw new Error(message || `Failed to generate sheets for ${name}`)
          }

          pdfBlob = await response.blob()
          await upsertInstructorPdf(sessionId, selectedDay, name, pdfBlob)
          shouldRefresh = true
        }
        pdfs.push(pdfBlob)
      }

      if (pdfs.length === 0) {
        alert('No instructor sheets available to print.')
        printWindow.close()
        return
      }

      const formData = new FormData()
      if (schematicCover) {
        formData.append('pdfs', schematicCover, 'schematic-cover.pdf')
        if (schematicBlank) {
          formData.append('pdfs', schematicBlank, 'schematic-blank.pdf')
        }
      }
      pdfs.forEach((pdf, index) => {
        formData.append('pdfs', pdf, `instructor-${index + 1}.pdf`)
      })
      formData.append('filename', 'instructor-sheets')

      const concatResponse = await fetch('/api/concat-pdfs', {
        method: 'POST',
        body: formData,
      })

      if (!concatResponse.ok) {
        const message = await concatResponse.text()
        throw new Error(message || 'Failed to combine instructor PDFs.')
      }

      const combinedPdf = await concatResponse.blob()
      if (shouldRefresh) {
        await refreshCachedPacket()
      }
      openPdfPrintDialog(combinedPdf, printWindow)
    } catch (error) {
      console.error(error)
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Unable to generate instructor sheets. Please try again.'
      alert(message)
      printWindow.close()
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

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Pop-up blocked. Please allow pop-ups to print.')
      return
    }
    printWindow.document.write('<p style="font-family: sans-serif;">Preparing PDF...</p>')

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
        const result = await fetchSchematicCoverWithBlank(instructorCoverOrientation, highlight)
        schematicCover = result.schematicCover
        schematicBlank = result.blankPage
      }

      const cached = await getCachedInstructorPdf(sessionId, selectedDay, name)
      if (cached) {
        if (schematicCover) {
          const formData = new FormData()
          formData.append('pdfs', schematicCover, 'schematic-cover.pdf')
          if (schematicBlank) {
            formData.append('pdfs', schematicBlank, 'schematic-blank.pdf')
          }
          formData.append('pdfs', cached, `instructor-${name}.pdf`)
          formData.append('filename', `instructor-${name}`)

          const concatResponse = await fetch('/api/concat-pdfs', {
            method: 'POST',
            body: formData,
          })

          if (!concatResponse.ok) {
            const message = await concatResponse.text()
            throw new Error(message || 'Failed to combine schematic cover and instructor sheet.')
          }

          const combined = await concatResponse.blob()
          openPdfPrintDialog(combined, printWindow)
        } else {
          openPdfPrintDialog(cached, printWindow)
        }
        return
      }

      const rostersToPrint = rosterGroups.filter(roster => roster.instructor === name)

      if (rostersToPrint.length === 0) {
        alert(`No classes found for ${name}.`)
        printWindow.close()
        return
      }

      const response = await fetch('/api/attendance-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildInstructorPayload(rostersToPrint, name)),
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || `Failed to generate sheets for ${name}`)
      }

      const pdfBlob = await response.blob()
      await upsertInstructorPdf(sessionId, selectedDay, name, pdfBlob)
      await refreshCachedPacket()
      if (schematicCover) {
        const formData = new FormData()
        formData.append('pdfs', schematicCover, 'schematic-cover.pdf')
        if (schematicBlank) {
          formData.append('pdfs', schematicBlank, 'schematic-blank.pdf')
        }
        formData.append('pdfs', pdfBlob, `instructor-${name}.pdf`)
        formData.append('filename', `instructor-${name}`)

        const concatResponse = await fetch('/api/concat-pdfs', {
          method: 'POST',
          body: formData,
        })

        if (!concatResponse.ok) {
          const message = await concatResponse.text()
          throw new Error(message || 'Failed to combine schematic cover and instructor sheet.')
        }

        const combined = await concatResponse.blob()
        openPdfPrintDialog(combined, printWindow)
      } else {
        openPdfPrintDialog(pdfBlob, printWindow)
      }
    } catch (error) {
      console.error(error)
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Unable to generate instructor sheets. Please try again.'
      alert(message)
      printWindow.close()
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

    const rosters = rosterGroups.map(roster => ({
      code: roster.code,
      serviceName: roster.serviceName,
      day: selectedDay,
      time: roster.time,
      location: roster.location,
      schedule: roster.schedule,
      instructor: roster.instructor,
      students: roster.students.map(student => ({
        name: student.name,
        phone: student.phone,
        instructor: student.instructor,
        level: student.level,
      })),
    }))

    const sessionName = getCurrentSessionName() || 'Summer 2025'
    const generatedDate = formatGeneratedDate(new Date())
    const sessionWeek = getSessionWeek(getCurrentSessionStartDate()) ?? 1

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Pop-up blocked. Please allow pop-ups to print.')
      return
    }
    printWindow.document.write('<p style="font-family: sans-serif;">Preparing PDF...</p>')

    try {
      let schematicCover: Blob | null = null
      let schematicBlank: Blob | null = null
      if (masterlistExtras.schematicCoverPage) {
        const result = await fetchSchematicCoverWithBlank(coverOrientation)
        schematicCover = result.schematicCover
        schematicBlank = result.blankPage
      }

      const response = await fetch('/api/masterlist-rosters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rosters,
          options: masterlistFormatOptions,
          sessionName,
          generatedDate,
          sessionWeek,
        }),
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'Failed to generate masterlist.')
      }

      const masterlistBlob = await response.blob()

      if (schematicCover) {
        const formData = new FormData()
        formData.append('pdfs', schematicCover, 'schematic-cover.pdf')
        if (schematicBlank) {
          formData.append('pdfs', schematicBlank, 'schematic-blank.pdf')
        }
        formData.append('pdfs', masterlistBlob, 'masterlist.pdf')
        formData.append('filename', 'masterlist')

        const concatResponse = await fetch('/api/concat-pdfs', {
          method: 'POST',
          body: formData,
        })

        if (!concatResponse.ok) {
          const message = await concatResponse.text()
          throw new Error(message || 'Failed to combine schematic cover and masterlist.')
        }

        const combined = await concatResponse.blob()
        openPdfPrintDialog(combined, printWindow)
      } else {
        openPdfPrintDialog(masterlistBlob, printWindow)
      }
    } catch (error) {
      console.error(error)
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Unable to generate masterlist. Please try again.'
      alert(message)
      printWindow.close()
    }
  }

  const handlePrint = () => {
    if (activeModal === 'schematic') {
      handlePrintSchematic()
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
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
        onClose={() => setActiveModal(null)}
        onToggle={handleToggleDay1Option}
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
          {},
        ) ?? {}}
        busyInstructors={busyInstructors}
        isRefreshing={isRefreshingInstructorPdfs}
        isPrintingAll={isPrintingAllInstructors}
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

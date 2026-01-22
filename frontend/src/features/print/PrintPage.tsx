import React, { useEffect, useState } from 'react'
import { useDay } from '../../app/DayContext'
import { getStudentsForDay } from '../../lib/storage'
import { buildRosterGroups, sanitizeLevel } from '../rosters/utils'
import { printOptions } from './constants'
import type { PrintOptionKey } from './types'
import { useSessionInstructors } from './hooks/useSessionInstructors'
import Day1OptionsModal from './components/Day1OptionsModal'
import InstructorOptionsModal from './components/InstructorOptionsModal'
import MasterlistOptionsModal from './components/MasterlistOptionsModal'
import PrintOptionButton from './components/PrintOptionButton'
import SchematicOptionsModal from './components/SchematicOptionsModal'

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
  const [instructorSelections, setInstructorSelections] = useState<Record<string, boolean>>({})
  const [instructorExtras, setInstructorExtras] = useState({
    singlePrint: true,
    schematicCoverPage: false,
  })
  const [masterlistExtras, setMasterlistExtras] = useState({
    schematicCoverPage: false,
  })
  const [schematicOptions, setSchematicOptions] = useState({
    highlightInstructor: false,
    selectedInstructor: 'none',
  })

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
    if (!instructorNames.length) {
      setInstructorSelections({})
      return
    }
    setInstructorSelections(current => {
      const next: Record<string, boolean> = {}
      instructorNames.forEach(name => {
        next[name] = current[name] ?? true
      })
      return next
    })
  }, [instructorNames])

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

  const handleToggleInstructor = (name: string) => {
    setInstructorSelections(current => ({
      ...current,
      [name]: !current[name],
    }))
  }

  const handleToggleInstructorExtra = (key: keyof typeof instructorExtras) => {
    setInstructorExtras(current => ({
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

  const openPdfPrintDialog = (pdfBlob: Blob) => {
    const blobUrl = window.URL.createObjectURL(pdfBlob)
    const printWindow = window.open(blobUrl, '_blank')

    if (!printWindow) {
      window.URL.revokeObjectURL(blobUrl)
      alert('Pop-up blocked. Please allow pop-ups to print.')
      return
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

  const getCurrentSessionName = () => {
    if (typeof window === 'undefined') {
      return ''
    }
    const currentSessionId = localStorage.getItem('decksupervisor.currentSessionId') ?? ''
    const stored = localStorage.getItem('decksupervisor.sessions')
    if (!currentSessionId || !stored) {
      return ''
    }
    try {
      const sessions = JSON.parse(stored) as {
        id: string
        sessionDay: string
        sessionSeason: string
        startDate: string
      }[]
      const session = sessions.find(item => item.id === currentSessionId)
      if (!session) {
        return ''
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
      const dayLabel = session.sessionDay ? dayNames[session.sessionDay] ?? session.sessionDay : ''
      const season = session.sessionSeason?.trim()
      const year = session.startDate ? new Date(session.startDate).getFullYear() : NaN
      const yearLabel = Number.isFinite(year) && year > 0 ? String(year) : ''
      const parts = [dayLabel, season, yearLabel].filter(Boolean)
      return parts.length ? parts.join(' ') : ''
    } catch (error) {
      console.error('Failed to parse stored sessions', error)
      return ''
    }
  }

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

  const handlePrintInstructorSheets = async () => {
    if (!selectedDay) {
      alert('Please select a day before printing instructor sheets.')
      return
    }

    const selectedInstructors = instructorNames.filter(name => instructorSelections[name])
    if (selectedInstructors.length === 0) {
      alert('Select at least one instructor to print.')
      return
    }

    const students = getStudentsForDay(selectedDay)
    if (students.length === 0) {
      alert('No roster data found for the selected day.')
      return
    }

    try {
      const rosterGroups = buildRosterGroups(students)
      if (instructorExtras.singlePrint) {
        const rostersToPrint = selectedInstructors.flatMap(name =>
          rosterGroups.filter(roster => roster.instructor === name),
        )

        if (rostersToPrint.length === 0) {
          alert('No classes found for the selected instructors.')
          return
        }

        const response = await fetch('/api/attendance-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildInstructorPayload(rostersToPrint)),
        })

        if (!response.ok) {
          const message = await response.text()
          throw new Error(message || 'Failed to generate instructor sheets')
        }

        const pdfBlob = await response.blob()
        openPdfPrintDialog(pdfBlob)
        return
      }

      const grouped = selectedInstructors
        .map(name => ({
          name,
          rosters: rosterGroups.filter(roster => roster.instructor === name),
        }))
        .filter(group => group.rosters.length > 0)

      if (grouped.length === 0) {
        alert('No classes found for the selected instructors.')
        return
      }

      for (const group of grouped) {
        const response = await fetch('/api/attendance-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildInstructorPayload(group.rosters, group.name)),
        })

        if (!response.ok) {
          const message = await response.text()
          throw new Error(message || `Failed to generate sheets for ${group.name}`)
        }

        const pdfBlob = await response.blob()
        openPdfPrintDialog(pdfBlob)
      }
    } catch (error) {
      console.error(error)
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Unable to generate instructor sheets. Please try again.'
      alert(message)
    }
  }

  const handlePrint = () => {}

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
        selections={instructorSelections}
        extras={instructorExtras}
        onClose={() => setActiveModal(null)}
        onToggleInstructor={handleToggleInstructor}
        onToggleExtra={handleToggleInstructorExtra}
        onPrint={handlePrintInstructorSheets}
      />
      <MasterlistOptionsModal
        open={activeModal === 'masterlist'}
        extras={masterlistExtras}
        onClose={() => setActiveModal(null)}
        onToggle={handleToggleMasterlistExtra}
        onPrint={handlePrint}
      />
      <SchematicOptionsModal
        open={activeModal === 'schematic'}
        options={schematicOptions}
        instructorNames={instructorNames}
        onClose={() => setActiveModal(null)}
        onToggleHighlight={handleToggleSchematicHighlight}
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

import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../app/AuthContext'
import { useCurrentSession } from '../../app/useCurrentSession'
import { useCurrentTeam } from '../../app/useCurrentTeam'
import { useCurrentTerm } from '../../app/useCurrentTerm'
import { getSessionTermLabel, syncReportCardsForDay } from '../../lib/reportCardSync'
import { fetchReportCardTotals } from '../../lib/serverApi'
import { useDay } from '../../app/DayContext'
import { getStudentsForDay, onStudentsUpdated } from '../../lib/storage'
import type { Student } from '../../types/app'
import { dayNames } from '../schematic/constants'

type LevelCount = {
  level: string
  count: number
}

type InstructorSummary = {
  name: string
  total: number
  levels: LevelCount[]
}

type EmployeeReportCardTotal = {
  name: string
  total: number
}

const normalizeLevel = (student: Student) => {
  const value = (student.service_name || student.level || '').trim()
  return value || 'Unknown'
}

const normalizeInstructor = (student: Student) => {
  const value = (student.instructor || '').trim()
  return value || 'Unassigned'
}

function ReportCardsPage() {
  const { selectedDay } = useDay()
  const { accountType, isGuest, user } = useAuth()
  const { access, session: currentSession } = useCurrentSession()
  const { currentTeam, currentTeamId } = useCurrentTeam()
  const { currentTerm } = useCurrentTerm()
  const [students, setStudents] = useState<Student[]>([])
  const [employeeTotals, setEmployeeTotals] = useState<EmployeeReportCardTotal[]>([])
  const [employeeTotalsLoading, setEmployeeTotalsLoading] = useState(false)
  const [syncWarning, setSyncWarning] = useState('')

  useEffect(() => {
    if (accountType === 'full_time') {
      setStudents([])
      return
    }
    setStudents(getStudentsForDay(selectedDay))
  }, [accountType, selectedDay])

  useEffect(() => {
    if (accountType === 'full_time') {
      return () => {}
    }
    return onStudentsUpdated(day => {
      if (day === selectedDay) {
        setStudents(getStudentsForDay(selectedDay))
      }
    })
  }, [accountType, selectedDay])

  useEffect(() => {
    if (accountType !== 'full_time') {
      setEmployeeTotals([])
      setEmployeeTotalsLoading(false)
      return
    }
    if (!currentTeamId || !currentTerm?.label) {
      setEmployeeTotals([])
      setEmployeeTotalsLoading(false)
      return
    }

    let active = true
    const loadEmployeeTotals = async () => {
      setEmployeeTotalsLoading(true)
      try {
        const response = await fetchReportCardTotals(currentTeamId, currentTerm.label)
        if (!active) {
          return
        }
        const data = response.totals ?? []
        const collator = new Intl.Collator('en', { sensitivity: 'base' })
        const totalsByEmployee = new Map<string, number>()

        ;(data ?? []).forEach(row => {
          const name = (row.instructor ?? '').trim() || 'Unassigned'
          const count = Math.max(0, row.number_of_report_cards ?? 0)
          totalsByEmployee.set(name, (totalsByEmployee.get(name) ?? 0) + count)
        })

        const totals = Array.from(totalsByEmployee.entries())
          .map(([name, total]) => ({ name, total }))
          .sort((a, b) => {
            if (a.total !== b.total) {
              return b.total - a.total
            }
            return collator.compare(a.name, b.name)
          })

        setEmployeeTotals(totals)
      } catch (error) {
        console.error('Failed to load full-time report card totals', error)
        setEmployeeTotals([])
      }
      setEmployeeTotalsLoading(false)
    }

    void loadEmployeeTotals()
    return () => {
      active = false
    }
  }, [accountType, currentTeamId, currentTerm?.label])

  const { instructorSummaries, lessonBlockTotals, totalStudents } = useMemo(() => {
    const instructorMap = new Map<string, Map<string, number>>()
    const totalMap = new Map<string, number>()
    let total = 0

    students.forEach(student => {
      const instructor = normalizeInstructor(student)
      const level = normalizeLevel(student)

      const instructorLevels = instructorMap.get(instructor) ?? new Map<string, number>()
      instructorLevels.set(level, (instructorLevels.get(level) ?? 0) + 1)
      instructorMap.set(instructor, instructorLevels)

      totalMap.set(level, (totalMap.get(level) ?? 0) + 1)
      total += 1
    })

    const collator = new Intl.Collator('en', { sensitivity: 'base' })
    const summaries: InstructorSummary[] = Array.from(instructorMap.entries())
      .map(([name, levels]) => {
        const levelCounts = Array.from(levels.entries())
          .map(([level, count]) => ({ level, count }))
          .sort((a, b) => collator.compare(a.level, b.level))
        const sum = levelCounts.reduce((acc, entry) => acc + entry.count, 0)
        return { name, total: sum, levels: levelCounts }
      })
      .sort((a, b) => collator.compare(a.name, b.name))

    const totals = Array.from(totalMap.entries())
      .map(([level, count]) => ({ level, count }))
      .sort((a, b) => collator.compare(a.level, b.level))

    return {
      instructorSummaries: summaries,
      lessonBlockTotals: totals,
      totalStudents: total,
    }
  }, [students])

  const dayLabel = selectedDay ? (dayNames[selectedDay] ?? selectedDay) : 'Select Day'
  const totalEmployeeReportCards = useMemo(
    () => employeeTotals.reduce((sum, employee) => sum + employee.total, 0),
    [employeeTotals],
  )
  const sessionLabel = useMemo(
    () =>
      getSessionTermLabel(
        currentSession?.session_season,
        currentSession?.session_year,
        currentSession?.start_date,
      ),
    [currentSession?.session_season, currentSession?.session_year, currentSession?.start_date],
  )

  useEffect(() => {
    if (
      accountType === 'full_time' ||
      !selectedDay ||
      isGuest ||
      !user ||
      access.mode !== 'owner' ||
      !sessionLabel
    ) {
      setSyncWarning('')
      return
    }

    const sync = async () => {
      const result = await syncReportCardsForDay({
        day: selectedDay,
        students,
        sessionLabel,
        teamId: currentSession?.team_id ?? null,
      })
      if (result.status === 'blocked_unassigned') {
        setSyncWarning(
          'Report card totals were not saved because some students are missing instructor assignments. Assign instructors in Schematic and save, then return to Report Cards.',
        )
        return
      }
      setSyncWarning('')
    }

    void sync().catch(error => {
      console.error('Failed to sync report card totals', error)
      setSyncWarning('Failed to sync report card totals. Please try again.')
    })
  }, [
    accountType,
    access.mode,
    currentSession?.team_id,
    isGuest,
    selectedDay,
    sessionLabel,
    students,
    user,
  ])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="relative overflow-hidden rounded-card border-2 border-secondary/20 bg-accent p-8 text-secondary shadow-md">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-secondary/15" />
        <div className="absolute -bottom-12 left-10 h-24 w-24 rounded-full bg-secondary/10" />
        <div className="relative">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary/70">
            Report Cards
          </p>
          <h2 className="mt-3 text-2xl font-semibold">Report Cards</h2>
          <p className="mt-2 max-w-2xl text-secondary">
            {accountType === 'full_time'
              ? 'Overview of total report card counts by employee for the selected team and term.'
              : 'Overview of report card counts by instructor and lesson block.'}
          </p>
          {accountType === 'full_time' ? (
            <>
              <p className="mt-3 text-sm font-semibold text-secondary/80">
                Team: <span className="font-semibold">{currentTeam?.name ?? 'No team selected'}</span>
              </p>
              <p className="mt-1 text-sm font-semibold text-secondary/80">
                Session Term: <span className="font-semibold">{currentTerm?.label ?? 'No term selected'}</span>
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm font-semibold text-secondary/80">
              Day: <span className="font-semibold">{dayLabel}</span>
            </p>
          )}
        </div>
      </div>

      {accountType === 'full_time' ? (
        !currentTeamId ? (
          <div className="rounded-card border-2 border-secondary/20 bg-bg p-6 text-secondary">
            Select a team on the home page to view employee report card totals.
          </div>
        ) : !currentTerm ? (
          <div className="rounded-card border-2 border-secondary/20 bg-bg p-6 text-secondary">
            Select a session term on the home page to view employee report card totals.
          </div>
        ) : employeeTotalsLoading ? (
          <div className="rounded-card border-2 border-secondary/20 bg-bg p-6 text-secondary">
            Loading employee report card totals...
          </div>
        ) : employeeTotals.length === 0 ? (
          <div className="rounded-card border-2 border-secondary/20 bg-bg p-6 text-secondary">
            No report card totals found for {currentTeam?.name ?? 'this team'} in {currentTerm.label}.
          </div>
        ) : (
          <section className="flex flex-col gap-4">
            <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="text-lg font-semibold">Employee Report Card Totals</h3>
                <span className="text-sm font-semibold text-secondary/80">
                  Session total: {totalEmployeeReportCards}
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {employeeTotals.map(employee => (
                  <div
                    key={`employee-total-${employee.name}`}
                    className="flex items-center justify-between rounded-2xl border border-secondary/20 bg-bg px-4 py-3"
                  >
                    <span className="text-sm font-semibold text-secondary">{employee.name}</span>
                    <span className="text-sm font-semibold text-secondary">{employee.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )
      ) : !selectedDay ? (
        <div className="rounded-card border-2 border-secondary/20 bg-bg p-6 text-secondary">
          Select a day to see report card counts.
        </div>
      ) : students.length === 0 ? (
        <div className="rounded-card border-2 border-secondary/20 bg-bg p-6 text-secondary">
          No students found for this day.
        </div>
      ) : (
        <>
          {syncWarning ? (
            <div className="rounded-card border-2 border-danger/40 bg-accent p-4 text-sm font-semibold text-danger shadow-md">
              {syncWarning}
            </div>
          ) : null}
          <section className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="text-lg font-semibold">Lesson Block Overview</h3>
              <span className="text-sm font-semibold text-secondary/80">
                Total students: {totalStudents}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lessonBlockTotals.map(entry => (
                <div
                  key={`total-${entry.level}`}
                  className="flex items-center justify-between rounded-2xl border border-secondary/20 bg-bg px-4 py-3"
                >
                  <span className="text-sm font-semibold text-secondary">{entry.level}</span>
                  <span className="text-sm font-semibold text-secondary">{entry.count}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-secondary">Instructor Report Card Needs</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {instructorSummaries.map(summary => (
                <div
                  key={`instructor-${summary.name}`}
                  className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="text-base font-semibold">{summary.name}</h4>
                    <span className="text-sm font-semibold text-secondary/80">
                      Total: {summary.total}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {summary.levels.map(level => (
                      <div
                        key={`${summary.name}-${level.level}`}
                        className="flex items-center justify-between rounded-2xl border border-secondary/20 bg-bg px-4 py-2"
                      >
                        <span className="text-sm font-semibold text-secondary">{level.level}</span>
                        <span className="text-sm font-semibold text-secondary">{level.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default ReportCardsPage

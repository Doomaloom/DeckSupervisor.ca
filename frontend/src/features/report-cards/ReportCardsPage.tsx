import React, { useEffect, useMemo, useState } from 'react'
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
  const [students, setStudents] = useState<Student[]>([])

  useEffect(() => {
    setStudents(getStudentsForDay(selectedDay))
  }, [selectedDay])

  useEffect(() => {
    return onStudentsUpdated(day => {
      if (day === selectedDay) {
        setStudents(getStudentsForDay(selectedDay))
      }
    })
  }, [selectedDay])

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
            Overview of report card counts by instructor and lesson block.
          </p>
          <p className="mt-3 text-sm font-semibold text-secondary/80">
            Day: <span className="font-semibold">{dayLabel}</span>
          </p>
        </div>
      </div>

      {!selectedDay ? (
        <div className="rounded-card border-2 border-secondary/20 bg-bg p-6 text-secondary">
          Select a day to see report card counts.
        </div>
      ) : students.length === 0 ? (
        <div className="rounded-card border-2 border-secondary/20 bg-bg p-6 text-secondary">
          No students found for this day.
        </div>
      ) : (
        <>
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

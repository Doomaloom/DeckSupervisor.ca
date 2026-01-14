import React, { useEffect, useMemo, useState } from 'react'
import { useDay } from '../../app/DayContext'
import { processCsvAndStore } from '../../lib/api'
import { extractEndTime, extractStartTime, getRunningMinutes } from '../../lib/time'
import { getScheduleForDay, getStudentsForDay, onStudentsUpdated, setScheduleForDay } from '../../lib/storage'
import type { Student } from '../../types/app'

type Course = {
    code: string
    level: string
    runningTime: number
    startTime: string
    endTime: string
    startMinutes: number
    endMinutes: number
    studentCount: number
}

type DragState = {
    code: string
    columnIndex: number
}

const SLOT_MINUTES = 15
const SLOT_HEIGHT_REM = 3.5
const HEADER_HEIGHT_REM = 4.95
const DEFAULT_CAPACITY = 12

const classCapacities: Record<string, number> = {
    // Example: 'Splash 2A': 6
    'Little Splash 1': 4,
    'Little Splash 2': 5,
    'Little Splash 3': 5,
    'Little Splash 4': 5,
    'Little Splash 5': 5,
    'Splash 1': 6,
    'Splash 2A': 6,
    'Splash 2B': 6,
    'Splash 3': 7,
    'Splash 4': 9,
    'Splash 5': 11,
    'Splash 6': 11,
    'Splash 7': 12,
    'Splash 8': 12,
    'Splash 9': 12,
    'Splash 10': 12,
    'Splash Adult 1': 8,
    'Splash Adult 2': 8,
    'Splash Adult 3': 8,
    'Inclusion': 3,
    'Private Lesson': 1,
}

const normalizedCapacities = Object.fromEntries(
    Object.entries(classCapacities).map(([key, value]) => [key.replace(/\s+/g, '').toLowerCase(), value]),
)

function timeToMinutes(time: string) {
    const [hours, minutes] = time.split(':').map(Number)
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        return 0
    }
    return hours * 60 + minutes
}

function buildCourses(students: Student[]): Course[] {
    const map = new Map<string, Course>()
    students.forEach(student => {
        const existing = map.get(student.code)
        if (existing) {
            existing.studentCount += 1
            return
        }
        const startTime = extractStartTime(student.time)
        const endTime = extractEndTime(student.time)
        const startMinutes = timeToMinutes(startTime)
        const endMinutes = timeToMinutes(endTime)
        map.set(student.code, {
            code: student.code,
            level: student.level || student.service_name,
            runningTime: getRunningMinutes(student.time),
            startTime,
            endTime,
            startMinutes,
            endMinutes,
            studentCount: 1,
        })
    })

    return Array.from(map.values()).sort((a, b) => {
        if (a.startTime === b.startTime) {
            return a.endTime.localeCompare(b.endTime)
        }
        return a.startTime.localeCompare(b.startTime)
    })
}

function getCapacity(course: Course) {
    const normalized = course.level.replace(/\s+/g, '').toLowerCase()
    const partialMatch = Object.entries(normalizedCapacities)
        .filter(([key]) => key.includes('private') || key.includes('inclusion'))
        .reduce<{ key: string; value: number } | null>((best, [key, value]) => {
            if (!normalized.includes(key)) {
                return best
            }
            if (!best || key.length > best.key.length) {
                return { key, value }
            }
            return best
        }, null)
    if (partialMatch) {
        return partialMatch.value
    }
    if (normalized.includes('adult') || normalized.includes('teen')) {
        const match = normalized.match(/(\d+)/)
        if (match) {
            const number = match[1]
            if (normalized.includes('adult')) {
                const adultKey = `splashadult${number}`
                return normalizedCapacities[adultKey] ?? DEFAULT_CAPACITY
            }
            const teenKey = `splashteen${number}`
            return normalizedCapacities[teenKey] ?? DEFAULT_CAPACITY
        }
    }
    return normalizedCapacities[normalized] ?? DEFAULT_CAPACITY
}

function isExceptionClass(level: string) {
    const normalized = level.toLowerCase()
    return normalized.includes('private') || normalized.includes('inclusion')
}

function getCapacityClass(course: Course, capacity: number) {
    if (course.studentCount === 1 && !isExceptionClass(course.level)) {
        return 'border-rose-200 bg-rose-100 text-rose-700'
    }
    if (course.studentCount < Math.floor(capacity / 2)) {
        return 'border-amber-200 bg-amber-100 text-amber-700'
    }
    return 'border-emerald-200 bg-emerald-100 text-emerald-700'
}

function buildColumns(courses: Course[]): Course[][] {
    const columns: Course[][] = []
    courses.forEach(course => {
        let added = false
        for (const column of columns) {
            const lastCourse = column[column.length - 1]
            if (lastCourse.endTime <= course.startTime) {
                column.push(course)
                added = true
                break
            }
        }
        if (!added) {
            columns.push([course])
        }
    })
    return columns
}

function coursesMatchTime(a: Course, b: Course) {
  return a.startMinutes === b.startMinutes && a.endMinutes === b.endMinutes
}

function coursesOverlap(a: Course, b: Course) {
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes
}

function findContiguousSwapIndices(column: Course[], course: Course) {
  const overlapping = column
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => coursesOverlap(entry, course))
    .sort((a, b) => a.entry.startMinutes - b.entry.startMinutes)

  if (overlapping.length === 0) {
    return []
  }

  if (overlapping[0].entry.startMinutes !== course.startMinutes) {
    return []
  }

  for (let i = 1; i < overlapping.length; i += 1) {
    if (overlapping[i - 1].entry.endMinutes !== overlapping[i].entry.startMinutes) {
      return []
    }
  }

  const last = overlapping[overlapping.length - 1].entry
  if (last.endMinutes !== course.endMinutes) {
    return []
  }

  return overlapping.map(item => item.index)
}

function canReplaceByStart(column: Course[], course: Course, targetIndex: number) {
  const target = column[targetIndex]
  if (!target || target.startMinutes !== course.startMinutes) {
    return false
  }
  return !column.some((entry, index) => index !== targetIndex && coursesOverlap(entry, course))
}

function buildTimeLabels(start: string, end: string): string[] {
    if (!start || !end) {
        return []
    }
    const labels: string[] = []
    const startDate = new Date(`1970-01-01T${start}:00`)
    const endDate = new Date(`1970-01-01T${end}:00`)
    const startMinutes = startDate.getMinutes()
    if (startMinutes % 15 !== 0) {
        startDate.setMinutes(startMinutes - (startMinutes % 15), 0, 0)
    }
    const endMinutes = endDate.getMinutes()
    if (endMinutes % 15 !== 0) {
        endDate.setMinutes(endMinutes + (15 - (endMinutes % 15)), 0, 0)
    }
    let current = startDate
    while (current < endDate) {
        labels.push(current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }))
        current = new Date(current.getTime() + 15 * 60000)
    }
    return labels
}

function SchematicPage() {
    const { selectedDay } = useDay()
    const [columns, setColumns] = useState<Course[][]>([])
    const [instructors, setInstructors] = useState<string[]>([])
    const [dragged, setDragged] = useState<DragState | null>(null)
    const [fileStatus, setFileStatus] = useState('No file selected.')
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
    const courses = useMemo(() => buildCourses(students), [students])
    const scheduleStartMinutes = useMemo(() => {
        if (courses.length === 0) {
            return 0
        }
        const earliest = Math.min(...courses.map(course => course.startMinutes))
        return earliest - (earliest % SLOT_MINUTES)
    }, [courses])
    const timeLabels = useMemo(() => {
        const earliest = courses[0]?.startTime ?? ''
        const latest = courses.reduce((latestEnd, course) => {
            return course.endTime > latestEnd ? course.endTime : latestEnd
        }, '00:00')
        return buildTimeLabels(earliest, latest)
    }, [courses])
  const scheduleHeightRem = Math.max(timeLabels.length * SLOT_HEIGHT_REM, SLOT_HEIGHT_REM)

    useEffect(() => {
        const initialColumns = buildColumns(courses)
        const stored = getScheduleForDay(selectedDay)

        if (stored && stored.codes.length > 0) {
            const courseMap = new Map(courses.map(course => [course.code, course]))
            const nextColumns = stored.codes
                .map(codes => codes.split(',').map(code => courseMap.get(code)).filter(Boolean) as Course[])
                .filter(column => column.length > 0)
            setColumns(nextColumns.length ? nextColumns : initialColumns)
            setInstructors(stored.instructors ?? [])
        } else {
            setColumns(initialColumns)
            setInstructors(initialColumns.map(() => ''))
        }
    }, [courses, selectedDay])

    const handleDragStart = (event: React.DragEvent<HTMLDivElement>, course: Course, columnIndex: number) => {
        setDragged({ code: course.code, columnIndex })
        const target = event.currentTarget
        const rect = target.getBoundingClientRect()
        const offsetX = event.clientX - rect.left
        const offsetY = event.clientY - rect.top
        event.dataTransfer.setDragImage(target, offsetX, offsetY)
    }

  const handleDrop = (columnIndex: number) => {
    if (!dragged) {
      return
    }
    setColumns(current => {
      const next = current.map(column => [...column])
      const sourceColumn = next[dragged.columnIndex]
      const courseIndex = sourceColumn.findIndex(course => course.code === dragged.code)
      if (courseIndex === -1) {
        return current
      }
      const [course] = sourceColumn.splice(courseIndex, 1)
      const targetColumn = next[columnIndex]
      if (dragged.columnIndex === columnIndex) {
        sourceColumn.push(course)
        sourceColumn.sort((a, b) => a.startTime.localeCompare(b.startTime))
        return next.filter(column => column.length > 0)
      }
      const swapIndices = findContiguousSwapIndices(targetColumn, course)
      if (swapIndices.length > 0) {
        const swapCourses = swapIndices
          .slice()
          .sort((a, b) => b - a)
          .map(index => targetColumn.splice(index, 1)[0])
        sourceColumn.push(...swapCourses)
        sourceColumn.sort((a, b) => a.startTime.localeCompare(b.startTime))
        targetColumn.push(course)
        targetColumn.sort((a, b) => a.startTime.localeCompare(b.startTime))
        return next.filter(column => column.length > 0)
      }
      const replaceIndex = targetColumn.findIndex(target => target.startMinutes === course.startMinutes)
      if (replaceIndex !== -1 && canReplaceByStart(targetColumn, course, replaceIndex)) {
        const [replaceCourse] = targetColumn.splice(replaceIndex, 1)
        sourceColumn.push(replaceCourse)
        sourceColumn.sort((a, b) => a.startTime.localeCompare(b.startTime))
        targetColumn.push(course)
        targetColumn.sort((a, b) => a.startTime.localeCompare(b.startTime))
        return next.filter(column => column.length > 0)
      }
      if (targetColumn.some(target => coursesOverlap(target, course))) {
        sourceColumn.splice(courseIndex, 0, course)
        return current
      }
      targetColumn.push(course)
      targetColumn.sort((a, b) => a.startTime.localeCompare(b.startTime))
      return next.filter(column => column.length > 0)
    })
    setDragged(null)
  }

    const handleDropOnCourse = (targetCourse: Course, targetColumnIndex: number) => {
    if (!dragged) {
      return
    }
    if (dragged.columnIndex === targetColumnIndex && dragged.code === targetCourse.code) {
      setDragged(null)
      return
        }
        setColumns(current => {
            const next = current.map(column => [...column])
            const sourceColumn = next[dragged.columnIndex]
            const sourceIndex = sourceColumn.findIndex(course => course.code === dragged.code)
            const targetColumn = next[targetColumnIndex]
            const targetIndex = targetColumn.findIndex(course => course.code === targetCourse.code)
      if (sourceIndex === -1 || targetIndex === -1) {
        return current
      }
      const [sourceCourse] = sourceColumn.splice(sourceIndex, 1)
      const swapIndices = findContiguousSwapIndices(targetColumn, sourceCourse)
      if (swapIndices.length > 0) {
        const swapCourses = swapIndices
          .slice()
          .sort((a, b) => b - a)
          .map(index => targetColumn.splice(index, 1)[0])
        sourceColumn.push(...swapCourses)
        targetColumn.push(sourceCourse)
        sourceColumn.sort((a, b) => a.startTime.localeCompare(b.startTime))
        targetColumn.sort((a, b) => a.startTime.localeCompare(b.startTime))
      } else {
        if (canReplaceByStart(targetColumn, sourceCourse, targetIndex)) {
          const [destinationCourse] = targetColumn.splice(targetIndex, 1)
          sourceColumn.push(destinationCourse)
          targetColumn.push(sourceCourse)
          sourceColumn.sort((a, b) => a.startTime.localeCompare(b.startTime))
          targetColumn.sort((a, b) => a.startTime.localeCompare(b.startTime))
        } else {
          sourceColumn.splice(sourceIndex, 0, sourceCourse)
        }
      }
      return next
    })
    setDragged(null)
  }

    const handleFileChange = async (nextFile: File | null) => {
        if (!nextFile) {
            setFileStatus('No file selected.')
            return
        }
        if (!selectedDay) {
            alert('Please select a day before uploading.')
            return
        }
        setFileStatus(`File Uploaded: ${nextFile.name}`)
        await processCsvAndStore(nextFile, selectedDay)
        setStudents(getStudentsForDay(selectedDay))
    }

    const handleSaveSchedule = () => {
        if (!selectedDay) {
            alert('Please select a day first.')
            return
        }
        const codes = columns.map(column => column.map(course => course.code).join(','))
        setScheduleForDay(selectedDay, {
            instructors,
            codes,
        })
        alert('Schedule saved successfully!')
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
    const dayLabel = selectedDay ? (dayNames[selectedDay] ?? selectedDay) : 'Select Day'

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <div className="flex w-full flex-col gap-4 overflow-x-auto">
                <div className="flex flex-wrap gap-3">
                    <span className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-accent">
                        Schematic
                    </span>
                    <span className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-accent">
                        {dayLabel} Winter 2026
                    </span>
                </div>

                <div className="flex w-full items-start justify-center gap-4">
                    <div className="mt-8 flex min-w-[70px] flex-col items-center text-xs text-secondary">
                        <div style={{ height: `${HEADER_HEIGHT_REM}rem` }} />
                        {timeLabels.map(label => (
                            <div className="py-2" key={`left-${label}`}>
                                {label}
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-3" id="main-content">
                        {columns.length === 0 && (
                            <p className="text-secondary">
                                No schedule data loaded. Upload a CSV file to generate the schedule.
                            </p>
                        )}
                        <div className="rounded-xl bg-primary px-4 py-2 text-center font-semibold text-accent">
                            Instructors/Level
                        </div>
                        <div className="flex gap-4">
                            {columns.map((column, columnIndex) => (
                                <div
                                    className="flex min-w-[220px] flex-1 flex-col"
                                    key={`column-${columnIndex}`}
                                    onDragOver={event => event.preventDefault()}
                                    onDrop={() => handleDrop(columnIndex)}
                                >
                                    <div className="rounded-t-xl border-2 border-secondary bg-accent p-2">
                                        <input
                                            className="w-full rounded-lg border-2 border-secondary bg-bg px-2 py-1 text-sm text-primary"
                                            type="text"
                                            value={instructors[columnIndex] ?? ''}
                                            placeholder={`Instructor ${columnIndex + 1}`}
                                            onChange={event => {
                                                const value = event.target.value
                                                setInstructors(current => {
                                                    const next = [...current]
                                                    next[columnIndex] = value
                                                    return next
                                                })
                                            }}
                                        />
                                    </div>
                                    <div
                                        className="relative rounded-b-xl border-2 border-secondary bg-bg"
                                        style={{ height: `${scheduleHeightRem}rem` }}
                                    >
                                        {column.map(course => {
                                            const startOffset =
                                                (course.startMinutes - scheduleStartMinutes) / SLOT_MINUTES
                                            const courseHeight = course.runningTime / SLOT_MINUTES
                                            const capacity = getCapacity(course)
                                            const capacityClass = getCapacityClass(course, capacity)
                                            return (
                                                <div
                                                    key={course.code}
                                                    className="absolute left-2 right-2 flex flex-col gap-2 rounded-xl border-2 border-secondary bg-accent p-2 text-xs shadow-md"
                                                    draggable
                                                    onDragStart={event => handleDragStart(event, course, columnIndex)}
                                                    onDragOver={event => event.preventDefault()}
                                                    onDrop={() => handleDropOnCourse(course, columnIndex)}
                                                    style={{
                                                        top: `${startOffset * SLOT_HEIGHT_REM}rem`,
                                                        height: `${courseHeight * SLOT_HEIGHT_REM}rem`,
                                                    }}
                                                >
                                                    <div className="flex flex-col gap-1">
                                                        <p className="font-semibold text-secondary">{course.level}</p>
                                                        <p className="text-primary">{course.code}</p>
                                                    </div>
                                                    <div
                                                        className={`mt-auto w-fit rounded-md border px-2 py-1 text-[0.7rem] font-semibold ${capacityClass}`}
                                                    >
                                                        {course.studentCount} of {capacity}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-8 flex min-w-[70px] flex-col items-center text-xs text-secondary">
                        <div style={{ height: `${HEADER_HEIGHT_REM}rem` }} />
                        {timeLabels.map(label => (
                            <div className="py-2" key={`right-${label}`}>
                                {label}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex justify-center">
                <button
                    className="rounded-2xl bg-primary px-6 py-3 text-white transition hover:-translate-y-0.5 hover:bg-secondary"
                    onClick={handleSaveSchedule}
                >
                    Save Schedule
                </button>
            </div>
        </div>
    )
}

export default SchematicPage

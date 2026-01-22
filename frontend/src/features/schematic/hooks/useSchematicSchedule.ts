import { useEffect, useMemo, useState } from 'react'
import {
    getScheduleForDay,
    getStudentsForDay,
    onStudentsUpdated,
    setInstructorsForDay,
    setInstructorCoursesForDay,
    setScheduleForDay,
    setStudentsForDay,
} from '../../../lib/storage'
import { prefetchInstructorPacket } from '../../../lib/instructorPdfCache'
import type { Student } from '../../../types/app'
import { SLOT_HEIGHT_REM, SLOT_MINUTES } from '../constants'
import type { Course, DragState } from '../types'
import { buildColumns, buildCourses, coursesOverlap } from '../utils/courses'
import { canPlaceCourses, canReplaceByStart, findContiguousSwapIndices } from '../utils/drag'
import { buildTimeLabels } from '../utils/time'

type SessionInstructor = {
    name: string
}

type SessionEntry = {
    id: string
    instructors: SessionInstructor[]
}

const SESSIONS_STORAGE_KEY = 'decksupervisor.sessions'
const CURRENT_SESSION_KEY = 'decksupervisor.currentSessionId'

export function useSchematicSchedule(selectedDay: string | null) {
    const [columns, setColumns] = useState<Course[][]>([])
    const [instructors, setInstructors] = useState<string[]>([])
    const [dragged, setDragged] = useState<DragState | null>(null)
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
    const instructorOptions = useMemo(() => {
        if (typeof window === 'undefined') {
            return []
        }
        const currentSessionId = localStorage.getItem(CURRENT_SESSION_KEY) ?? ''
        if (!currentSessionId) {
            return []
        }
        const stored = localStorage.getItem(SESSIONS_STORAGE_KEY)
        if (!stored) {
            return []
        }
        try {
            const sessions = JSON.parse(stored) as SessionEntry[]
            const session = sessions.find(item => item.id === currentSessionId)
            if (!session) {
                return []
            }
            const names = session.instructors.map(instructor => instructor.name.trim()).filter(Boolean)
            return Array.from(new Set(names))
        } catch (error) {
            console.error('Failed to parse stored sessions', error)
            return []
        }
    }, [selectedDay])

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
                const swapCourses = swapIndices.map(index => targetColumn[index])
                if (!canPlaceCourses(sourceColumn, swapCourses)) {
                    sourceColumn.splice(courseIndex, 0, course)
                    return current
                }
                const removed = swapIndices
                    .slice()
                    .sort((a, b) => b - a)
                    .map(index => targetColumn.splice(index, 1)[0])
                sourceColumn.push(...removed)
                sourceColumn.sort((a, b) => a.startTime.localeCompare(b.startTime))
                targetColumn.push(course)
                targetColumn.sort((a, b) => a.startTime.localeCompare(b.startTime))
                return next.filter(column => column.length > 0)
            }
            const replaceIndex = targetColumn.findIndex(target => target.startMinutes === course.startMinutes)
            if (replaceIndex !== -1 && canReplaceByStart(targetColumn, course, replaceIndex)) {
                const replaceCourse = targetColumn[replaceIndex]
                if (!replaceCourse || !canPlaceCourses(sourceColumn, [replaceCourse])) {
                    sourceColumn.splice(courseIndex, 0, course)
                    return current
                }
                targetColumn.splice(replaceIndex, 1)
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
                const swapCourses = swapIndices.map(index => targetColumn[index])
                if (!canPlaceCourses(sourceColumn, swapCourses)) {
                    sourceColumn.splice(sourceIndex, 0, sourceCourse)
                    return current
                }
                const removed = swapIndices
                    .slice()
                    .sort((a, b) => b - a)
                    .map(index => targetColumn.splice(index, 1)[0])
                sourceColumn.push(...removed)
                targetColumn.push(sourceCourse)
                sourceColumn.sort((a, b) => a.startTime.localeCompare(b.startTime))
                targetColumn.sort((a, b) => a.startTime.localeCompare(b.startTime))
            } else {
                if (canReplaceByStart(targetColumn, sourceCourse, targetIndex)) {
                    const destinationCourse = targetColumn[targetIndex]
                    if (!destinationCourse || !canPlaceCourses(sourceColumn, [destinationCourse])) {
                        sourceColumn.splice(sourceIndex, 0, sourceCourse)
                        return current
                    }
                    targetColumn.splice(targetIndex, 1)
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

        const assignments = columns.map((column, index) => ({
            name: (instructors[index] ?? '').trim(),
            codes: column.map(course => course.code),
        })).filter(entry => entry.codes.length > 0 || entry.name)

        setInstructorCoursesForDay(selectedDay, { instructors: assignments })
        setInstructorsForDay(selectedDay, {
            names: assignments.map(entry => entry.name),
            codes: assignments.map(entry => entry.codes.join(',')),
        })

        const instructorByCode = new Map<string, string>()
        assignments.forEach(entry => {
            if (!entry.name) {
                return
            }
            entry.codes.forEach(code => instructorByCode.set(code, entry.name))
        })

        const dayStudents = getStudentsForDay(selectedDay)
        const updated = dayStudents.map(student => {
            const instructor = instructorByCode.get(student.code)
            if (!instructor) {
                return student
            }
            return { ...student, instructor }
        })
        setStudentsForDay(selectedDay, updated)
        void prefetchInstructorPacket(selectedDay)
        alert('Schedule saved successfully!')
    }

    const setInstructorAt = (index: number, value: string) => {
        setInstructors(current => {
            const next = [...current]
            next[index] = value
            return next
        })
    }

    return {
        columns,
        instructors,
        timeLabels,
        scheduleHeightRem,
        scheduleStartMinutes,
        instructorOptions,
        handleDragStart,
        handleDrop,
        handleDropOnCourse,
        handleSaveSchedule,
        setInstructorAt,
    }
}

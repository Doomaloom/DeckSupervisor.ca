import { useEffect, useMemo, useState } from 'react'
import { formatSessionTermLabel as getSessionTermLabel } from '../../../shared/session/sessionLabels'
import {
    getScheduleForDay,
    getStudentsForDay,
    onStudentsUpdated,
    setInstructorsForDay,
    setInstructorCoursesForDay,
    setScheduleForDay,
    setStudentsForDay,
} from '../../../lib/storage'
import { useCurrentSession } from '../../../app/useCurrentSession'
import { fetchRequestAssignments, fetchSchematic, upsertSchematic } from '../../../lib/serverApi'
import { prefetchInstructorPacket } from '../../../lib/instructorPdfCache'
import type { RequestAssignment, Student } from '../../../types/app'
import { SLOT_HEIGHT_REM, SLOT_MINUTES } from '../constants'
import type { Course, DragState } from '../types'
import { buildCourses, coursesOverlap } from '../utils/courses'
import { createRequestAwareLayout, getLockedInstructorForColumn, type StoredCourseLayout } from '../utils/layout'
import { canPlaceCourses, canReplaceByStart, canSwapSingleCourses, findContiguousSwapIndices } from '../utils/drag'
import { buildTimeLabels } from '../utils/time'

function sortCoursesByStart(courses: Course[]) {
    return [...courses].sort((left, right) => left.startTime.localeCompare(right.startTime))
}

function clearSelectionAndDrag(course: Course, columnIndex: number) {
    return {
        codes: [course.code],
        columnIndex,
    }
}

function findSwapCandidatesForBlock(sourceColumn: Course[], targetColumn: Course[], movingCourses: Course[]) {
    if (movingCourses.length === 0) {
        return []
    }

    const overlapping = sortCoursesByStart(
        targetColumn.filter(entry => movingCourses.some(course => coursesOverlap(entry, course))),
    )
    if (overlapping.length === 0) {
        return []
    }

    if (overlapping.some(course => course.isLockedToInstructor)) {
        return []
    }

    const remainingTargetCourses = targetColumn.filter(
        course => !overlapping.some(entry => entry.code === course.code),
    )
    if (!canPlaceCourses(remainingTargetCourses, movingCourses)) {
        return []
    }

    if (!canPlaceCourses(sourceColumn, overlapping)) {
        return []
    }

    return overlapping
}

export function useSchematicSchedule(selectedDay: string | null) {
    const { access, session: currentSession, sessionId } = useCurrentSession()
    const [columns, setColumns] = useState<Course[][]>([])
    const [instructors, setInstructors] = useState<string[]>([])
    const [lockedInstructors, setLockedInstructors] = useState<string[]>([])
    const [dragged, setDragged] = useState<DragState | null>(null)
    const [selectedCourseCodes, setSelectedCourseCodes] = useState<string[]>([])
    const [students, setStudents] = useState<Student[]>([])
    const [remoteSchedule, setRemoteSchedule] = useState<StoredCourseLayout | null>(null)
    const [requestAssignments, setRequestAssignments] = useState<RequestAssignment[]>([])
    const [extraEmptyColumns, setExtraEmptyColumns] = useState(0)

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

    useEffect(() => {
        if (access.mode === 'guest' || !currentSession?.location) {
            setRequestAssignments([])
            return
        }
        const term = getSessionTermLabel(
            currentSession?.session_season,
            currentSession?.session_year ?? null,
            currentSession?.start_date,
        )
        const location = currentSession.location?.trim() ?? ''
        if (!term || !location) {
            setRequestAssignments([])
            return
        }

        let active = true
        const load = async () => {
            try {
                const response = await fetchRequestAssignments({ term, location })
                if (!active) {
                    return
                }
                setRequestAssignments(response.assignments ?? [])
            } catch (error) {
                console.error('Failed to load request assignments for schematic', error)
                if (active) {
                    setRequestAssignments([])
                }
            }
        }

        void load()
        return () => {
            active = false
        }
    }, [access.mode, currentSession?.location, currentSession?.session_season, currentSession?.session_year, currentSession?.start_date])

    const requestInstructorByCode = useMemo(() => {
        const map = new Map<string, string>()
        requestAssignments.forEach(entry => {
            const code = entry.eventId.trim()
            const instructor = entry.instructor.trim()
            if (!code || !instructor) {
                return
            }
            map.set(code, instructor)
        })
        return map
    }, [requestAssignments])

    const courses = useMemo(() => buildCourses(students, requestInstructorByCode), [requestInstructorByCode, students])
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
        const names = currentSession?.instructors?.map(instructor => instructor.name.trim()).filter(Boolean) ?? []
        requestAssignments.forEach(entry => {
            const instructor = entry.instructor.trim()
            if (instructor) {
                names.push(instructor)
            }
        })
        return Array.from(new Set(names))
    }, [currentSession, requestAssignments])

    useEffect(() => {
        if (access.mode === 'guest' || !sessionId || !currentSession) {
            setRemoteSchedule(null)
            return
        }
        let active = true
        const loadRemote = async () => {
            const response = await fetchSchematic(sessionId)
            if (!active) {
                return
            }
            const dataValue = response.schematic?.data as { codes?: string[]; instructors?: string[] } | undefined
            if (dataValue?.codes?.length) {
                setRemoteSchedule({
                    codes: dataValue.codes ?? [],
                    instructors: dataValue.instructors ?? [],
                })
            } else {
                setRemoteSchedule(null)
            }
        }
        void loadRemote()
        return () => {
            active = false
        }
    }, [access.mode, currentSession, sessionId])

    useEffect(() => {
        const stored = access.mode === 'guest' ? getScheduleForDay(selectedDay) : remoteSchedule
        const emptyStoredColumns = (stored?.codes ?? []).filter(code => !code.trim()).length
        setExtraEmptyColumns(emptyStoredColumns)
    }, [access.mode, remoteSchedule, selectedDay])

    useEffect(() => {
        const stored = access.mode === 'guest' ? getScheduleForDay(selectedDay) : remoteSchedule
        const layout = createRequestAwareLayout(courses, stored)
        for (let index = 0; index < extraEmptyColumns; index += 1) {
            layout.columns.push([])
            layout.instructors.push('')
            layout.lockedInstructors.push('')
        }
        setColumns(layout.columns)
        setInstructors(layout.instructors)
        setLockedInstructors(layout.lockedInstructors)
    }, [access.mode, courses, extraEmptyColumns, remoteSchedule, selectedDay])

    useEffect(() => {
        setSelectedCourseCodes(current => current.filter(code => courses.some(course => course.code === code)))
        setDragged(current => {
            if (!current) {
                return null
            }
            const nextCodes = current.codes.filter(code => courses.some(course => course.code === code))
            if (nextCodes.length === 0) {
                return null
            }
            return { ...current, codes: nextCodes }
        })
    }, [courses])

    const toggleCourseSelection = (course: Course, columnIndex: number) => {
        if (course.isLockedToInstructor) {
            return
        }
        setSelectedCourseCodes(current => {
            if (current.includes(course.code)) {
                return current.filter(code => code !== course.code)
            }
            const selectionIsFromSameColumn =
                current.length > 0 &&
                current.every(code => (columns[columnIndex] ?? []).some(entry => entry.code === code))
            if (!selectionIsFromSameColumn) {
                return [course.code]
            }
            return [...current, course.code]
        })
    }

    const handleDragStart = (event: React.DragEvent<HTMLDivElement>, course: Course, columnIndex: number) => {
        if (course.isLockedToInstructor) {
            event.preventDefault()
            return
        }
        const selectedInSameColumn =
            selectedCourseCodes.length > 0 &&
            selectedCourseCodes.includes(course.code) &&
            selectedCourseCodes.every(code => (columns[columnIndex] ?? []).some(entry => entry.code === code))
                ? selectedCourseCodes
                : null
        const nextDragged = selectedInSameColumn
            ? { codes: selectedInSameColumn, columnIndex }
            : clearSelectionAndDrag(course, columnIndex)

        setSelectedCourseCodes(selectedInSameColumn ?? [])
        setDragged(nextDragged)
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
            const movingCourses = sortCoursesByStart(sourceColumn.filter(course => dragged.codes.includes(course.code)))
            if (movingCourses.length !== dragged.codes.length || movingCourses.some(course => course.isLockedToInstructor)) {
                return current
            }
            next[dragged.columnIndex] = sourceColumn.filter(course => !dragged.codes.includes(course.code))
            const targetColumn = next[columnIndex]
            if (dragged.columnIndex === columnIndex) {
                next[columnIndex] = sortCoursesByStart([...targetColumn, ...movingCourses])
                return next
            }
            if (!canPlaceCourses(targetColumn, movingCourses)) {
                const swapCourses = findSwapCandidatesForBlock(next[dragged.columnIndex], targetColumn, movingCourses)
                if (swapCourses.length === 0) {
                    return current
                }
                next[columnIndex] = sortCoursesByStart(
                    targetColumn.filter(course => !swapCourses.some(entry => entry.code === course.code)).concat(movingCourses),
                )
                next[dragged.columnIndex] = sortCoursesByStart([...next[dragged.columnIndex], ...swapCourses])
                return next
            }
            next[columnIndex] = sortCoursesByStart([...targetColumn, ...movingCourses])
            return next
        })
        setDragged(null)
        setSelectedCourseCodes([])
    }

    const handleDropOnCourse = (targetCourse: Course, targetColumnIndex: number) => {
        if (!dragged) {
            return
        }
        if (dragged.columnIndex === targetColumnIndex && dragged.codes.includes(targetCourse.code)) {
            setDragged(null)
            return
        }
        if (dragged.codes.length > 1) {
            handleDrop(targetColumnIndex)
            return
        }

        setColumns(current => {
            const next = current.map(column => [...column])
            const sourceColumn = next[dragged.columnIndex]
            const sourceIndex = sourceColumn.findIndex(course => course.code === dragged.codes[0])
            const targetColumn = next[targetColumnIndex]
            const targetIndex = targetColumn.findIndex(course => course.code === targetCourse.code)
            if (sourceIndex === -1 || targetIndex === -1) {
                return current
            }

            const [sourceCourse] = sourceColumn.splice(sourceIndex, 1)
            if (sourceCourse.isLockedToInstructor || targetCourse.isLockedToInstructor) {
                sourceColumn.splice(sourceIndex, 0, sourceCourse)
                return current
            }

            const swapIndices = findContiguousSwapIndices(targetColumn, sourceCourse)
            if (swapIndices.length > 0) {
                const swapCourses = swapIndices.map(index => targetColumn[index])
                if (!canPlaceCourses(sourceColumn, swapCourses)) {
                    sourceColumn.splice(sourceIndex, 0, sourceCourse)
                    return current
                }
                const removed = swapIndices
                    .slice()
                    .sort((left, right) => right - left)
                    .map(index => targetColumn.splice(index, 1)[0])
                sourceColumn.push(...removed)
                targetColumn.push(sourceCourse)
                next[dragged.columnIndex] = sortCoursesByStart(sourceColumn)
                next[targetColumnIndex] = sortCoursesByStart(targetColumn)
                return next
            }

            if (canReplaceByStart(targetColumn, sourceCourse, targetIndex)) {
                const destinationCourse = targetColumn[targetIndex]
                if (!destinationCourse || !canPlaceCourses(sourceColumn, [destinationCourse])) {
                    sourceColumn.splice(sourceIndex, 0, sourceCourse)
                    return current
                }
                targetColumn.splice(targetIndex, 1)
                sourceColumn.push(destinationCourse)
                targetColumn.push(sourceCourse)
                next[dragged.columnIndex] = sortCoursesByStart(sourceColumn)
                next[targetColumnIndex] = sortCoursesByStart(targetColumn)
                return next
            }

            const destinationCourse = targetColumn[targetIndex]
            if (!destinationCourse || !canSwapSingleCourses(sourceColumn, targetColumn, sourceCourse, destinationCourse)) {
                sourceColumn.splice(sourceIndex, 0, sourceCourse)
                return current
            }
            targetColumn.splice(targetIndex, 1)
            sourceColumn.push(destinationCourse)
            targetColumn.push(sourceCourse)
            next[dragged.columnIndex] = sortCoursesByStart(sourceColumn)
            next[targetColumnIndex] = sortCoursesByStart(targetColumn)
            return next
        })
        setDragged(null)
        setSelectedCourseCodes([])
    }

    const handleSaveSchedule = async () => {
        if (!selectedDay) {
            alert('Please select a day first.')
            return
        }
        if (currentSession && access.mode !== 'owner') {
            alert('This schematic is view-only for shared sessions.')
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

        if (access.mode === 'owner' && currentSession && sessionId) {
            const nextRemoteSchedule = {
                codes,
                instructors,
            }
            try {
                await upsertSchematic(sessionId, nextRemoteSchedule)
            } catch (error) {
                alert(`Failed to save schedule: ${error instanceof Error ? error.message : 'Unknown error'}`)
                return
            }

            setRemoteSchedule(nextRemoteSchedule)
        }

        setStudentsForDay(selectedDay, updated)
        void prefetchInstructorPacket(selectedDay)
        alert('Schedule saved successfully!')
    }

    const addTemporaryColumn = () => {
        setColumns(current => [...current, []])
        setInstructors(current => [...current, ''])
        setLockedInstructors(current => [...current, ''])
        setExtraEmptyColumns(current => current + 1)
    }

    const removeEmptyColumns = () => {
        const keepIndices = columns
            .map((column, index) => ({ column, index }))
            .filter(({ column }) => column.length > 0)
            .map(({ index }) => index)
        setColumns(keepIndices.map(index => columns[index]))
        setInstructors(keepIndices.map(index => instructors[index] ?? ''))
        setLockedInstructors(keepIndices.map(index => lockedInstructors[index] ?? ''))
        setExtraEmptyColumns(0)
    }

    const setInstructorAt = (index: number, value: string) => {
        const lockedInstructor = getLockedInstructorForColumn(columns[index] ?? [])
        if (lockedInstructor && value !== lockedInstructor) {
            alert(`This column is locked to ${lockedInstructor} because it contains a requested class.`)
            return
        }
        setInstructors(current => {
            const next = [...current]
            next[index] = lockedInstructor || value
            return next
        })
    }

    return {
        columns,
        instructors,
        lockedInstructors,
        selectedCourseCodes,
        timeLabels,
        scheduleHeightRem,
        scheduleStartMinutes,
        instructorOptions,
        toggleCourseSelection,
        handleDragStart,
        handleDrop,
        handleDropOnCourse,
        handleSaveSchedule,
        addTemporaryColumn,
        removeEmptyColumns,
        setInstructorAt,
    }
}

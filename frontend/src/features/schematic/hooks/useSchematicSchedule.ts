import { useEffect, useMemo, useState } from 'react'
import { formatTermLabel } from '../../../app/useCurrentTerm'
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
import { normalizeCourseCodeForCompare } from '../utils/courseCode'
import { canPlaceCourses, canReplaceByStart, canSwapSingleCourses, findContiguousSwapIndices } from '../utils/drag'
import { buildTimeLabels } from '../utils/time'

type StoredSchedule = {
    codes: string[]
    instructors: string[]
}

type RequestAwareLayout = {
    columns: Course[][]
    instructors: string[]
    lockedInstructors: string[]
}

type ColumnFitScore = {
    columnIndex: number
    totalGap: number
    exactTouchCount: number
    largestGap: number
    blockSize: number
}

function getSessionTermLabel(sessionSeason: string | null | undefined, sessionYear: number | null, startDate: string | null | undefined) {
    const year = sessionYear ?? (startDate ? new Date(startDate).getFullYear() : NaN)
    if (!sessionSeason || !Number.isFinite(year) || year <= 0) {
        return ''
    }
    return formatTermLabel(sessionSeason, year)
}

function getStoredCourseOrder(courses: Course[], stored: StoredSchedule | null) {
    if (!stored || stored.codes.length === 0) {
        return courses
    }
    const courseMap = new Map(courses.map(course => [normalizeCourseCodeForCompare(course.code), course]))
    const ordered: Course[] = []
    const seen = new Set<string>()

    stored.codes.forEach(value => {
        value
            .split(',')
            .map(code => courseMap.get(normalizeCourseCodeForCompare(code)))
            .filter(Boolean)
            .forEach(course => {
                if (!course || seen.has(course.code)) {
                    return
                }
                seen.add(course.code)
                ordered.push(course)
            })
    })

    courses.forEach(course => {
        if (!seen.has(course.code)) {
            ordered.push(course)
        }
    })

    return ordered
}

function getBestFitColumnIndex(
    columns: Course[][],
    course: Course,
    options?: { lockedInstructor?: string; lockedInstructors?: string[] },
) {
    return getBestFitColumnIndexForBlock(columns, [course], options)
}

function getBestFitColumnIndexForBlock(
    columns: Course[][],
    courses: Course[],
    options?: { lockedInstructor?: string; lockedInstructors?: string[] },
) {
    if (courses.length === 0) {
        return -1
    }

    const scores: ColumnFitScore[] = []
    const firstCourse = courses[0]
    const lastCourse = courses[courses.length - 1]

    columns.forEach((column, columnIndex) => {
        const lockedInstructor = options?.lockedInstructor?.trim() ?? ''
        const columnLockedInstructor = options?.lockedInstructors?.[columnIndex]?.trim() ?? ''
        if (lockedInstructor && columnLockedInstructor !== lockedInstructor) {
            return
        }
        if (!canPlaceCourses(column, courses)) {
            return
        }

        const previousCourse = [...column]
            .filter(entry => entry.endMinutes <= firstCourse.startMinutes)
            .sort((left, right) => right.endMinutes - left.endMinutes)[0]
        const nextCourse = [...column]
            .filter(entry => entry.startMinutes >= lastCourse.endMinutes)
            .sort((left, right) => left.startMinutes - right.startMinutes)[0]

        const gapBefore = previousCourse ? firstCourse.startMinutes - previousCourse.endMinutes : Number.POSITIVE_INFINITY
        const gapAfter = nextCourse ? nextCourse.startMinutes - lastCourse.endMinutes : Number.POSITIVE_INFINITY
        const exactTouchCount = Number(gapBefore === 0) + Number(gapAfter === 0)
        const finiteGaps = [gapBefore, gapAfter].filter(value => Number.isFinite(value))
        const totalGap =
            finiteGaps.length > 0 ? finiteGaps.reduce((sum, value) => sum + value, 0) : Number.MAX_SAFE_INTEGER
        const largestGap =
            finiteGaps.length > 0 ? finiteGaps.reduce((largest, value) => Math.max(largest, value), 0) : Number.MAX_SAFE_INTEGER

        scores.push({
            columnIndex,
            totalGap,
            exactTouchCount,
            largestGap,
            blockSize: courses.length,
        })
    })

    scores.sort((left, right) => {
        if (left.blockSize !== right.blockSize) {
            return right.blockSize - left.blockSize
        }
        if (left.exactTouchCount !== right.exactTouchCount) {
            return right.exactTouchCount - left.exactTouchCount
        }
        if (left.totalGap !== right.totalGap) {
            return left.totalGap - right.totalGap
        }
        if (left.largestGap !== right.largestGap) {
            return left.largestGap - right.largestGap
        }
        return left.columnIndex - right.columnIndex
    })

    return scores[0]?.columnIndex ?? -1
}

function getMaxCompatiblePrefix(courses: Course[]) {
    if (courses.length === 0) {
        return []
    }
    const block: Course[] = [courses[0]]
    for (let index = 1; index < courses.length; index += 1) {
        const nextCourse = courses[index]
        const lastCourse = block[block.length - 1]
        if (coursesOverlap(lastCourse, nextCourse)) {
            break
        }
        block.push(nextCourse)
    }
    return block
}

function createRequestAwareLayout(courses: Course[], stored: StoredSchedule | null): RequestAwareLayout {
    const orderedCourses = getStoredCourseOrder(courses, stored)
    const lockedCourses = orderedCourses.filter(course => course.isLockedToInstructor && course.assignedInstructor)
    const flexibleCourses = orderedCourses.filter(course => !course.isLockedToInstructor || !course.assignedInstructor)
    const columns: Course[][] = []
    const instructors: string[] = []
    const lockedInstructors: string[] = []

    lockedCourses.forEach(course => {
        const targetIndex = getBestFitColumnIndex(columns, course, {
            lockedInstructor: course.assignedInstructor,
            lockedInstructors,
        })

        if (targetIndex >= 0) {
            columns[targetIndex].push(course)
            columns[targetIndex].sort((a, b) => a.startTime.localeCompare(b.startTime))
            instructors[targetIndex] = course.assignedInstructor ?? ''
            lockedInstructors[targetIndex] = course.assignedInstructor ?? ''
            return
        }

        columns.push([course])
        instructors.push(course.assignedInstructor ?? '')
        lockedInstructors.push(course.assignedInstructor ?? '')
    })

    const remainingFlexible = [...flexibleCourses]
    while (remainingFlexible.length > 0) {
        const compatiblePrefix = getMaxCompatiblePrefix(remainingFlexible)
        let placed = false

        for (let size = compatiblePrefix.length; size >= 1; size -= 1) {
            const block = compatiblePrefix.slice(0, size)
            const targetIndex = getBestFitColumnIndexForBlock(columns, block, { lockedInstructors })
            if (targetIndex >= 0) {
                columns[targetIndex].push(...block)
                columns[targetIndex].sort((a, b) => a.startTime.localeCompare(b.startTime))
                remainingFlexible.splice(0, size)
                placed = true
                break
            }
        }

        if (placed) {
            continue
        }

        const fallbackCourse = remainingFlexible.shift()
        if (!fallbackCourse) {
            break
        }
        columns.push([fallbackCourse])
        instructors.push('')
        lockedInstructors.push('')
    }

    if (stored?.instructors?.length) {
        instructors.forEach((value, index) => {
            if (value || lockedInstructors[index]) {
                return
            }
            instructors[index] = stored.instructors[index] ?? ''
        })
    }

    return {
        columns,
        instructors: instructors.map((value, index) => lockedInstructors[index] || value || ''),
        lockedInstructors,
    }
}

function getLockedInstructorForColumn(column: Course[]) {
    const locked = Array.from(new Set(column.map(course => course.assignedInstructor).filter(Boolean)))
    return locked[0] ?? ''
}

export function useSchematicSchedule(selectedDay: string | null) {
    const { access, session: currentSession, sessionId } = useCurrentSession()
    const [columns, setColumns] = useState<Course[][]>([])
    const [instructors, setInstructors] = useState<string[]>([])
    const [lockedInstructors, setLockedInstructors] = useState<string[]>([])
    const [dragged, setDragged] = useState<DragState | null>(null)
    const [students, setStudents] = useState<Student[]>([])
    const [remoteSchedule, setRemoteSchedule] = useState<{ codes: string[]; instructors: string[] } | null>(null)
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

    const handleDragStart = (event: React.DragEvent<HTMLDivElement>, course: Course, columnIndex: number) => {
        if (course.isLockedToInstructor) {
            event.preventDefault()
            return
        }
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
            if (course.isLockedToInstructor) {
                sourceColumn.splice(courseIndex, 0, course)
                return current
            }
            const targetColumn = next[columnIndex]
            if (dragged.columnIndex === columnIndex) {
                sourceColumn.push(course)
                sourceColumn.sort((a, b) => a.startTime.localeCompare(b.startTime))
                return next
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
                return next
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
                return next
            }
            if (targetColumn.some(target => coursesOverlap(target, course))) {
                sourceColumn.splice(courseIndex, 0, course)
                return current
            }
            targetColumn.push(course)
            targetColumn.sort((a, b) => a.startTime.localeCompare(b.startTime))
            return next
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
                    const destinationCourse = targetColumn[targetIndex]
                    if (!destinationCourse || !canSwapSingleCourses(sourceColumn, targetColumn, sourceCourse, destinationCourse)) {
                        sourceColumn.splice(sourceIndex, 0, sourceCourse)
                        return current
                    }
                    targetColumn.splice(targetIndex, 1)
                    sourceColumn.push(destinationCourse)
                    targetColumn.push(sourceCourse)
                    sourceColumn.sort((a, b) => a.startTime.localeCompare(b.startTime))
                    targetColumn.sort((a, b) => a.startTime.localeCompare(b.startTime))
                }
            }
            return next
        })
        setDragged(null)
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
        timeLabels,
        scheduleHeightRem,
        scheduleStartMinutes,
        instructorOptions,
        handleDragStart,
        handleDrop,
        handleDropOnCourse,
        handleSaveSchedule,
        addTemporaryColumn,
        removeEmptyColumns,
        setInstructorAt,
    }
}

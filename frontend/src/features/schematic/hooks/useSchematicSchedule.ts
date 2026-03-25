import { useEffect, useMemo, useState } from 'react'
import { formatSessionTermLabel as getSessionTermLabel } from '../../../shared/session/sessionLabels'
import {
    getExtractedClassesForSession,
    onExtractedClassesBySessionUpdated,
} from '../../../lib/extractedClassesStorage'
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
import type { ExtractedClass, RequestAssignment, Student } from '../../../types/app'
import { SLOT_HEIGHT_REM, SLOT_MINUTES } from '../constants'
import { buildCourses } from '../utils/courses'
import { normalizeCourseCodeForCompare } from '../utils/courseCode'
import type { StoredCourseLayout } from '../utils/layout'
import { useSchematicBoard } from './useSchematicBoard'
import { buildTimeLabels } from '../utils/time'

export function useSchematicSchedule(selectedDay: string | null) {
    const { access, session: currentSession, sessionId } = useCurrentSession()
    const [students, setStudents] = useState<Student[]>([])
    const [extractedClasses, setExtractedClasses] = useState<ExtractedClass[]>([])
    const [remoteSchedule, setRemoteSchedule] = useState<StoredCourseLayout | null>(null)
    const [requestAssignments, setRequestAssignments] = useState<RequestAssignment[]>([])

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
        if (!sessionId) {
            setExtractedClasses([])
            return () => {}
        }

        const load = () => setExtractedClasses(getExtractedClassesForSession(sessionId))
        load()

        return onExtractedClassesBySessionUpdated(updatedSessionId => {
            if (updatedSessionId === sessionId) {
                load()
            }
        })
    }, [sessionId])

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

    const extractedStudentCountByCode = useMemo(() => {
        const counts = new Map<string, number>()
        extractedClasses.forEach(classEntry => {
            if (selectedDay && classEntry.dayOfWeek && classEntry.dayOfWeek !== selectedDay) {
                return
            }
            const normalizedCode = normalizeCourseCodeForCompare(classEntry.courseCode)
            if (!normalizedCode || counts.has(normalizedCode)) {
                return
            }
            counts.set(normalizedCode, Math.max(classEntry.studentCount, 0))
        })
        return counts
    }, [extractedClasses, selectedDay])

    const courses = useMemo(() => {
        const rosterCourses = buildCourses(students, requestInstructorByCode)
        if (extractedStudentCountByCode.size === 0) {
            return rosterCourses
        }
        return rosterCourses.map(course => {
            const extractedCount = extractedStudentCountByCode.get(normalizeCourseCodeForCompare(course.code))
            if (extractedCount === undefined) {
                return course
            }
            return {
                ...course,
                studentCount: extractedCount,
            }
        })
    }, [extractedStudentCountByCode, requestInstructorByCode, students])
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

    const storedLayout = access.mode === 'guest' ? getScheduleForDay(selectedDay) : remoteSchedule
    const {
        columns,
        instructors,
        lockedInstructors,
        selectedCourseCodes,
        toggleCourseSelection,
        handleDragStart,
        handleDrop,
        handleDropOnCourse,
        addTemporaryColumn,
        removeEmptyColumns,
        setInstructorAt,
    } = useSchematicBoard({
        courses,
        storedLayout,
        allowStoredEmptyColumns: true,
    })

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

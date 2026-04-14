import { useEffect, useMemo, useRef, useState } from 'react'
import {
    getInstructorsForDay,
    getStudentsForDay,
    onStudentsUpdated,
    setInstructorsForDay,
    setStudentsForDay,
} from '../../../lib/storage'
import {
    applyPersistedLevelEdits,
    buildPersistedStudentLevelEditMap,
    fetchRosterLevelEdits,
    fetchRosterStudentEdits,
    hashStudentNames,
} from '../../../lib/rosterEditsApi'
import { fetchSchematic } from '../../../lib/serverApi'
import type { Student } from '../../../types/app'
import { buildRosterGroups } from '../utils'

type RemoteSchematicData = {
    codes?: string[]
    instructors?: string[]
}

function buildInstructorMap(data: RemoteSchematicData | null): Map<string, string> {
    const byCode = new Map<string, string>()
    if (!data?.codes?.length) {
        return byCode
    }
    const instructors = data.instructors ?? []
    data.codes.forEach((encodedCodes, index) => {
        const instructor = (instructors[index] ?? '').trim()
        if (!instructor) {
            return
        }
        encodedCodes
            .split(',')
            .map(code => code.trim())
            .filter(Boolean)
            .forEach(code => byCode.set(code, instructor))
    })
    return byCode
}

function applyInstructorAssignments(students: Student[], byCode: Map<string, string>): Student[] {
    if (students.length === 0 || byCode.size === 0) {
        return students
    }
    let changed = false
    const next = students.map(student => {
        const assigned = byCode.get(student.code)
        if (!assigned || assigned === student.instructor) {
            return student
        }
        changed = true
        return { ...student, instructor: assigned }
    })
    return changed ? next : students
}

export function useRosterData(selectedDay: string, sessionId?: string, isGuest?: boolean) {
    const [students, setStudents] = useState<Student[]>([])
    const [persistedStudentLevelEditMap, setPersistedStudentLevelEditMap] = useState<Record<string, boolean>>({})
    const [remoteSchematic, setRemoteSchematic] = useState<RemoteSchematicData | null>(null)
    const appliedEditsKey = useRef('')

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
        if (!sessionId || isGuest) {
            setRemoteSchematic(null)
            return
        }
        let active = true
        const loadSchematic = async () => {
            const response = await fetchSchematic(sessionId)
            if (!active) {
                return
            }
            const value = (response.schematic?.data ?? null) as RemoteSchematicData | null
            setRemoteSchematic(value)
            if (selectedDay) {
                setInstructorsForDay(selectedDay, {
                    names: value?.instructors ?? [],
                    codes: value?.codes ?? [],
                })
            }
        }
        void loadSchematic()
        return () => {
            active = false
        }
    }, [isGuest, selectedDay, sessionId])

    useEffect(() => {
        if (!sessionId || isGuest || students.length === 0) {
            return
        }
        const byCode = buildInstructorMap(remoteSchematic)
        const next = applyInstructorAssignments(students, byCode)
        if (next === students) {
            return
        }
        setStudents(next)
        setStudentsForDay(selectedDay, next)
    }, [isGuest, remoteSchematic, selectedDay, sessionId, students])

    useEffect(() => {
        if (!sessionId || isGuest || students.length === 0) {
            appliedEditsKey.current = ''
            setPersistedStudentLevelEditMap({})
            return
        }
        let active = true
        const applyEdits = async () => {
            const [rosterEdits, studentEdits] = await Promise.all([
                fetchRosterLevelEdits(sessionId),
                fetchRosterStudentEdits(sessionId),
            ])
            if (!active) {
                return
            }
            const editsKey = JSON.stringify({
                sessionId,
                rosterEdits,
                studentEdits,
                studentCount: students.length,
            })
            if (editsKey === appliedEditsKey.current) {
                return
            }
            appliedEditsKey.current = editsKey

            const nameHashMap = await hashStudentNames(students.map(student => student.name))
            const next = applyPersistedLevelEdits(students, rosterEdits, studentEdits, nameHashMap)

            setPersistedStudentLevelEditMap(buildPersistedStudentLevelEditMap(studentEdits))
            setStudents(next)
            setStudentsForDay(selectedDay, next)
        }
        void applyEdits()
        return () => {
            active = false
        }
    }, [isGuest, selectedDay, sessionId, students])

    const rosters = useMemo(() => buildRosterGroups(students), [students])
    const instructorOptions = useMemo(() => {
        const instructorConfig = getInstructorsForDay(selectedDay)
        return instructorConfig?.names?.filter(Boolean) ?? []
    }, [selectedDay])
    return {
        students,
        setStudents,
        rosters,
        instructorOptions,
        persistedStudentLevelEditMap,
    }
}

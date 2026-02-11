import { useEffect, useMemo, useRef, useState } from 'react'
import {
    getInstructorsForDay,
    getStudentsForDay,
    onStudentsUpdated,
    setInstructorsForDay,
    setStudentsForDay,
} from '../../../lib/storage'
import { fetchRosterLevelEdits, fetchRosterStudentEdits, hashStudentNames } from '../../../lib/rosterEditsApi'
import { supabase } from '../../../lib/supabaseClient'
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
            const { data } = await supabase
                .from('schematics')
                .select('data')
                .eq('session_id', sessionId)
                .maybeSingle()
            if (!active) {
                return
            }
            const value = (data?.data ?? null) as RemoteSchematicData | null
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

            const levelByCode = new Map(rosterEdits.map(edit => [edit.code, edit.level]))
            const studentOverride = new Map(
                studentEdits.map(edit => [`${edit.code}:${edit.student_name_hash}`, edit.level]),
            )

            const nameHashMap = await hashStudentNames(students.map(student => student.name))
            const next = students.map(student => {
                const rosterLevel = levelByCode.get(student.code)
                const nameHash = nameHashMap.get(student.name)
                const overrideKey = nameHash ? `${student.code}:${nameHash}` : ''
                const studentLevel = overrideKey ? studentOverride.get(overrideKey) : undefined
                if (studentLevel) {
                    return { ...student, level: studentLevel }
                }
                if (rosterLevel) {
                    return { ...student, level: rosterLevel }
                }
                return student
            })

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
    }
}

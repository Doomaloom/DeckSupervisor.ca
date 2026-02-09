import { useEffect, useMemo, useRef, useState } from 'react'
import { getInstructorsForDay, getStudentsForDay, onStudentsUpdated, setStudentsForDay } from '../../../lib/storage'
import { fetchRosterLevelEdits, fetchRosterStudentEdits, hashStudentNames } from '../../../lib/rosterEditsApi'
import type { Student } from '../../../types/app'
import { buildRosterGroups } from '../utils'

export function useRosterData(selectedDay: string, sessionId?: string, isGuest?: boolean) {
    const [students, setStudents] = useState<Student[]>([])
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

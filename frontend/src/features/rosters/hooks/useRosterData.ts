import { useEffect, useMemo, useState } from 'react'
import { getInstructorsForDay, getStudentsForDay, onStudentsUpdated } from '../../../lib/storage'
import type { Student } from '../../../types/app'
import { buildRosterGroups } from '../utils'

export function useRosterData(selectedDay: string) {
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

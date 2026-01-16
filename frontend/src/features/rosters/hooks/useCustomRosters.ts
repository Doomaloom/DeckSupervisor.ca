import { useEffect, useState } from 'react'
import { getCustomRostersForDay, setCustomRostersForDay } from '../../../lib/storage'
import type { CustomRoster } from '../../../types/app'

export function useCustomRosters(selectedDay: string) {
    const [customRosters, setCustomRosters] = useState<CustomRoster[]>([])

    useEffect(() => {
        if (!selectedDay) {
            setCustomRosters([])
            return
        }
        setCustomRosters(getCustomRostersForDay(selectedDay))
    }, [selectedDay])

    const saveCustomRosters = (next: CustomRoster[]) => {
        setCustomRosters(next)
        if (!selectedDay) {
            return
        }
        setCustomRostersForDay(selectedDay, next)
    }

    const updateCustomRosterInstructor = (id: string, instructor: string) => {
        const next = customRosters.map(roster =>
            roster.id === id ? { ...roster, instructor: instructor || undefined } : roster,
        )
        saveCustomRosters(next)
    }

    const updateCustomRosterLevel = (id: string, level: string) => {
        const next = customRosters.map(roster => (roster.id === id ? { ...roster, serviceName: level } : roster))
        saveCustomRosters(next)
    }

    return {
        customRosters,
        saveCustomRosters,
        updateCustomRosterInstructor,
        updateCustomRosterLevel,
    }
}

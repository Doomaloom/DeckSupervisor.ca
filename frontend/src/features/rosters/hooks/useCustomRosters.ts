import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../../app/AuthContext'
import { resolveCustomRosters, saveCustomRoster, deleteCustomRoster } from '../../../lib/customRostersApi'
import { getCustomRosterDayKey, getCustomRostersForDay, setCustomRostersForDay } from '../../../lib/storage'
import type { CustomRoster, Student } from '../../../types/app'

export function useCustomRosters(selectedDay: string, students: Student[], sessionId?: string) {
    const { session, user } = useAuth()
    const [customRosters, setCustomRosters] = useState<CustomRoster[]>([])
    const customRostersRef = useRef<CustomRoster[]>([])

    useEffect(() => {
        if (!selectedDay) {
            setCustomRosters([])
            return
        }
        let active = true
        const load = async () => {
            const accessToken = session?.access_token
            const isGuestMode = !accessToken || !user
            const localKey = getCustomRosterDayKey(selectedDay, sessionId, isGuestMode)
            if (isGuestMode || !sessionId) {
                const stored = getCustomRostersForDay(localKey)
                if (active) {
                    setCustomRosters(stored)
                    customRostersRef.current = stored
                }
                return
            }
            try {
                const resolved = await resolveCustomRosters(selectedDay, sessionId, students, accessToken)
                if (active) {
                    setCustomRosters(resolved)
                    customRostersRef.current = resolved
                    setCustomRostersForDay(localKey, resolved)
                }
            } catch (error) {
                console.error('Failed to sync custom rosters', error)
                const fallback = getCustomRostersForDay(localKey)
                if (active) {
                    setCustomRosters(fallback)
                    customRostersRef.current = fallback
                }
            }
        }
        void load()
        return () => {
            active = false
        }
    }, [selectedDay, session?.access_token, sessionId, students, user])

    const saveCustomRosters = async (next: CustomRoster[]) => {
        const previous = customRostersRef.current
        setCustomRosters(next)
        customRostersRef.current = next
        if (!selectedDay) {
            return
        }
        const isGuestMode = !session?.access_token || !user
        const localKey = getCustomRosterDayKey(selectedDay, sessionId, isGuestMode)
        setCustomRostersForDay(localKey, next)
        const accessToken = session?.access_token
        if (!accessToken || !user || !sessionId) {
            return
        }
        const nextIds = new Set(next.map(roster => roster.id))
        const deleted = previous.filter(roster => !nextIds.has(roster.id))
        try {
            await Promise.all([
                ...deleted.map(roster => deleteCustomRoster(roster.id, sessionId, accessToken)),
                ...next.map(roster => saveCustomRoster(selectedDay, sessionId, roster, students, accessToken)),
            ])
        } catch (error) {
            console.error('Failed to save custom rosters', error)
        }
    }

    const updateCustomRosterLevel = (id: string, level: string) => {
        const next = customRosters.map(roster => (roster.id === id ? { ...roster, serviceName: level } : roster))
        void saveCustomRosters(next)
    }

    return {
        customRosters,
        saveCustomRosters,
        updateCustomRosterLevel,
    }
}

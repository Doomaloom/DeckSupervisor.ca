import { useEffect, useMemo, useState } from 'react'
import { useCurrentTeam } from '../../../app/useCurrentTeam'
import { useCurrentTerm } from '../../../app/useCurrentTerm'
import { getStudentsForDay, onStudentsUpdated } from '../../../lib/storage'
import { supabase } from '../../../lib/supabaseClient'
import type { Student } from '../../../types/app'
import { SLOT_HEIGHT_REM, SLOT_MINUTES, dayNames } from '../constants'
import type { Course } from '../types'
import { buildColumns, buildCourses } from '../utils/courses'
import { buildTimeLabels } from '../utils/time'

const NO_LOCATION_KEY = '__no_location__'

const dayOrder = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const

type TeamSessionRow = {
    id: string
    session_day: string
    session_season: string | null
    session_year: number | null
    start_date: string | null
    location: string | null
    updated_at: string
}

type SchematicPayload = {
    codes: string[]
    instructors: string[]
}

type SchematicRow = {
    session_id: string
    data: { codes?: string[]; instructors?: string[] } | null
}

type LocationOption = {
    key: string
    value: string
    label: string
}

function getYearFromDate(value: string | null) {
    if (!value) {
        return null
    }
    const year = new Date(value).getFullYear()
    return Number.isFinite(year) && year > 0 ? year : null
}

function normalizeLocation(value: string | null | undefined) {
    return (value ?? '').trim()
}

function locationToKey(value: string) {
    return value || NO_LOCATION_KEY
}

function getSessionSeason(value: string | null) {
    return (value ?? '').trim().toLowerCase()
}

export function useFullTimeSchematicView(enabled: boolean) {
    const { currentTeamId } = useCurrentTeam()
    const { currentTerm } = useCurrentTerm()

    const [teamSessions, setTeamSessions] = useState<TeamSessionRow[]>([])
    const [schematicsBySession, setSchematicsBySession] = useState<Map<string, SchematicPayload>>(new Map())
    const [loadingSessions, setLoadingSessions] = useState(false)
    const [loadingSchematics, setLoadingSchematics] = useState(false)
    const [selectedDay, setSelectedDay] = useState('')
    const [selectedLocationKey, setSelectedLocationKey] = useState('')
    const [dayStudents, setDayStudents] = useState<Student[]>([])

    useEffect(() => {
        if (!enabled) {
            setTeamSessions([])
            setLoadingSessions(false)
            return
        }
        if (!currentTeamId) {
            setTeamSessions([])
            setLoadingSessions(false)
            return
        }

        let active = true
        const loadSessions = async () => {
            setLoadingSessions(true)
            const { data, error } = await supabase
                .from('sessions')
                .select('id,session_day,session_season,session_year,start_date,location,updated_at')
                .eq('team_id', currentTeamId)

            if (!active) {
                return
            }
            if (error) {
                console.error('Failed to load team sessions for full-time schematic view', error)
                setTeamSessions([])
                setLoadingSessions(false)
                return
            }

            setTeamSessions((data ?? []) as TeamSessionRow[])
            setLoadingSessions(false)
        }

        void loadSessions()
        return () => {
            active = false
        }
    }, [currentTeamId, enabled])

    const termSessions = useMemo(() => {
        if (!currentTerm) {
            return []
        }
        return teamSessions.filter(session => {
            if (!session.session_day) {
                return false
            }
            const season = getSessionSeason(session.session_season)
            const year = session.session_year ?? getYearFromDate(session.start_date)
            return season === currentTerm.season && year === currentTerm.year
        })
    }, [currentTerm, teamSessions])

    useEffect(() => {
        if (!enabled) {
            setSelectedDay('')
            return
        }
        if (termSessions.length === 0) {
            setSelectedDay('')
            return
        }

        const availableDays = new Set(termSessions.map(session => session.session_day))
        if (selectedDay && availableDays.has(selectedDay)) {
            return
        }

        const firstAvailableDay = dayOrder.find(day => availableDays.has(day)) ?? ''
        setSelectedDay(firstAvailableDay)
    }, [enabled, selectedDay, termSessions])

    const days = useMemo(
        () =>
            dayOrder.map(day => ({
                key: day,
                label: dayNames[day] ?? day,
                count: termSessions.filter(session => session.session_day === day).length,
            })),
        [termSessions],
    )

    const locationOptions = useMemo(() => {
        if (!selectedDay) {
            return []
        }

        const uniqueLocations = new Set<string>()
        termSessions
            .filter(session => session.session_day === selectedDay)
            .forEach(session => uniqueLocations.add(normalizeLocation(session.location)))

        return Array.from(uniqueLocations)
            .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
            .map(location => ({
                key: locationToKey(location),
                value: location,
                label: location || 'No location',
            }))
    }, [selectedDay, termSessions])

    useEffect(() => {
        if (!enabled) {
            setSelectedLocationKey('')
            return
        }
        if (locationOptions.length === 0) {
            setSelectedLocationKey('')
            return
        }
        const hasCurrent = locationOptions.some(option => option.key === selectedLocationKey)
        if (hasCurrent) {
            return
        }
        setSelectedLocationKey(locationOptions[0].key)
    }, [enabled, locationOptions, selectedLocationKey])

    const selectedLocation = useMemo(
        () => locationOptions.find(option => option.key === selectedLocationKey)?.value ?? '',
        [locationOptions, selectedLocationKey],
    )

    const selectedSession = useMemo(() => {
        if (!selectedDay || !selectedLocationKey) {
            return null
        }

        const candidates = termSessions.filter(
            session =>
                session.session_day === selectedDay &&
                normalizeLocation(session.location) === selectedLocation,
        )

        if (candidates.length === 0) {
            return null
        }

        return [...candidates].sort((a, b) => {
            const updatedAtA = new Date(a.updated_at).getTime()
            const updatedAtB = new Date(b.updated_at).getTime()
            if (updatedAtA !== updatedAtB) {
                return updatedAtB - updatedAtA
            }
            return a.id.localeCompare(b.id)
        })[0]
    }, [selectedDay, selectedLocation, selectedLocationKey, termSessions])

    useEffect(() => {
        if (!enabled) {
            setSchematicsBySession(new Map())
            setLoadingSchematics(false)
            return
        }
        if (termSessions.length === 0) {
            setSchematicsBySession(new Map())
            setLoadingSchematics(false)
            return
        }

        const sessionIds = termSessions.map(session => session.id)
        let active = true

        const loadSchematics = async () => {
            setLoadingSchematics(true)
            const { data, error } = await supabase
                .from('schematics')
                .select('session_id,data')
                .in('session_id', sessionIds)

            if (!active) {
                return
            }
            if (error) {
                console.error('Failed to load schematics for full-time view', error)
                setSchematicsBySession(new Map())
                setLoadingSchematics(false)
                return
            }

            const next = new Map<string, SchematicPayload>()
            ;(data ?? []).forEach(row => {
                const schematicRow = row as SchematicRow
                const codes = schematicRow.data?.codes ?? []
                const instructors = schematicRow.data?.instructors ?? []
                if (codes.length === 0) {
                    return
                }
                next.set(schematicRow.session_id, {
                    codes,
                    instructors,
                })
            })

            setSchematicsBySession(next)
            setLoadingSchematics(false)
        }

        void loadSchematics()
        return () => {
            active = false
        }
    }, [enabled, termSessions])

    useEffect(() => {
        if (!enabled) {
            setDayStudents([])
            return
        }
        if (!selectedDay) {
            setDayStudents([])
            return
        }
        setDayStudents(getStudentsForDay(selectedDay))
    }, [enabled, selectedDay])

    useEffect(() => {
        if (!enabled) {
            return () => {}
        }
        return onStudentsUpdated(day => {
            if (day === selectedDay) {
                setDayStudents(getStudentsForDay(selectedDay))
            }
        })
    }, [enabled, selectedDay])

    const selectedSessionSchematic = useMemo(() => {
        if (!selectedSession) {
            return null
        }
        return schematicsBySession.get(selectedSession.id) ?? null
    }, [schematicsBySession, selectedSession])

    const selectedLocationStudents = useMemo(
        () =>
            dayStudents.filter(
                student => normalizeLocation(student.location) === selectedLocation,
            ),
        [dayStudents, selectedLocation],
    )

    const courses = useMemo(() => buildCourses(selectedLocationStudents), [selectedLocationStudents])

    const columns = useMemo(() => {
        const initialColumns = buildColumns(courses)
        const remoteCodes = selectedSessionSchematic?.codes ?? []

        if (remoteCodes.length === 0) {
            return initialColumns
        }

        const courseMap = new Map(courses.map(course => [course.code, course]))
        const mappedColumns = remoteCodes
            .map(encoded => encoded.split(',').map(code => courseMap.get(code)).filter(Boolean) as Course[])
            .filter(column => column.length > 0)

        return mappedColumns.length > 0 ? mappedColumns : initialColumns
    }, [courses, selectedSessionSchematic])

    const instructors = useMemo(() => {
        const remoteInstructors = selectedSessionSchematic?.instructors ?? []
        if (remoteInstructors.length === 0) {
            return columns.map(() => '')
        }
        return columns.map((_, index) => remoteInstructors[index] ?? '')
    }, [columns, selectedSessionSchematic])

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

    const schematicSessionLabel = useMemo(() => {
        const dayLabel = selectedDay ? dayNames[selectedDay] ?? selectedDay : ''
        const locationLabel = locationOptions.find(option => option.key === selectedLocationKey)?.label ?? ''
        return [dayLabel, currentTerm?.label ?? '', locationLabel].filter(Boolean).join(' | ')
    }, [currentTerm?.label, locationOptions, selectedDay, selectedLocationKey])

    return {
        loadingSessions,
        loadingSchematics,
        days,
        selectedDay,
        setSelectedDay,
        locationOptions,
        selectedLocationKey,
        setSelectedLocationKey,
        selectedSession,
        selectedSessionSchematic,
        selectedLocationStudents,
        termSessions,
        columns,
        instructors,
        timeLabels,
        scheduleHeightRem,
        scheduleStartMinutes,
        schematicSessionLabel,
    }
}

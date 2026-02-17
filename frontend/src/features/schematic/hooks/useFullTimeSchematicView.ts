import { useEffect, useMemo, useState } from 'react'
import { useCurrentTeam } from '../../../app/useCurrentTeam'
import { useCurrentTerm } from '../../../app/useCurrentTerm'
import {
    getExtractedClassesForScope,
    onExtractedClassesUpdated,
} from '../../../lib/extractedClassesStorage'
import { supabase } from '../../../lib/supabaseClient'
import type { ExtractedClass } from '../../../types/app'
import { SLOT_HEIGHT_REM, SLOT_MINUTES, dayNames } from '../constants'
import type { Course } from '../types'
import { normalizeCourseCodeForCompare } from '../utils/courseCode'
import { buildTimeLabels, timeToMinutes } from '../utils/time'

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

function normalizeLocationMatch(value: string | null | undefined) {
    return normalizeLocation(value).toLowerCase()
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
    const [extractedClasses, setExtractedClasses] = useState<ExtractedClass[]>([])

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

        const uniqueLocations = new Map<string, string>()
        termSessions
            .filter(session => session.session_day === selectedDay)
            .forEach(session => {
                const location = normalizeLocation(session.location)
                const locationMatch = normalizeLocationMatch(location)
                if (!uniqueLocations.has(locationMatch)) {
                    uniqueLocations.set(locationMatch, location)
                }
            })

        return Array.from(uniqueLocations.entries())
            .sort((a, b) => a[1].localeCompare(b[1], 'en', { sensitivity: 'base' }))
            .map(([locationMatch, location]) => ({
                key: locationToKey(locationMatch),
                value: locationMatch,
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
                normalizeLocationMatch(session.location) === selectedLocation,
        )

        if (candidates.length === 0) {
            return null
        }

        const candidatesWithSchematic = candidates.filter(session => schematicsBySession.has(session.id))
        const preferredCandidates = candidatesWithSchematic.length > 0 ? candidatesWithSchematic : candidates

        return [...preferredCandidates].sort((a, b) => {
            const updatedAtA = new Date(a.updated_at).getTime()
            const updatedAtB = new Date(b.updated_at).getTime()
            if (updatedAtA !== updatedAtB) {
                return updatedAtB - updatedAtA
            }
            return a.id.localeCompare(b.id)
        })[0]
    }, [schematicsBySession, selectedDay, selectedLocation, selectedLocationKey, termSessions])

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
        if (!enabled || !currentTeamId || !currentTerm?.key) {
            setExtractedClasses([])
            return () => {}
        }

        const scopeKey = `${currentTeamId}::${currentTerm.key}`
        const load = () => setExtractedClasses(getExtractedClassesForScope(currentTeamId, currentTerm.key))
        load()

        return onExtractedClassesUpdated(updatedScopeKey => {
            if (updatedScopeKey === scopeKey) {
                load()
            }
        })
    }, [currentTeamId, currentTerm?.key, enabled])

    const selectedSessionSchematic = useMemo(() => {
        if (!selectedSession) {
            return null
        }
        return schematicsBySession.get(selectedSession.id) ?? null
    }, [schematicsBySession, selectedSession])

    const selectedLocationClasses = useMemo(() => {
        return extractedClasses.filter(classEntry => {
            if (classEntry.dayOfWeek !== selectedDay) {
                return false
            }
            if (normalizeLocationMatch(classEntry.location) !== selectedLocation) {
                return false
            }
            if (currentTerm) {
                const entrySeason = classEntry.sessionSeason.trim().toLowerCase()
                if (entrySeason && entrySeason !== currentTerm.season) {
                    return false
                }
                if (classEntry.sessionYear > 0 && classEntry.sessionYear !== currentTerm.year) {
                    return false
                }
            }
            return classEntry.courseCode.trim().length > 0
        })
    }, [currentTerm, extractedClasses, selectedDay, selectedLocation])

    const courses = useMemo(() => {
        const sortedClasses = [...selectedLocationClasses].sort((a, b) => {
            if (a.startTime24 !== b.startTime24) {
                return a.startTime24.localeCompare(b.startTime24)
            }
            if (a.endTime24 !== b.endTime24) {
                return a.endTime24.localeCompare(b.endTime24)
            }
            return a.courseCode.localeCompare(b.courseCode)
        })

        const seenCodes = new Set<string>()
        const next: Course[] = []

        sortedClasses.forEach(classEntry => {
            const code = classEntry.courseCode.trim()
            if (!code || seenCodes.has(code)) {
                return
            }

            const startMinutes = timeToMinutes(classEntry.startTime24)
            const rawEndMinutes = timeToMinutes(classEntry.endTime24)
            const endMinutes = rawEndMinutes >= startMinutes ? rawEndMinutes : rawEndMinutes + 24 * 60

            let runningTime = classEntry.durationMinutes
            if (runningTime <= 0) {
                runningTime = endMinutes - startMinutes
            }
            if (runningTime <= 0) {
                return
            }

            seenCodes.add(code)
            next.push({
                code,
                level: classEntry.serviceName.trim() || code,
                runningTime,
                startTime: classEntry.startTime24,
                endTime: classEntry.endTime24,
                startMinutes,
                endMinutes,
                studentCount: Math.max(classEntry.studentCount, 0),
            })
        })

        return next
    }, [selectedLocationClasses])

    const mappedDbSchedule = useMemo(() => {
        const remoteCodes = selectedSessionSchematic?.codes ?? []
        const remoteInstructors = selectedSessionSchematic?.instructors ?? []

        if (remoteCodes.length === 0) {
            return {
                columns: [] as Course[][],
                instructors: [] as string[],
            }
        }

        const courseMap = new Map(courses.map(course => [normalizeCourseCodeForCompare(course.code), course]))
        const mapped = remoteCodes
            .map((encoded, index) => ({
                courses: encoded
                    .split(',')
                    .map(code => courseMap.get(normalizeCourseCodeForCompare(code)))
                    .filter(Boolean) as Course[],
                instructor: remoteInstructors[index] ?? '',
            }))
            .filter(entry => entry.courses.length > 0)

        return {
            columns: mapped.map(entry => entry.courses),
            instructors: mapped.map(entry => entry.instructor),
        }
    }, [courses, selectedSessionSchematic])

    const renderedCourses = useMemo(() => mappedDbSchedule.columns.flat(), [mappedDbSchedule.columns])

    const hasDbSchematic = Boolean(selectedSessionSchematic)
    const hasExtractedClassesForLocation = courses.length > 0
    const hasMappedSchematicColumns = mappedDbSchedule.columns.length > 0
    const canRenderBoard =
        Boolean(selectedSession) &&
        hasDbSchematic &&
        hasExtractedClassesForLocation &&
        hasMappedSchematicColumns

    const columns = mappedDbSchedule.columns
    const instructors = mappedDbSchedule.instructors

    const scheduleStartMinutes = useMemo(() => {
        if (renderedCourses.length === 0) {
            return 0
        }
        const earliest = Math.min(...renderedCourses.map(course => course.startMinutes))
        return earliest - (earliest % SLOT_MINUTES)
    }, [renderedCourses])

    const timeLabels = useMemo(() => {
        const earliest = renderedCourses.reduce((current, course) => {
            if (!current || course.startMinutes < current.startMinutes) {
                return course
            }
            return current
        }, renderedCourses[0])?.startTime ?? ''
        const latest = renderedCourses.reduce((latestEnd, course) => {
            return course.endTime > latestEnd ? course.endTime : latestEnd
        }, '00:00')
        return buildTimeLabels(earliest, latest)
    }, [renderedCourses])

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
        hasDbSchematic,
        hasExtractedClassesForLocation,
        hasMappedSchematicColumns,
        canRenderBoard,
        termSessions,
        columns,
        instructors,
        timeLabels,
        scheduleHeightRem,
        scheduleStartMinutes,
        schematicSessionLabel,
    }
}

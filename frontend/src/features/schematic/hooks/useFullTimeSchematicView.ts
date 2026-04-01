import { useEffect, useMemo, useState } from 'react'
import { useCurrentTeam } from '../../../app/useCurrentTeam'
import { useCurrentTerm } from '../../../app/useCurrentTerm'
import { getYearFromDate } from '../../../shared/session/sessionLabels'
import { getEffectiveSourceLocations, normalizeSessionLocationKey } from '../../../shared/session/sourceLocations'
import {
    getExtractedClassesForScope,
    onExtractedClassesUpdated,
} from '../../../lib/extractedClassesStorage'
import { getStudentsByDay, onStudentsUpdated } from '../../../lib/storage'
import { fetchSchematics, fetchTeamSessions } from '../../../lib/serverApi'
import type { ExtractedClass, Student } from '../../../types/app'
import type { RosterListItem } from '../../rosters/types'
import { buildRosterGroups, filterRosterItems } from '../../rosters/utils'
import { extractStartTime } from '../../../lib/time'
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
    source_locations: string[]
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

type FullTimeRosterItem = RosterListItem & {
    day: string
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

function buildBookedCountByCode(
    students: Student[],
    sourceLocations: string[],
) {
    const locationKeys = new Set(sourceLocations.map(location => normalizeSessionLocationKey(location)).filter(Boolean))
    const bookedCountByCode = new Map<string, number>()
    const seenRosterCodes = new Set<string>()

    students.forEach(student => {
        if (locationKeys.size > 0 && !locationKeys.has(normalizeSessionLocationKey(student.location))) {
            return
        }
        const normalizedCode = normalizeCourseCodeForCompare(student.code)
        if (!normalizedCode) {
            return
        }
        seenRosterCodes.add(normalizedCode)
        if (student.waitlist) {
            return
        }
        bookedCountByCode.set(normalizedCode, (bookedCountByCode.get(normalizedCode) ?? 0) + 1)
    })

    return { bookedCountByCode, seenRosterCodes }
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
    const [studentsByDay, setStudentsByDay] = useState<Record<string, Student[]>>({})

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
            try {
                const response = await fetchTeamSessions(currentTeamId, 'id,session_day,session_season,session_year,start_date,location,source_locations,updated_at')
                if (!active) {
                    return
                }
                setTeamSessions((response.sessions ?? []) as TeamSessionRow[])
            } catch (error) {
                console.error('Failed to load team sessions for full-time schematic view', error)
                setTeamSessions([])
            }
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
            try {
                const response = await fetchSchematics(sessionIds)
                if (!active) {
                    return
                }
                const data = response.schematics ?? []
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
            } catch (error) {
                console.error('Failed to load schematics for full-time view', error)
                setSchematicsBySession(new Map())
            }
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

    useEffect(() => {
        if (!enabled) {
            setStudentsByDay({})
            return () => {}
        }

        const load = () => setStudentsByDay(getStudentsByDay())
        load()

        return onStudentsUpdated(() => {
            load()
        })
    }, [enabled])

    const selectedSessionSchematic = useMemo(() => {
        if (!selectedSession) {
            return null
        }
        return schematicsBySession.get(selectedSession.id) ?? null
    }, [schematicsBySession, selectedSession])

    const selectedSessionSourceLocations = useMemo(
        () => getEffectiveSourceLocations(selectedSession),
        [selectedSession],
    )

    const selectedLocationClasses = useMemo(() => {
        return extractedClasses.filter(classEntry => {
            if (classEntry.dayOfWeek !== selectedDay) {
                return false
            }
            if (
                selectedSessionSourceLocations.length > 0 &&
                !selectedSessionSourceLocations.some(
                    location => normalizeSessionLocationKey(location) === normalizeSessionLocationKey(classEntry.location),
                )
            ) {
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
    }, [currentTerm, extractedClasses, selectedDay, selectedSessionSourceLocations])

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
        const dayStudents = studentsByDay[selectedDay] ?? []
        const { bookedCountByCode, seenRosterCodes } = buildBookedCountByCode(dayStudents, selectedSessionSourceLocations)

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
            const normalizedCode = normalizeCourseCodeForCompare(code)
            const hasRosterRows = seenRosterCodes.has(normalizedCode)
            const studentCount = hasRosterRows
                ? bookedCountByCode.get(normalizedCode) ?? 0
                : Math.max(classEntry.studentCount, 0)
            next.push({
                code,
                level: classEntry.serviceName.trim() || code,
                runningTime,
                startTime: classEntry.startTime24,
                endTime: classEntry.endTime24,
                startMinutes,
                endMinutes,
                studentCount,
            })
        })

        return next
    }, [selectedDay, selectedLocationClasses, selectedSessionSourceLocations, studentsByDay])

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

    const fullTimeRosterItems = useMemo<FullTimeRosterItem[]>(() => {
        const allowedDays = new Set(termSessions.map(session => session.session_day).filter(Boolean))
        const next: FullTimeRosterItem[] = []

        Object.entries(studentsByDay).forEach(([day, students]) => {
            if (!allowedDays.has(day) || students.length === 0) {
                return
            }
            const groups = buildRosterGroups(students)
            groups.forEach(roster => {
                next.push({
                    day,
                    roster,
                    isCustom: false,
                })
            })
        })

        return next.sort((left, right) => {
            if (left.day !== right.day) {
                return dayOrder.indexOf(left.day as (typeof dayOrder)[number]) - dayOrder.indexOf(right.day as (typeof dayOrder)[number])
            }
            const leftTime = extractStartTime(left.roster.time)
            const rightTime = extractStartTime(right.roster.time)
            if (leftTime !== rightTime) {
                return leftTime.localeCompare(rightTime)
            }
            return left.roster.serviceName.localeCompare(right.roster.serviceName, 'en', { sensitivity: 'base' })
        })
    }, [studentsByDay, termSessions])

    const fullTimeRosterDayOptions = useMemo(() => {
        return Array.from(new Set(fullTimeRosterItems.map(item => item.day))).sort(
            (left, right) =>
                dayOrder.indexOf(left as (typeof dayOrder)[number]) - dayOrder.indexOf(right as (typeof dayOrder)[number]),
        )
    }, [fullTimeRosterItems])

    const fullTimeRosterLevelOptions = useMemo(() => {
        const levels = new Set<string>()
        fullTimeRosterItems.forEach(item => {
            if (item.roster.level) {
                levels.add(item.roster.level)
            }
        })
        return Array.from(levels).sort((left, right) => left.localeCompare(right, 'en', { sensitivity: 'base' }))
    }, [fullTimeRosterItems])

    const filterFullTimeRosters = (dayFilter: string, levelFilter: string, searchQuery: string) => {
        const dayFiltered = dayFilter
            ? fullTimeRosterItems.filter(item => item.day === dayFilter)
            : fullTimeRosterItems
        return filterRosterItems(dayFiltered, '', levelFilter, searchQuery) as FullTimeRosterItem[]
    }

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
        fullTimeRosterItems,
        fullTimeRosterDayOptions,
        fullTimeRosterLevelOptions,
        filterFullTimeRosters,
    }
}

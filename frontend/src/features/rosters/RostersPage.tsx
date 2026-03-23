import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useCsvImportFlow } from '../../app/CsvImportFlowContext'
import { useDay } from '../../app/DayContext'
import { useCurrentTeam } from '../../app/useCurrentTeam'
import { useCurrentTerm } from '../../app/useCurrentTerm'
import { processCsvWithoutStore } from '../../lib/api'
import { getStoredItem, setStoredItem } from '../../lib/browserStorage'
import { extractStartTime } from '../../lib/time'
import { prefetchInstructorPacket } from '../../lib/instructorPdfCache'
import type { ClassRoster, Student } from '../../types/app'
import { SLOT_HEIGHT_REM, SLOT_MINUTES, dayNames } from '../schematic/constants'
import FullTimeRostersPanel from '../schematic/components/FullTimeRostersPanel'
import SchematicBoard from '../schematic/components/SchematicBoard'
import type { Course } from '../schematic/types'
import { buildCourses, coursesOverlap } from '../schematic/utils/courses'
import { buildTimeLabels } from '../schematic/utils/time'
import CustomRostersPanel from './components/CustomRostersPanel'
import RosterFiltersBar from './components/RosterFiltersBar'
import RosterList from './components/RosterList'
import RostersTabs from './components/RostersTabs'
import { useCustomRosters } from './hooks/useCustomRosters'
import { useRosterData } from './hooks/useRosterData'
import { useRosterEdits } from './hooks/useRosterEdits'
import { useRosterFilters } from './hooks/useRosterFilters'
import { useRosterPrint } from './hooks/useRosterPrint'
import { buildCustomRosterGroups, getEmptyMessage } from './utils'
import type { RosterListItem } from './types'
import { useAuth } from '../../app/AuthContext'
import { useCurrentSession } from '../../app/useCurrentSession'

type FullTimeRosterItem = {
    day: string
    roster: {
        code: string
        serviceName: string
        level: string
        time: string
        instructor: string
        location: string
        schedule: string
        students: Student[]
    }
}

type StoredFullTimeRosters = {
    fileName: string
    importedAt: string
    classes: ClassRoster[]
}

function getFullTimeRostersStorageKey(teamId: string) {
    return `cob:full-time-rosters:${teamId}`
}

function saveStoredFullTimeRosters(teamId: string, fileName: string, classes: ClassRoster[]) {
    setStoredItem(
        getFullTimeRostersStorageKey(teamId),
        JSON.stringify({
            fileName,
            importedAt: new Date().toISOString(),
            classes,
        } satisfies StoredFullTimeRosters),
    )
}

function convertClassRosterToItem(roster: ClassRoster): FullTimeRosterItem {
    return {
        day: roster.day,
        roster: {
            code: roster.code,
            serviceName: roster.serviceName,
            level: roster.serviceName,
            time: roster.time,
            instructor: roster.instructor ?? '',
            location: roster.location,
            schedule: roster.schedule,
            students: roster.students.map((student, index) => ({
                id: `${roster.code}-${roster.day}-${index}-${student.name}`.replace(/\s+/g, '-'),
                service_name: roster.serviceName,
                code: roster.code,
                day: roster.day,
                time: roster.time,
                location: roster.location,
                schedule: roster.schedule,
                name: student.name,
                phone: student.phone,
                instructor: student.instructor || roster.instructor,
                level: student.level || roster.serviceName,
            })),
        },
    }
}

function sortCoursesByStart(courses: Course[]) {
    return [...courses].sort((left, right) => {
        if (left.startMinutes !== right.startMinutes) {
            return left.startMinutes - right.startMinutes
        }
        if (left.endMinutes !== right.endMinutes) {
            return left.endMinutes - right.endMinutes
        }
        return left.code.localeCompare(right.code)
    })
}

function canFitCourse(column: Course[], course: Course) {
    return !column.some(entry => coursesOverlap(entry, course))
}

function buildPreviewColumns(courses: Course[]) {
    const columns: Course[][] = []
    const instructors: string[] = []

    sortCoursesByStart(courses).forEach(course => {
        const assignedInstructor = course.assignedInstructor?.trim() ?? ''

        if (assignedInstructor) {
            for (let index = 0; index < columns.length; index += 1) {
                if (instructors[index] !== assignedInstructor) {
                    continue
                }
                if (canFitCourse(columns[index], course)) {
                    columns[index].push(course)
                    columns[index] = sortCoursesByStart(columns[index])
                    return
                }
            }
        }

        for (let index = 0; index < columns.length; index += 1) {
            if (assignedInstructor && instructors[index] && instructors[index] !== assignedInstructor) {
                continue
            }
            if (!canFitCourse(columns[index], course)) {
                continue
            }
            columns[index].push(course)
            columns[index] = sortCoursesByStart(columns[index])
            if (assignedInstructor && !instructors[index]) {
                instructors[index] = assignedInstructor
            }
            return
        }

        columns.push([course])
        instructors.push(assignedInstructor)
    })

    return {
        columns,
        instructors: instructors.map((value, index) => value || `Instructor ${index + 1}`),
    }
}

function RostersPage() {
    const { requestCsvFile } = useCsvImportFlow()
    const { selectedDay } = useDay()
    const { accountType, isGuest, user } = useAuth()
    const { access, sessionId } = useCurrentSession()
    const { currentTeam, currentTeamId } = useCurrentTeam()
    const { currentTerm } = useCurrentTerm()
    const [activeTab, setActiveTab] = useState<'default' | 'custom'>('default')
    const [studentLevelEditMap, setStudentLevelEditMap] = useState<Record<string, boolean>>({})
    const [fullTimeDayFilter, setFullTimeDayFilter] = useState('')
    const [fullTimeLevelFilter, setFullTimeLevelFilter] = useState('')
    const [fullTimeSearchQuery, setFullTimeSearchQuery] = useState('')
    const [fullTimeViewTab, setFullTimeViewTab] = useState<'rosters' | 'schematic'>('rosters')
    const [fullTimeRosterFileName, setFullTimeRosterFileName] = useState('')
    const [fullTimeRosterClasses, setFullTimeRosterClasses] = useState<ClassRoster[]>([])
    const [fullTimeUploadError, setFullTimeUploadError] = useState('')
    const [fullTimeUploading, setFullTimeUploading] = useState(false)
    const fullTimeUploadInputRef = useRef<HTMLInputElement | null>(null)
    const { students, setStudents, rosters, instructorOptions } = useRosterData(
        selectedDay ?? '',
        sessionId ?? undefined,
        isGuest,
    )
    const { customRosters, saveCustomRosters, updateCustomRosterLevel } =
        useCustomRosters(selectedDay ?? '', students, sessionId ?? undefined)
    const customRosterGroups = useMemo(() => {
        const rosterByCode = new Map(rosters.map(roster => [roster.code, roster]))
        const studentsById = new Map(students.map(student => [student.id, student]))
        return buildCustomRosterGroups(customRosters, rosterByCode, studentsById)
    }, [customRosters, rosters, students])
    const rosterItems = useMemo<RosterListItem[]>(
        () => [
            ...rosters.map(roster => ({ roster, isCustom: false })),
            ...customRosterGroups.map(roster => ({ roster, isCustom: true })),
        ],
        [rosters, customRosterGroups],
    )
    const sortedRosterItems = useMemo(() => {
        return [...rosterItems].sort((a, b) => {
            const timeA = extractStartTime(a.roster.time)
            const timeB = extractStartTime(b.roster.time)
            if (timeA !== timeB) {
                return timeA.localeCompare(timeB)
            }
            return a.roster.serviceName.localeCompare(b.roster.serviceName, 'en', { sensitivity: 'base' })
        })
    }, [rosterItems])
    const levelOptions = useMemo(() => {
        const levels = new Set<string>()
        rosterItems.forEach(item => {
            if (item.roster.level) {
                levels.add(item.roster.level)
            }
        })
        return Array.from(levels).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
    }, [rosterItems])
    const {
        instructorFilter,
        setInstructorFilter,
        levelFilter,
        setLevelFilter,
        searchQuery,
        setSearchQuery,
        filteredRosters,
    } = useRosterFilters(sortedRosterItems)
    const {
        handleRosterLevelChange,
        handleStudentLevelChange,
    } = useRosterEdits({
        selectedDay: selectedDay ?? '',
        students,
        setStudents,
        sessionId: sessionId ?? undefined,
        currentUserId: user?.id,
        canEdit: isGuest || access.mode === 'owner' || access.allowRosterEdits,
    })
    const { handlePrintRoster } = useRosterPrint()
    const emptyMessage = getEmptyMessage(students.length)
    const handleToggleStudentLevelEdits = (code: string) => {
        setStudentLevelEditMap(current => ({
            ...current,
            [code]: !current[code],
        }))
    }
    const selectedDayRef = useRef(selectedDay)

    useEffect(() => {
        selectedDayRef.current = selectedDay
    }, [selectedDay])

    useEffect(() => {
        return () => {
            const day = selectedDayRef.current
            if (day) {
                void prefetchInstructorPacket(day)
            }
        }
    }, [])

    useEffect(() => {
        if (accountType !== 'full_time' || !currentTeamId) {
            setFullTimeRosterClasses([])
            setFullTimeRosterFileName('')
            return
        }

        try {
            const stored = getStoredItem(getFullTimeRostersStorageKey(currentTeamId))
            if (!stored) {
                setFullTimeRosterClasses([])
                setFullTimeRosterFileName('')
                return
            }
            const parsed = JSON.parse(stored) as StoredFullTimeRosters
            const classes = parsed.classes ?? []
            setFullTimeRosterClasses(classes)
            setFullTimeRosterFileName(parsed.fileName ?? '')
        } catch (error) {
            console.error('Failed to load stored full-time rosters', error)
            setFullTimeRosterClasses([])
            setFullTimeRosterFileName('')
        }
    }, [accountType, currentTeamId])

    const fullTimeRosterItems = useMemo(
        () => fullTimeRosterClasses.map(convertClassRosterToItem),
        [fullTimeRosterClasses],
    )

    const fullTimeRosterDayOptions = useMemo(() => {
        return Array.from(new Set(fullTimeRosterItems.map(item => item.day))).sort((left, right) => {
            const order = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
            return order.indexOf(left) - order.indexOf(right)
        })
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

    useEffect(() => {
        if (!fullTimeDayFilter || fullTimeRosterDayOptions.includes(fullTimeDayFilter)) {
            return
        }
        setFullTimeDayFilter('')
    }, [fullTimeDayFilter, fullTimeRosterDayOptions])

    const filteredFullTimeRosters = useMemo(() => {
        const normalizedQuery = fullTimeSearchQuery.trim().toLowerCase()
        return fullTimeRosterItems.filter(item => {
            if (fullTimeDayFilter && item.day !== fullTimeDayFilter) {
                return false
            }
            if (fullTimeLevelFilter && item.roster.level !== fullTimeLevelFilter) {
                return false
            }
            if (!normalizedQuery) {
                return true
            }
            if (item.roster.code.toLowerCase().includes(normalizedQuery)) {
                return true
            }
            return item.roster.students.some(student => student.name.toLowerCase().includes(normalizedQuery) || student.phone.toLowerCase().includes(normalizedQuery))
        })
    }, [fullTimeDayFilter, fullTimeLevelFilter, fullTimeRosterItems, fullTimeSearchQuery])

    const fullTimeSchematicDay = fullTimeDayFilter || fullTimeRosterDayOptions[0] || ''
    const fullTimeSchematicStudents = useMemo(() => {
        return fullTimeRosterClasses
            .filter(roster => roster.day === fullTimeSchematicDay)
            .flatMap(roster =>
                roster.students.map((student, index) => ({
                    id: `${roster.code}-${roster.day}-${index}-${student.name}`.replace(/\s+/g, '-'),
                    service_name: roster.serviceName,
                    code: roster.code,
                    day: roster.day,
                    time: roster.time,
                    location: roster.location,
                    schedule: roster.schedule,
                    name: student.name,
                    phone: student.phone,
                    instructor: student.instructor || roster.instructor,
                    level: student.level || roster.serviceName,
                })),
            )
    }, [fullTimeRosterClasses, fullTimeSchematicDay])

    const fullTimeSchematicCourses = useMemo(() => {
        const instructorByCode = new Map<string, string>()
        fullTimeRosterClasses
            .filter(roster => roster.day === fullTimeSchematicDay)
            .forEach(roster => {
                const instructor = roster.instructor.trim()
                if (instructor) {
                    instructorByCode.set(roster.code, instructor)
                }
            })
        return buildCourses(fullTimeSchematicStudents, instructorByCode)
    }, [fullTimeRosterClasses, fullTimeSchematicDay, fullTimeSchematicStudents])

    const fullTimeSchematicLayout = useMemo(
        () => buildPreviewColumns(fullTimeSchematicCourses),
        [fullTimeSchematicCourses],
    )

    const fullTimeSchematicStartMinutes = useMemo(() => {
        if (fullTimeSchematicCourses.length === 0) {
            return 0
        }
        const earliest = Math.min(...fullTimeSchematicCourses.map(course => course.startMinutes))
        return earliest - (earliest % SLOT_MINUTES)
    }, [fullTimeSchematicCourses])

    const fullTimeSchematicTimeLabels = useMemo(() => {
        if (fullTimeSchematicCourses.length === 0) {
            return []
        }
        const earliest = fullTimeSchematicCourses[0]?.startTime ?? ''
        const latest = fullTimeSchematicCourses.reduce((current, course) => {
            return course.endTime > current ? course.endTime : current
        }, '00:00')
        return buildTimeLabels(earliest, latest)
    }, [fullTimeSchematicCourses])

    const fullTimeSchematicHeight = Math.max(fullTimeSchematicTimeLabels.length * SLOT_HEIGHT_REM, SLOT_HEIGHT_REM)

    const handleFullTimeRosterUpload = async (file: File | null) => {
        if (!file || !currentTeamId) {
            return
        }
        setFullTimeUploadError('')
        setFullTimeUploading(true)
        try {
            const response = await processCsvWithoutStore(file, '')
            const classes = (response.classes ?? []).map(roster => ({
                ...roster,
                instructor: '',
                students: roster.students.map(student => ({
                    ...student,
                    instructor: '',
                })),
            }))
            setFullTimeRosterClasses(classes)
            setFullTimeRosterFileName(file.name)
            saveStoredFullTimeRosters(currentTeamId, file.name, classes)
            setFullTimeDayFilter('')
            setFullTimeLevelFilter('')
            setFullTimeSearchQuery('')
        } catch (error) {
            console.error(error)
            setFullTimeUploadError(error instanceof Error ? error.message : 'Failed to process roster CSV.')
        } finally {
            setFullTimeUploading(false)
        }
    }

    const handleFullTimeInstructorChange = (day: string, code: string, value: string) => {
        if (!currentTeamId) {
            return
        }
        const normalizedValue = value
        setFullTimeRosterClasses(current => {
            const next = current.map(roster => {
                if (roster.day !== day || roster.code !== code) {
                    return roster
                }
                return {
                    ...roster,
                    instructor: normalizedValue,
                    students: roster.students.map(student => ({
                        ...student,
                        instructor: normalizedValue,
                    })),
                }
            })
            saveStoredFullTimeRosters(currentTeamId, fullTimeRosterFileName, next)
            return next
        })
    }

    if (accountType === 'full_time') {
        return (
            <div id="rosters-page" data-component="rosters-page" className="mx-auto flex w-full max-w-6xl flex-col gap-6">
                <input
                    ref={fullTimeUploadInputRef}
                    className="hidden"
                    type="file"
                    accept=".csv"
                    onChange={event => {
                        void handleFullTimeRosterUpload(event.target.files?.[0] ?? null)
                        event.target.value = ''
                    }}
                />
                <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary/70">
                        Full-Time Rosters
                    </p>
                    <h2 className="mt-2 text-xl font-semibold">Team Roster View</h2>
                    <p className="mt-2 text-sm text-secondary/80">
                        Upload a roster CSV from this page. The page will load all days found in that upload into its own local roster dataset.
                    </p>
                    <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-secondary/80 md:grid-cols-2">
                        <p>
                            Team: <span className="font-semibold">{currentTeam?.name ?? 'No team selected'}</span>
                        </p>
                        <p>
                            Session Term: <span className="font-semibold">{currentTerm?.label ?? 'No term selected'}</span>
                        </p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <button
                            type="button"
                            className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${fullTimeViewTab === 'rosters'
                                    ? 'border-secondary bg-secondary text-accent'
                                    : 'border-secondary/30 bg-bg text-secondary hover:bg-accent'
                                }`}
                            onClick={() => setFullTimeViewTab('rosters')}
                        >
                            Roster View
                        </button>
                        <button
                            type="button"
                            className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${fullTimeViewTab === 'schematic'
                                    ? 'border-secondary bg-secondary text-accent'
                                    : 'border-secondary/30 bg-bg text-secondary hover:bg-accent'
                                }`}
                            onClick={() => setFullTimeViewTab('schematic')}
                        >
                            Schematic View
                        </button>
                    </div>
                </div>

                {!currentTeamId ? (
                    <div className="rounded-card border-2 border-secondary/30 bg-bg p-4 text-sm font-semibold text-secondary">
                        Select a team on the home page to view uploaded rosters.
                    </div>
                ) : (
                    <>
                        {fullTimeRosterFileName ? (
                            <div className="rounded-card border-2 border-secondary/20 bg-accent p-4 text-sm font-semibold text-secondary shadow-md">
                                Loaded roster file: {fullTimeRosterFileName}
                                {currentTerm?.label ? ` • Current term: ${currentTerm.label}` : ''}
                            </div>
                        ) : null}
                        {fullTimeUploadError ? (
                            <div className="rounded-card border-2 border-danger/30 bg-danger/10 p-4 text-sm font-semibold text-danger">
                                {fullTimeUploadError}
                            </div>
                        ) : null}
                        {fullTimeViewTab === 'rosters' ? (
                            <FullTimeRostersPanel
                                dayOptions={fullTimeRosterDayOptions}
                                levelOptions={fullTimeRosterLevelOptions}
                                dayFilter={fullTimeDayFilter}
                                levelFilter={fullTimeLevelFilter}
                                searchQuery={fullTimeSearchQuery}
                                onUploadRoster={() => fullTimeUploadInputRef.current?.click()}
                                onInstructorChange={handleFullTimeInstructorChange}
                                onDayFilterChange={setFullTimeDayFilter}
                                onLevelFilterChange={setFullTimeLevelFilter}
                                onSearchChange={setFullTimeSearchQuery}
                                rosters={filteredFullTimeRosters}
                            />
                        ) : (
                            <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                                            Schematic Preview
                                        </p>
                                        <h3 className="mt-2 text-xl font-semibold">
                                            {fullTimeSchematicDay ? dayNames[fullTimeSchematicDay] ?? fullTimeSchematicDay : 'No day selected'}
                                        </h3>
                                    </div>
                                    <button
                                        type="button"
                                        className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5"
                                        onClick={() => fullTimeUploadInputRef.current?.click()}
                                    >
                                        Upload Roster
                                    </button>
                                </div>
                                {fullTimeRosterDayOptions.length > 1 ? (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {fullTimeRosterDayOptions.map(day => (
                                            <button
                                                key={day}
                                                type="button"
                                                className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${fullTimeSchematicDay === day
                                                        ? 'border-secondary bg-secondary text-accent'
                                                        : 'border-secondary/30 bg-bg text-secondary hover:bg-accent'
                                                    }`}
                                                onClick={() => setFullTimeDayFilter(day)}
                                            >
                                                {dayNames[day] ?? day}
                                            </button>
                                        ))}
                                    </div>
                                ) : null}

                                {fullTimeSchematicCourses.length === 0 ? (
                                    <p className="mt-4 text-sm text-secondary/70">
                                        No uploaded classes are available for this day.
                                    </p>
                                ) : (
                                    <div className="mt-5">
                                        <SchematicBoard
                                            columns={fullTimeSchematicLayout.columns}
                                            instructors={fullTimeSchematicLayout.instructors}
                                            timeLabels={fullTimeSchematicTimeLabels}
                                            scheduleHeightRem={fullTimeSchematicHeight}
                                            scheduleStartMinutes={fullTimeSchematicStartMinutes}
                                            instructorOptions={[]}
                                            sessionLabel={[
                                                currentTeam?.name ?? '',
                                                fullTimeSchematicDay ? dayNames[fullTimeSchematicDay] ?? fullTimeSchematicDay : '',
                                            ].filter(Boolean).join(' | ')}
                                            readOnly
                                            onInstructorChange={() => { }}
                                            onCourseSelect={() => { }}
                                            onColumnDrop={() => { }}
                                            onCourseDrop={() => { }}
                                            onCourseDragStart={() => { }}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                        {fullTimeUploading ? (
                            <p className="text-sm font-semibold text-secondary/80">Processing roster upload...</p>
                        ) : null}
                    </>
                )}
            </div>
        )
    }

    return (
        <div id="rosters-page" data-component="rosters-page" className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">Roster Data</p>
                        <h2 className="mt-2 text-xl font-semibold">Upload and Review Rosters</h2>
                        <p className="mt-2 text-sm text-secondary/70">
                            Import a roster CSV directly from this page, then review or edit the loaded classes below.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="rounded-2xl bg-primary px-5 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5"
                        onClick={requestCsvFile}
                    >
                        Upload Roster
                    </button>
                </div>
            </div>

            <RostersTabs activeTab={activeTab} onChange={setActiveTab} />
            <div className="flex flex-col gap-6">
                {activeTab === 'custom' ? (
                    <CustomRostersPanel
                        rosters={rosters}
                        instructorOptions={instructorOptions}
                        customRosters={customRosters}
                        onSave={saveCustomRosters}
                    />
                ) : (
                    <>
                        <RosterFiltersBar
                            instructorOptions={instructorOptions}
                            levelOptions={levelOptions}
                            instructorFilter={instructorFilter}
                            levelFilter={levelFilter}
                            searchQuery={searchQuery}
                            onInstructorFilterChange={setInstructorFilter}
                            onLevelFilterChange={setLevelFilter}
                            onSearchChange={setSearchQuery}
                        />
                        <RosterList
                            rosters={filteredRosters}
                            emptyMessage={emptyMessage}
                            onPrintRoster={handlePrintRoster}
                            onRosterLevelChange={handleRosterLevelChange}
                            onCustomRosterLevelChange={updateCustomRosterLevel}
                            onStudentLevelChange={handleStudentLevelChange}
                            studentLevelEditMap={studentLevelEditMap}
                            onToggleStudentLevelEdits={handleToggleStudentLevelEdits}
                        />
                    </>
                )}
            </div>
        </div>
    )
}

export default RostersPage

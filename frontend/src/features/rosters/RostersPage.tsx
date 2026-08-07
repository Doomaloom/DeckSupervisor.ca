import { useEffect, useMemo, useRef, useState } from 'react'
import { useCsvImportFlow } from '../../app/CsvImportFlowContext'
import { useDay } from '../../app/DayContext'
import { useCurrentTeam } from '../../app/useCurrentTeam'
import { useCurrentTerm } from '../../app/useCurrentTerm'
import { getStoredItem, setStoredItem } from '../../lib/browserStorage'
import { extractStartTime } from '../../lib/time'
import type { ClassRoster, Student } from '../../types/app'
import { SLOT_HEIGHT_REM, SLOT_MINUTES, dayNames } from '../schematic/constants'
import FullTimeRostersPanel from '../schematic/components/FullTimeRostersPanel'
import SchematicBoard from '../schematic/components/SchematicBoard'
import { buildCourses } from '../schematic/utils/courses'
import { buildTimeLabels } from '../schematic/utils/time'
import { useSchematicBoard } from '../schematic/hooks/useSchematicBoard'
import CustomRostersPanel from './components/CustomRostersPanel'
import FullTimeInstructorAssignmentsPanel from './components/FullTimeInstructorAssignmentsPanel'
import FullTimeRequestListPanel from './components/FullTimeRequestListPanel'
import RosterFiltersBar from './components/RosterFiltersBar'
import RosterList from './components/RosterList'
import RostersTabs from './components/RostersTabs'
import {
    applyMatchedRequestCounts,
    attemptAutoAssignFullTimeRequests,
    buildColumnsForDay,
    buildAutoAssignedFullTimeRequestEntries,
    createEmptyInstructorDayAssignments,
    parseFullTimeRequestCsv,
    createRequestId,
    getInstructorPeriodsForDay,
    syncFullTimeRostersWithRequests,
    sortDayKeys,
} from './fullTimePlanning'
import {
    loadFullTimeInstructorAssignments,
    loadFullTimeRequestEntries,
    saveFullTimeInstructorAssignments,
    saveFullTimeRequestEntries,
} from './fullTimeStorage'
import { useCustomRosters } from './hooks/useCustomRosters'
import { useRosterData } from './hooks/useRosterData'
import { useRosterEdits } from './hooks/useRosterEdits'
import { useRosterFilters } from './hooks/useRosterFilters'
import { useRosterPrint } from './hooks/useRosterPrint'
import PrintPopupBlockedNotice from '../../components/PrintPopupBlockedNotice'
import { buildCustomRosterGroups, getEmptyMessage } from './utils'
import type {
    FullTimeInstructorAssignments,
    FullTimeInstructorPeriod,
    FullTimeRequestEntry,
    RosterListItem,
} from './types'
import { useAuth } from '../../app/AuthContext'
import { useCurrentSession } from '../../app/useCurrentSession'
import { fetchCsvAnalyze } from '../../lib/serverApi'

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

type FullTimeRequestDraft = Pick<FullTimeRequestEntry, 'firstName' | 'lastName' | 'phone' | 'instructor'>

const emptyFullTimeRequestDraft: FullTimeRequestDraft = {
    firstName: '',
    lastName: '',
    phone: '',
    instructor: '',
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
                waitlist: Boolean(student.waitlist),
            })),
        },
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
    const [fullTimeViewTab, setFullTimeViewTab] = useState<'rosters' | 'schematic' | 'instructors' | 'requests'>('rosters')
    const [fullTimeRosterFileName, setFullTimeRosterFileName] = useState('')
    const [fullTimeRosterClasses, setFullTimeRosterClasses] = useState<ClassRoster[]>([])
    const [fullTimeInstructorAssignments, setFullTimeInstructorAssignments] = useState<FullTimeInstructorAssignments>({})
    const [fullTimeRequestEntries, setFullTimeRequestEntries] = useState<FullTimeRequestEntry[]>([])
    const [fullTimeRequestDraft, setFullTimeRequestDraft] = useState<FullTimeRequestDraft>(emptyFullTimeRequestDraft)
    const [fullTimeUploadError, setFullTimeUploadError] = useState('')
    const [fullTimeUploading, setFullTimeUploading] = useState(false)
    const fullTimeUploadInputRef = useRef<HTMLInputElement | null>(null)
    const fullTimeTermKey = currentTerm?.key ?? 'no-term'
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
            if (item.roster.serviceName) {
                levels.add(item.roster.serviceName)
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
    const {
        blockedPrintJob,
        clearBlockedPrintJob,
        handlePrintRoster,
        retryBlockedPrint,
    } = useRosterPrint()
    const emptyMessage = getEmptyMessage(students.length)
    const handleToggleStudentLevelEdits = (code: string) => {
        setStudentLevelEditMap(current => ({
            ...current,
            [code]: !current[code],
        }))
    }
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

    useEffect(() => {
        if (accountType !== 'full_time' || !currentTeamId) {
            setFullTimeInstructorAssignments({})
            setFullTimeRequestEntries([])
            return
        }

        setFullTimeInstructorAssignments(loadFullTimeInstructorAssignments(currentTeamId, fullTimeTermKey))
        setFullTimeRequestEntries(loadFullTimeRequestEntries(currentTeamId, fullTimeTermKey))
    }, [accountType, currentTeamId, fullTimeTermKey])

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
            if (item.roster.serviceName) {
                levels.add(item.roster.serviceName)
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
            if (fullTimeLevelFilter && item.roster.serviceName !== fullTimeLevelFilter) {
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

    const fullTimeInstructorDayKeys = useMemo(
        () => sortDayKeys(fullTimeRosterDayOptions),
        [fullTimeRosterDayOptions],
    )

    const fullTimeInstructorPeriodsByDay = useMemo(
        () =>
            Object.fromEntries(
                fullTimeInstructorDayKeys.map(day => [
                    day,
                    getInstructorPeriodsForDay(buildColumnsForDay(fullTimeRosterClasses, day)),
                ]),
            ) as Record<string, ReturnType<typeof getInstructorPeriodsForDay>>,
        [fullTimeInstructorDayKeys, fullTimeRosterClasses],
    )

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
                    waitlist: Boolean(student.waitlist),
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
    const fullTimeInstructorOptions = useMemo(() => {
        const names = new Set<string>()
        fullTimeRosterClasses
            .filter(roster => roster.day === fullTimeSchematicDay)
            .forEach(roster => {
                const instructor = roster.instructor.trim()
                if (instructor) {
                    names.add(instructor)
                }
            })
        return Array.from(names).sort((left, right) => left.localeCompare(right, 'en', { sensitivity: 'base' }))
    }, [fullTimeRosterClasses, fullTimeSchematicDay])
    const {
        columns: fullTimeColumns,
        instructors: fullTimeInstructors,
        lockedInstructors: fullTimeLockedInstructors,
        selectedCourseCodes: fullTimeSelectedCourseCodes,
        toggleCourseSelection: toggleFullTimeCourseSelection,
        handleDragStart: handleFullTimeDragStart,
        handleDrop: handleFullTimeDrop,
        handleDropOnCourse: handleFullTimeDropOnCourse,
        addTemporaryColumn: addFullTimeTemporaryColumn,
        removeEmptyColumns: removeFullTimeEmptyColumns,
        setInstructorAt: setFullTimeInstructorAt,
    } = useSchematicBoard({
        courses: fullTimeSchematicCourses,
        storedLayout: null,
        allowStoredEmptyColumns: false,
    })

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

    const selectedFullTimeCourse = useMemo(() => {
        if (fullTimeSelectedCourseCodes.length !== 1) {
            return null
        }
        const selectedCode = fullTimeSelectedCourseCodes[0]
        return fullTimeColumns
            .flat()
            .find(course => course.code === selectedCode) ?? null
    }, [fullTimeColumns, fullTimeSelectedCourseCodes])

    const selectedFullTimeCourseRequests = useMemo(() => {
        if (!selectedFullTimeCourse) {
            return []
        }
        return fullTimeRequestEntries.filter(entry => {
            return entry.matchedDay === fullTimeSchematicDay && entry.matchedCode === selectedFullTimeCourse.code
        })
    }, [fullTimeRequestEntries, fullTimeSchematicDay, selectedFullTimeCourse])

    const handleFullTimeRosterUpload = async (file: File | null) => {
        if (!file || !currentTeamId) {
            return
        }
        setFullTimeUploadError('')
        setFullTimeUploading(true)
        try {
            const analyzed = await fetchCsvAnalyze(file, currentTerm
                ? {
                    teamId: currentTeamId,
                    termSeason: currentTerm.season,
                    termYear: currentTerm.year,
                }
                : {
                    teamId: currentTeamId,
                })
            const classes = (analyzed.rosters ?? []).map(roster => ({
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

    const handleClearFullTimeRosterAssignments = () => {
        if (!currentTeamId || fullTimeRosterClasses.length === 0) {
            return
        }
        if (!window.confirm('Clear all instructor assignments from the uploaded full-time rosters?')) {
            return
        }
        setFullTimeRosterClasses(current => {
            const next = current.map(roster => ({
                ...roster,
                instructor: '',
                students: roster.students.map(student => ({
                    ...student,
                    instructor: '',
                })),
            }))
            saveStoredFullTimeRosters(currentTeamId, fullTimeRosterFileName, next)
            return next
        })
    }

    const updateFullTimeInstructorAssignments = (
        day: string,
        period: FullTimeInstructorPeriod,
        updater: (current: string[]) => string[],
    ) => {
        if (!currentTeamId) {
            return
        }
        setFullTimeInstructorAssignments(current => {
            const currentDayAssignments = current[day] ?? createEmptyInstructorDayAssignments()
            const nextDayAssignments = {
                ...currentDayAssignments,
                [period]: updater(currentDayAssignments[period]),
            }
            const next = {
                ...current,
                [day]: nextDayAssignments,
            }
            saveFullTimeInstructorAssignments(currentTeamId, fullTimeTermKey, next)
            return next
        })
    }

    const handleFullTimeInstructorAssignmentChange = (
        day: string,
        period: FullTimeInstructorPeriod,
        index: number,
        value: string,
    ) => {
        updateFullTimeInstructorAssignments(day, period, current => {
            const next = [...current]
            next[index] = value
            return next
        })
    }

    const handleAddFullTimeInstructorAssignment = (
        day: string,
        period: FullTimeInstructorPeriod,
    ) => {
        updateFullTimeInstructorAssignments(day, period, current => [...current, ''])
    }

    const handleRemoveFullTimeInstructorAssignment = (
        day: string,
        period: FullTimeInstructorPeriod,
        index: number,
    ) => {
        updateFullTimeInstructorAssignments(day, period, current => {
            const next = current.filter((_, currentIndex) => currentIndex !== index)
            return next.length > 0 ? next : ['']
        })
    }

    const handleFullTimeRequestDraftChange = (
        field: keyof FullTimeRequestDraft,
        value: string,
    ) => {
        setFullTimeRequestDraft(current => ({
            ...current,
            [field]: value,
        }))
    }

    const handleAddFullTimeRequest = () => {
        if (!currentTeamId) {
            return
        }
        const nextEntry = {
            id: createRequestId(),
            firstName: fullTimeRequestDraft.firstName.trim(),
            lastName: fullTimeRequestDraft.lastName.trim(),
            phone: fullTimeRequestDraft.phone.trim(),
            instructor: fullTimeRequestDraft.instructor.trim(),
            accommodated: false,
            reason: '',
            reasonNote: '',
            matchedDay: '',
            matchedCode: '',
            matchedServiceName: '',
            matchedTime: '',
            matchedBy: '',
            matchedRequestCount: 0,
            requiresManualReview: false,
            manualReviewNote: '',
        } satisfies FullTimeRequestEntry

        if (!nextEntry.firstName || !nextEntry.lastName || !nextEntry.phone || !nextEntry.instructor) {
            alert('Enter first name, last name, phone number, and instructor before adding a request.')
            return
        }

        setFullTimeRequestEntries(current => {
            const next = [...current, nextEntry]
            saveFullTimeRequestEntries(currentTeamId, fullTimeTermKey, next)
            return next
        })
        setFullTimeRequestDraft(emptyFullTimeRequestDraft)
    }

    const handleFullTimeRequestEntryChange = <K extends keyof FullTimeRequestEntry>(
        id: string,
        field: K,
        value: FullTimeRequestEntry[K],
    ) => {
        if (!currentTeamId) {
            return
        }
        setFullTimeRequestEntries(current => {
            const next = current.map(entry => {
                if (entry.id !== id) {
                    return entry
                }
                if (field === 'accommodated') {
                    const accommodated = Boolean(value)
                    return {
                        ...entry,
                        accommodated,
                        reason: accommodated ? '' : entry.reason,
                        reasonNote: accommodated ? '' : entry.reasonNote,
                    }
                }
                if (field === 'reason' && entry.accommodated) {
                    return { ...entry, reason: '', reasonNote: '' }
                }
                if (field === 'reason') {
                    const reason = value as FullTimeRequestEntry['reason']
                    return {
                        ...entry,
                        reason,
                        reasonNote: reason === 'other' ? entry.reasonNote : '',
                    }
                }
                return {
                    ...entry,
                    [field]: value,
                }
            })
            saveFullTimeRequestEntries(currentTeamId, fullTimeTermKey, next)
            return next
        })
    }

    const handleDeleteFullTimeRequest = (id: string) => {
        if (!currentTeamId) {
            return
        }
        setFullTimeRequestEntries(current => {
            const next = current.filter(entry => entry.id !== id)
            saveFullTimeRequestEntries(currentTeamId, fullTimeTermKey, next)
            return next
        })
    }

    const handleImportFullTimeRequests = async (file: File | null) => {
        if (!currentTeamId || !file) {
            return
        }

        try {
            const imported = parseFullTimeRequestCsv(await file.text()).map(entry => ({
                id: createRequestId(),
                firstName: entry.firstName,
                lastName: entry.lastName,
                phone: entry.phone,
                instructor: entry.instructor,
                accommodated: false,
                reason: '',
                reasonNote: '',
                matchedDay: '',
                matchedCode: '',
                matchedServiceName: '',
                matchedTime: '',
                matchedBy: '',
                matchedRequestCount: 0,
                requiresManualReview: false,
                manualReviewNote: '',
            } satisfies FullTimeRequestEntry))

            if (imported.length === 0) {
                alert('The CSV did not contain any request rows to import.')
                return
            }

            setFullTimeRequestEntries(current => {
                const next = [...current, ...imported]
                saveFullTimeRequestEntries(currentTeamId, fullTimeTermKey, next)
                return next
            })
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Failed to import the requests CSV.')
        }
    }

    const handleAutoAssignFullTimeRequests = () => {
        if (!currentTeamId) {
            return
        }
        const next = attemptAutoAssignFullTimeRequests(fullTimeRequestEntries, fullTimeRosterClasses)
        setFullTimeRequestEntries(next.entries)
        setFullTimeRosterClasses(next.rosters)
        saveFullTimeRequestEntries(currentTeamId, fullTimeTermKey, next.entries)
        saveStoredFullTimeRosters(currentTeamId, fullTimeRosterFileName, next.rosters)
    }

    const handleReattemptFullTimeRequestAssignment = (id: string) => {
        if (!currentTeamId) {
            return
        }

        const targetEntry = fullTimeRequestEntries.find(entry => entry.id === id)
        if (!targetEntry) {
            return
        }

        const [updatedEntry] = buildAutoAssignedFullTimeRequestEntries([targetEntry], fullTimeRosterClasses)
        if (!updatedEntry) {
            return
        }

        const nextEntries = applyMatchedRequestCounts(
            fullTimeRequestEntries.map(entry => (entry.id === id ? updatedEntry : entry)),
        )
        const nextRosters = syncFullTimeRostersWithRequests(nextEntries, fullTimeRosterClasses)

        setFullTimeRequestEntries(nextEntries)
        setFullTimeRosterClasses(nextRosters)
        saveFullTimeRequestEntries(currentTeamId, fullTimeTermKey, nextEntries)
        saveStoredFullTimeRosters(currentTeamId, fullTimeRosterFileName, nextRosters)
    }

    const handleMarkFullTimeRequestsConflicting = (requestIds: string[]) => {
        if (!currentTeamId || requestIds.length === 0) {
            return
        }
        setFullTimeRequestEntries(current => {
            const requestIdSet = new Set(requestIds)
            const next = current.map(entry => {
                if (!requestIdSet.has(entry.id)) {
                    return entry
                }
                return {
                    ...entry,
                    accommodated: false,
                    reason: 'conflicting_request',
                    reasonNote: '',
                }
            })
            saveFullTimeRequestEntries(currentTeamId, fullTimeTermKey, next)
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
                        <button
                            type="button"
                            className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${fullTimeViewTab === 'instructors'
                                    ? 'border-secondary bg-secondary text-accent'
                                    : 'border-secondary/30 bg-bg text-secondary hover:bg-accent'
                                }`}
                            onClick={() => setFullTimeViewTab('instructors')}
                        >
                            Instructors
                        </button>
                        <button
                            type="button"
                            className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${fullTimeViewTab === 'requests'
                                    ? 'border-secondary bg-secondary text-accent'
                                    : 'border-secondary/30 bg-bg text-secondary hover:bg-accent'
                                }`}
                            onClick={() => setFullTimeViewTab('requests')}
                        >
                            Request List
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
                                onClearAssignments={handleClearFullTimeRosterAssignments}
                                onInstructorChange={handleFullTimeInstructorChange}
                                onDayFilterChange={setFullTimeDayFilter}
                                onLevelFilterChange={setFullTimeLevelFilter}
                                onSearchChange={setFullTimeSearchQuery}
                                rosters={filteredFullTimeRosters}
                            />
                        ) : fullTimeViewTab === 'instructors' ? (
                            <FullTimeInstructorAssignmentsPanel
                                dayKeys={fullTimeInstructorDayKeys}
                                periodMap={fullTimeInstructorPeriodsByDay}
                                assignments={fullTimeInstructorAssignments}
                                onInstructorChange={handleFullTimeInstructorAssignmentChange}
                                onAddInstructor={handleAddFullTimeInstructorAssignment}
                                onRemoveInstructor={handleRemoveFullTimeInstructorAssignment}
                            />
                        ) : fullTimeViewTab === 'requests' ? (
                            <FullTimeRequestListPanel
                                draft={fullTimeRequestDraft}
                                entries={fullTimeRequestEntries}
                                onDraftChange={handleFullTimeRequestDraftChange}
                                onAddRequest={handleAddFullTimeRequest}
                                onImportCsv={file => {
                                    void handleImportFullTimeRequests(file)
                                }}
                                onAutoAssign={handleAutoAssignFullTimeRequests}
                                onReattemptEntry={handleReattemptFullTimeRequestAssignment}
                                onEntryChange={handleFullTimeRequestEntryChange}
                                onDeleteRequest={handleDeleteFullTimeRequest}
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
                                        <div className="mb-4 flex flex-wrap justify-center gap-3">
                                            <button
                                                type="button"
                                                className="rounded-2xl border border-secondary/30 bg-bg px-5 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-accent"
                                                onClick={addFullTimeTemporaryColumn}
                                            >
                                                Add Temporary Column
                                            </button>
                                            <button
                                                type="button"
                                                className="rounded-2xl border border-secondary/30 bg-bg px-5 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-accent"
                                                onClick={removeFullTimeEmptyColumns}
                                            >
                                                Remove Empty Columns
                                            </button>
                                        </div>
                                        {selectedFullTimeCourse ? (
                                            <div className="mb-4 rounded-2xl border border-secondary/20 bg-bg p-4 text-secondary">
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                                                            Selected Class Requests
                                                        </p>
                                                        <h4 className="mt-2 text-lg font-semibold">
                                                            {selectedFullTimeCourse.level} • {selectedFullTimeCourse.code}
                                                        </h4>
                                                        <p className="mt-1 text-sm text-secondary/70">
                                                            {selectedFullTimeCourse.startTime} - {selectedFullTimeCourse.endTime}
                                                            {selectedFullTimeCourse.assignedInstructor
                                                                ? ` • Assigned to ${selectedFullTimeCourse.assignedInstructor}`
                                                                : ''}
                                                        </p>
                                                    </div>
                                                    {selectedFullTimeCourseRequests.some(entry => entry.accommodated) ? (
                                                        <button
                                                            type="button"
                                                            className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger transition hover:bg-danger/20"
                                                            onClick={() =>
                                                                handleMarkFullTimeRequestsConflicting(
                                                                    selectedFullTimeCourseRequests
                                                                        .filter(entry => entry.accommodated)
                                                                        .map(entry => entry.id),
                                                                )
                                                            }
                                                        >
                                                            Mark All Conflicting
                                                        </button>
                                                    ) : null}
                                                </div>
                                                {selectedFullTimeCourseRequests.length === 0 ? (
                                                    <p className="mt-3 text-sm text-secondary/70">
                                                        No matched requests are linked to this class yet.
                                                    </p>
                                                ) : (
                                                    <div className="mt-4 flex flex-col gap-3">
                                                        {selectedFullTimeCourseRequests.map(entry => (
                                                            <div
                                                                key={entry.id}
                                                                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-secondary/15 bg-accent/60 px-4 py-3"
                                                            >
                                                                <div>
                                                                    <p className="font-semibold text-secondary">
                                                                        {[entry.firstName, entry.lastName].filter(Boolean).join(' ')}
                                                                    </p>
                                                                    <p className="text-sm text-secondary/75">
                                                                        {entry.phone}
                                                                        {entry.instructor ? ` • Requested: ${entry.instructor}` : ''}
                                                                        {entry.matchedBy ? ` • Matched by ${entry.matchedBy}` : ''}
                                                                    </p>
                                                                    {entry.requiresManualReview ? (
                                                                        <p className="mt-1 text-sm font-semibold text-danger">
                                                                            Manual review: {entry.manualReviewNote || 'This match should be reviewed manually.'}
                                                                        </p>
                                                                    ) : null}
                                                                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-secondary/60">
                                                                        {entry.accommodated
                                                                            ? 'Accommodated'
                                                                            : entry.reason === 'conflicting_request'
                                                                                ? 'Not accommodated: conflicting request'
                                                                                : entry.reason
                                                                                    ? `Not accommodated: ${entry.reason.replaceAll('_', ' ')}`
                                                                                    : 'Not accommodated'}
                                                                    </p>
                                                                    {!entry.accommodated && entry.reason === 'other' && entry.reasonNote ? (
                                                                        <p className="mt-1 text-sm text-secondary/75">
                                                                            Note: {entry.reasonNote}
                                                                        </p>
                                                                    ) : null}
                                                                </div>
                                                                {entry.accommodated ? (
                                                                    <button
                                                                        type="button"
                                                                        className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger transition hover:bg-danger/20"
                                                                        onClick={() => handleMarkFullTimeRequestsConflicting([entry.id])}
                                                                    >
                                                                        Mark Conflicting
                                                                    </button>
                                                                ) : null}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ) : null}
                                        <SchematicBoard
                                            columns={fullTimeColumns}
                                            instructors={fullTimeInstructors}
                                            lockedInstructors={fullTimeLockedInstructors}
                                            selectedCourseCodes={fullTimeSelectedCourseCodes}
                                            timeLabels={fullTimeSchematicTimeLabels}
                                            scheduleHeightRem={fullTimeSchematicHeight}
                                            scheduleStartMinutes={fullTimeSchematicStartMinutes}
                                            instructorOptions={fullTimeInstructorOptions}
                                            sessionLabel={[
                                                currentTeam?.name ?? '',
                                                fullTimeSchematicDay ? dayNames[fullTimeSchematicDay] ?? fullTimeSchematicDay : '',
                                            ].filter(Boolean).join(' | ')}
                                            onInstructorChange={setFullTimeInstructorAt}
                                            onCourseSelect={toggleFullTimeCourseSelection}
                                            onColumnDrop={handleFullTimeDrop}
                                            onCourseDrop={handleFullTimeDropOnCourse}
                                            onCourseDragStart={handleFullTimeDragStart}
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
                {blockedPrintJob ? (
                    <PrintPopupBlockedNotice
                        jobLabel={blockedPrintJob.jobLabel}
                        onRetry={retryBlockedPrint}
                        onDismiss={clearBlockedPrintJob}
                    />
                ) : null}
                {activeTab === 'custom' ? (
                    <CustomRostersPanel
                        rosters={rosters}
                        instructorOptions={instructorOptions}
                        customRosters={customRosters}
                        onPrintRoster={handlePrintRoster}
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

import { useEffect, useMemo, useState } from 'react'
import { ArrowsPointingOutIcon } from '@heroicons/react/24/outline'
import { useLocation } from 'react-router-dom'
import type { PlannerCallStatus, PlannerClass, PlannerClassStatus, PlannerDataset, PlannerParticipant } from '../../types/app'
import {
    getPlannerAlternativeClasses,
    getPlannerClassCapacityBand,
    getPlannerFillPercent,
    loadPlannerDataset,
    parseSessionPlannerCsv,
    plannerCallStatusOptions,
    savePlannerDataset,
    summarizePlannerCalls,
    updatePlannerCallRecord,
    updatePlannerClassStatus,
} from '../../lib/sessionPlanner'
import { extractEndTime, extractStartTime, getRunningMinutes } from '../../lib/time'
import TimeRail from '../schematic/components/TimeRail'
import { COLUMN_MIN_WIDTH_PX, HEADER_HEIGHT_REM, SLOT_HEIGHT_REM, SLOT_MINUTES } from '../schematic/constants'
import { buildTimeLabels, timeToMinutes } from '../schematic/utils/time'

const PLANNER_SLOT_HEIGHT_REM = SLOT_HEIGHT_REM + 0.9

const dayNames: Record<string, string> = {
    Mo: 'Monday',
    Tu: 'Tuesday',
    We: 'Wednesday',
    Th: 'Thursday',
    Fr: 'Friday',
    Sa: 'Saturday',
    Su: 'Sunday',
}

const dayOrder = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const

function statusClasses(status: PlannerClassStatus) {
    switch (status) {
        case 'pending_cancellation':
            return 'border-amber-400 bg-amber-50 text-amber-900'
        case 'cancelled':
            return 'border-rose-400 bg-rose-50 text-rose-900'
        default:
            return 'border-emerald-400 bg-emerald-50 text-emerald-900'
    }
}

function capacityClasses(plannerClass: PlannerClass) {
    switch (getPlannerClassCapacityBand(plannerClass)) {
        case 'red':
            return 'bg-rose-100 text-rose-900'
        case 'yellow':
            return 'bg-amber-100 text-amber-900'
        case 'green':
            return 'bg-emerald-100 text-emerald-900'
        default:
            return 'bg-secondary/10 text-secondary'
    }
}

type PlannerBoardCourse = {
    classKey: string
    serviceName: string
    eventId: string
    eventTime: string
    facility: string
    bookedCount: number
    maximumCapacity: number
    waitlistCount: number
    planningStatus: PlannerClassStatus
    startTime: string
    endTime: string
    startMinutes: number
    endMinutes: number
    runningTime: number
}

function buildPlannerBoardCourses(classes: PlannerClass[]): PlannerBoardCourse[] {
    return classes
        .map(plannerClass => {
            const startTime = extractStartTime(plannerClass.eventTime)
            const endTime = extractEndTime(plannerClass.eventTime)
            const startMinutes = timeToMinutes(startTime)
            const rawEndMinutes = timeToMinutes(endTime)
            const endMinutes = rawEndMinutes >= startMinutes ? rawEndMinutes : rawEndMinutes + 24 * 60
            return {
                classKey: plannerClass.classKey,
                serviceName: plannerClass.serviceName,
                eventId: plannerClass.eventId,
                eventTime: plannerClass.eventTime,
                facility: plannerClass.facility,
                bookedCount: plannerClass.bookedCount,
                maximumCapacity: plannerClass.maximumCapacity,
                waitlistCount: plannerClass.waitlistCount,
                planningStatus: plannerClass.planningStatus,
                startTime,
                endTime,
                startMinutes,
                endMinutes,
                runningTime: getRunningMinutes(plannerClass.eventTime),
            }
        })
        .sort((left, right) => {
            if (left.startMinutes !== right.startMinutes) {
                return left.startMinutes - right.startMinutes
            }
            return left.endMinutes - right.endMinutes
        })
}

function buildPlannerBoardColumns(courses: PlannerBoardCourse[]) {
    const columns: PlannerBoardCourse[][] = []
    courses.forEach(course => {
        let placed = false
        for (const column of columns) {
            const last = column[column.length - 1]
            if (last.endMinutes <= course.startMinutes) {
                column.push(course)
                placed = true
                break
            }
        }
        if (!placed) {
            columns.push([course])
        }
    })
    return columns
}

function getPlannerBoardStatusClasses(status: PlannerClassStatus, isSelected: boolean) {
    const selectedRing = isSelected ? 'ring-2 ring-secondary ring-inset' : ''
    switch (status) {
        case 'pending_cancellation':
            return `${selectedRing} border-amber-500 bg-amber-100 text-amber-950`
        case 'cancelled':
            return `${selectedRing} border-rose-500 bg-rose-100 text-rose-950`
        default:
            return `${selectedRing} border-black text-black`
    }
}

function SessionPlanningPage() {
    const location = useLocation()
    const [dataset, setDataset] = useState<PlannerDataset | null>(null)
    const [selectedDay, setSelectedDay] = useState('')
    const [selectedLocation, setSelectedLocation] = useState('')
    const [selectedClassKey, setSelectedClassKey] = useState('')
    const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(true)
    const [error, setError] = useState('')
    const isPopout = new URLSearchParams(location.search).get('popout') === '1'

    useEffect(() => {
        const stored = loadPlannerDataset()
        if (!stored) {
            return
        }
        setDataset(stored)
    }, [])

    const persistDataset = (next: PlannerDataset) => {
        setDataset(next)
        savePlannerDataset(next)
    }

    const handleUpload = async (file: File | null) => {
        if (!file) {
            return
        }
        try {
            const text = await file.text()
            const next = parseSessionPlannerCsv(text, file.name)
            persistDataset(next)
            setError('')
            const firstSession = next.sessions[0]
            const firstClass = next.classes[0]
            setSelectedDay(firstSession?.dayOfWeek ?? '')
            setSelectedLocation(firstSession?.facility ?? '')
            setSelectedClassKey(firstClass?.classKey ?? '')
        } catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : 'Failed to parse planner CSV.')
        }
    }

    const availableDays = useMemo(() => {
        if (!dataset) {
            return []
        }
        return Array.from(new Set(dataset.sessions.map(session => session.dayOfWeek))).sort((left, right) => {
            const leftIndex = dayOrder.indexOf(left as (typeof dayOrder)[number])
            const rightIndex = dayOrder.indexOf(right as (typeof dayOrder)[number])
            if (leftIndex === -1 && rightIndex === -1) {
                return left.localeCompare(right)
            }
            if (leftIndex === -1) {
                return 1
            }
            if (rightIndex === -1) {
                return -1
            }
            return leftIndex - rightIndex
        })
    }, [dataset])

    useEffect(() => {
        if (!availableDays.length) {
            setSelectedDay('')
            return
        }
        if (!selectedDay || !availableDays.includes(selectedDay)) {
            setSelectedDay(availableDays[0])
        }
    }, [availableDays, selectedDay])

    const availableLocations = useMemo(() => {
        if (!dataset || !selectedDay) {
            return []
        }
        return Array.from(
            new Set(
                dataset.sessions
                    .filter(session => session.dayOfWeek === selectedDay)
                    .map(session => session.facility),
            ),
        ).sort((left, right) => left.localeCompare(right))
    }, [dataset, selectedDay])

    useEffect(() => {
        if (!availableLocations.length) {
            setSelectedLocation('')
            return
        }
        if (!selectedLocation || !availableLocations.includes(selectedLocation)) {
            setSelectedLocation(availableLocations[0])
        }
    }, [availableLocations, selectedLocation])

    const visibleClasses = useMemo(() => {
        if (!dataset || !selectedDay || !selectedLocation) {
            return []
        }
        return dataset.classes.filter(
            plannerClass => plannerClass.dayOfWeek === selectedDay && plannerClass.facility === selectedLocation,
        )
    }, [dataset, selectedDay, selectedLocation])

    useEffect(() => {
        if (!visibleClasses.length) {
            setSelectedClassKey('')
            return
        }
        if (!selectedClassKey || !visibleClasses.some(plannerClass => plannerClass.classKey === selectedClassKey)) {
            setSelectedClassKey(visibleClasses[0].classKey)
        }
    }, [selectedClassKey, visibleClasses])

    const selectedClass = useMemo(
        () => dataset?.classes.find(plannerClass => plannerClass.classKey === selectedClassKey) ?? null,
        [dataset, selectedClassKey],
    )

    const bookedParticipants = useMemo(() => {
        if (!dataset || !selectedClass) {
            return []
        }
        const byId = new Map(dataset.participants.map(participant => [participant.id, participant]))
        return selectedClass.participantIds
            .map(participantId => byId.get(participantId))
            .filter((participant): participant is PlannerParticipant => Boolean(participant))
    }, [dataset, selectedClass])

    const alternatives = useMemo(() => {
        if (!dataset || !selectedClass) {
            return []
        }
        return getPlannerAlternativeClasses(dataset, selectedClass)
    }, [dataset, selectedClass])

    const boardCourses = useMemo(() => buildPlannerBoardCourses(visibleClasses), [visibleClasses])
    const boardColumns = useMemo(() => buildPlannerBoardColumns(boardCourses), [boardCourses])

    const scheduleBounds = useMemo(() => {
        if (boardCourses.length === 0) {
            return null
        }
        const earliest = Math.min(...boardCourses.map(course => course.startMinutes))
        const latest = Math.max(...boardCourses.map(course => course.endMinutes))
        const startHour = Math.floor(earliest / 60)
        const endHour = Math.ceil(latest / 60)
        const start = `${String(startHour).padStart(2, '0')}:00`
        const end = `${String(endHour).padStart(2, '0')}:00`
        return { start, end }
    }, [boardCourses])

    const timeLabels = useMemo(() => {
        if (!scheduleBounds) {
            return []
        }
        return buildTimeLabels(scheduleBounds.start, scheduleBounds.end)
    }, [scheduleBounds])

    const scheduleStartMinutes = useMemo(() => {
        if (!scheduleBounds) {
            return 0
        }
        return timeToMinutes(scheduleBounds.start)
    }, [scheduleBounds])

    const scheduleHeightRem = useMemo(() => timeLabels.length * PLANNER_SLOT_HEIGHT_REM, [timeLabels])
    const setClassStatus = (classKey: string, status: PlannerClassStatus) => {
        if (!dataset) {
            return
        }
        persistDataset(updatePlannerClassStatus(dataset, classKey, status))
    }

    const setCallRecord = (
        participantId: string,
        update: {
            status?: PlannerCallStatus
            notes?: string
            offeredAlternativeClassKey?: string
            acceptedAlternativeClassKey?: string
        },
    ) => {
        if (!dataset) {
            return
        }
        persistDataset(updatePlannerCallRecord(dataset, participantId, update))
    }

    const summary = selectedClass && dataset ? summarizePlannerCalls(dataset, selectedClass.classKey) : null
    const openPopout = () => {
        const popoutUrl = `${window.location.origin}/session-planning?popout=1`
        const popup = window.open(
            popoutUrl,
            'session-planning-popout',
            'popup=yes,width=1600,height=1000,resizable=yes,scrollbars=yes',
        )
        popup?.focus()
    }

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
            <div className="rounded-card border-2 border-secondary/20 bg-accent p-8 text-secondary shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary/70">
                            Session Planning
                        </p>
                        <h2 className="mt-3 text-2xl font-semibold">Session Planning / Reorganization</h2>
                    </div>
                    {!isPopout ? (
                        <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-2xl border border-secondary/30 bg-bg px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-primary/10"
                            onClick={openPopout}
                        >
                            <ArrowsPointingOutIcon className="h-4 w-4" />
                            Pop Out Planner
                        </button>
                    ) : null}
                </div>
                <p className="mt-2 max-w-3xl text-secondary/80">
                    Upload a participant CSV to review classes by day and location, flag cancellations,
                    track calls, and offer exact-level alternatives.
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-4">
                    <label className="relative flex h-12 items-center justify-center rounded-2xl border-2 border-dashed border-secondary bg-bg px-5 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:border-primary">
                        <span>{dataset ? 'Replace Planner CSV' : 'Upload Planner CSV'}</span>
                        <input
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            type="file"
                            accept=".csv"
                            onChange={event => {
                                void handleUpload(event.target.files?.[0] ?? null)
                                event.target.value = ''
                            }}
                        />
                    </label>
                    {dataset ? (
                        <p className="text-sm text-secondary/70">
                            Loaded: <span className="font-semibold text-secondary">{dataset.sourceFileName}</span>
                        </p>
                    ) : null}
                </div>
                {error ? <p className="mt-4 text-sm font-semibold text-danger">{error}</p> : null}
            </div>

            {!dataset ? (
                <div className="rounded-card border-2 border-secondary/20 bg-accent p-8 text-secondary shadow-md">
                    Upload a participant CSV to start planning.
                </div>
            ) : (
                <div className={`grid gap-6 ${isInfoPanelOpen ? 'lg:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]' : ''}`}>
                    <div className="flex min-h-[70vh] flex-col gap-4 rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                        <div className="flex flex-wrap gap-2">
                            {availableDays.map(day => (
                                <button
                                    key={day}
                                    type="button"
                                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${selectedDay === day ? 'bg-secondary text-accent' : 'bg-bg text-secondary hover:bg-secondary/10'
                                        }`}
                                    onClick={() => setSelectedDay(day)}
                                >
                                    {dayNames[day] ?? day}
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {availableLocations.map(location => (
                                <button
                                    key={location}
                                    type="button"
                                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${selectedLocation === location ? 'bg-primary text-accent' : 'bg-bg text-secondary hover:bg-primary/10'
                                        }`}
                                    onClick={() => setSelectedLocation(location)}
                                >
                                    {location}
                                </button>
                            ))}
                        </div>

                        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto pr-1">
                            {visibleClasses.length === 0 ? (
                                <div className="rounded-2xl border border-secondary/20 bg-bg p-5 text-sm text-secondary/70">
                                    No classes found for this day and location.
                                </div>
                            ) : (
                                <div className="flex min-w-[760px] items-start justify-center gap-4">
                                    <TimeRail
                                        className="mt-8 flex min-w-[70px] flex-col items-center text-xs text-secondary"
                                        headerHeightRem={HEADER_HEIGHT_REM}
                                        slotHeightRem={PLANNER_SLOT_HEIGHT_REM}
                                        labels={timeLabels}
                                        keyPrefix="planner-left"
                                    />

                                    <div className="flex-1">
                                        <div className="flex flex-col gap-3">
                                            <div className="rounded-xl bg-primary px-4 py-2 text-center font-semibold text-accent">
                                                {dayNames[selectedDay] ?? selectedDay} • {selectedLocation}
                                            </div>
                                            <div className="flex">
                                                {boardColumns.map((column, columnIndex) => (
                                                    <div
                                                        key={`planner-column-${columnIndex}`}
                                                        className="flex flex-1 flex-col"
                                                        style={{ minWidth: `${COLUMN_MIN_WIDTH_PX}px` }}
                                                    >
                                                        <div className={`border border-black bg-accent p-2 ${columnIndex === 0 ? 'border-black' : 'border-black border-l-0'}`}>
                                                            <div className="w-full rounded-none border border-black bg-white px-2 py-1 text-center text-sm font-semibold text-black">
                                                                Class Lane {columnIndex + 1}
                                                            </div>
                                                        </div>
                                                        <div
                                                            className={`relative border border-black border-t-0 bg-bg ${columnIndex === 0 ? 'border-black' : 'border-black border-l-0'}`}
                                                            style={{ height: `${scheduleHeightRem}rem` }}
                                                        >
                                                            {column.map(course => {
                                                                const startOffset = (course.startMinutes - scheduleStartMinutes) / SLOT_MINUTES
                                                                const courseHeight = course.runningTime / SLOT_MINUTES
                                                                const plannerClass = visibleClasses.find(item => item.classKey === course.classKey)
                                                                const isSelected = selectedClassKey === course.classKey
                                                                return (
                                                                    <button
                                                                        key={course.classKey}
                                                                        type="button"
                                                                        className={`absolute left-0 right-0 flex flex-col overflow-hidden border text-left text-xs transition hover:z-10 hover:-translate-y-0.5 ${getPlannerBoardStatusClasses(course.planningStatus, isSelected)
                                                                            } ${plannerClass ? capacityClasses(plannerClass) : 'bg-white'}`}
                                                                        onClick={() => {
                                                                            setSelectedClassKey(course.classKey)
                                                                            setIsInfoPanelOpen(true)
                                                                        }}
                                                                        style={{
                                                                            top: `${startOffset * PLANNER_SLOT_HEIGHT_REM}rem`,
                                                                            height: `${courseHeight * PLANNER_SLOT_HEIGHT_REM}rem`,
                                                                        }}
                                                                    >
                                                                        <div className="flex flex-1 flex-col gap-1 px-2 py-2">
                                                                            <div className="flex items-start justify-between gap-2">
                                                                                <p className="line-clamp-2 font-semibold">{course.serviceName}</p>
                                                                                <span className="rounded-full border border-black/20 bg-white/70 px-1.5 py-0.5 text-[0.6rem] font-semibold">
                                                                                    {course.eventId}
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-[0.7rem]">{course.eventTime}</p>
                                                                            <span className={`w-fit rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] ${statusClasses(course.planningStatus)}`}>
                                                                                {course.planningStatus.replace('_', ' ')}
                                                                            </span>
                                                                        </div>
                                                                        <div className="border-t border-black bg-white/70 px-2 py-0.5 text-center text-[0.7rem] font-semibold">
                                                                            {course.bookedCount} / {course.maximumCapacity} • W {course.waitlistCount}
                                                                        </div>
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <TimeRail
                                        className="mt-8 flex min-w-[70px] flex-col items-center text-xs text-secondary"
                                        headerHeightRem={HEADER_HEIGHT_REM}
                                        slotHeightRem={PLANNER_SLOT_HEIGHT_REM}
                                        labels={timeLabels}
                                        keyPrefix="planner-right"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {isInfoPanelOpen ? (
                        <div className="flex min-h-[70vh] flex-col gap-4 rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                            {!selectedClass || !dataset ? (
                                <>
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                                                Class Details
                                            </p>
                                            <h3 className="mt-2 text-xl font-semibold">No class selected</h3>
                                        </div>
                                        <button
                                            type="button"
                                            className="rounded-full border border-secondary/30 px-3 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-bg"
                                            onClick={() => setIsInfoPanelOpen(false)}
                                        >
                                            Close
                                        </button>
                                    </div>
                                    <div className="rounded-2xl border border-secondary/20 bg-bg p-5 text-sm text-secondary/70">
                                        Select a class on the board to manage its cancellation workflow.
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                                                {dayNames[selectedClass.dayOfWeek] ?? selectedClass.dayOfWeek} • {selectedClass.facility}
                                            </p>
                                            <h3 className="mt-2 text-xl font-semibold">{selectedClass.serviceName}</h3>
                                            <p className="mt-1 text-sm text-secondary/70">{selectedClass.eventTime}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                className="rounded-full border border-secondary/30 px-3 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-bg"
                                                onClick={() => setIsInfoPanelOpen(false)}
                                            >
                                                Close
                                            </button>
                                            <button
                                                type="button"
                                                className="rounded-full bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900 transition hover:-translate-y-0.5"
                                                onClick={() => setClassStatus(selectedClass.classKey, 'pending_cancellation')}
                                            >
                                                Pending Cancellation
                                            </button>
                                            <button
                                                type="button"
                                                className="rounded-full bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-900 transition hover:-translate-y-0.5"
                                                onClick={() => setClassStatus(selectedClass.classKey, 'cancelled')}
                                            >
                                                Cancelled
                                            </button>
                                            <button
                                                type="button"
                                                className="rounded-full bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:-translate-y-0.5"
                                                onClick={() => setClassStatus(selectedClass.classKey, 'active')}
                                            >
                                                Active
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-2xl border border-secondary/20 bg-bg p-4">
                                            <p className="text-xs uppercase tracking-[0.14em] text-secondary/70">Capacity</p>
                                            <p className="mt-2 text-lg font-semibold">
                                                {selectedClass.bookedCount} / {selectedClass.maximumCapacity}
                                            </p>
                                            <p className="text-sm text-secondary/70">Minimum capacity {selectedClass.minimumCapacity}</p>
                                        </div>
                                        <div className="rounded-2xl border border-secondary/20 bg-bg p-4">
                                            <p className="text-xs uppercase tracking-[0.14em] text-secondary/70">Waitlist</p>
                                            <p className="mt-2 text-lg font-semibold">{selectedClass.waitlistCount}</p>
                                            <p className="text-sm text-secondary/70">Booked count trusts the CSV Booked field.</p>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-secondary/20 bg-bg p-4">
                                        <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-secondary/70">
                                            Alternative Classes
                                        </h4>
                                        <div className="mt-3 flex max-h-48 flex-col gap-2 overflow-y-auto pr-1">
                                            {alternatives.length === 0 ? (
                                                <p className="text-sm text-secondary/70">No exact ServiceName alternatives found.</p>
                                            ) : (
                                                alternatives.map(option => (
                                                    <div key={option.classKey} className="rounded-2xl border border-secondary/20 bg-accent p-3">
                                                        <p className="font-semibold">
                                                            {dayNames[option.dayOfWeek] ?? option.dayOfWeek} • {option.eventTime}
                                                        </p>
                                                        <p className="text-sm text-secondary/70">
                                                            {option.facility} • {option.bookedCount}/{option.maximumCapacity} booked • waitlist {option.waitlistCount}
                                                        </p>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {selectedClass.planningStatus === 'active' ? (
                                        <div className="rounded-2xl border border-secondary/20 bg-bg p-4 text-sm text-secondary/70">
                                            Mark this class as pending cancellation or cancelled to start the call workflow.
                                        </div>
                                    ) : (
                                        <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-secondary/20 bg-bg p-4">
                                            <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-secondary/70">
                                                Cancellation Call Workflow
                                            </h4>
                                            <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
                                                {bookedParticipants.map(participant => {
                                                    const callRecord = dataset.callRecords[participant.id]
                                                    return (
                                                        <div key={participant.id} className="rounded-2xl border border-secondary/20 bg-accent p-4">
                                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                                <div>
                                                                    <p className="font-semibold">{participant.name}</p>
                                                                    <p className="text-sm text-secondary/70">
                                                                        {participant.phone || 'No phone'} {participant.email ? `• ${participant.email}` : ''}
                                                                    </p>
                                                                </div>
                                                                <select
                                                                    className="rounded-xl border border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                                                                    value={callRecord?.status ?? 'not_started'}
                                                                    onChange={event =>
                                                                        setCallRecord(participant.id, { status: event.target.value as PlannerCallStatus })
                                                                    }
                                                                >
                                                                    {plannerCallStatusOptions.map(option => (
                                                                        <option key={option.key} value={option.key}>
                                                                            {option.label}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>

                                                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                                                                <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
                                                                    Offered Alternative
                                                                    <select
                                                                        className="rounded-xl border border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                                                                        value={callRecord?.offeredAlternativeClassKey ?? ''}
                                                                        onChange={event =>
                                                                            setCallRecord(participant.id, {
                                                                                offeredAlternativeClassKey: event.target.value,
                                                                            })
                                                                        }
                                                                    >
                                                                        <option value="">No offer selected</option>
                                                                        {alternatives.map(option => (
                                                                            <option key={option.classKey} value={option.classKey}>
                                                                                {(dayNames[option.dayOfWeek] ?? option.dayOfWeek)} • {option.eventTime} • {option.facility}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </label>

                                                                <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
                                                                    Accepted Alternative
                                                                    <select
                                                                        className="rounded-xl border border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                                                                        value={callRecord?.acceptedAlternativeClassKey ?? ''}
                                                                        onChange={event =>
                                                                            setCallRecord(participant.id, {
                                                                                acceptedAlternativeClassKey: event.target.value,
                                                                                status: event.target.value ? 'accepted_alternative' : callRecord?.status ?? 'not_started',
                                                                            })
                                                                        }
                                                                    >
                                                                        <option value="">No acceptance recorded</option>
                                                                        {alternatives.map(option => (
                                                                            <option key={option.classKey} value={option.classKey}>
                                                                                {(dayNames[option.dayOfWeek] ?? option.dayOfWeek)} • {option.eventTime} • {option.facility}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </label>
                                                            </div>

                                                            <label className="mt-3 flex flex-col gap-2 text-sm font-semibold text-secondary">
                                                                Notes
                                                                <textarea
                                                                    className="min-h-20 rounded-xl border border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                                                                    value={callRecord?.notes ?? ''}
                                                                    onChange={event => setCallRecord(participant.id, { notes: event.target.value })}
                                                                />
                                                            </label>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    )
}

export default SessionPlanningPage

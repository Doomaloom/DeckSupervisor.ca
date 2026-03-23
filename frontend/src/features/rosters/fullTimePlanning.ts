import type { ClassRoster, Student } from '../../types/app'
import { buildCourses } from '../schematic/utils/courses'
import { createRequestAwareLayout } from '../schematic/utils/layout'
import type {
    FullTimeInstructorAssignments,
    FullTimeInstructorDayAssignments,
    FullTimeInstructorPeriod,
    FullTimeRequestEntry,
    FullTimeRequestReason,
} from './types'

const dayOrder = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const

export const fullTimeRequestReasonOptions: Array<{
    value: Exclude<FullTimeRequestReason, ''>
    label: string
}> = [
    { value: 'conflicting_request', label: 'Conflicting request' },
    { value: 'staff_schedule', label: 'Staff schedule' },
    { value: 'student_not_registered', label: 'Student not registered' },
]

export function createEmptyInstructorDayAssignments(): FullTimeInstructorDayAssignments {
    return {
        allDay: [''],
        am: [''],
        pm: [''],
    }
}

export function sanitizeInstructorNames(names: string[]) {
    const trimmed = names.map(name => name.trim())
    const nonEmpty = trimmed.filter(Boolean)
    return nonEmpty.length > 0 ? nonEmpty : ['']
}

export function normalizeInstructorAssignments(
    input: unknown,
): FullTimeInstructorAssignments {
    if (!input || typeof input !== 'object') {
        return {}
    }

    return Object.fromEntries(
        Object.entries(input).map(([day, value]) => {
            const source = value && typeof value === 'object' ? value : {}
            const assignments = source as Partial<FullTimeInstructorDayAssignments>
            return [
                day,
                {
                    allDay: sanitizeInstructorNames(Array.isArray(assignments.allDay) ? assignments.allDay : []),
                    am: sanitizeInstructorNames(Array.isArray(assignments.am) ? assignments.am : []),
                    pm: sanitizeInstructorNames(Array.isArray(assignments.pm) ? assignments.pm : []),
                } satisfies FullTimeInstructorDayAssignments,
            ]
        }),
    )
}

export function normalizeRequestEntries(input: unknown): FullTimeRequestEntry[] {
    if (!Array.isArray(input)) {
        return []
    }

    return input.map((entry, index) => {
        const value = entry && typeof entry === 'object' ? entry as Partial<FullTimeRequestEntry> : {}
        return {
            id: typeof value.id === 'string' && value.id.trim() ? value.id : `request-${index}`,
            firstName: typeof value.firstName === 'string' ? value.firstName : '',
            lastName: typeof value.lastName === 'string' ? value.lastName : '',
            phone: typeof value.phone === 'string' ? value.phone : '',
            instructor: typeof value.instructor === 'string' ? value.instructor : '',
            accommodated: Boolean(value.accommodated),
            reason: isValidRequestReason(value.reason) ? value.reason : '',
        }
    })
}

function isValidRequestReason(value: unknown): value is FullTimeRequestReason {
    return value === '' || fullTimeRequestReasonOptions.some(option => option.value === value)
}

export function createRequestId() {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function sortDayKeys(days: string[]) {
    return [...days].sort((left, right) => dayOrder.indexOf(left as (typeof dayOrder)[number]) - dayOrder.indexOf(right as (typeof dayOrder)[number]))
}

export function buildStudentsForDay(rosters: ClassRoster[], day: string): Student[] {
    return rosters
        .filter(roster => roster.day === day)
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
}

export function buildInstructorMapForDay(rosters: ClassRoster[], day: string) {
    const instructorByCode = new Map<string, string>()
    rosters
        .filter(roster => roster.day === day)
        .forEach(roster => {
            const instructor = roster.instructor.trim()
            if (instructor) {
                instructorByCode.set(roster.code, instructor)
            }
        })
    return instructorByCode
}

export function buildColumnsForDay(rosters: ClassRoster[], day: string) {
    const students = buildStudentsForDay(rosters, day)
    const courses = buildCourses(students, buildInstructorMapForDay(rosters, day))
    return createRequestAwareLayout(courses).columns
}

type GapWindow = {
    start: number
    end: number
}

function intersectGapWindows(left: GapWindow[], right: GapWindow[]) {
    const intersections: GapWindow[] = []
    left.forEach(leftWindow => {
        right.forEach(rightWindow => {
            const start = Math.max(leftWindow.start, rightWindow.start)
            const end = Math.min(leftWindow.end, rightWindow.end)
            if (end - start > 30) {
                intersections.push({ start, end })
            }
        })
    })
    return intersections
}

export function findCommonBreakMinute(columns: Array<Array<{ startMinutes: number; endMinutes: number }>>) {
    const nonEmptyColumns = columns.filter(column => column.length > 0)
    if (nonEmptyColumns.length === 0) {
        return null
    }

    let commonWindows: GapWindow[] | null = null

    for (const column of nonEmptyColumns) {
        const sorted = [...column].sort((left, right) => left.startMinutes - right.startMinutes)
        const gaps: GapWindow[] = []

        for (let index = 1; index < sorted.length; index += 1) {
            const previous = sorted[index - 1]
            const current = sorted[index]
            if (current.startMinutes - previous.endMinutes > 30) {
                gaps.push({
                    start: previous.endMinutes,
                    end: current.startMinutes,
                })
            }
        }

        if (gaps.length === 0) {
            return null
        }

        commonWindows = commonWindows ? intersectGapWindows(commonWindows, gaps) : gaps
        if (!commonWindows.length) {
            return null
        }
    }

    const widestWindow = commonWindows.sort((left, right) => (right.end - right.start) - (left.end - left.start))[0]
    if (!widestWindow) {
        return null
    }

    return Math.floor((widestWindow.start + widestWindow.end) / 2)
}

export function formatMinutesAsClock(minutes: number) {
    const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60)
    const hours24 = Math.floor(normalized / 60)
    const mins = normalized % 60
    const suffix = hours24 >= 12 ? 'PM' : 'AM'
    const hours12 = hours24 % 12 || 12
    return `${hours12}:${String(mins).padStart(2, '0')} ${suffix}`
}

export function getInstructorPeriodsForDay(
    columns: Array<Array<{ startMinutes: number; endMinutes: number }>>,
): Array<{
    key: FullTimeInstructorPeriod
    label: string
    splitMinute: number | null
}> {
    const splitMinute = findCommonBreakMinute(columns)
    if (splitMinute === null) {
        return [{ key: 'allDay', label: 'All Day Instructors', splitMinute: null }]
    }
    return [
        { key: 'am', label: `AM Instructors (before ${formatMinutesAsClock(splitMinute)})`, splitMinute },
        { key: 'pm', label: `PM Instructors (after ${formatMinutesAsClock(splitMinute)})`, splitMinute },
    ]
}

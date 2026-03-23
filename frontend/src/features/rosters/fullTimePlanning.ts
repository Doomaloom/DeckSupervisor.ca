import type { ClassRoster, Student } from '../../types/app'
import {
    buildCsvHeaderIndex,
    getCsvHeaderValue,
    hasAnyCsvHeader,
    parseCsvText,
} from '../../shared/csv/csvUtils'
import { buildCourses } from '../schematic/utils/courses'
import { createRequestAwareLayout } from '../schematic/utils/layout'
import type {
    FullTimeInstructorAssignments,
    FullTimeInstructorDayAssignments,
    FullTimeInstructorPeriod,
    FullTimeRequestEntry,
    FullTimeRequestMatchSource,
    FullTimeRequestReason,
} from './types'

const dayOrder = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const

export const fullTimeRequestReasonOptions: Array<{
    value: Exclude<FullTimeRequestReason, ''>
    label: string
}> = [
    { value: 'conflicting_request', label: 'Conflicting request' },
    { value: 'other', label: 'Other' },
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
            reasonNote: typeof value.reasonNote === 'string' ? value.reasonNote : '',
            matchedDay: typeof value.matchedDay === 'string' ? value.matchedDay : '',
            matchedCode: typeof value.matchedCode === 'string' ? value.matchedCode : '',
            matchedServiceName: typeof value.matchedServiceName === 'string' ? value.matchedServiceName : '',
            matchedTime: typeof value.matchedTime === 'string' ? value.matchedTime : '',
            matchedBy: isValidMatchSource(value.matchedBy) ? value.matchedBy : '',
            matchedRequestCount: Number.isFinite(value.matchedRequestCount) ? Math.max(Number(value.matchedRequestCount), 0) : 0,
            requiresManualReview: Boolean(value.requiresManualReview),
            manualReviewNote: typeof value.manualReviewNote === 'string' ? value.manualReviewNote : '',
        }
    })
}

const fullTimeRequestCsvHeaderOptions = { stripNonAlphanumeric: true } as const

export function parseFullTimeRequestCsv(text: string) {
    const rows = parseCsvText(text)
    if (rows.length < 2) {
        throw new Error('The requests CSV does not contain any request rows.')
    }

    const requiredHeaderGroups = [
        { label: 'First Name', headers: ['First Name'] },
        { label: 'Last Name', headers: ['Last Name'] },
        { label: 'Phone Number', headers: ['Phone Number'] },
        { label: 'Instructor Name', headers: ['Instructor Name'] },
    ]

    const headerIndex = buildCsvHeaderIndex(rows[0], fullTimeRequestCsvHeaderOptions)
    const missing = requiredHeaderGroups
        .filter(group => !hasAnyCsvHeader(headerIndex, group.headers, fullTimeRequestCsvHeaderOptions))
        .map(group => group.label)

    if (missing.length > 0) {
        throw new Error(`The requests CSV is missing required columns: ${missing.join(', ')}`)
    }

    return rows
        .slice(1)
        .map(row => ({
            firstName: getCsvHeaderValue(row, headerIndex, ['First Name'], fullTimeRequestCsvHeaderOptions),
            lastName: getCsvHeaderValue(row, headerIndex, ['Last Name'], fullTimeRequestCsvHeaderOptions),
            phone: getCsvHeaderValue(row, headerIndex, ['Phone Number'], fullTimeRequestCsvHeaderOptions),
            instructor: getCsvHeaderValue(row, headerIndex, ['Instructor Name'], fullTimeRequestCsvHeaderOptions),
        }))
        .filter(entry => entry.firstName || entry.lastName || entry.phone || entry.instructor)
}

function isValidRequestReason(value: unknown): value is FullTimeRequestReason {
    return value === '' || fullTimeRequestReasonOptions.some(option => option.value === value)
}

function isValidMatchSource(value: unknown): value is FullTimeRequestMatchSource {
    return value === '' || value === 'phone' || value === 'name'
}

export function createRequestId() {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizePhone(value: string) {
    return value.replace(/\D+/g, '')
}

function normalizeNamePart(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
}

function normalizeFullName(firstName: string, lastName: string) {
    return [normalizeNamePart(firstName), normalizeNamePart(lastName)]
        .filter(Boolean)
        .join(' ')
        .trim()
}

function normalizeStudentFullName(name: string) {
    return normalizeNamePart(name)
}

function normalizeStudentFirstName(name: string) {
    return normalizeNamePart(name).split(' ')[0] ?? ''
}

function levenshteinDistance(left: string, right: string) {
    if (left === right) {
        return 0
    }
    if (!left.length) {
        return right.length
    }
    if (!right.length) {
        return left.length
    }

    const previous = Array.from({ length: right.length + 1 }, (_, index) => index)

    for (let row = 1; row <= left.length; row += 1) {
        let diagonal = previous[0]
        previous[0] = row
        for (let column = 1; column <= right.length; column += 1) {
            const current = previous[column]
            const cost = left[row - 1] === right[column - 1] ? 0 : 1
            previous[column] = Math.min(
                previous[column] + 1,
                previous[column - 1] + 1,
                diagonal + cost,
            )
            diagonal = current
        }
    }

    return previous[right.length]
}

function similarityScore(left: string, right: string) {
    const normalizedLeft = normalizeNamePart(left)
    const normalizedRight = normalizeNamePart(right)
    if (!normalizedLeft || !normalizedRight) {
        return 0
    }
    const maxLength = Math.max(normalizedLeft.length, normalizedRight.length)
    if (maxLength === 0) {
        return 1
    }
    return 1 - levenshteinDistance(normalizedLeft, normalizedRight) / maxLength
}

type RequestRosterMatch = {
    day: string
    code: string
    serviceName: string
    time: string
    matchSource: FullTimeRequestMatchSource
    requiresManualReview: boolean
    manualReviewNote: string
}

type AutoAssignFullTimeRequestsResult = {
    entries: FullTimeRequestEntry[]
    rosters: ClassRoster[]
}

function buildRequestRosterMatches(rosters: ClassRoster[]) {
    return rosters.flatMap(roster =>
        roster.students.map(student => ({
            day: roster.day,
            code: roster.code,
            serviceName: roster.serviceName,
            time: roster.time,
            phone: normalizePhone(student.phone),
            firstName: normalizeStudentFirstName(student.name),
            fullName: normalizeStudentFullName(student.name),
        })),
    )
}

function findRequestMatch(
    entry: FullTimeRequestEntry,
    rosterMatches: ReturnType<typeof buildRequestRosterMatches>,
): RequestRosterMatch | null {
    const normalizedFirstName = normalizeNamePart(entry.firstName)
    const normalizedPhone = normalizePhone(entry.phone)
    const attemptedPhoneMatch = Boolean(normalizedPhone)
    if (normalizedPhone) {
        const phoneMatches = rosterMatches.filter(match => match.phone === normalizedPhone)
        if (phoneMatches.length === 1) {
            const [phoneMatch] = phoneMatches
            return {
                day: phoneMatch.day,
                code: phoneMatch.code,
                serviceName: phoneMatch.serviceName,
                time: phoneMatch.time,
                matchSource: 'phone',
                requiresManualReview: false,
                manualReviewNote: '',
            }
        }
        if (phoneMatches.length > 1 && normalizedFirstName) {
            const exactFirstNameMatches = phoneMatches.filter(match => match.firstName === normalizedFirstName)
            if (exactFirstNameMatches.length === 1) {
                const [phoneMatch] = exactFirstNameMatches
                return {
                    day: phoneMatch.day,
                    code: phoneMatch.code,
                    serviceName: phoneMatch.serviceName,
                    time: phoneMatch.time,
                    matchSource: 'phone',
                    requiresManualReview: false,
                    manualReviewNote: '',
                }
            }

            const fuzzyPhoneMatches = phoneMatches
                .map(match => ({
                    match,
                    score: similarityScore(normalizedFirstName, match.firstName),
                }))
                .sort((left, right) => right.score - left.score)
            const bestPhoneMatch = fuzzyPhoneMatches[0]
            const secondPhoneMatch = fuzzyPhoneMatches[1]
            if (
                bestPhoneMatch &&
                bestPhoneMatch.score >= 0.75 &&
                (!secondPhoneMatch || bestPhoneMatch.score - secondPhoneMatch.score >= 0.1)
            ) {
                return {
                    day: bestPhoneMatch.match.day,
                    code: bestPhoneMatch.match.code,
                    serviceName: bestPhoneMatch.match.serviceName,
                    time: bestPhoneMatch.match.time,
                    matchSource: 'phone',
                    requiresManualReview: true,
                    manualReviewNote: 'Phone number matched multiple students; first name was fuzzy-matched.',
                }
            }
            return null
        }
    }

    const normalizedFullName = normalizeFullName(entry.firstName, entry.lastName)
    if (!normalizedFullName) {
        return null
    }
    const nameMatch = rosterMatches.find(match => match.fullName === normalizedFullName)
    if (!nameMatch) {
        const fuzzyNameMatches = rosterMatches
            .map(match => ({
                match,
                score: similarityScore(normalizedFullName, match.fullName),
            }))
            .sort((left, right) => right.score - left.score)
        const bestNameMatch = fuzzyNameMatches[0]
        const secondNameMatch = fuzzyNameMatches[1]
        if (
            !bestNameMatch ||
            bestNameMatch.score < 0.82 ||
            (secondNameMatch && bestNameMatch.score - secondNameMatch.score < 0.08)
        ) {
            return null
        }
        return {
            day: bestNameMatch.match.day,
            code: bestNameMatch.match.code,
            serviceName: bestNameMatch.match.serviceName,
            time: bestNameMatch.match.time,
            matchSource: 'name',
            requiresManualReview: true,
            manualReviewNote: 'Student name was fuzzy-matched and should be reviewed manually.',
        }
    }
    return {
        day: nameMatch.day,
        code: nameMatch.code,
        serviceName: nameMatch.serviceName,
        time: nameMatch.time,
        matchSource: 'name',
        requiresManualReview: attemptedPhoneMatch,
        manualReviewNote: attemptedPhoneMatch
            ? 'Phone number did not match; student was assigned from a name match and should be reviewed manually.'
            : '',
    }
}

export function attemptAutoAssignFullTimeRequests(
    entries: FullTimeRequestEntry[],
    rosters: ClassRoster[],
): AutoAssignFullTimeRequestsResult {
    const rosterMatches = buildRequestRosterMatches(rosters)

    const nextEntries = buildAutoAssignedFullTimeRequestEntries(entries, rosterMatches)
    const nextRosters = syncFullTimeRostersWithRequests(nextEntries, rosters)

    return {
        entries: nextEntries,
        rosters: nextRosters,
    }
}

export function buildAutoAssignedFullTimeRequestEntries(
    entries: FullTimeRequestEntry[],
    rostersOrMatches: ClassRoster[] | ReturnType<typeof buildRequestRosterMatches>,
) {
    const rosterMatches = Array.isArray(rostersOrMatches) && rostersOrMatches.length > 0 && 'students' in rostersOrMatches[0]
        ? buildRequestRosterMatches(rostersOrMatches as ClassRoster[])
        : rostersOrMatches as ReturnType<typeof buildRequestRosterMatches>

    const matched = entries.map(entry => {
        const match = findRequestMatch(entry, rosterMatches)
        if (!match) {
            return {
                ...entry,
                accommodated: false,
                reason: 'student_not_registered' as const,
                reasonNote: '',
                matchedDay: '',
                matchedCode: '',
                matchedServiceName: '',
                matchedTime: '',
                matchedBy: '',
                matchedRequestCount: 0,
                requiresManualReview: false,
                manualReviewNote: '',
            }
        }

        return {
            ...entry,
            accommodated: true,
            reason: '',
            reasonNote: '',
            matchedDay: match.day,
            matchedCode: match.code,
            matchedServiceName: match.serviceName,
            matchedTime: match.time,
            matchedBy: match.matchSource,
            matchedRequestCount: 0,
            requiresManualReview: match.requiresManualReview,
            manualReviewNote: match.manualReviewNote,
        }
    })

    return applyMatchedRequestCounts(matched)
}

export function applyMatchedRequestCounts(entries: FullTimeRequestEntry[]) {
    const requestCounts = new Map<string, number>()
    entries.forEach(entry => {
        if (!entry.matchedCode) {
            return
        }
        const key = `${entry.matchedDay}::${entry.matchedCode}::${entry.instructor.trim().toLowerCase()}`
        requestCounts.set(key, (requestCounts.get(key) ?? 0) + 1)
    })

    return entries.map(entry => {
        if (!entry.matchedCode) {
            return entry
        }
        const key = `${entry.matchedDay}::${entry.matchedCode}::${entry.instructor.trim().toLowerCase()}`
        return {
            ...entry,
            matchedRequestCount: requestCounts.get(key) ?? 0,
        }
    })
}

export function syncFullTimeRostersWithRequests(
    entries: FullTimeRequestEntry[],
    rosters: ClassRoster[],
) {
    const instructorVotesByRoster = new Map<string, Map<string, number>>()
    entries.forEach(entry => {
        if (!entry.accommodated || !entry.matchedCode) {
            return
        }
        const requestedInstructor = entry.instructor.trim()
        if (!requestedInstructor) {
            return
        }
        const rosterKey = `${entry.matchedDay}::${entry.matchedCode}`
        const rosterVotes = instructorVotesByRoster.get(rosterKey) ?? new Map<string, number>()
        rosterVotes.set(requestedInstructor, (rosterVotes.get(requestedInstructor) ?? 0) + 1)
        instructorVotesByRoster.set(rosterKey, rosterVotes)
    })

    const nextRosters = rosters.map(roster => {
        const rosterKey = `${roster.day}::${roster.code}`
        const rosterVotes = instructorVotesByRoster.get(rosterKey)
        if (!rosterVotes || rosterVotes.size === 0) {
            return roster
        }

        const existingInstructor = roster.instructor.trim()
        let assignedInstructor = ''
        let highestVoteCount = -1

        Array.from(rosterVotes.entries())
            .sort(([leftName], [rightName]) => leftName.localeCompare(rightName, 'en', { sensitivity: 'base' }))
            .forEach(([name, count]) => {
                if (count > highestVoteCount) {
                    assignedInstructor = name
                    highestVoteCount = count
                    return
                }
                if (count === highestVoteCount && existingInstructor && name === existingInstructor) {
                    assignedInstructor = name
                }
            })

        if (!assignedInstructor) {
            return roster
        }

        return {
            ...roster,
            instructor: assignedInstructor,
            students: roster.students.map(student => ({
                ...student,
                instructor: assignedInstructor,
            })),
        }
    })
    return nextRosters
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

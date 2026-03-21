import type {
    PlannerCallStatus,
    PlannerClass,
    PlannerClassMoveType,
    PlannerClassStatus,
    PlannerCallRecordUpdate,
    PlannerDataset,
    PlannerParticipant,
    PlannerParticipantCallRecord,
    PlannerParticipantStatus,
    PlannerSession,
} from '../types/app'
import { getStoredItem, setStoredItem } from './browserStorage'
import { getScopedKey } from './storageScope'
import { extractEndTime, extractStartTime } from './time'

const plannerDatasetKey = () => getScopedKey('sessionPlannerDataset')
export const PLANNER_SAVE_STATE_VERSION = 1

export type PlannerSaveState = {
    version: number
    exportedAt: string
    shareDisplayName: string
    locationOverrides: Record<string, string>
    callbackPhoneNumber: string
    selection: {
        selectedDay: string
        selectedLocation: string
        selectedClassKey: string
    }
    classStatuses: Record<string, PlannerClassStatus>
    classLaneIndexes: Record<string, number>
    classMoves: Record<
        string,
        {
            plannedMoveType: PlannerClassMoveType
            plannedMoveTime: string
            plannedMoveTargetClassKey: string
        }
    >
    callRecords: Record<string, PlannerParticipantCallRecord>
}

export type PlannerSaveStateApplyResult = {
    dataset: PlannerDataset
    matchedClasses: number
    skippedClasses: number
    matchedCallRecords: number
    skippedCallRecords: number
}

type ParsedCsv = {
    rows: string[][]
}

type CsvParticipantRow = {
    serviceName: string
    minimumCapacity: number
    maximumCapacity: number
    bookedCount: number
    dayOfWeek: string
    eventTime: string
    eventId: string
    sessionSeason: string
    sessionYear: number
    facility: string
    attendeeName: string
    attendeeStatus: PlannerParticipantStatus
    attendeePhone: string
    age: string
    email: string
}

type CsvEmptyClassRow = {
    serviceName: string
    minimumCapacity: number
    maximumCapacity: number
    bookedCount: number
    dayOfWeek: string
    eventTime: string
    eventId: string
    sessionSeason: string
    sessionYear: number
    facility: string
}

const dayMap: Record<string, string> = {
    monday: 'Mo',
    tuesday: 'Tu',
    wednesday: 'We',
    thursday: 'Th',
    friday: 'Fr',
    saturday: 'Sa',
    sunday: 'Su',
    mo: 'Mo',
    tu: 'Tu',
    we: 'We',
    th: 'Th',
    fr: 'Fr',
    sa: 'Sa',
    su: 'Su',
}

function parseCsvText(text: string): ParsedCsv {
    const rows: string[][] = []
    let row: string[] = []
    let current = ''
    let inQuotes = false

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index]
        const next = text[index + 1]

        if (char === '"' && next === '"') {
            current += '"'
            index += 1
            continue
        }

        if (char === '"') {
            inQuotes = !inQuotes
            continue
        }

        if (char === ',' && !inQuotes) {
            row.push(current)
            current = ''
            continue
        }

        if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && next === '\n') {
                index += 1
            }
            row.push(current)
            current = ''
            if (row.length > 1 || row[0]?.trim()) {
                rows.push(row)
            }
            row = []
            continue
        }

        current += char
    }

    if (current.length > 0 || row.length > 0) {
        row.push(current)
        if (row.length > 1 || row[0]?.trim()) {
            rows.push(row)
        }
    }

    return { rows }
}

function normalizeHeader(value: string) {
    return value.trim().replace(/^\uFEFF/, '').toLowerCase()
}

function buildHeaderIndex(headerRow: string[]) {
    const headerIndex = new Map<string, number>()
    headerRow.forEach((header, index) => {
        const normalized = normalizeHeader(header)
        if (normalized) {
            headerIndex.set(normalized, index)
        }
    })
    return headerIndex
}

function hasAnyHeader(headerIndex: Map<string, number>, headers: string[]) {
    return headers.some(header => headerIndex.has(normalizeHeader(header)))
}

function getHeaderValue(row: string[], headerIndex: Map<string, number>, headers: string[]) {
    for (const header of headers) {
        const index = headerIndex.get(normalizeHeader(header))
        if (index !== undefined && index < row.length) {
            return row[index]?.trim() ?? ''
        }
    }
    return ''
}

function normalizeDay(value: string) {
    const trimmed = value.trim()
    if (!trimmed) {
        return ''
    }
    if (trimmed === 'Mo Tu We Th Fr' || trimmed === 'Mo,Tu,We,Th,Fr') {
        return 'Mo,Tu,We,Th,Fr'
    }
    return dayMap[trimmed.toLowerCase()] ?? trimmed
}

function parsePositiveNumber(value: string) {
    const parsed = Number.parseInt(value.trim(), 10)
    if (!Number.isFinite(parsed) || parsed < 0) {
        return 0
    }
    return parsed
}

function parseAttendeeStatus(value: string): PlannerParticipantStatus | null {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'booked') {
        return 'booked'
    }
    if (normalized === 'waiting') {
        return 'waiting'
    }
    return null
}

function parseAttendeeName(value: string) {
    const trimmed = value.trim()
    if (!trimmed) {
        return ''
    }
    if (!trimmed.includes(',')) {
        return trimmed.replace(/\s+/g, ' ')
    }
    const parts = trimmed.split(',', 2)
    const lastName = parts[0]?.trim() ?? ''
    const firstName = parts[1]?.trim() ?? ''
    return [firstName, lastName].filter(Boolean).join(' ')
}

function parseEventSchedule(value: string) {
    const trimmed = value.trim()
    const normalized = trimmed.replace(/^From\s+/i, '')
    const parts = normalized.split(/\s+to\s+/i)
    const startRaw = parts[0]?.trim() ?? ''
    if (!startRaw) {
        return { season: '', year: 0 }
    }

    const parsed = new Date(`${startRaw}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) {
        return { season: '', year: 0 }
    }

    const month = parsed.getUTCMonth() + 1
    if (month <= 3) {
        return { season: 'Winter', year: parsed.getUTCFullYear() }
    }
    if (month <= 6) {
        return { season: 'Spring', year: parsed.getUTCFullYear() }
    }
    if (month <= 9) {
        return { season: 'Summer', year: parsed.getUTCFullYear() }
    }
    return { season: 'Fall', year: parsed.getUTCFullYear() }
}

function parseDateString(value: string) {
    const trimmed = value.trim()
    if (!trimmed) {
        return null
    }

    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (isoMatch) {
        const year = Number(isoMatch[1])
        const month = Number(isoMatch[2])
        const day = Number(isoMatch[3])
        const date = new Date(year, month - 1, day)
        if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
            return date
        }
    }

    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (slashMatch) {
        const month = Number(slashMatch[1])
        const day = Number(slashMatch[2])
        const year = Number(slashMatch[3])
        const date = new Date(year, month - 1, day)
        if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
            return date
        }
    }

    const parsed = new Date(trimmed)
    if (Number.isNaN(parsed.getTime())) {
        return null
    }
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
}

function getSeasonAndYearFromDates(startDate: Date | null, endDate: Date | null, eventSchedule: string) {
    const schedule = parseEventSchedule(eventSchedule)
    if (schedule.season && schedule.year > 0) {
        return schedule
    }

    const date = startDate ?? endDate
    if (!date) {
        return { season: '', year: 0 }
    }

    const month = date.getMonth() + 1
    if (month <= 3) {
        return { season: 'Winter', year: date.getFullYear() }
    }
    if (month <= 6) {
        return { season: 'Spring', year: date.getFullYear() }
    }
    if (month <= 9) {
        return { season: 'Summer', year: date.getFullYear() }
    }
    return { season: 'Fall', year: date.getFullYear() }
}

function extractTimeAndDate(value: string) {
    const trimmed = value.trim()
    if (!trimmed) {
        return { time24: '', date: null as Date | null }
    }

    const date = parseDateString(trimmed)
    const normalized = trimmed
        .replace(/^\d{4}-\d{1,2}-\d{1,2}[T\s]*/, '')
        .replace(/^\d{1,2}\/\d{1,2}\/\d{4}\s+/, '')
        .trim()

    const timeSource = normalized || trimmed
    const timeMatch = timeSource.match(/(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])?/)
    if (!timeMatch) {
        return { time24: '', date }
    }

    let hours = Number(timeMatch[1])
    const minutes = timeMatch[2] ?? '00'
    const modifier = timeMatch[3]?.toUpperCase() ?? ''

    if (modifier === 'PM' && hours < 12) {
        hours += 12
    } else if (modifier === 'AM' && hours === 12) {
        hours = 0
    }

    if (!modifier && hours === 24) {
        hours = 0
    }

    if (hours < 0 || hours > 23) {
        return { time24: '', date }
    }

    return {
        time24: `${String(hours).padStart(2, '0')}:${minutes.padStart(2, '0')}`,
        date,
    }
}

function formatTime12h(time24: string) {
    const [hourText = '0', minuteText = '00'] = time24.split(':')
    let hour = Number(hourText)
    if (!Number.isFinite(hour)) {
        return ''
    }
    const suffix = hour >= 12 ? 'PM' : 'AM'
    if (hour === 0) {
        hour = 12
    } else if (hour > 12) {
        hour -= 12
    }
    return `${hour}:${minuteText} ${suffix}`
}

function buildEventTimeRange(startTime24: string, endTime24: string) {
    const start = formatTime12h(startTime24)
    const end = formatTime12h(endTime24)
    if (!start || !end) {
        return ''
    }
    return `${start} - ${end}`
}

function buildSessionKey(dayOfWeek: string, sessionSeason: string, sessionYear: number, facility: string) {
    return [dayOfWeek.trim(), sessionSeason.trim().toLowerCase(), String(sessionYear), facility.trim().toLowerCase()].join('|')
}

function buildClassKey(row: Pick<CsvParticipantRow, 'eventId' | 'dayOfWeek' | 'eventTime' | 'facility' | 'sessionSeason' | 'sessionYear'>) {
    return [
        row.eventId.trim(),
        row.dayOfWeek.trim(),
        row.eventTime.trim().toLowerCase(),
        row.facility.trim().toLowerCase(),
        row.sessionSeason.trim().toLowerCase(),
        String(row.sessionYear),
    ].join('|')
}

function getPlannerClassBounds(eventTime: string) {
    const startTime = extractStartTime(eventTime)
    const endTime = extractEndTime(eventTime)
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const [endHour, endMinute] = endTime.split(':').map(Number)
    const startMinutes = startHour * 60 + startMinute
    let endMinutes = endHour * 60 + endMinute
    if (endMinutes < startMinutes) {
        endMinutes += 24 * 60
    }
    return { startMinutes, endMinutes }
}

function sortPlannerClasses(left: PlannerClass, right: PlannerClass) {
    if (left.dayOfWeek !== right.dayOfWeek) {
        return left.dayOfWeek.localeCompare(right.dayOfWeek)
    }
    if (left.facility !== right.facility) {
        return left.facility.localeCompare(right.facility)
    }
    if (left.laneIndex !== right.laneIndex) {
        return left.laneIndex - right.laneIndex
    }
    return left.eventTime.localeCompare(right.eventTime)
}

function normalizePlannerClassLanes(classes: PlannerClass[]) {
    const grouped = new Map<string, PlannerClass[]>()
    classes.forEach(plannerClass => {
        const key = `${plannerClass.dayOfWeek}|${plannerClass.facility}`
        if (!grouped.has(key)) {
            grouped.set(key, [])
        }
        grouped.get(key)!.push(plannerClass)
    })

    const laneMap = new Map<string, number>()

    grouped.forEach(group => {
        const lanes: PlannerClass[][] = []
        const ordered = [...group].sort((left, right) => {
            const leftHasLane = Number.isInteger(left.laneIndex) && left.laneIndex >= 0
            const rightHasLane = Number.isInteger(right.laneIndex) && right.laneIndex >= 0
            if (leftHasLane && rightHasLane && left.laneIndex !== right.laneIndex) {
                return left.laneIndex - right.laneIndex
            }
            if (leftHasLane !== rightHasLane) {
                return leftHasLane ? -1 : 1
            }
            const leftBounds = getPlannerClassBounds(left.eventTime)
            const rightBounds = getPlannerClassBounds(right.eventTime)
            if (leftBounds.startMinutes !== rightBounds.startMinutes) {
                return leftBounds.startMinutes - rightBounds.startMinutes
            }
            return leftBounds.endMinutes - rightBounds.endMinutes
        })

        ordered.forEach(plannerClass => {
            const bounds = getPlannerClassBounds(plannerClass.eventTime)
            const preferredLane = Number.isInteger(plannerClass.laneIndex) && plannerClass.laneIndex >= 0
                ? plannerClass.laneIndex
                : -1

            if (preferredLane >= 0) {
                while (lanes.length <= preferredLane) {
                    lanes.push([])
                }
                const preferredColumn = lanes[preferredLane]
                const last = preferredColumn[preferredColumn.length - 1]
                if (!last || getPlannerClassBounds(last.eventTime).endMinutes <= bounds.startMinutes) {
                    preferredColumn.push(plannerClass)
                    laneMap.set(plannerClass.classKey, preferredLane)
                    return
                }
            }

            let nextLaneIndex = lanes.findIndex(column => {
                const last = column[column.length - 1]
                return !last || getPlannerClassBounds(last.eventTime).endMinutes <= bounds.startMinutes
            })

            if (nextLaneIndex === -1) {
                nextLaneIndex = lanes.length
                lanes.push([])
            }

            lanes[nextLaneIndex].push(plannerClass)
            laneMap.set(plannerClass.classKey, nextLaneIndex)
        })
    })

    return classes.map(plannerClass => ({
        ...plannerClass,
        laneIndex: laneMap.get(plannerClass.classKey) ?? 0,
    }))
}

function getCapacityBand(plannerClass: PlannerClass) {
    if (plannerClass.maximumCapacity <= 0) {
        return 'neutral'
    }
    if (plannerClass.bookedCount < plannerClass.maximumCapacity / 2) {
        return 'red'
    }
    if (plannerClass.bookedCount < Math.ceil(plannerClass.maximumCapacity * 0.7)) {
        return 'yellow'
    }
    return 'green'
}

function normalizePlannerClassMove(input: {
    plannedMoveType?: PlannerClassMoveType | string
    plannedMoveTime?: string
    plannedMoveTargetClassKey?: string
}) {
    const plannedMoveType =
        input.plannedMoveType === 'new_time' || input.plannedMoveType === 'target_class'
            ? input.plannedMoveType
            : ''

    if (plannedMoveType === 'new_time') {
        return {
            plannedMoveType,
            plannedMoveTime: input.plannedMoveTime?.trim() ?? '',
            plannedMoveTargetClassKey: '',
        }
    }

    if (plannedMoveType === 'target_class') {
        return {
            plannedMoveType,
            plannedMoveTime: '',
            plannedMoveTargetClassKey: input.plannedMoveTargetClassKey?.trim() ?? '',
        }
    }

    return {
        plannedMoveType: '' as PlannerClassMoveType,
        plannedMoveTime: '',
        plannedMoveTargetClassKey: '',
    }
}

function normalizePlannerClassEntry(plannerClass: PlannerClass): PlannerClass {
    const move = normalizePlannerClassMove(plannerClass)
    return {
        ...plannerClass,
        laneIndex: Number.isInteger(plannerClass.laneIndex) && plannerClass.laneIndex >= 0 ? plannerClass.laneIndex : 0,
        plannedMoveType: move.plannedMoveType,
        plannedMoveTime: move.plannedMoveTime,
        plannedMoveTargetClassKey: move.plannedMoveTargetClassKey,
    }
}

export function parseSessionPlannerCsv(text: string, sourceFileName: string): PlannerDataset {
    const { rows } = parseCsvText(text)
    if (rows.length < 2) {
        throw new Error('The CSV does not contain any participant rows.')
    }

    const headerRow = rows[0]
    const headerIndex = buildHeaderIndex(headerRow)

    const requiredHeaders = [
        'servicename',
        'minimumcapacity',
        'maximumcapacity',
        'booked',
        'dayoftheweek',
        'eventtime',
        'eventid',
        'eventschedule',
        'facility',
        'attendeename',
        'attendeestatus',
        'attendeephone',
        'age',
        'e-mail',
    ]

    const missing = requiredHeaders.filter(header => !headerIndex.has(header))
    if (missing.length > 0) {
        throw new Error(`The CSV is missing required columns: ${missing.join(', ')}`)
    }

    const sessionMap = new Map<string, PlannerSession>()
    const classMap = new Map<string, PlannerClass>()
    const participantMap = new Map<string, PlannerParticipant>()

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex]
        if (!row.length) {
            continue
        }

        const eventId = getHeaderValue(row, headerIndex, ['eventid'])
        const attendeeStatus = parseAttendeeStatus(getHeaderValue(row, headerIndex, ['attendeestatus']))
        if (!eventId || !attendeeStatus) {
            continue
        }

        const { season, year } = parseEventSchedule(getHeaderValue(row, headerIndex, ['eventschedule']))
        const parsedRow: CsvParticipantRow = {
            serviceName: getHeaderValue(row, headerIndex, ['servicename']),
            minimumCapacity: parsePositiveNumber(getHeaderValue(row, headerIndex, ['minimumcapacity'])),
            maximumCapacity: parsePositiveNumber(getHeaderValue(row, headerIndex, ['maximumcapacity'])),
            bookedCount: parsePositiveNumber(getHeaderValue(row, headerIndex, ['booked'])),
            dayOfWeek: normalizeDay(getHeaderValue(row, headerIndex, ['dayoftheweek'])),
            eventTime: getHeaderValue(row, headerIndex, ['eventtime']),
            eventId,
            sessionSeason: season,
            sessionYear: year,
            facility: getHeaderValue(row, headerIndex, ['facility']),
            attendeeName: parseAttendeeName(getHeaderValue(row, headerIndex, ['attendeename'])),
            attendeeStatus,
            attendeePhone: getHeaderValue(row, headerIndex, ['attendeephone']),
            age: getHeaderValue(row, headerIndex, ['age']),
            email: getHeaderValue(row, headerIndex, ['e-mail']),
        }

        if (!parsedRow.serviceName || !parsedRow.dayOfWeek || !parsedRow.eventTime || !parsedRow.facility || !parsedRow.attendeeName) {
            continue
        }

        const sessionKey = buildSessionKey(
            parsedRow.dayOfWeek,
            parsedRow.sessionSeason,
            parsedRow.sessionYear,
            parsedRow.facility,
        )
        const classKey = buildClassKey(parsedRow)

        if (!sessionMap.has(sessionKey)) {
            sessionMap.set(sessionKey, {
                sessionKey,
                dayOfWeek: parsedRow.dayOfWeek,
                sessionSeason: parsedRow.sessionSeason,
                sessionYear: parsedRow.sessionYear,
                facility: parsedRow.facility,
                classKeys: [],
            })
        }

        const plannerSession = sessionMap.get(sessionKey)!
        if (!plannerSession.classKeys.includes(classKey)) {
            plannerSession.classKeys.push(classKey)
        }

        if (!classMap.has(classKey)) {
            classMap.set(classKey, {
                classKey,
                eventId: parsedRow.eventId,
                sessionKey,
                serviceName: parsedRow.serviceName,
                dayOfWeek: parsedRow.dayOfWeek,
                eventTime: parsedRow.eventTime,
                facility: parsedRow.facility,
                sessionSeason: parsedRow.sessionSeason,
                sessionYear: parsedRow.sessionYear,
                minimumCapacity: parsedRow.minimumCapacity,
                maximumCapacity: parsedRow.maximumCapacity,
                bookedCount: parsedRow.bookedCount,
                waitlistCount: 0,
                participantIds: [],
                waitingParticipantIds: [],
                laneIndex: 0,
                planningStatus: 'active',
                plannedMoveType: '',
                plannedMoveTime: '',
                plannedMoveTargetClassKey: '',
            })
        }

        const plannerClass = classMap.get(classKey)!
        if (attendeeStatus === 'waiting') {
            plannerClass.waitlistCount += 1
        }

        const participantId = `${classKey}::${parsedRow.attendeeName.toLowerCase()}::${parsedRow.attendeePhone}`
        if (participantMap.has(participantId)) {
            continue
        }

        participantMap.set(participantId, {
            id: participantId,
            classKey,
            eventId: parsedRow.eventId,
            serviceName: parsedRow.serviceName,
            name: parsedRow.attendeeName,
            phone: parsedRow.attendeePhone,
            email: parsedRow.email,
            age: parsedRow.age,
            attendeeStatus,
        })

        if (attendeeStatus === 'booked') {
            plannerClass.participantIds.push(participantId)
            continue
        }
        plannerClass.waitingParticipantIds.push(participantId)
    }

    const sessions = Array.from(sessionMap.values()).sort((left, right) => {
        if (left.dayOfWeek !== right.dayOfWeek) {
            return left.dayOfWeek.localeCompare(right.dayOfWeek)
        }
        return left.facility.localeCompare(right.facility)
    })

    const classes = Array.from(classMap.values()).sort((left, right) => {
        if (left.dayOfWeek !== right.dayOfWeek) {
            return left.dayOfWeek.localeCompare(right.dayOfWeek)
        }
        if (left.facility !== right.facility) {
            return left.facility.localeCompare(right.facility)
        }
        return left.eventTime.localeCompare(right.eventTime)
    })

    const participants = Array.from(participantMap.values()).sort((left, right) => left.name.localeCompare(right.name))
    const callRecords: Record<string, PlannerParticipantCallRecord> = {}
    participants.forEach(participant => {
        callRecords[participant.id] = {
            participantId: participant.id,
            classKey: participant.classKey,
            status: 'not_started',
            notes: '',
            offeredAlternativeClassKey: '',
            acceptedAlternativeClassKey: '',
            completedAt: '',
            emailSentAt: '',
        }
    })

    return {
        sourceFileName,
        importedAt: new Date().toISOString(),
        sessions,
        classes: normalizePlannerClassLanes(classes).sort(sortPlannerClasses),
        participants,
        callRecords,
    }
}

export function parseEmptyClassesPlannerCsv(text: string, sourceFileName: string): PlannerDataset {
    const { rows } = parseCsvText(text)
    if (rows.length < 2) {
        throw new Error('The CSV does not contain any class rows.')
    }

    const headerIndex = buildHeaderIndex(rows[0])
    const requiredHeaderGroups = [
        { label: 'GroupName / ServiceName / Level', headers: ['GroupName', 'ServiceName', 'Service', 'Level'] },
        { label: 'ID / EventID / Code', headers: ['ID', 'EventID', 'Event Id', 'Code', 'ClassCode'] },
        { label: 'MainFacility / Facility / Location', headers: ['MainFacility', 'Main Facility', 'Facility', 'Location'] },
        { label: 'Day / DayOfTheWeek', headers: ['Day', 'DayOfTheWeek', 'Day Of The Week'] },
        { label: 'Starts / EventTime', headers: ['Starts', 'Start', 'StartTime', 'EventTime', 'Time'] },
        { label: 'Ends / EventTime', headers: ['Ends', 'End', 'EndTime', 'EventTime', 'Time'] },
        { label: 'RegTotal / Registered / Enrollment / Students', headers: ['RegTotal', 'Registered', 'Enrollment', 'Students'] },
    ]

    const missing = requiredHeaderGroups
        .filter(group => !hasAnyHeader(headerIndex, group.headers))
        .map(group => group.label)

    if (missing.length > 0) {
        throw new Error(`The empty-classes CSV is missing required columns: ${missing.join(', ')}`)
    }

    const sessionMap = new Map<string, PlannerSession>()
    const classMap = new Map<string, PlannerClass>()

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex]
        if (!row.length) {
            continue
        }

        const eventId = getHeaderValue(row, headerIndex, ['EventID', 'Event Id', 'ClassCode', 'Code', 'ID'])
        const serviceName = getHeaderValue(row, headerIndex, ['ServiceName', 'Service', 'Service Name', 'GroupName', 'Level'])
        const facility = getHeaderValue(row, headerIndex, ['Location', 'Facility', 'MainFacility', 'Main Facility'])
        const dayOfWeek = normalizeDay(
            getHeaderValue(row, headerIndex, ['DayOfTheWeek', 'Day Of The Week', 'Day']),
        )
        const bookedCount = parsePositiveNumber(
            getHeaderValue(row, headerIndex, ['RegTotal', 'Registered', 'Enrollment', 'Students']),
        )

        if (!eventId || !serviceName || !facility || !dayOfWeek || bookedCount > 0) {
            continue
        }

        const startsValue = getHeaderValue(row, headerIndex, ['Starts', 'Start', 'StartTime'])
        const endsValue = getHeaderValue(row, headerIndex, ['Ends', 'End', 'EndTime'])
        const timeRangeValue = getHeaderValue(row, headerIndex, ['EventTime', 'Time'])
        let { time24: startTime24, date: startDate } = extractTimeAndDate(startsValue)
        let { time24: endTime24, date: endDate } = extractTimeAndDate(endsValue)

        if ((!startTime24 || !endTime24) && timeRangeValue) {
            const [startPart = '', endPart = ''] = timeRangeValue.split('-')
            if (!startTime24) {
                const extracted = extractTimeAndDate(startPart)
                startTime24 = extracted.time24
                startDate = startDate ?? extracted.date
            }
            if (!endTime24) {
                const extracted = extractTimeAndDate(endPart || startPart)
                endTime24 = extracted.time24
                endDate = endDate ?? extracted.date
            }
        }

        const eventTime = buildEventTimeRange(startTime24, endTime24)
        if (!eventTime) {
            continue
        }

        const eventSchedule = getHeaderValue(row, headerIndex, ['EventSchedule', 'Schedule'])
        const { season, year } = getSeasonAndYearFromDates(startDate, endDate, eventSchedule)
        const parsedRow: CsvEmptyClassRow = {
            serviceName,
            minimumCapacity: parsePositiveNumber(getHeaderValue(row, headerIndex, ['Min', 'MinimumCapacity'])),
            maximumCapacity: parsePositiveNumber(getHeaderValue(row, headerIndex, ['Max', 'MaximumCapacity'])),
            bookedCount,
            dayOfWeek,
            eventTime,
            eventId,
            sessionSeason: season,
            sessionYear: year,
            facility,
        }

        const sessionKey = buildSessionKey(
            parsedRow.dayOfWeek,
            parsedRow.sessionSeason,
            parsedRow.sessionYear,
            parsedRow.facility,
        )
        const classKey = buildClassKey(parsedRow)

        if (!sessionMap.has(sessionKey)) {
            sessionMap.set(sessionKey, {
                sessionKey,
                dayOfWeek: parsedRow.dayOfWeek,
                sessionSeason: parsedRow.sessionSeason,
                sessionYear: parsedRow.sessionYear,
                facility: parsedRow.facility,
                classKeys: [],
            })
        }

        const plannerSession = sessionMap.get(sessionKey)!
        if (!plannerSession.classKeys.includes(classKey)) {
            plannerSession.classKeys.push(classKey)
        }

        if (!classMap.has(classKey)) {
            classMap.set(classKey, {
                classKey,
                eventId: parsedRow.eventId,
                sessionKey,
                serviceName: parsedRow.serviceName,
                dayOfWeek: parsedRow.dayOfWeek,
                eventTime: parsedRow.eventTime,
                facility: parsedRow.facility,
                sessionSeason: parsedRow.sessionSeason,
                sessionYear: parsedRow.sessionYear,
                minimumCapacity: parsedRow.minimumCapacity,
                maximumCapacity: parsedRow.maximumCapacity,
                bookedCount: 0,
                waitlistCount: 0,
                participantIds: [],
                waitingParticipantIds: [],
                laneIndex: 0,
                planningStatus: 'active',
                plannedMoveType: '',
                plannedMoveTime: '',
                plannedMoveTargetClassKey: '',
            })
        }
    }

    const sessions = Array.from(sessionMap.values()).sort((left, right) => {
        if (left.dayOfWeek !== right.dayOfWeek) {
            return left.dayOfWeek.localeCompare(right.dayOfWeek)
        }
        return left.facility.localeCompare(right.facility)
    })

    const classes = Array.from(classMap.values()).sort((left, right) => {
        if (left.dayOfWeek !== right.dayOfWeek) {
            return left.dayOfWeek.localeCompare(right.dayOfWeek)
        }
        if (left.facility !== right.facility) {
            return left.facility.localeCompare(right.facility)
        }
        return left.eventTime.localeCompare(right.eventTime)
    })

    if (classes.length === 0) {
        throw new Error('No empty classes were found in the schematic CSV.')
    }

    return {
        sourceFileName,
        importedAt: new Date().toISOString(),
        sessions,
        classes: normalizePlannerClassLanes(classes).sort(sortPlannerClasses),
        participants: [],
        callRecords: {},
    }
}

function normalizePlannerCallRecord(
    participantId: string,
    record: PlannerParticipantCallRecord | undefined,
    classKey: string,
): PlannerParticipantCallRecord {
    return {
        participantId,
        classKey: record?.classKey ?? classKey,
        status: record?.status ?? 'not_started',
        notes: record?.notes ?? '',
        offeredAlternativeClassKey: record?.offeredAlternativeClassKey ?? '',
        acceptedAlternativeClassKey: record?.acceptedAlternativeClassKey ?? '',
        completedAt: record?.completedAt ?? '',
        emailSentAt: record?.emailSentAt ?? '',
    }
}

function normalizePlannerDataset(dataset: PlannerDataset): PlannerDataset {
    const classKeyByParticipantId = new Map<string, string>()
    const normalizedClasses = normalizePlannerClassLanes(
        dataset.classes.map(plannerClass => normalizePlannerClassEntry(plannerClass)),
    ).sort(sortPlannerClasses)

    dataset.participants.forEach(participant => {
        classKeyByParticipantId.set(participant.id, participant.classKey)
    })

    const normalizedCallRecords: Record<string, PlannerParticipantCallRecord> = {}
    Object.entries(dataset.callRecords ?? {}).forEach(([participantId, record]) => {
        normalizedCallRecords[participantId] = normalizePlannerCallRecord(
            participantId,
            record,
            classKeyByParticipantId.get(participantId) ?? '',
        )
    })

    dataset.participants.forEach(participant => {
        normalizedCallRecords[participant.id] = normalizePlannerCallRecord(
            participant.id,
            normalizedCallRecords[participant.id],
            participant.classKey,
        )
    })

    return {
        ...dataset,
        classes: normalizedClasses,
        callRecords: normalizedCallRecords,
    }
}

export function loadPlannerDataset(): PlannerDataset | null {
    if (typeof window === 'undefined') {
        return null
    }
    const stored = getStoredItem(plannerDatasetKey())
    if (!stored) {
        return null
    }
    try {
        return normalizePlannerDataset(JSON.parse(stored) as PlannerDataset)
    } catch (error) {
        console.error('Failed to parse planner dataset', error)
        return null
    }
}

export function savePlannerDataset(dataset: PlannerDataset) {
    if (typeof window === 'undefined') {
        return
    }
    setStoredItem(plannerDatasetKey(), JSON.stringify(normalizePlannerDataset(dataset)))
}

function mergeUnique(values: string[], additions: string[]) {
    return Array.from(new Set([...values, ...additions]))
}

function mergeSourceFileNames(current: string, next: string) {
    const names = `${current},${next}`
        .split(',')
        .map(value => value.trim())
        .filter(Boolean)
    return Array.from(new Set(names)).join(', ')
}

function hasParticipantData(plannerClass: PlannerClass) {
    return (
        plannerClass.participantIds.length > 0 ||
        plannerClass.waitingParticipantIds.length > 0 ||
        plannerClass.bookedCount > 0 ||
        plannerClass.waitlistCount > 0
    )
}

function mergePlannerClass(existing: PlannerClass, incoming: PlannerClass): PlannerClass {
    const existingHasParticipantData = hasParticipantData(existing)
    const incomingHasParticipantData = hasParticipantData(incoming)

    const authoritative = incomingHasParticipantData && !existingHasParticipantData ? incoming : existing
    const fallback = authoritative === existing ? incoming : existing

    return {
        ...existing,
        eventId: authoritative.eventId || fallback.eventId,
        sessionKey: authoritative.sessionKey || fallback.sessionKey,
        serviceName: authoritative.serviceName || fallback.serviceName,
        dayOfWeek: authoritative.dayOfWeek || fallback.dayOfWeek,
        eventTime: authoritative.eventTime || fallback.eventTime,
        facility: authoritative.facility || fallback.facility,
        sessionSeason: authoritative.sessionSeason || fallback.sessionSeason,
        sessionYear: authoritative.sessionYear || fallback.sessionYear,
        minimumCapacity:
            authoritative.minimumCapacity > 0 ? authoritative.minimumCapacity : fallback.minimumCapacity,
        maximumCapacity:
            authoritative.maximumCapacity > 0 ? authoritative.maximumCapacity : fallback.maximumCapacity,
        bookedCount: authoritative.bookedCount,
        waitlistCount: authoritative.waitlistCount,
        participantIds: mergeUnique(existing.participantIds, incoming.participantIds),
        waitingParticipantIds: mergeUnique(existing.waitingParticipantIds, incoming.waitingParticipantIds),
        laneIndex: existing.laneIndex,
        planningStatus: existing.planningStatus,
        plannedMoveType: existing.plannedMoveType,
        plannedMoveTime: existing.plannedMoveTime,
        plannedMoveTargetClassKey: existing.plannedMoveTargetClassKey,
    }
}

export function mergePlannerDatasets(current: PlannerDataset, incoming: PlannerDataset): PlannerDataset {
    const sessionMap = new Map(current.sessions.map(session => [session.sessionKey, { ...session }]))
    incoming.sessions.forEach(session => {
        const existing = sessionMap.get(session.sessionKey)
        if (!existing) {
            sessionMap.set(session.sessionKey, {
                ...session,
                classKeys: [...session.classKeys],
            })
            return
        }
        existing.classKeys = mergeUnique(existing.classKeys, session.classKeys)
    })

    const classMap = new Map(
        current.classes.map(plannerClass => [
            plannerClass.classKey,
            {
                ...plannerClass,
                participantIds: [...plannerClass.participantIds],
                waitingParticipantIds: [...plannerClass.waitingParticipantIds],
            },
        ]),
    )
    incoming.classes.forEach(plannerClass => {
        const existing = classMap.get(plannerClass.classKey)
        if (!existing) {
            classMap.set(plannerClass.classKey, {
                ...plannerClass,
                participantIds: [...plannerClass.participantIds],
                waitingParticipantIds: [...plannerClass.waitingParticipantIds],
            })
            return
        }
        classMap.set(plannerClass.classKey, mergePlannerClass(existing, plannerClass))
    })

    const participantMap = new Map(current.participants.map(participant => [participant.id, participant]))
    incoming.participants.forEach(participant => {
        if (!participantMap.has(participant.id)) {
            participantMap.set(participant.id, participant)
        }
    })

    const callRecords: Record<string, PlannerParticipantCallRecord> = { ...current.callRecords }
    Object.entries(incoming.callRecords).forEach(([participantId, record]) => {
        if (!callRecords[participantId]) {
            callRecords[participantId] = record
        }
    })

    return {
        sourceFileName: mergeSourceFileNames(current.sourceFileName, incoming.sourceFileName),
        importedAt: new Date().toISOString(),
        sessions: Array.from(sessionMap.values()).sort((left, right) => {
            if (left.dayOfWeek !== right.dayOfWeek) {
                return left.dayOfWeek.localeCompare(right.dayOfWeek)
            }
            return left.facility.localeCompare(right.facility)
        }),
        classes: normalizePlannerClassLanes(Array.from(classMap.values())).sort(sortPlannerClasses),
        participants: Array.from(participantMap.values()).sort((left, right) => left.name.localeCompare(right.name)),
        callRecords,
    }
}

export function updatePlannerClassStatus(
    dataset: PlannerDataset,
    classKey: string,
    status: PlannerClassStatus,
): PlannerDataset {
    return {
        ...dataset,
        classes: dataset.classes.map(plannerClass =>
            plannerClass.classKey === classKey ? { ...plannerClass, planningStatus: status } : plannerClass,
        ),
    }
}

export function updatePlannerClassMove(
    dataset: PlannerDataset,
    classKey: string,
    update: {
        plannedMoveType?: PlannerClassMoveType
        plannedMoveTime?: string
        plannedMoveTargetClassKey?: string
    },
): PlannerDataset {
    return {
        ...dataset,
        classes: dataset.classes.map(plannerClass => {
            if (plannerClass.classKey !== classKey) {
                return plannerClass
            }
            const move = normalizePlannerClassMove({
                plannedMoveType: update.plannedMoveType ?? plannerClass.plannedMoveType,
                plannedMoveTime: update.plannedMoveTime ?? plannerClass.plannedMoveTime,
                plannedMoveTargetClassKey:
                    update.plannedMoveTargetClassKey ?? plannerClass.plannedMoveTargetClassKey,
            })
            return {
                ...plannerClass,
                plannedMoveType: move.plannedMoveType,
                plannedMoveTime: move.plannedMoveTime,
                plannedMoveTargetClassKey: move.plannedMoveTargetClassKey,
            }
        }),
    }
}

export function updatePlannerClassLanes(
    dataset: PlannerDataset,
    laneIndexes: Record<string, number>,
): PlannerDataset {
    return {
        ...dataset,
        classes: normalizePlannerClassLanes(
            dataset.classes.map(plannerClass => ({
                ...plannerClass,
                laneIndex:
                    laneIndexes[plannerClass.classKey] !== undefined
                        ? Math.max(0, Math.floor(laneIndexes[plannerClass.classKey] ?? 0))
                        : plannerClass.laneIndex,
            })),
        ).sort(sortPlannerClasses),
    }
}

export function updatePlannerCallRecord(
    dataset: PlannerDataset,
    participantId: string,
    update: Partial<PlannerParticipantCallRecord>,
): PlannerDataset {
    const existing = dataset.callRecords[participantId]
    if (!existing) {
        return dataset
    }
    return {
        ...dataset,
        callRecords: {
            ...dataset.callRecords,
            [participantId]: {
                ...existing,
                ...update,
            },
        },
    }
}

export function buildPlannerSaveState(args: {
    dataset: PlannerDataset
    shareDisplayName: string
    locationOverrides: Record<string, string>
    callbackPhoneNumber: string
    selectedDay: string
    selectedLocation: string
    selectedClassKey: string
}): PlannerSaveState {
    return {
        version: PLANNER_SAVE_STATE_VERSION,
        exportedAt: new Date().toISOString(),
        shareDisplayName: args.shareDisplayName.trim(),
        locationOverrides: normalizeLocationOverrides(args.locationOverrides),
        callbackPhoneNumber: args.callbackPhoneNumber.trim(),
        selection: {
            selectedDay: args.selectedDay,
            selectedLocation: args.selectedLocation,
            selectedClassKey: args.selectedClassKey,
        },
        classStatuses: Object.fromEntries(
            args.dataset.classes.map(plannerClass => [plannerClass.classKey, plannerClass.planningStatus]),
        ),
        classLaneIndexes: Object.fromEntries(
            args.dataset.classes.map(plannerClass => [plannerClass.classKey, plannerClass.laneIndex]),
        ),
        classMoves: Object.fromEntries(
            args.dataset.classes.map(plannerClass => [
                plannerClass.classKey,
                normalizePlannerClassMove(plannerClass),
            ]),
        ),
        callRecords: Object.fromEntries(
            Object.entries(args.dataset.callRecords).map(([participantId, record]) => [
                participantId,
                normalizePlannerCallRecord(participantId, record, record?.classKey ?? ''),
            ]),
        ),
    }
}

export function parsePlannerSaveState(text: string): PlannerSaveState {
    let parsed: unknown
    try {
        parsed = JSON.parse(text)
    } catch {
        throw new Error('The planner state file is not valid JSON.')
    }

    if (!parsed || typeof parsed !== 'object') {
        throw new Error('The planner state file is invalid.')
    }

    const state = parsed as Partial<PlannerSaveState>
    if (state.version !== PLANNER_SAVE_STATE_VERSION) {
        throw new Error('This planner state file version is not supported.')
    }

    return {
        version: state.version,
        exportedAt: typeof state.exportedAt === 'string' ? state.exportedAt : '',
        shareDisplayName: typeof state.shareDisplayName === 'string' ? state.shareDisplayName : '',
        locationOverrides: normalizeLocationOverrides(state.locationOverrides),
        callbackPhoneNumber: typeof state.callbackPhoneNumber === 'string' ? state.callbackPhoneNumber : '',
        selection: {
            selectedDay: typeof state.selection?.selectedDay === 'string' ? state.selection.selectedDay : '',
            selectedLocation:
                typeof state.selection?.selectedLocation === 'string' ? state.selection.selectedLocation : '',
            selectedClassKey:
                typeof state.selection?.selectedClassKey === 'string' ? state.selection.selectedClassKey : '',
        },
        classStatuses: normalizeClassStatuses(state.classStatuses),
        classLaneIndexes: Object.fromEntries(
            Object.entries(state.classLaneIndexes ?? {})
                .filter(([, laneIndex]) => Number.isInteger(laneIndex) && Number(laneIndex) >= 0)
                .map(([classKey, laneIndex]) => [classKey, Number(laneIndex)]),
        ),
        classMoves: normalizeClassMoves(state.classMoves),
        callRecords: normalizeCallRecords(state.callRecords),
    }
}

export function applyPlannerSaveState(
    dataset: PlannerDataset,
    state: PlannerSaveState,
): PlannerSaveStateApplyResult {
    const classKeySet = new Set(dataset.classes.map(plannerClass => plannerClass.classKey))
    const participantIdSet = new Set(Object.keys(dataset.callRecords))

    let matchedClasses = 0
    const nextClasses = dataset.classes.map(plannerClass => {
        const status = state.classStatuses[plannerClass.classKey]
        const laneIndex = state.classLaneIndexes[plannerClass.classKey]
        const move = state.classMoves[plannerClass.classKey]
        if (!status && laneIndex === undefined && !move) {
            return plannerClass
        }
        matchedClasses += 1
        const normalizedMove = normalizePlannerClassMove(move ?? plannerClass)
        return {
            ...plannerClass,
            planningStatus: status ?? plannerClass.planningStatus,
            laneIndex: laneIndex ?? plannerClass.laneIndex,
            plannedMoveType: normalizedMove.plannedMoveType,
            plannedMoveTime: normalizedMove.plannedMoveTime,
            plannedMoveTargetClassKey: normalizedMove.plannedMoveTargetClassKey,
        }
    })

    let matchedCallRecords = 0
    const nextCallRecords: Record<string, PlannerParticipantCallRecord> = { ...dataset.callRecords }
    Object.entries(state.callRecords).forEach(([participantId, record]) => {
        const existingRecord = dataset.callRecords[participantId]
        if (!existingRecord) {
            return
        }
        matchedCallRecords += 1
        nextCallRecords[participantId] = normalizePlannerCallRecord(
            participantId,
            {
                ...existingRecord,
                ...record,
                participantId,
                classKey: existingRecord.classKey,
            },
            existingRecord.classKey,
        )
    })

    return {
        dataset: {
            ...dataset,
            classes: normalizePlannerClassLanes(nextClasses).sort(sortPlannerClasses),
            callRecords: nextCallRecords,
        },
        matchedClasses,
        skippedClasses: Array.from(
            new Set([
                ...Object.keys(state.classStatuses),
                ...Object.keys(state.classLaneIndexes),
                ...Object.keys(state.classMoves),
            ]),
        ).filter(classKey => !classKeySet.has(classKey)).length,
        matchedCallRecords,
        skippedCallRecords: Object.keys(state.callRecords).filter(participantId => !participantIdSet.has(participantId))
            .length,
    }
}

export function plannerSaveStateToText(state: PlannerSaveState) {
    return JSON.stringify(state, null, 2)
}

export function plannerSaveStateToSharePayload(state: PlannerSaveState): {
    classStatuses: Record<string, PlannerClassStatus>
    classLaneIndexes: Record<string, number>
    classMoves: Record<
        string,
        {
            plannedMoveType: PlannerClassMoveType
            plannedMoveTime: string
            plannedMoveTargetClassKey: string
        }
    >
    callRecords: Record<string, PlannerCallRecordUpdate>
    locationOverrides: Record<string, string>
    callbackPhoneNumber: string
} {
    return {
        classStatuses: state.classStatuses,
        classLaneIndexes: state.classLaneIndexes,
        classMoves: state.classMoves,
        callRecords: Object.fromEntries(
            Object.entries(state.callRecords).map(([participantId, record]) => [
                participantId,
                {
                    status: record.status,
                    notes: record.notes,
                    offeredAlternativeClassKey: record.offeredAlternativeClassKey,
                    acceptedAlternativeClassKey: record.acceptedAlternativeClassKey,
                    completedAt: record.completedAt,
                    emailSentAt: record.emailSentAt,
                },
            ]),
        ),
        locationOverrides: state.locationOverrides,
        callbackPhoneNumber: state.callbackPhoneNumber,
    }
}

export function getPlannerClassCapacityBand(plannerClass: PlannerClass) {
    return getCapacityBand(plannerClass)
}

export function getPlannerFillPercent(plannerClass: PlannerClass) {
    if (plannerClass.maximumCapacity <= 0) {
        return 0
    }
    return Math.round((plannerClass.bookedCount / plannerClass.maximumCapacity) * 100)
}

export function getPlannerAlternativeClasses(dataset: PlannerDataset, sourceClass: PlannerClass) {
    const normalizedServiceName = sourceClass.serviceName.trim().toLowerCase()
    return dataset.classes
        .filter(plannerClass => {
            if (plannerClass.classKey === sourceClass.classKey) {
                return false
            }
            if (plannerClass.planningStatus === 'cancelled') {
                return false
            }
            return plannerClass.serviceName.trim().toLowerCase() === normalizedServiceName
        })
        .sort((left, right) => {
            const leftSameDay = left.dayOfWeek === sourceClass.dayOfWeek ? 0 : 1
            const rightSameDay = right.dayOfWeek === sourceClass.dayOfWeek ? 0 : 1
            if (leftSameDay !== rightSameDay) {
                return leftSameDay - rightSameDay
            }
            if (left.dayOfWeek !== right.dayOfWeek) {
                return left.dayOfWeek.localeCompare(right.dayOfWeek)
            }
            if (left.facility !== right.facility) {
                return left.facility.localeCompare(right.facility)
            }
            return left.eventTime.localeCompare(right.eventTime)
        })
}

export function getPlannerMoveTargetLabel(dataset: PlannerDataset, plannerClass: PlannerClass) {
    const move = normalizePlannerClassMove(plannerClass)
    if (move.plannedMoveType === 'new_time') {
        return move.plannedMoveTime || 'New time not set'
    }
    if (move.plannedMoveType === 'target_class') {
        const targetClass = dataset.classes.find(item => item.classKey === move.plannedMoveTargetClassKey)
        if (!targetClass) {
            return 'Target class not found'
        }
        return `${targetClass.dayOfWeek} • ${targetClass.eventTime} • ${targetClass.facility}`
    }
    return ''
}

export function summarizePlannerCalls(dataset: PlannerDataset, classKey: string) {
    const bookedParticipantIds = dataset.classes.find(plannerClass => plannerClass.classKey === classKey)?.participantIds ?? []
    let contacted = 0
    let rebooked = 0
    bookedParticipantIds.forEach(participantId => {
        const record = dataset.callRecords[participantId]
        if (!record) {
            return
        }
        if (record.status !== 'not_started') {
            contacted += 1
        }
        if (record.status === 'accepted_alternative') {
            rebooked += 1
        }
    })
    return {
        contacted,
        remaining: Math.max(0, bookedParticipantIds.length - contacted),
        rebooked,
    }
}

export const plannerCallStatusOptions: Array<{ key: PlannerCallStatus; label: string }> = [
    { key: 'not_started', label: 'Not started' },
    { key: 'called', label: 'Called' },
    { key: 'voicemail', label: 'Voicemail' },
    { key: 'reached', label: 'Reached' },
    { key: 'declined_alternatives', label: 'Declined alternatives' },
    { key: 'accepted_alternative', label: 'Accepted alternative' },
]

function normalizeLocationOverrides(input: unknown): Record<string, string> {
    if (!input || typeof input !== 'object') {
        return {}
    }
    return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
            .map(([facility, value]) => [facility.trim(), typeof value === 'string' ? value.trim() : ''])
            .filter(([facility, value]) => facility && value),
    )
}

function normalizeClassStatuses(input: unknown): Record<string, PlannerClassStatus> {
    if (!input || typeof input !== 'object') {
        return {}
    }
    return Object.fromEntries(
        Object.entries(input as Record<string, unknown>).filter((entry): entry is [string, PlannerClassStatus] =>
            entry[0].trim().length > 0 &&
            (entry[1] === 'active' || entry[1] === 'pending_cancellation' || entry[1] === 'cancelled' || entry[1] === 'planned_move'),
        ),
    )
}

function normalizeClassMoves(
    input: unknown,
): Record<
    string,
    {
        plannedMoveType: PlannerClassMoveType
        plannedMoveTime: string
        plannedMoveTargetClassKey: string
    }
> {
    if (!input || typeof input !== 'object') {
        return {}
    }
    return Object.fromEntries(
        Object.entries(input as Record<string, { plannedMoveType?: PlannerClassMoveType; plannedMoveTime?: string; plannedMoveTargetClassKey?: string }>)
            .filter(([classKey]) => classKey.trim().length > 0)
            .map(([classKey, move]) => [classKey, normalizePlannerClassMove(move ?? {})]),
    )
}

function normalizeCallRecords(input: unknown): Record<string, PlannerParticipantCallRecord> {
    if (!input || typeof input !== 'object') {
        return {}
    }
    return Object.fromEntries(
        Object.entries(input as Record<string, PlannerParticipantCallRecord | undefined>).map(
            ([participantId, record]) => [
                participantId,
                normalizePlannerCallRecord(participantId, record, record?.classKey ?? ''),
            ],
        ),
    )
}

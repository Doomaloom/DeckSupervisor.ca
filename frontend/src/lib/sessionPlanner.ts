import type {
  PlannerCallStatus,
  PlannerClass,
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

function getCapacityBand(plannerClass: PlannerClass) {
  if (plannerClass.maximumCapacity <= 0) {
    return 'neutral'
  }
  if (plannerClass.bookedCount < plannerClass.minimumCapacity) {
    return 'red'
  }
  if (plannerClass.bookedCount < Math.ceil(plannerClass.maximumCapacity * 0.7)) {
    return 'yellow'
  }
  return 'green'
}

export function parseSessionPlannerCsv(text: string, sourceFileName: string): PlannerDataset {
  const { rows } = parseCsvText(text)
  if (rows.length < 2) {
    throw new Error('The CSV does not contain any participant rows.')
  }

  const headerRow = rows[0]
  const headerIndex = new Map<string, number>()
  headerRow.forEach((header, index) => {
    const normalized = normalizeHeader(header)
    if (normalized) {
      headerIndex.set(normalized, index)
    }
  })

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

  const getValue = (row: string[], header: string) => {
    const index = headerIndex.get(header)
    if (index === undefined || index >= row.length) {
      return ''
    }
    return row[index]?.trim() ?? ''
  }

  const sessionMap = new Map<string, PlannerSession>()
  const classMap = new Map<string, PlannerClass>()
  const participantMap = new Map<string, PlannerParticipant>()

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]
    if (!row.length) {
      continue
    }

    const eventId = getValue(row, 'eventid')
    const attendeeStatus = parseAttendeeStatus(getValue(row, 'attendeestatus'))
    if (!eventId || !attendeeStatus) {
      continue
    }

    const { season, year } = parseEventSchedule(getValue(row, 'eventschedule'))
    const parsedRow: CsvParticipantRow = {
      serviceName: getValue(row, 'servicename'),
      minimumCapacity: parsePositiveNumber(getValue(row, 'minimumcapacity')),
      maximumCapacity: parsePositiveNumber(getValue(row, 'maximumcapacity')),
      bookedCount: parsePositiveNumber(getValue(row, 'booked')),
      dayOfWeek: normalizeDay(getValue(row, 'dayoftheweek')),
      eventTime: getValue(row, 'eventtime'),
      eventId,
      sessionSeason: season,
      sessionYear: year,
      facility: getValue(row, 'facility'),
      attendeeName: parseAttendeeName(getValue(row, 'attendeename')),
      attendeeStatus,
      attendeePhone: getValue(row, 'attendeephone'),
      age: getValue(row, 'age'),
      email: getValue(row, 'e-mail'),
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
        planningStatus: 'active',
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
    if (participant.attendeeStatus !== 'booked') {
      return
    }
    callRecords[participant.id] = {
      participantId: participant.id,
      classKey: participant.classKey,
      status: 'not_started',
      notes: '',
      offeredAlternativeClassKey: '',
      acceptedAlternativeClassKey: '',
      completedAt: '',
    }
  })

  return {
    sourceFileName,
    importedAt: new Date().toISOString(),
    sessions,
    classes,
    participants,
    callRecords,
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
  }
}

function normalizePlannerDataset(dataset: PlannerDataset): PlannerDataset {
  const classKeyByParticipantId = new Map<string, string>()
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
    if (participant.attendeeStatus !== 'booked') {
      return
    }
    normalizedCallRecords[participant.id] = normalizePlannerCallRecord(
      participant.id,
      normalizedCallRecords[participant.id],
      participant.classKey,
    )
  })

  return {
    ...dataset,
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
    existing.participantIds = mergeUnique(existing.participantIds, plannerClass.participantIds)
    existing.waitingParticipantIds = mergeUnique(existing.waitingParticipantIds, plannerClass.waitingParticipantIds)
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
    classes: Array.from(classMap.values()).sort((left, right) => {
      if (left.dayOfWeek !== right.dayOfWeek) {
        return left.dayOfWeek.localeCompare(right.dayOfWeek)
      }
      if (left.facility !== right.facility) {
        return left.facility.localeCompare(right.facility)
      }
      return left.eventTime.localeCompare(right.eventTime)
    }),
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
    if (!status) {
      return plannerClass
    }
    matchedClasses += 1
    return {
      ...plannerClass,
      planningStatus: status,
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
      classes: nextClasses,
      callRecords: nextCallRecords,
    },
    matchedClasses,
    skippedClasses: Object.keys(state.classStatuses).filter(classKey => !classKeySet.has(classKey)).length,
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
  callRecords: Record<string, PlannerCallRecordUpdate>
  locationOverrides: Record<string, string>
  callbackPhoneNumber: string
} {
  return {
    classStatuses: state.classStatuses,
    callRecords: Object.fromEntries(
      Object.entries(state.callRecords).map(([participantId, record]) => [
        participantId,
        {
          status: record.status,
          notes: record.notes,
          offeredAlternativeClassKey: record.offeredAlternativeClassKey,
          acceptedAlternativeClassKey: record.acceptedAlternativeClassKey,
          completedAt: record.completedAt,
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
      (entry[1] === 'active' || entry[1] === 'pending_cancellation' || entry[1] === 'cancelled'),
    ),
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

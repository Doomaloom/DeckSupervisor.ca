import type { ClassRoster } from '../../types/app'

export type RequestCsvRow = {
  rowNumber: number
  firstName: string
  lastName: string
  fullName: string
  normalizedName: string
  requestedInstructor: string
  requestedDays: string[]
  originalDayValue: string
}

export type RequestMatch = {
  request: RequestCsvRow
  requestedDay: string
  classRoster: ClassRoster
}

export type UnmatchedRequest = {
  request: RequestCsvRow
  requestedDay: string
  reason: string
}

export type InstructorRequestCount = {
  instructor: string
  count: number
}

export type ClassRequestSummary = {
  eventId: string
  serviceName: string
  time: string
  location: string
  schedule: string
  matchedRequestCount: number
  uniqueStudentCount: number
  instructorCounts: InstructorRequestCount[]
}

export type DayRequestSummary = {
  day: string
  classes: ClassRequestSummary[]
}

export type RequestsAnalysisResult = {
  totalRequests: number
  totalDayEntries: number
  matchedDayEntries: number
  unmatchedDayEntries: number
  matchedStudentCount: number
  days: DayRequestSummary[]
  unmatched: UnmatchedRequest[]
}

type ParsedCsv = {
  rows: string[][]
}

const dayMap: Record<string, string> = {
  monday: 'Mo',
  mon: 'Mo',
  mo: 'Mo',
  tuesday: 'Tu',
  tue: 'Tu',
  tues: 'Tu',
  tu: 'Tu',
  we: 'We',
  wed: 'We',
  wednesday: 'We',
  th: 'Th',
  thu: 'Th',
  thur: 'Th',
  thurs: 'Th',
  thursday: 'Th',
  friday: 'Fr',
  fri: 'Fr',
  fr: 'Fr',
  saturday: 'Sa',
  sat: 'Sa',
  sa: 'Sa',
  sunday: 'Su',
  sun: 'Su',
  su: 'Su',
}

const dayOrder = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const

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
  return value
    .trim()
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function buildHeaderIndex(headerRow: string[]) {
  const index = new Map<string, number>()
  headerRow.forEach((header, columnIndex) => {
    const normalized = normalizeHeader(header)
    if (normalized) {
      index.set(normalized, columnIndex)
    }
  })
  return index
}

function getHeaderValue(row: string[], headerIndex: Map<string, number>, headers: string[]) {
  for (const header of headers) {
    const columnIndex = headerIndex.get(normalizeHeader(header))
    if (columnIndex !== undefined && columnIndex < row.length) {
      return row[columnIndex]?.trim() ?? ''
    }
  }
  return ''
}

function hasAnyHeader(headerIndex: Map<string, number>, headers: string[]) {
  return headers.some(header => headerIndex.has(normalizeHeader(header)))
}

export function normalizePersonName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeDayToken(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }
  if (trimmed === 'Mo Tu We Th Fr' || trimmed === 'Mo,Tu,We,Th,Fr') {
    return 'Mo,Tu,We,Th,Fr'
  }
  return dayMap[trimmed.toLowerCase()] ?? trimmed
}

function parseRequestedDays(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return []
  }

  const direct = normalizeDayToken(trimmed)
  if (direct === 'Mo,Tu,We,Th,Fr') {
    return ['Mo', 'Tu', 'We', 'Th', 'Fr']
  }
  if (dayOrder.includes(direct as (typeof dayOrder)[number])) {
    return [direct]
  }

  const normalized = trimmed
    .toLowerCase()
    .replace(/\bthrur\b/g, 'thur')
    .replace(/\bthrus\b/g, 'thurs')
    .replace(/\btues\b/g, 'tuesday')
    .replace(/\bthur\b/g, 'thursday')
    .replace(/\bthurs\b/g, 'thursday')
    .replace(/\bfri\b/g, 'friday')
    .replace(/\bsat\b/g, 'saturday')
    .replace(/\bsun\b/g, 'sunday')
    .replace(/\bwed\b/g, 'wednesday')
    .replace(/\bmon\b/g, 'monday')

  const extracted = new Set<string>()
  const patterns: Array<[RegExp, string]> = [
    [/\bmonday\b/g, 'Mo'],
    [/\btuesday\b/g, 'Tu'],
    [/\bwednesday\b/g, 'We'],
    [/\bthursday\b/g, 'Th'],
    [/\bfriday\b/g, 'Fr'],
    [/\bsaturday\b/g, 'Sa'],
    [/\bsunday\b/g, 'Su'],
  ]

  patterns.forEach(([pattern, day]) => {
    if (pattern.test(normalized)) {
      extracted.add(day)
    }
  })

  if (extracted.size > 0) {
    return Array.from(extracted)
  }

  const splitParts = trimmed
    .split(/[\/,|]+/)
    .map(part => normalizeDayToken(part))
    .filter(part => dayOrder.includes(part as (typeof dayOrder)[number]))

  return Array.from(new Set(splitParts))
}

export function parseRequestsCsv(text: string): RequestCsvRow[] {
  const { rows } = parseCsvText(text)
  if (rows.length < 2) {
    throw new Error('The requests CSV does not contain any request rows.')
  }

  const requiredHeaderGroups = [
    { label: 'First Name', headers: ['First Name', 'FirstName', 'Student First Name'] },
    { label: 'Last Name', headers: ['Last Name', 'LastName', 'Student Last Name'] },
    {
      label: 'Instructor Requested',
      headers: ['Instructor Requested', 'Requested Instructor', 'Instructor', 'Requested Staff'],
    },
    { label: 'Day Of Week', headers: ['Day Of Week', 'DayOfTheWeek', 'Day', 'Requested Day'] },
  ]

  let headerRowIndex = -1
  let headerIndex = new Map<string, number>()

  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 10); rowIndex += 1) {
    const candidateIndex = buildHeaderIndex(rows[rowIndex])
    const matchedGroupCount = requiredHeaderGroups.filter(group =>
      hasAnyHeader(candidateIndex, group.headers),
    ).length
    if (matchedGroupCount >= 3) {
      headerRowIndex = rowIndex
      headerIndex = candidateIndex
      break
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = 0
    headerIndex = buildHeaderIndex(rows[0])
  }

  const missing = requiredHeaderGroups
    .filter(group => !hasAnyHeader(headerIndex, group.headers))
    .map(group => group.label)

  if (missing.length > 0) {
    throw new Error(`The requests CSV is missing required columns: ${missing.join(', ')}`)
  }

  const parsedRows: RequestCsvRow[] = []

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]
    if (!row.length) {
      continue
    }

    const firstName = getHeaderValue(row, headerIndex, ['First Name', 'FirstName', 'Student First Name'])
    const lastName = getHeaderValue(row, headerIndex, ['Last Name', 'LastName', 'Student Last Name'])
    const requestedInstructor = getHeaderValue(row, headerIndex, [
      'Instructor Requested',
      'Requested Instructor',
      'Instructor',
      'Requested Staff',
    ])
    const originalDayValue = getHeaderValue(row, headerIndex, ['Day Of Week', 'DayOfTheWeek', 'Day', 'Requested Day'])

    const fullName = [firstName, lastName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    if (!fullName && !requestedInstructor && !originalDayValue) {
      continue
    }

    parsedRows.push({
      rowNumber: rowIndex + 1,
      firstName,
      lastName,
      fullName,
      normalizedName: normalizePersonName(fullName),
      requestedInstructor: requestedInstructor.trim(),
      requestedDays: parseRequestedDays(originalDayValue),
      originalDayValue,
    })
  }

  return parsedRows
}

function buildStudentDayIndex(classRosters: ClassRoster[]) {
  const index = new Map<string, ClassRoster[]>()

  classRosters.forEach(classRoster => {
    const normalizedDay = normalizeDayToken(classRoster.day)
    if (!normalizedDay) {
      return
    }
    const days =
      normalizedDay === 'Mo,Tu,We,Th,Fr'
        ? ['Mo', 'Tu', 'We', 'Th', 'Fr']
        : normalizedDay.split(',').map(day => normalizeDayToken(day)).filter(Boolean)

    classRoster.students.forEach(student => {
      const normalizedName = normalizePersonName(student.name)
      if (!normalizedName) {
        return
      }
      days.forEach(day => {
        const key = `${day}::${normalizedName}`
        const existing = index.get(key) ?? []
        existing.push(classRoster)
        index.set(key, existing)
      })
    })
  })

  return index
}

function buildDaySortKey(day: string) {
  const index = dayOrder.indexOf(day as (typeof dayOrder)[number])
  return index === -1 ? 99 : index
}

export function analyzeInstructorRequests(
  requestRows: RequestCsvRow[],
  classRosters: ClassRoster[],
): RequestsAnalysisResult {
  const dayIndex = buildStudentDayIndex(classRosters)
  const daySummaries = new Map<string, Map<string, { roster: ClassRoster; matches: RequestMatch[] }>>()
  const unmatched: UnmatchedRequest[] = []
  const matchedStudentKeys = new Set<string>()
  let totalDayEntries = 0

  requestRows.forEach(request => {
    if (!request.normalizedName) {
      unmatched.push({
        request,
        requestedDay: '',
        reason: 'Missing student name',
      })
      return
    }
    if (!request.requestedInstructor) {
      unmatched.push({
        request,
        requestedDay: '',
        reason: 'Missing requested instructor',
      })
      return
    }
    if (request.requestedDays.length === 0) {
      unmatched.push({
        request,
        requestedDay: '',
        reason: 'Missing or invalid requested day',
      })
      return
    }

    request.requestedDays.forEach(requestedDay => {
      totalDayEntries += 1
      const matches = dayIndex.get(`${requestedDay}::${request.normalizedName}`) ?? []
      if (matches.length === 0) {
        unmatched.push({
          request,
          requestedDay,
          reason: 'No registered class found for this student on the requested day',
        })
        return
      }

      const dayClasses = daySummaries.get(requestedDay) ?? new Map()
      matches.forEach(classRoster => {
        const summary = dayClasses.get(classRoster.code) ?? { roster: classRoster, matches: [] }
        summary.matches.push({
          request,
          requestedDay,
          classRoster,
        })
        dayClasses.set(classRoster.code, summary)
        matchedStudentKeys.add(`${requestedDay}::${request.normalizedName}`)
      })
      daySummaries.set(requestedDay, dayClasses)
    })
  })

  const days = Array.from(daySummaries.entries())
    .sort(([left], [right]) => buildDaySortKey(left) - buildDaySortKey(right) || left.localeCompare(right))
    .map(([day, classes]) => ({
      day,
      classes: Array.from(classes.values())
        .map(({ roster, matches }) => {
          const instructorCounts = new Map<string, number>()
          const uniqueStudents = new Set<string>()

          matches.forEach(match => {
            instructorCounts.set(
              match.request.requestedInstructor,
              (instructorCounts.get(match.request.requestedInstructor) ?? 0) + 1,
            )
            uniqueStudents.add(match.request.normalizedName)
          })

          return {
            eventId: roster.code,
            serviceName: roster.serviceName,
            time: roster.time,
            location: roster.location,
            schedule: roster.schedule,
            matchedRequestCount: matches.length,
            uniqueStudentCount: uniqueStudents.size,
            instructorCounts: Array.from(instructorCounts.entries())
              .map(([instructor, count]) => ({ instructor, count }))
              .sort((left, right) => right.count - left.count || left.instructor.localeCompare(right.instructor)),
          }
        })
        .sort((left, right) => {
          if (left.time !== right.time) {
            return left.time.localeCompare(right.time)
          }
          return left.eventId.localeCompare(right.eventId)
        }),
    }))

  return {
    totalRequests: requestRows.length,
    totalDayEntries,
    matchedDayEntries: totalDayEntries - unmatched.filter(entry => entry.requestedDay).length,
    unmatchedDayEntries: unmatched.filter(entry => entry.requestedDay).length,
    matchedStudentCount: matchedStudentKeys.size,
    days,
    unmatched: unmatched.sort((left, right) => left.request.rowNumber - right.request.rowNumber),
  }
}

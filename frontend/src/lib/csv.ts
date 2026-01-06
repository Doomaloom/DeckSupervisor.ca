import type { InstructorEntry, Student } from '../types/app'

type CsvParseResult = {
  rows: string[][]
  rawHeader: string
}

function parseCsvText(text: string): CsvParseResult {
  const rows: string[][] = []
  let row: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (char === '"' && nextChar === '"') {
      current += '"'
      i += 1
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
      if (char === '\r' && nextChar === '\n') {
        i += 1
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

  const rawHeader = rows[0]?.join(',') ?? ''
  return { rows, rawHeader }
}

function buildInstructorMap(instructors: InstructorEntry[]): Record<string, string> {
  const map: Record<string, string> = {}
  instructors.forEach(instructor => {
    const name = instructor.name.trim()
    if (!name) {
      return
    }
    instructor.codes
      .split(',')
      .map(code => code.trim())
      .filter(Boolean)
      .forEach(code => {
        map[code] = name
      })
  })
  return map
}

export function parseStudentsFromCsv(
  text: string,
  instructors: InstructorEntry[],
  fallbackDay: string
): Student[] {
  const { rows, rawHeader } = parseCsvText(text)
  if (rows.length < 2) {
    return []
  }

  const courseMap = buildInstructorMap(instructors)
  let SERVICE_NAME = 0
  let CODE = 7
  let DAY = 4
  let TIME = 6
  let LOCATION = 15
  let SCHEDULE = 8
  let NAME = 18
  let PHONE = 20
  let series = true

  if (!rawHeader.includes('EventSchedule')) {
    SERVICE_NAME = 10
    CODE = 0
    DAY = 2
    TIME = 1
    LOCATION = 6
    SCHEDULE = 2
    NAME = 16
    PHONE = 17
    series = false
  }

  const students: Student[] = []

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i]
    if (!row.length) {
      continue
    }

    const rawDay = row[DAY] ?? ''
    const dayValue =
      rawDay === 'Mo Tu We Th Fr' || rawDay === 'Mo,Tu,We,Th,Fr'
        ? 'Mo,Tu,We,Th,Fr'
        : rawDay || fallbackDay

    const code = (row[CODE] ?? '').trim()
    const serviceName = (row[SERVICE_NAME] ?? '').trim()
    const time = (row[TIME] ?? '').trim()
    const location = (row[LOCATION] ?? '').trim()
    const schedule = (row[SCHEDULE] ?? '').trim()
    const phone = (row[PHONE] ?? '').trim()

    let name = ''
    if (series) {
      const lastName = row[NAME] ?? ''
      const firstName = row[NAME + 1] ?? ''
      name = `${firstName} ${lastName}`.trim()
    } else {
      name = (row[NAME] ?? '').trim()
    }

    if (!code || !name) {
      continue
    }

    const instructor = courseMap[code] ?? ''
    const level = serviceName
    const id = `${code}-${name}-${time}-${dayValue}`.replace(/\s+/g, '-')

    students.push({
      id,
      service_name: serviceName,
      code,
      day: dayValue,
      time,
      location,
      schedule,
      name,
      phone,
      instructor,
      level,
    })
  }

  return students
}

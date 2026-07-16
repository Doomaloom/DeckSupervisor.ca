import type {
  MasterlistAlphabeticalNameBasis,
  MasterlistFormatOptions,
  MasterlistPdfRequest,
  MasterlistRoster,
} from '../types'

export type MasterlistRow =
  | { kind: 'data'; cells: string[] }
  | { kind: 'time' | 'course' | 'alphabetical'; label: string }

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const records = (value: unknown) => (Array.isArray(value) ? value.filter(Boolean) as Record<string, unknown>[] : [])
const nameCollator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })
const suffixes = new Set(['jr', 'sr', 'ii', 'iii', 'iv'])

type MasterlistRosterInput = MasterlistRoster | Record<string, unknown>

type NamedDataRow = {
  row: Extract<MasterlistRow, { kind: 'data' }>
  name: string
}

export function sanitizeEventName(name: string) {
  const normalized = name.replace(/ /g, '')
  const replacements: Array<[RegExp, string]> = [
    [/Splash7/i, 'Splash 7'],
    [/Splash8/i, 'Splash 8'],
    [/Splash9/i, 'Splash 9'],
    [/Splash10/i, 'Splash 10'],
    [/Adult1/i, 'Splash Adult 1'],
    [/Adult2/i, 'Splash Adult 2'],
    [/Adult3/i, 'Splash Adult 3'],
    [/Teen1/i, 'Splash Teen 1'],
    [/Teen2/i, 'Splash Teen 2'],
    [/Teen3/i, 'Splash Teen 3'],
    [/GroupPrivate/i, 'Group Private'],
    [/Private/i, 'Private'],
  ]
  return replacements.find(([pattern]) => pattern.test(normalized))?.[1] ?? name.trim()
}

export function normalizeMasterlistFontSize(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 14
  return Math.min(18, Math.max(8, Math.round(value)))
}

function buildRosterDataRows(roster: MasterlistRosterInput): NamedDataRow[] {
  const value = roster as unknown as Record<string, unknown>
  const time = text(value.time ?? value.Time)
  const code = text(value.courseCode ?? value.CourseCode ?? value.code ?? value.Code)
  const serviceName = sanitizeEventName(text(value.serviceName ?? value.ServiceName))
  const rosterInstructor = text(value.instructor ?? value.Instructor)
  const students = records(value.students ?? value.Students)

  return students.flatMap(student => {
    const name = text(student.name ?? student.Name)
    if (!name || !code) return []
    const instructor = rosterInstructor || text(student.instructor ?? student.Instructor)
    return [{
      name,
      row: {
        kind: 'data' as const,
        cells: [
          code,
          time,
          instructor,
          serviceName || sanitizeEventName(text(student.level ?? student.Level)),
          name,
          text(student.age ?? student.Age),
          text(student.phone ?? student.Phone),
        ],
      },
    }]
  })
}

function firstNameKey(name: string) {
  const commaIndex = name.indexOf(',')
  const firstNamePortion = commaIndex >= 0 ? name.slice(commaIndex + 1) : name
  return firstNamePortion.trim().split(/\s+/)[0] ?? name
}

function lastNameKey(name: string) {
  const commaIndex = name.indexOf(',')
  if (commaIndex >= 0) return name.slice(0, commaIndex).trim() || name

  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return parts[0] ?? name
  const normalizedLast = parts.at(-1)?.replace(/[.,]/g, '').toLowerCase() ?? ''
  if (suffixes.has(normalizedLast) && parts.length > 1) parts.pop()
  return parts.at(-1) ?? name
}

function alphabeticalKey(name: string, basis: MasterlistAlphabeticalNameBasis) {
  return basis === 'first-name' ? firstNameKey(name) : lastNameKey(name)
}

function alphabeticalGroup(key: string) {
  const firstCharacter = Array.from(key.trim())[0]?.toUpperCase() ?? ''
  return /^[A-Z]$/.test(firstCharacter) ? firstCharacter : '#'
}

function buildAlphabeticalRows(
  rosters: MasterlistRosterInput[],
  basis: MasterlistAlphabeticalNameBasis,
) {
  const students = rosters.flatMap(buildRosterDataRows)
  students.sort((left, right) => {
    const leftGroup = alphabeticalGroup(alphabeticalKey(left.name, basis))
    const rightGroup = alphabeticalGroup(alphabeticalKey(right.name, basis))
    const groupComparison = nameCollator.compare(
      leftGroup === '#' ? 'ZZZZ' : leftGroup,
      rightGroup === '#' ? 'ZZZZ' : rightGroup,
    )
    if (groupComparison !== 0) return groupComparison
    const keyComparison = nameCollator.compare(
      alphabeticalKey(left.name, basis),
      alphabeticalKey(right.name, basis),
    )
    if (keyComparison !== 0) return keyComparison
    const nameComparison = nameCollator.compare(left.name, right.name)
    if (nameComparison !== 0) return nameComparison
    return nameCollator.compare(left.row.cells[0], right.row.cells[0])
  })

  const rows: MasterlistRow[] = []
  let currentGroup = ''
  students.forEach(student => {
    const group = alphabeticalGroup(alphabeticalKey(student.name, basis))
    if (group !== currentGroup) {
      rows.push({ kind: 'alphabetical', label: group })
      currentGroup = group
    }
    rows.push(student.row)
  })
  return rows
}

export function buildMasterlistRows(
  rosters: MasterlistRosterInput[],
  options: MasterlistFormatOptions,
) {
  if (options.layout === 'alphabetical') {
    return buildAlphabeticalRows(rosters, options.alphabetical_name_basis)
  }

  const rows: MasterlistRow[] = []
  let currentTime = ''
  for (const roster of rosters) {
    const value = roster as unknown as Record<string, unknown>
    const time = text(value.time ?? value.Time)
    const code = text(value.courseCode ?? value.CourseCode ?? value.code ?? value.Code)
    const serviceName = sanitizeEventName(text(value.serviceName ?? value.ServiceName))
    const rosterInstructor = text(value.instructor ?? value.Instructor)
    const students = records(value.students ?? value.Students)
    if (options.time_headers && time && time !== currentTime) {
      rows.push({ kind: 'time', label: time })
      currentTime = time
    }
    if (options.course_headers) {
      const fallbackInstructor = students.length ? text(students[0].instructor ?? students[0].Instructor) : ''
      const instructor = rosterInstructor || fallbackInstructor
      const base = serviceName || code
      const label = options.instructor_headers && instructor ? `${base} - ${instructor}` : base
      if (label) rows.push({ kind: 'course', label })
    }
    buildRosterDataRows(roster)
      .sort((left, right) => nameCollator.compare(left.name, right.name))
      .forEach(student => rows.push(student.row))
  }
  return rows
}

export function buildMasterlistTitle(request: MasterlistPdfRequest) {
  const parts = [request.sessionName?.trim()]
  if (request.sessionProgressLabel?.trim()) parts.push(request.sessionProgressLabel.trim())
  else if ((request.sessionWeek ?? 0) > 0) parts.push(`Week ${request.sessionWeek}`)
  parts.push(request.generatedDate?.trim())
  return parts.filter(Boolean).join(' - ')
}

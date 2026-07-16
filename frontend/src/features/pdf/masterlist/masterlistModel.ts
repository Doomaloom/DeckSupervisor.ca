import type { MasterlistFormatOptions, MasterlistPdfRequest } from '../types'

export type MasterlistRow =
  | { kind: 'data'; cells: string[] }
  | { kind: 'time' | 'course'; label: string }

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const records = (value: unknown) => (Array.isArray(value) ? value.filter(Boolean) as Record<string, unknown>[] : [])

export function sanitizeEventName(name: string) {
  const normalized = name.replaceAll(' ', '')
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

export function buildMasterlistRows(
  rosters: Record<string, unknown>[],
  options: MasterlistFormatOptions,
) {
  const rows: MasterlistRow[] = []
  let currentTime = ''
  for (const roster of rosters) {
    const time = text(roster.time ?? roster.Time)
    const code = text(roster.code ?? roster.Code)
    const serviceName = sanitizeEventName(text(roster.serviceName ?? roster.ServiceName))
    const rosterInstructor = text(roster.instructor ?? roster.Instructor)
    const students = records(roster.students ?? roster.Students)
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
    students.forEach(student => {
      const name = text(student.name ?? student.Name)
      if (!name || !code) return
      const instructor = rosterInstructor || text(student.instructor ?? student.Instructor)
      rows.push({
        kind: 'data',
        cells: [
          code,
          time,
          instructor,
          serviceName || sanitizeEventName(text(student.level ?? student.Level)),
          name,
          text(student.age ?? student.Age),
          text(student.phone ?? student.Phone),
        ],
      })
    })
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

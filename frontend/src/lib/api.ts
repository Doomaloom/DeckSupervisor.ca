import type { ClassRoster, ExtractedClass, ExtractedSession, InstructorEntry, Student } from '../types/app'
import { setStudentsForDay } from './storage'
import { normalizeSessionLocationKey } from '../shared/session/sourceLocations'

type ProcessCsvResponse = {
  success: boolean
  day?: string
  total: number
  classes: ClassRoster[]
}

type ExtractClassesResponse = {
  success: boolean
  totalSessions: number
  totalClasses: number
  sessions: ExtractedSession[]
  classesBySession: Record<string, ExtractedClass[]>
}

function summarizeProcessCsvClasses(classes: ClassRoster[]) {
  return classes.map(roster => ({
    code: roster.code,
    studentCount: roster.students.length,
    waitlistCount: roster.students.filter(student => Boolean(student.waitlist)).length,
    students: roster.students.map(student => ({
      name: student.name,
      waitlist: Boolean(student.waitlist),
    })),
  }))
}

async function processCsv(file: File, day: string, instructors: InstructorEntry[] = []): Promise<ProcessCsvResponse> {
  const formData = new FormData()
  formData.append('csv_file', file)
  formData.append('day', day)
  instructors.forEach(instructor => {
    formData.append('instructor_names[]', instructor.name)
    formData.append('instructor_codes[]', instructor.codes)
  })

  const response = await fetch('/api/process-csv', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error('Failed to process CSV')
  }

  return (await response.json()) as ProcessCsvResponse
}

function rosterToStudents(rosters: ClassRoster[]): Student[] {
  const students: Student[] = []
  rosters.forEach(roster => {
    roster.students.forEach(student => {
      const id = `${roster.code}-${student.name}-${roster.time}-${roster.day}`.replace(/\s+/g, '-')
      students.push({
        id,
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
      })
    })
  })
  return students
}

export async function processCsvAndStore(
  file: File,
  day: string,
  instructors: InstructorEntry[] = [],
  options?: { courseCodes?: string[]; rawLocations?: string[] }
): Promise<ProcessCsvResponse> {
  const data = await processCsv(file, day, instructors)
  console.log('[csv-import] process-csv raw response', {
    requestedDay: day,
    classCount: data.classes?.length ?? 0,
    classes: summarizeProcessCsvClasses(data.classes ?? []),
  })
  const allowedCodes = new Set((options?.courseCodes ?? []).map(code => code.trim()).filter(Boolean))
  const allowedLocationKeys = new Set(
    (options?.rawLocations ?? []).map(location => normalizeSessionLocationKey(location)).filter(Boolean),
  )
  const classes =
    allowedCodes.size > 0
      ? (data.classes ?? []).filter(roster => {
          if (!allowedCodes.has(roster.code.trim())) {
            return false
          }
          if (allowedLocationKeys.size === 0) {
            return true
          }
          return allowedLocationKeys.has(normalizeSessionLocationKey(roster.location))
        })
      : (data.classes ?? [])

  if (classes.length) {
    const students = rosterToStudents(classes)
    const grouped = students.reduce<Record<string, Student[]>>((acc, student) => {
      acc[student.day] = acc[student.day] || []
      acc[student.day].push(student)
      return acc
    }, {})
    Object.entries(grouped).forEach(([key, list]) => {
      setStudentsForDay(key, list)
    })
  }
  return {
    ...data,
    classes,
    total: classes.reduce((sum, roster) => sum + roster.students.length, 0),
  }
}

export async function processCsvWithoutStore(
  file: File,
  day = '',
  instructors: InstructorEntry[] = [],
): Promise<ProcessCsvResponse> {
  return processCsv(file, day, instructors)
}

export async function extractClassesFromCsv(file: File): Promise<ExtractClassesResponse> {
  const formData = new FormData()
  formData.append('csv_file', file)

  const response = await fetch('/api/extract-classes', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error('Failed to extract classes from CSV')
  }

  return (await response.json()) as ExtractClassesResponse
}

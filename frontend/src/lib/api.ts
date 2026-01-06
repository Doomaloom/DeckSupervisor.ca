import type { ClassRoster, InstructorEntry, Student } from '../types/app'
import { setStudentsForDay } from './storage'

type ProcessCsvResponse = {
  success: boolean
  day?: string
  total: number
  classes: ClassRoster[]
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
      })
    })
  })
  return students
}

export async function processCsvAndStore(
  file: File,
  day: string,
  instructors: InstructorEntry[] = []
): Promise<ProcessCsvResponse> {
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

  const data = (await response.json()) as ProcessCsvResponse
  if (data.classes?.length) {
    const students = rosterToStudents(data.classes)
    const grouped = students.reduce<Record<string, Student[]>>((acc, student) => {
      acc[student.day] = acc[student.day] || []
      acc[student.day].push(student)
      return acc
    }, {})
    Object.entries(grouped).forEach(([key, list]) => {
      setStudentsForDay(key, list)
    })
  }
  return data
}

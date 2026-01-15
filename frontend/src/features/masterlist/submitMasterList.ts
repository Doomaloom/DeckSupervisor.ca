import { getInstructorCoursesForDay, getInstructorsForDay, getStudentsForDay, setFormatOptions } from '../../lib/storage'
import type { FormatOptions, InstructorCourseAssignment, InstructorEntry, Student } from '../../types/app'

type SubmitMasterListParams = {
  selectedDay: string
  formatOptions: FormatOptions
  rememberFormatting: boolean
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function escapeCsvValue(value: string) {
  if (!value) {
    return ''
  }
  const escaped = value.replace(/"/g, '""')
  if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) {
    return `"${escaped}"`
  }
  return escaped
}

function buildCsvFromStudents(students: Student[]) {
  const headers = ['EventID', 'EventTime', 'ServiceName', 'AttendeeName', 'AttendeePhone']
  const rows = students.map(student => [
    student.code,
    student.time,
    student.service_name,
    student.name,
    student.phone,
  ])
  return [headers, ...rows].map(row => row.map(value => escapeCsvValue(String(value ?? ''))).join(',')).join('\n')
}

function buildInstructorAssignments(
  selectedDay: string,
): Array<Pick<InstructorEntry, 'name' | 'codes'>> {
  const fromCourses = getInstructorCoursesForDay(selectedDay)
  if (fromCourses?.instructors?.length) {
    return fromCourses.instructors
      .map((entry: InstructorCourseAssignment) => ({
        name: entry.name.trim(),
        codes: entry.codes.join(','),
      }))
      .filter(entry => entry.name)
  }

  const fromConfig = getInstructorsForDay(selectedDay)
  if (!fromConfig) {
    return []
  }
  return fromConfig.names
    .map((name, index) => ({
      name: name.trim(),
      codes: fromConfig.codes[index] ?? '',
    }))
    .filter(entry => entry.name)
}

export async function submitMasterList({
  selectedDay,
  formatOptions,
  rememberFormatting,
}: SubmitMasterListParams) {
  if (rememberFormatting) {
    setFormatOptions(formatOptions)
  }

  const students = getStudentsForDay(selectedDay)
  if (students.length === 0) {
    throw new Error('No roster data found for this day.')
  }

  const csvContent = buildCsvFromStudents(students)
  const csvBlob = new Blob([csvContent], { type: 'text/csv' })
  const instructorAssignments = buildInstructorAssignments(selectedDay)

  const formData = new FormData()
  formData.append('csv_file', csvBlob, 'masterlist.csv')
  instructorAssignments.forEach(instructor => {
    formData.append('instructor_names[]', instructor.name)
    formData.append('instructor_codes[]', instructor.codes)
  })
  Object.entries(formatOptions).forEach(([key, value]) => {
    if (value) {
      formData.append(key, 'on')
    }
  })

  const response = await fetch('/api/masterlist', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error('Failed to generate master list')
  }

  const blob = await response.blob()
  downloadBlob(blob, 'masterlist.xlsx')
}

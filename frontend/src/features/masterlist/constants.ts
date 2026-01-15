import type { FormatOptions, InstructorEntry } from '../../types/app'

export const emptyInstructor: InstructorEntry = { name: '', codes: '' }

export type FormatOptionItem = {
  key: keyof FormatOptions
  label: string
}

export const formatOptionItems: FormatOptionItem[] = [
  { key: 'time_headers', label: 'Time Headers' },
  { key: 'instructor_headers', label: 'Instructor Headers' },
  { key: 'course_headers', label: 'Course Headers' },
  { key: 'borders', label: 'Borders' },
]

export const timeHeaderStyleOptions: FormatOptionItem[] = [
  { key: 'center_time', label: 'Center' },
  { key: 'bold_time', label: 'Bold' },
]

export const courseHeaderStyleOptions: FormatOptionItem[] = [
  { key: 'center_course', label: 'Center' },
  { key: 'bold_course', label: 'Bold' },
]

export type ColumnOptionItem = {
  key: string
  label: string
}

export const columnOptionItems: ColumnOptionItem[] = [
  { key: 'class_code', label: 'Class Code' },
  { key: 'class_time', label: 'Class Time' },
  { key: 'class_level', label: 'Class Level' },
  { key: 'instructor_name', label: 'Instructor Name' },
  { key: 'student_name', label: 'Student Name' },
  { key: 'student_phone', label: 'Student Phone' },
]

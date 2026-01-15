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

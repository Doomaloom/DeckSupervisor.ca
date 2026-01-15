import type {
  CustomRoster,
  FormatOptions,
  InstructorConfig,
  InstructorCourseConfig,
  ScheduleConfig,
  Student,
} from '../types/app'

const PREFIX = 'cob'
const selectedDayKey = `${PREFIX}:selectedDay`
const studentsKey = `${PREFIX}:studentsByDay`
const instructorsKey = `${PREFIX}:instructorsByDay`
const formatOptionsKey = `${PREFIX}:formatOptions`
const schedulesKey = `${PREFIX}:schedulesByDay`
const instructorCoursesKey = `${PREFIX}:instructorCoursesByDay`
const customRostersKey = `${PREFIX}:customRostersByDay`
const studentsUpdatedEvent = `${PREFIX}:students-updated`

type StudentsByDay = Record<string, Student[]>
type InstructorsByDay = Record<string, InstructorConfig>
type SchedulesByDay = Record<string, ScheduleConfig>
type InstructorCoursesByDay = Record<string, InstructorCourseConfig>
type CustomRostersByDay = Record<string, CustomRoster[]>

const defaultFormatOptions: FormatOptions = {
  time_headers: false,
  instructor_headers: false,
  course_headers: false,
  borders: false,
  center_time: false,
  bold_time: false,
  center_course: false,
  bold_course: false,
}

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const value = window.localStorage.getItem(key)
    if (!value) {
      return fallback
    }
    return JSON.parse(value) as T
  } catch (error) {
    console.error(`Failed to parse ${key} from localStorage`, error)
    return fallback
  }
}

function saveJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(key, JSON.stringify(value))
}

export function getSelectedDay(): string {
  if (typeof window === 'undefined') {
    return ''
  }
  return window.localStorage.getItem(selectedDayKey) ?? ''
}

export function setSelectedDay(day: string) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(selectedDayKey, day)
}

export function getFormatOptions(): FormatOptions {
  return loadJson(formatOptionsKey, defaultFormatOptions)
}

export function setFormatOptions(options: FormatOptions) {
  saveJson(formatOptionsKey, options)
}

export function getStudentsByDay(): StudentsByDay {
  return loadJson(studentsKey, {})
}

export function getStudentsForDay(day: string): Student[] {
  if (!day) {
    return []
  }
  const all = getStudentsByDay()
  return all[day] ?? []
}

export function setStudentsForDay(day: string, students: Student[]) {
  if (!day) {
    return
  }
  const all = getStudentsByDay()
  all[day] = students
  saveJson(studentsKey, all)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(studentsUpdatedEvent, { detail: { day } }))
  }
}

export function updateStudentForDay(day: string, studentId: string, update: Partial<Student>) {
  if (!day) {
    return
  }
  const students = getStudentsForDay(day)
  const updated = students.map(student =>
    student.id === studentId ? { ...student, ...update } : student
  )
  setStudentsForDay(day, updated)
}

export function onStudentsUpdated(handler: (day: string) => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }
  const listener = (event: Event) => {
    const custom = event as CustomEvent<{ day?: string }>
    handler(custom.detail?.day ?? '')
  }
  window.addEventListener(studentsUpdatedEvent, listener)
  return () => window.removeEventListener(studentsUpdatedEvent, listener)
}

export function getInstructorsByDay(): InstructorsByDay {
  return loadJson(instructorsKey, {})
}

export function getInstructorsForDay(day: string): InstructorConfig | null {
  if (!day) {
    return null
  }
  const all = getInstructorsByDay()
  return all[day] ?? null
}

export function setInstructorsForDay(day: string, instructors: InstructorConfig) {
  if (!day) {
    return
  }
  const all = getInstructorsByDay()
  all[day] = instructors
  saveJson(instructorsKey, all)
}

export function getSchedulesByDay(): SchedulesByDay {
  return loadJson(schedulesKey, {})
}

export function getScheduleForDay(day: string): ScheduleConfig | null {
  if (!day) {
    return null
  }
  const all = getSchedulesByDay()
  return all[day] ?? null
}

export function setScheduleForDay(day: string, schedule: ScheduleConfig) {
  if (!day) {
    return
  }
  const all = getSchedulesByDay()
  all[day] = schedule
  saveJson(schedulesKey, all)
}

export function getCustomRostersByDay(): CustomRostersByDay {
  return loadJson(customRostersKey, {})
}

export function getCustomRostersForDay(day: string): CustomRoster[] {
  if (!day) {
    return []
  }
  const all = getCustomRostersByDay()
  return all[day] ?? []
}

export function setCustomRostersForDay(day: string, rosters: CustomRoster[]) {
  if (!day) {
    return
  }
  const all = getCustomRostersByDay()
  all[day] = rosters
  saveJson(customRostersKey, all)
}

export function getInstructorCoursesByDay(): InstructorCoursesByDay {
  return loadJson(instructorCoursesKey, {})
}

export function getInstructorCoursesForDay(day: string): InstructorCourseConfig | null {
  if (!day) {
    return null
  }
  const all = getInstructorCoursesByDay()
  return all[day] ?? null
}

export function setInstructorCoursesForDay(day: string, config: InstructorCourseConfig) {
  if (!day) {
    return
  }
  const all = getInstructorCoursesByDay()
  all[day] = config
  saveJson(instructorCoursesKey, all)
}

export function clearDayData(day: string) {
  if (!day) {
    return
  }
  const students = getStudentsByDay()
  const instructors = getInstructorsByDay()
  const schedules = getSchedulesByDay()
  const instructorCourses = getInstructorCoursesByDay()
  const customRosters = getCustomRostersByDay()

  delete students[day]
  delete instructors[day]
  delete schedules[day]
  delete instructorCourses[day]
  delete customRosters[day]

  saveJson(studentsKey, students)
  saveJson(instructorsKey, instructors)
  saveJson(schedulesKey, schedules)
  saveJson(instructorCoursesKey, instructorCourses)
  saveJson(customRostersKey, customRosters)
}

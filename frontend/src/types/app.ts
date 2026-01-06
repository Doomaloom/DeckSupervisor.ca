export type FormatOptions = {
  time_headers: boolean
  instructor_headers: boolean
  course_headers: boolean
  borders: boolean
  center_time: boolean
  bold_time: boolean
  center_course: boolean
  bold_course: boolean
}

export type InstructorEntry = {
  name: string
  codes: string
}

export type InstructorConfig = {
  names: string[]
  codes: string[]
}

export type Student = {
  id: string
  service_name: string
  code: string
  day: string
  time: string
  location: string
  schedule: string
  name: string
  phone: string
  instructor: string
  level: string
}

export type ScheduleConfig = {
  instructors: string[]
  codes: string[]
}

export type RosterStudent = {
  name: string
  phone: string
  instructor: string
  level: string
}

export type ClassRoster = {
  code: string
  serviceName: string
  day: string
  time: string
  location: string
  schedule: string
  instructor: string
  students: RosterStudent[]
}

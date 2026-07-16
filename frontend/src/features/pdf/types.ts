export type PdfArtifact = {
  blob: Blob
  filename: string
  title: string
}

export type PdfOrientation = 'portrait' | 'landscape'

export type AttendancePdfStudent = {
  name: string
}

export type AttendancePdfRoster = {
  code: string
  level: string
  serviceName: string
  time: string
  instructor: string
  location: string
  schedule: string
  students: AttendancePdfStudent[]
}

export type AttendancePdfItem = {
  template: string
  roster: AttendancePdfRoster
}

export type AttendancePdfRequest = {
  template?: string
  session?: string
  filename?: string
  title?: string
  roster?: AttendancePdfRoster
  rosters?: AttendancePdfItem[]
}

export type SchematicPdfCourse = {
  code?: string
  level?: string
  startMinutes?: number
  durationMinutes?: number
  studentCount?: number
  capacity?: number
}

export type SchematicPdfRequest = {
  orientation?: PdfOrientation
  title?: string
  dateRange?: string
  weeksLabel?: string
  highlightInstructor?: boolean
  selectedInstructor?: string
  instructors?: string[]
  columns?: SchematicPdfCourse[][]
  scalePercent?: number
  rotateCounterClockwise90?: boolean
}

export type MasterlistFormatOptions = {
  time_headers: boolean
  instructor_headers: boolean
  course_headers: boolean
  borders: boolean
  center_time: boolean
  bold_time: boolean
  center_course: boolean
  bold_course: boolean
  font_size: number
}

export type MasterlistPdfRequest = {
  rosters: Array<Record<string, unknown>>
  options: MasterlistFormatOptions
  sessionName?: string
  generatedDate?: string
  sessionWeek?: number
  sessionProgressLabel?: string
}

export type SessionReportPdfRequest = Record<string, unknown> & {
  title?: string
}

export const PDF_RENDERER_VERSION = 'frontend-vector-v1'

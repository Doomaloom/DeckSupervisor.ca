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
  deckSupervisorName?: string
  highlightInstructor?: boolean
  selectedInstructor?: string
  instructors?: string[]
  columns?: SchematicPdfCourse[][]
  scalePercent?: number
  rotateCounterClockwise90?: boolean
}

export type MasterlistLayout = 'class-time' | 'alphabetical'
export type MasterlistAlphabeticalNameBasis = 'first-name' | 'last-name'

export type MasterlistFormatOptions = {
  layout: MasterlistLayout
  alphabetical_name_basis: MasterlistAlphabeticalNameBasis
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

export type MasterlistStudent = {
  name: string
  phone: string
  age?: string
  instructor: string
  level: string
}

export type MasterlistRoster = {
  courseCode: string
  serviceName: string
  day: string
  time: string
  location: string
  schedule: string
  instructor: string
  students: MasterlistStudent[]
}

export type MasterlistPdfRequest = {
  rosters: MasterlistRoster[]
  options: MasterlistFormatOptions
  sessionName?: string
  generatedDate?: string
  sessionWeek?: number
  sessionProgressLabel?: string
}

export type InstructorTextEntry = { instructor: string; text: string }
export type StrengthWeaknessEntry = { instructor: string; strengths: string[]; weaknesses: string[] }
export type InstructorCoverEntry = { instructor: string; coveredBy: string; details: string }
export type ChallengingTimeEntry = { time: string; lessons: string; description: string }
export type NewClassLayoutEntry = { level: string; description: string }
export type SafetyConcernEntry = { concernType: string; description: string }
export type ItemDescriptionEntry = { item: string; description: string }
export type ParentFeedbackEntry = { feedbackType: string; description: string }
export type AdminWorkEntry = { work: string; description: string }
export type InitiativeEntry = { title: string; brief: string }

export type SessionReportPdfRequest = {
  title: string
  sessionContext: string
  authorName: string
  createdAt: string
  updatedAt: string
  staff: {
    performance: InstructorTextEntry[]
    strengthWeakness: StrengthWeaknessEntry[]
    successionPlans: InstructorTextEntry[]
    instructorCovers: InstructorCoverEntry[]
  }
  lessonStructure: {
    challengingTimes: ChallengingTimeEntry[]
    newClassLayouts: NewClassLayoutEntry[]
  }
  safetyFacility: {
    safetyConcerns: SafetyConcernEntry[]
    maintenanceIssues: ItemDescriptionEntry[]
    poolDeckWorksWell: ItemDescriptionEntry[]
    poolDeckImprovements: ItemDescriptionEntry[]
  }
  parentCustomerFeedback: ParentFeedbackEntry[]
  projectsInitiatives: {
    adminWork: AdminWorkEntry[]
    initiatives: InitiativeEntry[]
  }
}

export const PDF_RENDERER_VERSION = 'frontend-vector-v2-backend-parity'

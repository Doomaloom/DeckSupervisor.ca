export type AttendancePrintStudent = { name: string }

export type AttendancePrintRoster = {
  code: string
  level: string
  serviceName: string
  time: string
  instructor: string
  location: string
  schedule: string
  students: AttendancePrintStudent[]
}

export type AttendancePrintItem = {
  template: string
  roster: AttendancePrintRoster
}

export type AttendancePrintRequest = {
  session?: string
  title?: string
  roster?: AttendancePrintRoster
  rosters?: AttendancePrintItem[]
  template?: string
}

export type AttendancePrintResult =
  | { status: 'printed' }
  | { status: 'popup-blocked' }
  | { status: 'failed'; error: Error }

export type AttendanceTemplateSections = {
  key: string
  styles: string[]
  pageAttributes: Record<string, string>
  frontFragment: HTMLElement
  backFragment: HTMLElement
}

export type AttendancePrintPage = {
  kind: 'attendance-front' | 'attendance-back' | 'schematic-cover' | 'blank'
  element: HTMLElement
}

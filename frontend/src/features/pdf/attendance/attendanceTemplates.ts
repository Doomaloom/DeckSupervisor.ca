import templateData from './attendanceTemplateData.generated.json'

export type AttendanceTemplateDefinition = {
  key: string
  title: string
  skills: string[]
  backSections: string[]
  showPreviousLevel: boolean
  showResult: boolean
  showRegisterIn: boolean
  compactBackPage: boolean
}

export const attendanceTemplates = templateData as AttendanceTemplateDefinition[]

const templatesByKey = new Map(attendanceTemplates.map(template => [template.key, template]))

export function getAttendanceTemplate(key: string) {
  return templatesByKey.get(key) ?? templatesByKey.get('SplashFitness') ?? attendanceTemplates[0]
}

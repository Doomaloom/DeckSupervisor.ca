import templateData from './attendanceTemplateData.generated.json'

export type AttendanceTemplateColumn = { text: string; widthPt: number }
export type AttendanceBackColumn = { widthPt: number; blocks: string[] }
export type AttendanceTemplateDefinition = {
  key: string
  title: string
  sheetWidthPx: number
  rotateHeightPx: number
  rotateTranslatePx: number
  rotateTopPx: number
  headerWidthPt: number
  headerHeightPt: number
  columns: AttendanceTemplateColumn[]
  backTableWidthPt: number
  backColumns: AttendanceBackColumn[]
  compactBackPage: boolean
}

export const attendanceTemplates = templateData as AttendanceTemplateDefinition[]
const templatesByKey = new Map(attendanceTemplates.map(template => [template.key, template]))
export function getAttendanceTemplate(key: string) {
  return templatesByKey.get(key) ?? templatesByKey.get('SplashFitness') ?? attendanceTemplates[0]
}

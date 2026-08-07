import templateData from './attendanceTemplateData.generated.json'

export type AttendanceTemplateColumn = { text: string; widthPt: number }
export type AttendanceRichSpan = { text: string; bold: boolean }
export type AttendanceRichLine = {
  spans: AttendanceRichSpan[]
  marker: 'none' | 'bullet' | 'dash'
  indentLevel: number
}
export type AttendanceBackBlock = { lines: AttendanceRichLine[] }
export type AttendanceAssessmentBackPage = {
  kind: 'assessment'
  columns: [AttendanceBackBlock[], AttendanceBackBlock[], AttendanceBackBlock[]]
  naturalHeightPt: number
}
export type AttendancePrivateCatalogBlock = { title: string; entries: string[] }
export type AttendancePrivateBackPage = {
  kind: 'private-catalog'
  columns: [AttendancePrivateCatalogBlock[], AttendancePrivateCatalogBlock[], AttendancePrivateCatalogBlock[]]
  naturalHeightPt: number
}
export type AttendanceBackPage = AttendanceAssessmentBackPage | AttendancePrivateBackPage
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
  backPage: AttendanceBackPage
}

export const attendanceTemplates = templateData as AttendanceTemplateDefinition[]
const templatesByKey = new Map(attendanceTemplates.map(template => [template.key, template]))
export function getAttendanceTemplate(key: string) {
  return templatesByKey.get(key) ?? templatesByKey.get('SplashFitness') ?? attendanceTemplates[0]
}

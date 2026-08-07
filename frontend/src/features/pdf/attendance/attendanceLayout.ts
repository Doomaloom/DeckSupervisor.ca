import type { AttendancePdfItem } from '../types'
import { ATTENDANCE_FRONT_STYLE, ATTENDANCE_PAIR, ATTENDANCE_PRINTABLE } from './attendanceStyle'
import type { AttendanceBackPage, AttendanceTemplateDefinition } from './attendanceTemplates'

export function getFrontFit(template: AttendanceTemplateDefinition) {
  return ATTENDANCE_PRINTABLE.width / (template.sheetWidthPx * 0.75)
}

export function getFrontColumnWidths(template: AttendanceTemplateDefinition) {
  const totalWeight = template.headerWidthPt + template.columns.reduce((sum, column) => sum + column.widthPt, 0)
  const widthScale = ATTENDANCE_PRINTABLE.width / totalWeight
  return {
    header: template.headerWidthPt * widthScale,
    skills: template.columns.map(column => column.widthPt * widthScale),
  }
}

export function getRotatedHeadingPosition(template: AttendanceTemplateDefinition) {
  return (template.rotateTopPx + template.rotateTranslatePx) * 0.75 * getFrontFit(template)
}

export function getFrontRowHeight(template: AttendanceTemplateDefinition, densityScale = 1) {
  return ATTENDANCE_FRONT_STYLE.studentRowMinHeight * getFrontFit(template) * densityScale
}

export function getPairedDensityScale(naturalHeightPt: number) {
  if (!Number.isFinite(naturalHeightPt) || naturalHeightPt <= 0) return 1
  return Math.min(1, ATTENDANCE_PAIR.slotHeight / naturalHeightPt)
}

export function buildAttendanceBackModel<T extends AttendanceBackPage>(backPage: T, paired = false) {
  return {
    kind: backPage.kind,
    columns: backPage.columns,
    densityScale: paired ? getPairedDensityScale(backPage.naturalHeightPt) : 1,
    naturalHeight: backPage.naturalHeightPt,
    blockCount: backPage.columns.reduce((sum, column) => sum + column.length, 0),
  }
}

export function buildAttendanceFrontModel(item: AttendancePdfItem, template: AttendanceTemplateDefinition, paired = false) {
  const fit = getFrontFit(template)
  const headerHeight = template.rotateHeightPx * 0.75 * fit
  const rowHeight = getFrontRowHeight(template)
  const naturalHeight = headerHeight + item.roster.students.length * rowHeight
  const densityScale = paired ? getPairedDensityScale(naturalHeight) : 1

  return {
    fit,
    densityScale,
    naturalHeight,
    headerHeight: headerHeight * densityScale,
    rowHeight: rowHeight * densityScale,
    columnWidths: getFrontColumnWidths(template),
    headingBaseline: getRotatedHeadingPosition(template) * densityScale,
    students: item.roster.students,
  }
}

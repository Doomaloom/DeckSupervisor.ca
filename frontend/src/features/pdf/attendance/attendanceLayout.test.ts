import { describe, expect, it } from 'vitest'
import type { AttendancePdfItem } from '../types'
import {
  buildAttendanceBackModel,
  buildAttendanceFrontModel,
  getFrontColumnWidths,
  getFrontFit,
  getFrontRowHeight,
  getPairedDensityScale,
  getRotatedHeadingPosition,
} from './attendanceLayout'
import { ATTENDANCE_PAIR, ATTENDANCE_PRINTABLE } from './attendanceStyle'
import { getAttendanceTemplate } from './attendanceTemplates'

const attendanceItem = (studentNames: string[]): AttendancePdfItem => ({
  template: 'Splash1',
  roster: {
    code: '123',
    level: 'Splash 1',
    serviceName: 'Splash 1',
    time: '9:00 AM',
    instructor: 'Alex Instructor',
    location: 'Main Pool',
    schedule: 'Mon 2026-07-06',
    students: studentNames.map(name => ({ name })),
  },
})

describe('attendance front layout', () => {
  const template = getAttendanceTemplate('Splash1')

  it('fits the historical sheet width to the printable page', () => {
    expect(getFrontFit(template)).toBeCloseTo(ATTENDANCE_PRINTABLE.width / (template.sheetWidthPx * 0.75), 8)
    const widths = getFrontColumnWidths(template)
    expect(widths.header + widths.skills.reduce((sum, width) => sum + width, 0)).toBeCloseTo(ATTENDANCE_PRINTABLE.width, 8)
  })

  it('uses both historical rotation offsets', () => {
    expect(getRotatedHeadingPosition(template)).toBeCloseTo(
      (template.rotateTopPx + template.rotateTranslatePx) * 0.75 * getFrontFit(template),
      8,
    )
  })

  it('does not synthesize a row for an empty roster', () => {
    const model = buildAttendanceFrontModel(attendanceItem([]), template)
    expect(model.students).toEqual([])
    expect(model.naturalHeight).toBe(model.headerHeight)
  })

  it('only reduces vertical density when a paired fragment is too tall', () => {
    expect(getPairedDensityScale(ATTENDANCE_PAIR.slotHeight - 1)).toBe(1)
    expect(getPairedDensityScale(ATTENDANCE_PAIR.slotHeight * 2)).toBe(0.5)

    const item = attendanceItem(Array.from({ length: 20 }, (_, index) => `Student ${index + 1}`))
    const single = buildAttendanceFrontModel(item, template)
    const paired = buildAttendanceFrontModel(item, template, true)
    expect(single.rowHeight).toBeCloseTo(getFrontRowHeight(template), 8)
    expect(paired.densityScale).toBeLessThan(1)
    expect(paired.headerHeight + paired.students.length * paired.rowHeight).toBeCloseTo(ATTENDANCE_PAIR.slotHeight, 8)
  })

  it('keeps the complete private catalog in its dedicated three-column model', () => {
    const privatePage = getAttendanceTemplate('SplashPrivate').backPage
    expect(privatePage.kind).toBe('private-catalog')
    const single = buildAttendanceBackModel(privatePage)
    const paired = buildAttendanceBackModel(privatePage, true)

    expect(single.kind).toBe('private-catalog')
    expect(single.columns.map(column => column.length)).toEqual([6, 4, 7])
    expect(single.blockCount).toBe(17)
    expect(single.densityScale).toBe(1)
    expect(paired.densityScale).toBeLessThan(1)
  })
})

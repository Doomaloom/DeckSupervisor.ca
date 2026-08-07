import { describe, expect, it } from 'vitest'
import { attendanceTemplates, getAttendanceTemplate } from './attendanceTemplates'
import { groupAttendanceItems } from './AttendanceDocument'
import type { AttendancePdfItem } from '../types'

const item = (code: string, template = 'Splash1'): AttendancePdfItem => ({
  template,
  roster: {
    code,
    level: template,
    serviceName: template,
    time: '9:00 AM',
    instructor: 'Instructor',
    location: 'Pool',
    schedule: 'Mon 2026-01-01',
    students: [{ name: 'Student' }],
  },
})

describe('attendance template catalog', () => {
  it('contains all 23 migrated templates', () => {
    expect(attendanceTemplates).toHaveLength(23)
    expect(new Set(attendanceTemplates.map(template => template.key)).size).toBe(23)
    expect(attendanceTemplates.every(template => template.columns.length > 0)).toBe(true)
    expect(attendanceTemplates.every(template => template.columns.every(column => column.widthPt > 0))).toBe(true)
    const assessmentTemplates = attendanceTemplates.filter(template => template.backPage.kind === 'assessment')
    expect(assessmentTemplates).toHaveLength(22)
    expect(assessmentTemplates.every(template => template.backPage.columns.length === 3)).toBe(true)
    expect(assessmentTemplates.every(template => template.backPage.columns.every(column => column.length > 0))).toBe(true)
    expect(assessmentTemplates.every(template => template.backPage.naturalHeightPt > 0)).toBe(true)
  })

  it('retains rich headings, criteria markers, and line boundaries', () => {
    const assessmentTemplates = attendanceTemplates.filter(template => template.backPage.kind === 'assessment')
    const blocks = assessmentTemplates.flatMap(template => template.backPage.columns.flat())
    const lines = blocks.flatMap(block => block.lines)

    expect(blocks.every(block => block.lines.length > 0)).toBe(true)
    expect(lines.some(line => line.spans.some(span => span.bold))).toBe(true)
    expect(lines.some(line => line.marker === 'bullet')).toBe(true)
    expect(lines.some(line => line.marker === 'dash')).toBe(true)
  })

  it('falls back to Splash Fitness and preserves the private catalog distribution', () => {
    expect(getAttendanceTemplate('missing').key).toBe('SplashFitness')
    const privateTemplate = getAttendanceTemplate('SplashPrivate')
    expect(privateTemplate.backPage.kind).toBe('private-catalog')
    if (privateTemplate.backPage.kind !== 'private-catalog') return

    expect(privateTemplate.backPage.columns.map(column => column.length)).toEqual([6, 4, 7])
    expect(privateTemplate.backPage.columns.flat()).toHaveLength(17)
    expect(privateTemplate.backPage.columns[0][0].title).toBe('Splash 1')
    expect(privateTemplate.backPage.columns[2].at(-1)?.title).toBe('Little Splash 5')
    expect(privateTemplate.backPage.columns.flat().every(block => block.entries.length > 0)).toBe(true)
  })

  it('pairs only adjacent rosters with the same code', () => {
    expect(groupAttendanceItems([item('A'), item('A'), item('B'), item('C'), item('C')]).map(group => group.length)).toEqual([2, 1, 2])
  })
})

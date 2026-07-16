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
    expect(attendanceTemplates.every(template => template.skills.length > 0)).toBe(true)
    expect(attendanceTemplates.every(template => template.backSections.length > 0)).toBe(true)
  })

  it('falls back to Splash Fitness and identifies the compact private sheet', () => {
    expect(getAttendanceTemplate('missing').key).toBe('SplashFitness')
    expect(getAttendanceTemplate('SplashPrivate').compactBackPage).toBe(true)
  })

  it('pairs only adjacent rosters with the same code', () => {
    expect(groupAttendanceItems([item('A'), item('A'), item('B'), item('C'), item('C')]).map(group => group.length)).toEqual([2, 1, 2])
  })
})

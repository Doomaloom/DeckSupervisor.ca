import { describe, expect, it } from 'vitest'
import type { AttendancePdfItem } from '../types'
import { groupAttendanceItems } from './attendanceModel'

const item = (code: string): AttendancePdfItem => ({
  template: 'Splash1',
  roster: { code, level: '', serviceName: '', time: '', instructor: '', location: '', schedule: '', students: [] },
})

describe('attendance grouping', () => {
  it('pairs only adjacent matching course codes', () => {
    expect(groupAttendanceItems([item('A'), item('A'), item('B'), item('A')]).map(group => group.length)).toEqual([2, 1, 1])
  })
})

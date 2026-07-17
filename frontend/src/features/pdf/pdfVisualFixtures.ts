import type { AttendancePdfItem, AttendancePdfRequest } from './types'
import { LEGACY_ATTENDANCE_TEMPLATE_KEYS } from './attendance/legacyAttendanceTemplates'

const roster = (template: string, code = '00123') => ({
  code, level: template, serviceName: template, time: '9:00 AM', instructor: 'Alex Instructor',
  location: 'Main Pool', schedule: 'Mon 2026-07-06',
  students: [{ name: 'Avery Adams' }, { name: 'Blair Brown' }, { name: 'Casey Chen' }],
})

const item = (template: string, code?: string, includeStudents = true): AttendancePdfItem => ({
  template,
  roster: { ...roster(template, code), students: includeStudents ? roster(template, code).students : [] },
})

export const attendanceVisualFixtures: Record<string, AttendancePdfRequest> = Object.fromEntries([
  ...LEGACY_ATTENDANCE_TEMPLATE_KEYS.map(template => [
    `attendance-${template}`,
    { template, session: 'Summer 2026', filename: `attendance-${template}`, title: template, roster: roster(template) },
  ]),
  ['attendance-paired', { session: 'Summer 2026', filename: 'attendance-paired', title: 'Paired attendance', rosters: [item('LittleSplash1', 'PAIR', false), item('LittleSplash2', 'PAIR', false)] }],
  ['attendance-odd', { session: 'Summer 2026', filename: 'attendance-odd', title: 'Odd attendance', rosters: [item('LittleSplash1', 'PAIR', false), item('LittleSplash2', 'PAIR', false), item('Splash3', 'ODD')] }],
])

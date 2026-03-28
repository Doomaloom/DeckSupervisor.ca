import { beforeEach, describe, expect, it } from 'vitest'
import { setExtractedClassesForSession } from '../../../lib/extractedClassesStorage'
import {
  getCustomRosterDayKey,
  setCustomRostersForDay,
  setScheduleForDay,
  setStudentsForDay,
} from '../../../lib/storage'
import { setStorageScope } from '../../../lib/storageScope'
import type { FormatOptions, Student } from '../../../types/app'
import {
  buildBaseSchematicPayload,
  buildMasterlistRequestBody,
  buildSchematicPrefetchPayloads,
} from './printPayloads'

const defaultFormatOptions: FormatOptions = {
  time_headers: false,
  instructor_headers: false,
  course_headers: false,
  borders: false,
  center_time: false,
  bold_time: false,
  center_course: false,
  bold_course: false,
}

const session = {
  id: 'session-1',
  team_id: null,
  created_by: 'user-1',
  session_day: 'Mo',
  session_season: 'Spring',
  session_year: 2026,
  start_date: '2026-03-23',
  end_date: '2026-05-18',
  location: 'Main Pool',
  session_start_time24: '09:00',
  session_end_time24: '11:00',
  instructors: [],
}

function makeStudent(overrides: Partial<Student>): Student {
  return {
    id: overrides.id ?? 'student-1',
    service_name: overrides.service_name ?? 'Splash 1',
    code: overrides.code ?? 'C1',
    day: overrides.day ?? 'Mo',
    time: overrides.time ?? '9:00 AM - 9:30 AM',
    location: overrides.location ?? 'Main Pool',
    schedule: overrides.schedule ?? 'Weekly',
    name: overrides.name ?? 'Alice',
    phone: overrides.phone ?? '555-1111',
    instructor: overrides.instructor ?? 'Coach A',
    level: overrides.level ?? 'Splash 1',
    waitlist: overrides.waitlist ?? false,
  }
}

describe('printPayloads', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    setStorageScope('guest')
  })

  it('builds masterlist payloads for custom rosters using original class codes', () => {
    setStudentsForDay('Mo', [
      makeStudent({ id: 'student-1', code: 'C1', name: 'Alice' }),
      makeStudent({ id: 'student-2', code: 'C2', name: 'Bob', instructor: 'Coach B' }),
    ])
    setCustomRostersForDay(getCustomRosterDayKey('Mo', 'session-1', true), [
      {
        id: 'custom-1',
        serviceName: 'Merged Group',
        instructor: 'Coach Z',
        sourceCodes: ['C1', 'C2'],
        studentIds: ['student-1', 'student-2'],
        createdAt: '2026-03-28T09:00:00.000Z',
      },
    ])

    const payload = buildMasterlistRequestBody({
      day: 'Mo',
      sessionId: 'session-1',
      session,
      options: defaultFormatOptions,
    })

    expect(payload?.sessionName).toBe('Monday Spring 2026')
    expect(payload?.rosters).toEqual([
      {
        code: 'C1',
        serviceName: 'Splash 1',
        day: 'Mo',
        time: '9:00 AM - 9:30 AM',
        location: 'Main Pool',
        schedule: 'Weekly',
        instructor: 'Coach A',
        students: [
          {
            name: 'Alice',
            phone: '555-1111',
            instructor: 'Coach A',
            level: 'Splash 1',
          },
        ],
      },
      {
        code: 'C2',
        serviceName: 'Splash 1',
        day: 'Mo',
        time: '9:00 AM - 9:30 AM',
        location: 'Main Pool',
        schedule: 'Weekly',
        instructor: 'Coach B',
        students: [
          {
            name: 'Bob',
            phone: '555-1111',
            instructor: 'Coach B',
            level: 'Splash 1',
          },
        ],
      },
      {
        code: 'C1',
        serviceName: 'Merged Group',
        day: 'Mo',
        time: '9:00 AM - 9:30 AM',
        location: 'Main Pool',
        schedule: 'Weekly',
        instructor: 'Coach Z',
        students: [
          {
            name: 'Alice',
            phone: '555-1111',
            instructor: 'Coach A',
            level: 'Splash 1',
          },
        ],
      },
      {
        code: 'C2',
        serviceName: 'Merged Group',
        day: 'Mo',
        time: '9:00 AM - 9:30 AM',
        location: 'Main Pool',
        schedule: 'Weekly',
        instructor: 'Coach Z',
        students: [
          {
            name: 'Bob',
            phone: '555-1111',
            instructor: 'Coach B',
            level: 'Splash 1',
          },
        ],
      },
    ])
  })

  it('builds the base schematic payload from the saved layout and extracted counts', () => {
    setStudentsForDay('Mo', [
      makeStudent({ id: 'student-1', code: 'C1', instructor: 'Coach A' }),
      makeStudent({ id: 'student-2', code: 'C2', instructor: 'Coach B' }),
    ])
    setScheduleForDay('Mo', {
      codes: ['C2', 'C1'],
      instructors: ['Coach B', 'Coach A'],
    })
    setExtractedClassesForSession('session-1', [
      {
        sessionKey: 'session-1',
        dayOfWeek: 'Mo',
        sessionSeason: 'Spring',
        sessionYear: 2026,
        courseCode: 'C1',
        serviceName: 'Splash 1',
        location: 'Main Pool',
        startTime24: '09:00',
        endTime24: '09:30',
        durationMinutes: 30,
        studentCount: 8,
        waitlistCount: 0,
      },
      {
        sessionKey: 'session-1',
        dayOfWeek: 'Mo',
        sessionSeason: 'Spring',
        sessionYear: 2026,
        courseCode: 'C2',
        serviceName: 'Splash 1',
        location: 'Main Pool',
        startTime24: '09:00',
        endTime24: '09:30',
        durationMinutes: 30,
        studentCount: 5,
        waitlistCount: 0,
      },
    ])

    const payload = buildBaseSchematicPayload({
      day: 'Mo',
      sessionId: 'session-1',
      session,
    })

    expect(payload).not.toBeNull()
    expect(payload?.orientation).toBe('portrait')
    expect(payload?.instructors).toEqual(['Coach B', 'Coach A'])
    expect(payload?.columns.map(column => column.map(course => course.code))).toEqual([['C2'], ['C1']])
    expect(payload?.columns[1][0]?.studentCount).toBe(8)
  })

  it('builds portrait and landscape prefetch payloads for the base schematic and each printable instructor', () => {
    setStudentsForDay('Mo', [
      makeStudent({ id: 'student-1', code: 'C1', instructor: 'Coach A' }),
      makeStudent({ id: 'student-2', code: 'C2', instructor: 'Coach B' }),
    ])
    setCustomRostersForDay(getCustomRosterDayKey('Mo', 'session-1', true), [
      {
        id: 'custom-2',
        serviceName: 'Custom Group',
        instructor: 'Coach C',
        sourceCodes: ['C1'],
        studentIds: ['student-1'],
        createdAt: '2026-03-28T09:00:00.000Z',
      },
    ])

    const payloads = buildSchematicPrefetchPayloads({
      day: 'Mo',
      sessionId: 'session-1',
      session,
    })

    expect(payloads).toHaveLength(8)
    expect(payloads.filter(entry => !entry.payload.highlightInstructor)).toHaveLength(2)
    expect(payloads.filter(entry => entry.payload.orientation === 'portrait')).toHaveLength(4)
    expect(payloads.filter(entry => entry.payload.orientation === 'landscape')).toHaveLength(4)
    expect(
      payloads
        .filter(entry => entry.payload.highlightInstructor)
        .map(entry => `${entry.payload.orientation}:${entry.payload.selectedInstructor}`),
    ).toEqual([
      'portrait:Coach A',
      'portrait:Coach B',
      'portrait:Coach C',
      'landscape:Coach A',
      'landscape:Coach B',
      'landscape:Coach C',
    ])
  })
})

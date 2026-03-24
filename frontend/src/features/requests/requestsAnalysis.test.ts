import { describe, expect, it } from 'vitest'
import type { ClassRoster } from '../../types/app'
import {
  analyzeInstructorRequests,
  normalizeDayToken,
  normalizePersonName,
  parseRequestsCsv,
} from './requestsAnalysis'

const classRosters: ClassRoster[] = [
  {
    code: '1001',
    serviceName: 'Splash 2A',
    day: 'Mo',
    time: '09:00-09:30',
    location: 'Pool A',
    schedule: 'Schedule 1',
    instructor: '',
    students: [
      { name: 'Jane Doe', phone: '5551112222', instructor: '', level: 'Splash 2A' },
      { name: 'John Smith', phone: '5551113333', instructor: '', level: 'Splash 2A' },
    ],
  },
  {
    code: '1002',
    serviceName: 'Splash 3',
    day: 'Wednesday',
    time: '10:00-10:30',
    location: 'Pool B',
    schedule: 'Schedule 2',
    instructor: '',
    students: [{ name: 'Jane Doe', phone: '5551112222', instructor: '', level: 'Splash 3' }],
  },
]

describe('requestsAnalysis', () => {
  it('normalizes person names and day tokens', () => {
    expect(normalizePersonName(' Jane Doe (Parent) ')).toBe('jane doe')
    expect(normalizeDayToken('Tues')).toBe('Tu')
    expect(normalizeDayToken('Mo Tu We Th Fr')).toBe('Mo,Tu,We,Th,Fr')
  })

  it('parses request CSVs with alternate headers and header rows not at the top', () => {
    const rows = parseRequestsCsv(
      'ignored\nStudent First Name,Student Last Name,Requested Staff,Requested Day\nJane,Doe,Coach Amy,Monday/Wednesday',
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      firstName: 'Jane',
      lastName: 'Doe',
      requestedInstructor: 'Coach Amy',
      requestedDays: ['Mo', 'We'],
    })
  })

  it('analyzes instructor requests into day summaries and unmatched rows', () => {
    const requests = parseRequestsCsv(
      'First Name,Last Name,Instructor Requested,Day Of Week\nJane,Doe,Coach Amy,Monday\nJane,Doe,Coach Amy,Wednesday\nMissing,Student,Coach Amy,Friday\nJohn,Smith,,Monday',
    )

    const result = analyzeInstructorRequests(requests, classRosters)

    expect(result.totalRequests).toBe(4)
    expect(result.totalDayEntries).toBe(3)
    expect(result.matchedDayEntries).toBe(2)
    expect(result.unmatchedDayEntries).toBe(1)
    expect(result.matchedStudentCount).toBe(2)
    expect(result.days).toHaveLength(2)
    expect(result.days[0]).toMatchObject({
      day: 'Mo',
      classes: [
        {
          eventId: '1001',
          matchedRequestCount: 1,
          uniqueStudentCount: 1,
          instructorCounts: [{ instructor: 'Coach Amy', count: 1 }],
        },
      ],
    })
    expect(result.unmatched.map(entry => entry.reason)).toEqual([
      'No registered class found for this student on the requested day',
      'Missing requested instructor',
    ])
  })
})

import { describe, expect, it } from 'vitest'
import type { ClassRoster } from '../../types/app'
import type { FullTimeRequestEntry } from './types'
import {
  attemptAutoAssignFullTimeRequests,
  buildSchematicClassKey,
  getInstructorPeriodsForDay,
  parseFullTimeRequestCsv,
  syncFullTimeRostersWithRequests,
} from './fullTimePlanning'

const rosterClasses: ClassRoster[] = [
  {
    code: '1001',
    serviceName: 'Splash 2A',
    day: 'Mo',
    time: '09:00-09:30',
    location: 'Pool A',
    schedule: 'Morning',
    instructor: 'Existing Coach',
    students: [
      { name: 'Alice Smith', phone: '(555) 111-2222', instructor: 'Existing Coach', level: 'Splash 2A' },
      { name: 'Ben Smith', phone: '(555) 111-2222', instructor: 'Existing Coach', level: 'Splash 2A' },
      { name: 'Chris Green', phone: '(555) 333-4444', instructor: 'Existing Coach', level: 'Splash 2A' },
    ],
  },
  {
    code: '1002',
    serviceName: 'Splash 3',
    day: 'Mo',
    time: '10:00-10:30',
    location: 'Pool A',
    schedule: 'Morning',
    instructor: '',
    students: [{ name: 'Janet Doe', phone: '555-666-7777', instructor: '', level: 'Splash 3' }],
  },
]

function makeEntry(overrides: Partial<FullTimeRequestEntry>): FullTimeRequestEntry {
  return {
    id: overrides.id ?? 'request-1',
    firstName: overrides.firstName ?? 'Alice',
    lastName: overrides.lastName ?? 'Smith',
    phone: overrides.phone ?? '5551112222',
    instructor: overrides.instructor ?? 'Coach Amy',
    accommodated: overrides.accommodated ?? false,
    reason: overrides.reason ?? '',
    reasonNote: overrides.reasonNote ?? '',
    matchedDay: overrides.matchedDay ?? '',
    matchedCode: overrides.matchedCode ?? '',
    matchedServiceName: overrides.matchedServiceName ?? '',
    matchedTime: overrides.matchedTime ?? '',
    matchedBy: overrides.matchedBy ?? '',
    matchedRequestCount: overrides.matchedRequestCount ?? 0,
    requiresManualReview: overrides.requiresManualReview ?? false,
    manualReviewNote: overrides.manualReviewNote ?? '',
    schematicConflict: overrides.schematicConflict ?? false,
    schematicConflictNote: overrides.schematicConflictNote ?? '',
  }
}

describe('fullTimePlanning', () => {
  it('parses full-time request CSVs and rejects missing required columns', () => {
    expect(
      parseFullTimeRequestCsv(
        'First Name,Last Name,Phone Number,Instructor Name\nAlice,Smith,5551112222,Coach Amy',
      ),
    ).toEqual([
      {
        firstName: 'Alice',
        lastName: 'Smith',
        phone: '5551112222',
        instructor: 'Coach Amy',
      },
    ])

    expect(() => parseFullTimeRequestCsv('First Name,Last Name\nAlice,Smith')).toThrow(
      'The requests CSV is missing required columns: Phone Number, Instructor Name',
    )
  })

  it('matches unique phone numbers without manual review', () => {
    const result = attemptAutoAssignFullTimeRequests([makeEntry({ phone: '5553334444', firstName: 'Chris', lastName: 'Green' })], rosterClasses)

    expect(result.entries[0]).toMatchObject({
      accommodated: true,
      matchedCode: '1001',
      matchedBy: 'phone',
      requiresManualReview: false,
    })
  })

  it('requires first-name confirmation for sibling phone numbers', () => {
    const result = attemptAutoAssignFullTimeRequests([makeEntry({ firstName: 'Ben' })], rosterClasses)

    expect(result.entries[0]).toMatchObject({
      accommodated: true,
      matchedCode: '1001',
      matchedBy: 'phone',
      requiresManualReview: false,
    })
  })

  it('falls back to exact or fuzzy name matches and marks them for manual review when phone matching fails', () => {
    const exactResult = attemptAutoAssignFullTimeRequests(
      [makeEntry({ firstName: 'Alice', lastName: 'Smith', phone: '0000000000' })],
      rosterClasses,
    )
    const fuzzyResult = attemptAutoAssignFullTimeRequests(
      [makeEntry({ firstName: 'Janet', lastName: 'Do', phone: '9999999999' })],
      rosterClasses,
    )

    expect(exactResult.entries[0]).toMatchObject({
      accommodated: true,
      matchedCode: '1001',
      matchedBy: 'name',
      requiresManualReview: true,
    })
    expect(exactResult.entries[0].manualReviewNote).toContain('Phone number did not match')

    expect(fuzzyResult.entries[0]).toMatchObject({
      accommodated: true,
      matchedCode: '1002',
      matchedBy: 'name',
      requiresManualReview: true,
    })
    expect(fuzzyResult.entries[0].manualReviewNote).toContain('fuzzy-matched')
  })

  it('marks unmatched requests as student_not_registered', () => {
    const result = attemptAutoAssignFullTimeRequests(
      [makeEntry({ firstName: 'Nope', lastName: 'Missing', phone: '1231231234' })],
      rosterClasses,
    )

    expect(result.entries[0]).toMatchObject({
      accommodated: false,
      reason: 'student_not_registered',
      matchedCode: '',
    })
  })

  it('aggregates request counts per class plus requested instructor and syncs roster instructors from strongest vote', () => {
    const result = attemptAutoAssignFullTimeRequests(
      [
        makeEntry({ id: '1', instructor: 'Coach Amy', firstName: 'Alice' }),
        makeEntry({ id: '2', instructor: 'Coach Amy', firstName: 'Ben' }),
        makeEntry({ id: '3', instructor: 'Coach Beth', firstName: 'Chris', phone: '5553334444', lastName: 'Green' }),
      ],
      rosterClasses,
    )

    expect(result.entries.map(entry => entry.matchedRequestCount)).toEqual([2, 2, 1])
    expect(result.rosters[0].instructor).toBe('Coach Amy')
    expect(result.rosters[0].students.every(student => student.instructor === 'Coach Amy')).toBe(true)
  })

  it('keeps schematic-backed requests matched but highlight-only without changing roster instructors', () => {
    const schematicClassKeys = new Set([buildSchematicClassKey('Mo', 'Pool A', '1001')])
    const result = attemptAutoAssignFullTimeRequests(
      [makeEntry({ id: '1', instructor: 'Coach Amy', firstName: 'Alice' })],
      rosterClasses,
      schematicClassKeys,
    )

    expect(result.entries[0]).toMatchObject({
      accommodated: true,
      matchedCode: '1001',
      schematicConflict: true,
    })
    expect(result.entries[0].schematicConflictNote).toContain('highlighted only')
    expect(result.rosters[0].instructor).toBe('Existing Coach')
    expect(result.rosters[0].students.every(student => student.instructor === 'Existing Coach')).toBe(true)
  })

  it('ignores schematic-conflict request votes while syncing non-conflicting roster instructors', () => {
    const nextRosters = syncFullTimeRostersWithRequests(
      [
        makeEntry({
          id: '1',
          instructor: 'Coach Amy',
          accommodated: true,
          matchedDay: 'Mo',
          matchedCode: '1001',
          schematicConflict: true,
        }),
        makeEntry({
          id: '2',
          firstName: 'Janet',
          lastName: 'Doe',
          phone: '5556667777',
          instructor: 'Coach Beth',
          accommodated: true,
          matchedDay: 'Mo',
          matchedCode: '1002',
        }),
      ],
      rosterClasses,
    )

    expect(nextRosters[0].instructor).toBe('Existing Coach')
    expect(nextRosters[1].instructor).toBe('Coach Beth')
  })

  it('returns all-day or am/pm instructor periods based on common breaks', () => {
    expect(
      getInstructorPeriodsForDay([
        [{ startMinutes: 540, endMinutes: 570 }, { startMinutes: 585, endMinutes: 615 }],
        [{ startMinutes: 540, endMinutes: 570 }, { startMinutes: 585, endMinutes: 615 }],
      ]),
    ).toEqual([{ key: 'allDay', label: 'All Day Instructors', splitMinute: null }])

    const splitPeriods = getInstructorPeriodsForDay([
      [{ startMinutes: 540, endMinutes: 570 }, { startMinutes: 630, endMinutes: 660 }],
      [{ startMinutes: 540, endMinutes: 570 }, { startMinutes: 630, endMinutes: 660 }],
    ])

    expect(splitPeriods).toHaveLength(2)
    expect(splitPeriods[0].key).toBe('am')
    expect(splitPeriods[1].key).toBe('pm')
  })
})

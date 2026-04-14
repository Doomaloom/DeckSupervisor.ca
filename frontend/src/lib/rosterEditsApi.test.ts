import { describe, expect, it } from 'vitest'
import type { Student } from '../types/app'
import { applyPersistedLevelEdits, buildPersistedStudentLevelEditMap } from './rosterEditsApi'

const students: Student[] = [
  {
    id: '1',
    service_name: 'Splash 2A',
    code: '1001',
    day: 'Mo',
    time: '09:00-09:30',
    location: 'Pool A',
    schedule: 'Morning',
    name: 'Student One',
    phone: '5551111111',
    instructor: 'Coach Amy',
    level: 'Splash 2A',
    waitlist: false,
  },
  {
    id: '2',
    service_name: 'Splash 2A',
    code: '1001',
    day: 'Mo',
    time: '09:00-09:30',
    location: 'Pool A',
    schedule: 'Morning',
    name: 'Student Two',
    phone: '5551112222',
    instructor: 'Coach Amy',
    level: 'Splash 2A',
    waitlist: false,
  },
]

describe('rosterEditsApi', () => {
  it('builds a roster toggle map from persisted student edits', () => {
    expect(
      buildPersistedStudentLevelEditMap([
        { code: '1001', student_name_hash: 'hash-one', level: 'Splash 3' },
        { code: '1001', student_name_hash: 'hash-two', level: 'Splash 4' },
        { code: '1002', student_name_hash: 'hash-three', level: 'Splash 1' },
      ]),
    ).toEqual({
      '1001': true,
      '1002': true,
    })
  })

  it('applies roster-level edits when present', () => {
    const nameHashMap = new Map([
      ['Student One', 'hash-one'],
      ['Student Two', 'hash-two'],
    ])

    expect(
      applyPersistedLevelEdits(
        students,
        [{ code: '1001', level: 'Splash 3' }],
        [],
        nameHashMap,
      ),
    ).toEqual([
      { ...students[0], level: 'Splash 3' },
      { ...students[1], level: 'Splash 3' },
    ])
  })

  it('lets student-level edits override roster-level edits', () => {
    const nameHashMap = new Map([
      ['Student One', 'hash-one'],
      ['Student Two', 'hash-two'],
    ])

    expect(
      applyPersistedLevelEdits(
        students,
        [{ code: '1001', level: 'Splash 3' }],
        [{ code: '1001', student_name_hash: 'hash-two', level: 'Splash 4' }],
        nameHashMap,
      ),
    ).toEqual([
      { ...students[0], level: 'Splash 3' },
      { ...students[1], level: 'Splash 4' },
    ])
  })
})

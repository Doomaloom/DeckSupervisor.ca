import { describe, expect, it } from 'vitest'
import type { Course } from '../types'
import { createRequestAwareLayout } from './layout'

function makeCourse(overrides: Partial<Course>): Course {
  const startMinutes = overrides.startMinutes ?? 540
  const endMinutes = overrides.endMinutes ?? 570
  return {
    code: overrides.code ?? '1001',
    level: overrides.level ?? 'Splash 2A',
    runningTime: overrides.runningTime ?? endMinutes - startMinutes,
    startTime: overrides.startTime ?? '09:00',
    endTime: overrides.endTime ?? '09:30',
    startMinutes,
    endMinutes,
    studentCount: overrides.studentCount ?? 4,
    studentName: overrides.studentName,
    assignedInstructor: overrides.assignedInstructor,
    isRequested: overrides.isRequested,
    isLockedToInstructor: overrides.isLockedToInstructor,
  }
}

describe('createRequestAwareLayout', () => {
  it('places non-overlapping flexible classes into stable time-ordered columns', () => {
    const layout = createRequestAwareLayout([
      makeCourse({ code: 'A', startTime: '09:00', endTime: '09:30', startMinutes: 540, endMinutes: 570 }),
      makeCourse({ code: 'B', startTime: '09:30', endTime: '10:00', startMinutes: 570, endMinutes: 600 }),
      makeCourse({ code: 'C', startTime: '09:00', endTime: '09:30', startMinutes: 540, endMinutes: 570 }),
    ])

    expect(layout.columns).toHaveLength(2)
    expect(layout.columns[0].map(course => course.code)).toEqual(['A', 'B'])
    expect(layout.columns[1].map(course => course.code)).toEqual(['C'])
  })

  it('prefers an existing locked instructor lane when a requested course fits', () => {
    const layout = createRequestAwareLayout([
      makeCourse({
        code: 'A',
        startTime: '09:00',
        endTime: '09:30',
        startMinutes: 540,
        endMinutes: 570,
        assignedInstructor: 'Coach Amy',
        isRequested: true,
        isLockedToInstructor: true,
      }),
      makeCourse({
        code: 'B',
        startTime: '09:30',
        endTime: '10:00',
        startMinutes: 570,
        endMinutes: 600,
        assignedInstructor: 'Coach Amy',
        isRequested: true,
        isLockedToInstructor: true,
      }),
    ])

    expect(layout.columns).toHaveLength(1)
    expect(layout.columns[0].map(course => course.code)).toEqual(['A', 'B'])
    expect(layout.lockedInstructors).toEqual(['Coach Amy'])
  })

  it('restores saved columns without collapsing a later instructor lane', () => {
    const layout = createRequestAwareLayout(
      [
        makeCourse({ code: 'A', startTime: '09:00', endTime: '09:30', startMinutes: 540, endMinutes: 570 }),
        makeCourse({ code: 'B', startTime: '09:00', endTime: '09:30', startMinutes: 540, endMinutes: 570 }),
        makeCourse({ code: 'C', startTime: '09:00', endTime: '09:30', startMinutes: 540, endMinutes: 570 }),
        makeCourse({ code: 'D', startTime: '09:00', endTime: '09:30', startMinutes: 540, endMinutes: 570 }),
        makeCourse({ code: 'E', startTime: '09:30', endTime: '10:00', startMinutes: 570, endMinutes: 600 }),
      ],
      {
        codes: ['A', 'B', 'C', 'D', 'E'],
        instructors: ['Inst 1', 'Inst 2', 'Inst 3', 'Inst 4', 'Inst 5'],
      },
    )

    expect(layout.columns).toHaveLength(5)
    expect(layout.columns.map(column => column.map(course => course.code))).toEqual([['A'], ['B'], ['C'], ['D'], ['E']])
    expect(layout.instructors).toEqual(['Inst 1', 'Inst 2', 'Inst 3', 'Inst 4', 'Inst 5'])
  })

  it('preserves saved lanes when stored data contains missing courses', () => {
    const layout = createRequestAwareLayout(
      [
        makeCourse({ code: 'A', startTime: '09:00', endTime: '09:30', startMinutes: 540, endMinutes: 570 }),
        makeCourse({ code: 'B', startTime: '09:00', endTime: '09:30', startMinutes: 540, endMinutes: 570 }),
        makeCourse({ code: 'C', startTime: '09:30', endTime: '10:00', startMinutes: 570, endMinutes: 600 }),
      ],
      {
        codes: ['A', 'MISSING', 'B'],
        instructors: ['Inst 1', 'Inst stale', 'Inst 2'],
      },
    )

    expect(layout.columns).toHaveLength(3)
    expect(layout.columns.map(column => column.map(course => course.code))).toEqual([['A', 'C'], [], ['B']])
    expect(layout.instructors).toEqual(['Inst 1', 'Inst stale', 'Inst 2'])
  })

  it('keeps the locked instructor header when restoring a saved lane', () => {
    const layout = createRequestAwareLayout(
      [
        makeCourse({
          code: 'A',
          startTime: '09:00',
          endTime: '09:30',
          startMinutes: 540,
          endMinutes: 570,
          assignedInstructor: 'Coach Amy',
          isRequested: true,
          isLockedToInstructor: true,
        }),
      ],
      {
        codes: ['A'],
        instructors: ['Wrong Name'],
      },
    )

    expect(layout.columns).toHaveLength(1)
    expect(layout.columns[0].map(course => course.code)).toEqual(['A'])
    expect(layout.instructors).toEqual(['Coach Amy'])
    expect(layout.lockedInstructors).toEqual(['Coach Amy'])
  })
})

import { describe, expect, it } from 'vitest'
import type { Student } from '../../types/app'
import {
  buildEmployeeReportCardSummaries,
  buildStudentReportCardSummary,
  normalizeInstructorName,
  normalizeLevel,
} from './utils'

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
    level: 'Splash 3',
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
    level: 'Splash 3',
    waitlist: false,
  },
  {
    id: '3',
    service_name: 'Splash 4',
    code: '1002',
    day: 'Mo',
    time: '10:00-10:30',
    location: 'Pool B',
    schedule: 'Morning',
    name: 'Student Three',
    phone: '5551113333',
    instructor: 'Coach Beth',
    level: 'Splash 5',
    waitlist: false,
  },
  {
    id: '4',
    service_name: 'Splash 5',
    code: '1002',
    day: 'Mo',
    time: '10:00-10:30',
    location: 'Pool B',
    schedule: 'Morning',
    name: 'Student Four',
    phone: '5551114444',
    instructor: '',
    level: 'Splash 5',
    waitlist: false,
  },
]

describe('report card utils', () => {
  it('prefers edited student levels and normalizes blank instructor names', () => {
    expect(normalizeLevel(students[0])).toBe('Splash 3')
    expect(
      normalizeLevel({
        ...students[0],
        level: 'LittleSplash3',
      }),
    ).toBe('Little Splash 3')
    expect(
      normalizeLevel({
        ...students[0],
        level: 'Little Splash 3',
      }),
    ).toBe('Little Splash 3')
    expect(normalizeInstructorName('  ')).toBe('Unassigned')
  })

  it('builds report card summaries from effective student levels', () => {
    const summary = buildStudentReportCardSummary([
      ...students,
      {
        ...students[0],
        id: '5',
        name: 'Student Five',
        level: 'LittleSplash3',
      },
      {
        ...students[0],
        id: '6',
        name: 'Student Six',
        level: 'Little Splash 3',
      },
    ])

    expect(summary.totalStudents).toBe(6)
    expect(summary.lessonBlockTotals).toEqual([
      { level: 'Little Splash 3', count: 2 },
      { level: 'Splash 3', count: 2 },
      { level: 'Splash 5', count: 2 },
    ])
    expect(summary.instructorSummaries).toEqual([
      {
        name: 'Coach Amy',
        total: 4,
        levels: [
          { level: 'Little Splash 3', count: 2 },
          { level: 'Splash 3', count: 2 },
        ],
      },
      {
        name: 'Coach Beth',
        total: 1,
        levels: [{ level: 'Splash 5', count: 1 }],
      },
      {
        name: 'Unassigned',
        total: 1,
        levels: [{ level: 'Splash 5', count: 1 }],
      },
    ])
  })

  it('aggregates employee totals by instructor and level', () => {
    expect(
      buildEmployeeReportCardSummaries([
        { instructor: 'Coach Amy', number_of_report_cards: 2 },
        { instructor: 'Coach Amy', number_of_report_cards: 1 },
        { instructor: 'Coach Beth', number_of_report_cards: 4 },
        { instructor: '', number_of_report_cards: 1 },
      ]),
    ).toEqual([
      {
        name: 'Coach Beth',
        total: 4,
        levels: [],
      },
      {
        name: 'Coach Amy',
        total: 3,
        levels: [],
      },
      {
        name: 'Unassigned',
        total: 1,
        levels: [],
      },
    ])
  })
})

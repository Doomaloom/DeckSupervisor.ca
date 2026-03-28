import { describe, expect, it } from 'vitest'
import type { Student } from '../../../types/app'
import { buildColumns, buildCourses, coursesMatchTime, coursesOverlap } from './courses'

const students: Student[] = [
  {
    id: '1',
    service_name: 'Splash 2A',
    code: '1001',
    day: 'Mo',
    time: '09:00-09:30',
    location: 'Pool A',
    schedule: 'Morning',
    name: 'Alice',
    phone: '5551112222',
    instructor: '',
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
    name: 'Ben',
    phone: '5551113333',
    instructor: '',
    level: 'Splash 2A',
    waitlist: false,
  },
  {
    id: '3',
    service_name: 'Splash 3',
    code: '1002',
    day: 'Mo',
    time: '09:30-10:00',
    location: 'Pool A',
    schedule: 'Morning',
    name: 'Cara',
    phone: '5551114444',
    instructor: '',
    level: 'Splash 3',
    waitlist: false,
  },
  {
    id: '4',
    service_name: 'Splash 2A',
    code: '1001',
    day: 'Mo',
    time: '09:00-09:30',
    location: 'Pool A',
    schedule: 'Morning',
    name: 'Waitlisted Wendy',
    phone: '5551115555',
    instructor: '',
    level: 'Splash 2A',
    waitlist: true,
  },
]

describe('course utils', () => {
  it('builds ordered courses with request metadata and aggregated student counts', () => {
    const courses = buildCourses(students, new Map([['1001', 'Coach Amy']]))

    expect(courses).toHaveLength(2)
    expect(courses[0]).toMatchObject({
      code: '1001',
      studentCount: 2,
      assignedInstructor: 'Coach Amy',
      isRequested: true,
      isLockedToInstructor: true,
    })
    expect(courses[1].code).toBe('1002')
  })

  it('builds time-compatible columns and compares overlaps correctly', () => {
    const courses = buildCourses(students)
    const columns = buildColumns(courses)

    expect(columns).toHaveLength(1)
    expect(coursesMatchTime(courses[0], { ...courses[0] })).toBe(true)
    expect(coursesOverlap(courses[0], courses[1])).toBe(false)
  })

  it('uses the first non-waitlist student name for private lessons', () => {
    const courses = buildCourses([
      {
        id: 'private-1',
        service_name: 'Private Lesson',
        code: 'P1',
        day: 'Mo',
        time: '10:00-10:30',
        location: 'Pool B',
        schedule: 'Morning',
        name: 'Waitlisted Wendy',
        phone: '5551116666',
        instructor: '',
        level: 'Private Lesson',
        waitlist: true,
      },
      {
        id: 'private-2',
        service_name: 'Private Lesson',
        code: 'P1',
        day: 'Mo',
        time: '10:00-10:30',
        location: 'Pool B',
        schedule: 'Morning',
        name: 'Active Alex',
        phone: '5551117777',
        instructor: '',
        level: 'Private Lesson',
        waitlist: false,
      },
    ])

    expect(courses).toHaveLength(1)
    expect(courses[0]).toMatchObject({
      code: 'P1',
      level: 'Private Lesson',
      studentCount: 1,
      studentName: 'Active Alex',
    })
  })
})

import { describe, expect, it } from 'vitest'
import type { Course } from '../types'
import { getCapacity, getCapacityClass, isExceptionClass } from './capacity'

function makeCourse(level: string, studentCount: number): Course {
  return {
    code: '1001',
    level,
    runningTime: 30,
    startTime: '09:00',
    endTime: '09:30',
    startMinutes: 540,
    endMinutes: 570,
    studentCount,
  }
}

describe('capacity utils', () => {
  it('detects exception classes and returns configured capacities', () => {
    expect(isExceptionClass('Private Lesson')).toBe(true)
    expect(isExceptionClass('Splash 2A')).toBe(false)
    expect(getCapacity(makeCourse('Private Lesson', 1))).toBe(1)
    expect(getCapacity(makeCourse('Splash Adult 2', 4))).toBe(8)
    expect(getCapacity(makeCourse('Unknown Level', 4))).toBe(12)
  })

  it('returns the expected capacity class for low, partial, and healthy enrolment', () => {
    expect(getCapacityClass(makeCourse('Splash 2A', 1), 6)).toBe('bg-rose-500 text-white')
    expect(getCapacityClass(makeCourse('Splash 2A', 2), 6)).toBe('bg-amber-500 text-black')
    expect(getCapacityClass(makeCourse('Splash 2A', 4), 6)).toBe('bg-emerald-600 text-white')
  })
})

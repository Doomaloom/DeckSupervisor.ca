import { describe, expect, it } from 'vitest'
import type { Course } from '../types'
import {
  canPlaceCourses,
  canReplaceByStart,
  canSwapSingleCourses,
  findContiguousSwapIndices,
} from './drag'

function makeCourse(code: string, startMinutes: number, endMinutes: number): Course {
  return {
    code,
    level: 'Splash 2A',
    runningTime: endMinutes - startMinutes,
    startTime: `${String(Math.floor(startMinutes / 60)).padStart(2, '0')}:${String(startMinutes % 60).padStart(2, '0')}`,
    endTime: `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`,
    startMinutes,
    endMinutes,
    studentCount: 4,
  }
}

describe('drag utils', () => {
  it('finds contiguous overlapping swap indices only for exact matching blocks', () => {
    const column = [makeCourse('A', 540, 555), makeCourse('B', 555, 570), makeCourse('C', 600, 630)]

    expect(findContiguousSwapIndices(column, makeCourse('X', 540, 570))).toEqual([0, 1])
    expect(findContiguousSwapIndices(column, makeCourse('Y', 545, 570))).toEqual([])
  })

  it('checks replacement by matching start times and overlap rules', () => {
    const column = [makeCourse('A', 540, 570), makeCourse('B', 600, 630)]

    expect(canReplaceByStart(column, makeCourse('X', 540, 585), 0)).toBe(true)
    expect(canReplaceByStart(column, makeCourse('Y', 545, 585), 0)).toBe(false)
  })

  it('allows legal placement and swaps while rejecting overlaps', () => {
    const sourceColumn = [makeCourse('A', 540, 570)]
    const targetColumn = [makeCourse('B', 600, 630)]

    expect(canPlaceCourses(targetColumn, [makeCourse('X', 630, 660)])).toBe(true)
    expect(canPlaceCourses(targetColumn, [makeCourse('Y', 615, 645)])).toBe(false)
    expect(canSwapSingleCourses(sourceColumn, targetColumn, sourceColumn[0], targetColumn[0])).toBe(true)
  })
})

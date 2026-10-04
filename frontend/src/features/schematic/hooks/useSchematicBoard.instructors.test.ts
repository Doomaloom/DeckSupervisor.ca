import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useSchematicBoard } from './useSchematicBoard'
import type { Course } from '../types'
const course: Course = { code: 'A', level: 'Swimmer 1', startTime: '09:00', endTime: '09:30', startMinutes: 540, endMinutes: 570, runningTime: 30, studentCount: 1, assignedInstructor: 'Alex', isLockedToInstructor: true }
it('does not restore a removed instructor from requested-class names', () => {
  const roster = [{ id: 'b', name: 'Blair' }]
  const storedLayout = { assignmentIds: ['column-a'], instructorIds: [null], instructors: [''], codes: ['A'] }
  const courses = [course]
  const { result } = renderHook(() => useSchematicBoard({ courses, storedLayout, instructorRoster: roster }))
  expect(result.current.columns[0].map(row => row.code)).toEqual(['A'])
  expect(result.current.instructors).toEqual([''])
  expect(result.current.lockedInstructors).toEqual([''])
  act(() => result.current.setInstructorAt(0, 'b'))
  expect(result.current.instructorIds).toEqual(['b'])
  expect(result.current.instructors).toEqual(['Blair'])
})
it('selects distinct identities for duplicate names and can assign one instructor to multiple columns', () => {
  const roster = [{ id: 'a', name: 'Alex' }, { id: 'b', name: 'Alex' }]
  const courses = [{ ...course, isLockedToInstructor: false, assignedInstructor: undefined }]
  const storedLayout = { assignmentIds: ['column-a', 'column-b'], instructorIds: ['a', 'b'], instructors: ['Alex', 'Alex'], codes: ['A', ''] }
  const { result } = renderHook(() => useSchematicBoard({ courses, storedLayout, instructorRoster: roster }))
  expect(result.current.instructorIds).toEqual(['a', 'b'])
  act(() => result.current.setInstructorAt(1, 'a'))
  expect(result.current.instructorIds).toEqual(['a', 'a'])
})

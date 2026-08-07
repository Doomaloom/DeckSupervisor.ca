import { describe, expect, it } from 'vitest'
import { ATTENDANCE_RENDERER_VERSION } from '../features/pdf/types'
import {
  getAttendancePdfEntryKey,
  INSTRUCTOR_PDF_CACHE_DB_VERSION,
  shouldClearInstructorPdfCache,
} from './instructorPdfCache'

describe('instructor PDF cache versioning', () => {
  it('never requests an IndexedDB version below the shipped HTML-renderer version', () => {
    expect(INSTRUCTOR_PDF_CACHE_DB_VERSION).toBe(8)
  })

  it('isolates attendance entries by the unified renderer version', () => {
    expect(getAttendancePdfEntryKey('session', 'Monday', 'Alex')).toBe(
      `${ATTENDANCE_RENDERER_VERSION}::session::Monday::Alex`,
    )
  })

  it('clears every cache created before version 8 and not the current cache', () => {
    expect(shouldClearInstructorPdfCache(7)).toBe(true)
    expect(shouldClearInstructorPdfCache(8)).toBe(false)
  })
})

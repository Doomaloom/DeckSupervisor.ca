import { describe, expect, it } from 'vitest'
import { ATTENDANCE_RENDERER_VERSION } from '../features/pdf/types'
import { buildInstructorPdfCacheKey } from './instructorPdfCache'

describe('instructor PDF cache versioning', () => {
  it('scopes attendance artifacts to the HTML renderer version', () => {
    expect(buildInstructorPdfCacheKey('session-1', 'Monday', 'Alex')).toBe(
      `${ATTENDANCE_RENDERER_VERSION}::session-1::Monday::Alex`,
    )
  })
})

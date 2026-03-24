import { describe, expect, it } from 'vitest'
import { normalizeCourseCodeForCompare } from './courseCode'

describe('courseCode utils', () => {
  it('normalizes numeric course codes by stripping leading zeroes', () => {
    expect(normalizeCourseCodeForCompare('00123')).toBe('123')
    expect(normalizeCourseCodeForCompare('000')).toBe('0')
  })

  it('preserves non-numeric course codes and handles empty values', () => {
    expect(normalizeCourseCodeForCompare('AB-123')).toBe('AB-123')
    expect(normalizeCourseCodeForCompare('   ')).toBe('')
    expect(normalizeCourseCodeForCompare(null)).toBe('')
  })
})

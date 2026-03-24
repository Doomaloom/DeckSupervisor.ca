import { describe, expect, it } from 'vitest'
import {
  formatSessionDisplayName,
  formatSessionTermLabel,
  getDayLabel,
  getYearFromDate,
  resolveSessionYear,
} from './sessionLabels'

describe('sessionLabels', () => {
  it('returns a readable day label and preserves unknown day tokens', () => {
    expect(getDayLabel('Mo')).toBe('Monday')
    expect(getDayLabel(' Custom ')).toBe('Custom')
    expect(getDayLabel('')).toBe('')
  })

  it('extracts years from dates and returns null for missing values', () => {
    expect(getYearFromDate('2026-03-23')).toBe(2026)
    expect(getYearFromDate(null)).toBeNull()
  })

  it('resolves session year from direct input before date fallbacks', () => {
    expect(resolveSessionYear('2031', '2026-01-01', '2027-01-01')).toBe(2031)
    expect(resolveSessionYear('', '2026-01-01', '2027-01-01')).toBe(2026)
    expect(resolveSessionYear('', null, '2027-01-01')).toBe(2027)
  })

  it('formats term labels from season and year sources', () => {
    expect(formatSessionTermLabel('Spring', 2026, null)).toBe('Spring 2026')
    expect(formatSessionTermLabel('Spring', null, '2026-03-01')).toBe('Spring 2026')
    expect(formatSessionTermLabel('', null, null)).toBe('')
  })

  it('formats a session display name and falls back when needed', () => {
    expect(
      formatSessionDisplayName({
        sessionDay: 'Tu',
        sessionSeason: 'Winter',
        sessionYear: 2026,
      }),
    ).toBe('Tuesday Winter 2026')
    expect(formatSessionDisplayName({ fallback: 'My Session' })).toBe('My Session')
  })
})

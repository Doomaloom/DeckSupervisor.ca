import { describe, expect, it } from 'vitest'
import {
  formatSessionDisplayName,
  formatSessionTermLabel,
  formatSessionTimeLabel,
  formatSessionTimeRange,
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

  it('formats session times and time ranges from 24-hour input', () => {
    expect(formatSessionTimeLabel('09:00')).toBe('9:00 AM')
    expect(formatSessionTimeLabel('13:15')).toBe('1:15 PM')
    expect(formatSessionTimeRange('09:00', '13:00')).toBe('9:00 AM-1:00 PM')
    expect(formatSessionTimeRange('', '13:00')).toBe('')
  })

  it('formats a session display name and falls back when needed', () => {
    expect(
      formatSessionDisplayName({
        sessionDay: 'Tu',
        sessionSeason: 'Winter',
        sessionYear: 2026,
        sessionStartTime24: '09:00',
        sessionEndTime24: '13:00',
      }),
    ).toBe('Tuesday Winter 2026 | 9:00 AM-1:00 PM')
    expect(
      formatSessionDisplayName({
        dayOverride: 'Mo',
        termSeason: 'spring',
        termYear: 2026,
        includeDay: false,
        includeTimeRange: false,
      }),
    ).toBe('Spring 2026')
    expect(
      formatSessionDisplayName({
        dayOverride: 'Mo',
        includeTimeRange: false,
      }),
    ).toBe('Monday')
    expect(formatSessionDisplayName({ fallback: 'My Session' })).toBe('My Session')
  })
})

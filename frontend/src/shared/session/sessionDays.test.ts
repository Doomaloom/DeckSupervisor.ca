import { describe, expect, it } from 'vitest'
import {
  MANUAL_SESSION_DAY_OPTIONS,
  compareSessionDays,
  sortSessionDays,
} from './sessionDays'

describe('sessionDays', () => {
  it('sorts weekdays, weekday ranges, and mini sessions in canonical order', () => {
    expect(
      sortSessionDays([
        'Mini Session 3',
        'Fr',
        'Mini Session 1',
        'Mo,Tu,We,Th,Fr',
        'Tu',
      ]),
    ).toEqual(['Tu', 'Fr', 'Mo,Tu,We,Th,Fr', 'Mini Session 1', 'Mini Session 3'])
  })

  it('sorts unknown values after known session days', () => {
    expect(compareSessionDays('Mini Session 4', 'Custom')).toBeLessThan(0)
    expect(compareSessionDays('Custom B', 'Custom A')).toBeGreaterThan(0)
  })

  it('includes mini sessions in manual session day options', () => {
    expect(MANUAL_SESSION_DAY_OPTIONS.map(option => option.value)).toContain('Mini Session 1')
    expect(MANUAL_SESSION_DAY_OPTIONS.map(option => option.value)).toContain('Mini Session 4')
  })
})

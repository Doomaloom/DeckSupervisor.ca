import { describe, expect, it } from 'vitest'
import { resolveShareDates } from './shareDates'
import type { DbSessionEntry } from '../session-management/types'

const session: DbSessionEntry = {
  id: 'session-1',
  team_id: 'team-1',
  created_by: 'user-1',
  session_day: 'Monday',
  session_season: 'Spring',
  session_year: 2026,
  start_date: '2026-04-06',
  end_date: '2026-05-11',
  location: 'Main Pool',
  source_locations: ['Main Pool'],
  session_start_time24: '16:00',
  session_end_time24: '19:00',
  instructors: [{ name: 'Alex' }],
}

describe('resolveShareDates', () => {
  it('rejects single dates that do not match the session weekday', () => {
    const result = resolveShareDates({
      mode: 'single',
      singleDate: '2026-04-21',
      rangeStartDate: '',
      rangeEndDate: '',
      session,
      today: '2026-04-21',
    })

    expect(result.dates).toEqual([])
    expect(result.validationMessage).toContain('Monday')
  })

  it('expands a range to matching session weekdays within the session window', () => {
    const result = resolveShareDates({
      mode: 'range',
      singleDate: '',
      rangeStartDate: '2026-04-20',
      rangeEndDate: '2026-05-05',
      session,
      today: '2026-04-21',
    })

    expect(result.validationMessage).toBe('')
    expect(result.dates).toEqual(['2026-04-27', '2026-05-04'])
  })

  it('blocks ranges that produce no matching dates', () => {
    const result = resolveShareDates({
      mode: 'range',
      singleDate: '',
      rangeStartDate: '2026-04-21',
      rangeEndDate: '2026-04-22',
      session,
      today: '2026-04-21',
    })

    expect(result.dates).toEqual([])
    expect(result.validationMessage).toContain('No Monday dates')
  })

  it('accepts stored two-letter weekday codes', () => {
    const result = resolveShareDates({
      mode: 'single',
      singleDate: '2026-04-27',
      rangeStartDate: '',
      rangeEndDate: '',
      session: {
        ...session,
        session_day: 'mo',
      },
      today: '2026-04-21',
    })

    expect(result.validationMessage).toBe('')
    expect(result.dates).toEqual(['2026-04-27'])
  })
})

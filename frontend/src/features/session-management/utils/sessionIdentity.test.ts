import { describe, expect, it } from 'vitest'
import {
  buildSessionIdentityCriteria,
  hasIdentityCriteria,
  resolveDisplayAndSourceLocations,
  sortDbSessionsByStartDateDesc,
  sortLocalSessionsByStartDateDesc,
} from './sessionIdentity'
import type { DbSessionEntry, LocalSessionEntry } from '../types'

describe('sessionIdentity', () => {
  it('builds identity criteria from mixed string input', () => {
    expect(
      buildSessionIdentityCriteria({
        sessionDay: ' Monday ',
        sessionSeason: ' Winter ',
        sessionYear: '2026',
        location: ' Main Pool ',
        locations: ['Main Pool', 'Training Pool'],
      }),
    ).toEqual({
      dayOfWeek: 'Monday',
      sessionSeason: 'Winter',
      sessionYear: 2026,
      location: 'Main Pool',
      locations: ['Main Pool', 'Training Pool'],
    })
  })

  it('detects whether any identity criteria exist', () => {
    expect(hasIdentityCriteria({})).toBe(false)
    expect(hasIdentityCriteria({ sessionSeason: 'Spring' })).toBe(true)
    expect(hasIdentityCriteria({ locations: ['Lane Pool'] })).toBe(true)
  })

  it('resolves display and raw locations and requires a display location for combined scopes', () => {
    expect(
      resolveDisplayAndSourceLocations({
        location: '',
        sourceLocations: ['Main Pool', 'Training Pool'],
      }),
    ).toEqual({
      sourceLocations: ['Main Pool', 'Training Pool'],
      displayLocation: '',
      validationMessage: 'Enter a display location when combining multiple raw locations.',
    })

    expect(
      resolveDisplayAndSourceLocations({
        location: '',
        sourceLocations: ['Main Pool'],
      }),
    ).toEqual({
      sourceLocations: ['Main Pool'],
      displayLocation: 'Main Pool',
      validationMessage: '',
    })
  })

  it('sorts local sessions by newest start date first', () => {
    const sessions: LocalSessionEntry[] = [
      {
        id: 'a',
        sessionDay: 'Monday',
        sessionSeason: 'Winter',
        startDate: '2026-01-01',
        endDate: '2026-02-01',
        instructors: [],
      },
      {
        id: 'b',
        sessionDay: 'Tuesday',
        sessionSeason: 'Winter',
        startDate: '2026-03-01',
        endDate: '2026-04-01',
        instructors: [],
      },
    ]

    expect(sortLocalSessionsByStartDateDesc(sessions).map(session => session.id)).toEqual(['b', 'a'])
  })

  it('sorts db sessions by newest start date first', () => {
    const sessions: DbSessionEntry[] = [
      {
        id: 'a',
        team_id: null,
        created_by: 'u1',
        session_day: 'Monday',
        session_season: 'Winter',
        session_year: 2026,
        start_date: '2026-01-01',
        end_date: '2026-02-01',
        location: null,
        source_locations: [],
        session_start_time24: null,
        session_end_time24: null,
        instructors: [],
      },
      {
        id: 'b',
        team_id: null,
        created_by: 'u1',
        session_day: 'Tuesday',
        session_season: 'Winter',
        session_year: 2026,
        start_date: '2026-03-01',
        end_date: '2026-04-01',
        location: null,
        source_locations: [],
        session_start_time24: null,
        session_end_time24: null,
        instructors: [],
      },
    ]

    expect(sortDbSessionsByStartDateDesc(sessions).map(session => session.id)).toEqual(['b', 'a'])
  })
})

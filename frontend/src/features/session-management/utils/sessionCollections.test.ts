import { describe, expect, it } from 'vitest'
import {
  buildFullTimeSessionTerms,
  buildFullTimeTermYears,
  filterTermsForYear,
  findDefaultTermForYear,
  getSessionListDisplayMeta,
  groupSessionListItemsByTerm,
} from './sessionCollections'
import type { SessionListItem, TeamTermSessionRow } from '../types'

describe('sessionCollections', () => {
  it('groups and orders full-time session terms', () => {
    const rows: TeamTermSessionRow[] = [
      { id: '1', session_season: 'Fall', session_year: 2025, start_date: '2025-09-01' },
      { id: '2', session_season: 'Winter', session_year: 2026, start_date: '2026-01-10' },
      { id: '3', session_season: 'Spring', session_year: 2026, start_date: '2026-03-10' },
      { id: '4', session_season: 'Spring', session_year: 2026, start_date: '2026-03-11' },
    ]

    expect(buildFullTimeSessionTerms(rows)).toEqual([
      { key: 'winter-2026', season: 'winter', year: 2026, label: 'Winter 2026', sessionCount: 1 },
      { key: 'spring-2026', season: 'spring', year: 2026, label: 'Spring 2026', sessionCount: 2 },
      { key: 'fall-2025', season: 'fall', year: 2025, label: 'Fall 2025', sessionCount: 1 },
    ])
  })

  it('builds descending term years from the current date', () => {
    expect(buildFullTimeTermYears('2026-04-21')).toEqual([2026, 2025, 2024, 2023, 2022])
  })

  it('filters terms for a selected year and finds the default term', () => {
    const terms = buildFullTimeSessionTerms([
      { id: '1', session_season: 'Winter', session_year: 2026, start_date: '2026-01-10' },
      { id: '2', session_season: 'Spring', session_year: 2026, start_date: '2026-03-10' },
      { id: '3', session_season: 'Fall', session_year: 2025, start_date: '2025-09-01' },
    ])

    expect(filterTermsForYear(terms, 2026).map(term => term.key)).toEqual(['winter-2026', 'spring-2026'])
    expect(findDefaultTermForYear(terms, 2026)?.key).toBe('winter-2026')
    expect(findDefaultTermForYear(terms, null)).toBeNull()
  })

  it('builds session list display metadata for local and shared items', () => {
    const localItem: SessionListItem = {
      kind: 'local',
      session: {
        id: 'local-1',
        sessionDay: 'Monday',
        sessionSeason: 'Winter',
        sessionYear: 2026,
        startDate: '2026-01-05',
        endDate: '2026-02-16',
        location: 'Main Pool',
        sourceLocations: ['Main Pool', 'Training Pool'],
        instructors: [{ name: 'Alex' }, { name: 'Sam' }],
      },
    }
    const sharedItem: SessionListItem = {
      kind: 'shared',
      entry: {
        id: 'share-1',
        share_date: '2026-04-21',
        allow_roster_edits: false,
      },
      session: {
        id: 'db-1',
        team_id: 'team-1',
        created_by: 'u1',
        session_day: 'Tuesday',
        session_season: 'Spring',
        session_year: 2026,
        start_date: '2026-03-01',
        end_date: '2026-04-15',
        location: 'Therapy Pool',
        source_locations: ['Therapy Pool'],
        session_start_time24: '08:00',
        session_end_time24: '10:00',
        instructors: [{ name: 'Morgan' }],
      },
    }

    expect(getSessionListDisplayMeta(localItem)).toMatchObject({
      instructorCount: 2,
      location: 'Main Pool',
      sourceLocations: ['Main Pool', 'Training Pool'],
      rosterFileName: '',
    })
    expect(getSessionListDisplayMeta(sharedItem)).toMatchObject({
      instructorCount: 1,
      location: 'Therapy Pool',
      shareDate: '2026-04-21',
      title: 'Tuesday Spring 2026 | 8:00 AM-10:00 AM',
    })
  })

  it('groups session list items by season-year and orders groups and items newest first', () => {
    const groups = groupSessionListItemsByTerm([
      {
        kind: 'db',
        session: {
          id: 'winter-1',
          team_id: 'team-1',
          created_by: 'u1',
          session_day: 'Monday',
          session_season: 'Winter',
          session_year: 2026,
          start_date: '2026-01-05',
          end_date: '2026-02-16',
          location: null,
          source_locations: [],
          session_start_time24: null,
          session_end_time24: null,
          instructors: [],
        },
      },
      {
        kind: 'db',
        session: {
          id: 'fall-2',
          team_id: 'team-1',
          created_by: 'u1',
          session_day: 'Thursday',
          session_season: 'Fall',
          session_year: 2026,
          start_date: '2026-10-01',
          end_date: '2026-11-16',
          location: null,
          source_locations: [],
          session_start_time24: null,
          session_end_time24: null,
          instructors: [],
        },
      },
      {
        kind: 'db',
        session: {
          id: 'fall-1',
          team_id: 'team-1',
          created_by: 'u1',
          session_day: 'Wednesday',
          session_season: 'Fall',
          session_year: 2026,
          start_date: '2026-09-01',
          end_date: '2026-10-16',
          location: null,
          source_locations: [],
          session_start_time24: null,
          session_end_time24: null,
          instructors: [],
        },
      },
      {
        kind: 'local',
        session: {
          id: 'spring-1',
          sessionDay: 'Tuesday',
          sessionSeason: 'Spring',
          sessionYear: 2025,
          startDate: '2025-03-01',
          endDate: '2025-04-01',
          instructors: [],
        },
      },
    ])

    expect(groups.map(group => group.label)).toEqual(['Fall 2026', 'Winter 2026', 'Spring 2025'])
    expect(groups[0]?.items.map(item => item.session.id)).toEqual(['fall-2', 'fall-1'])
  })
})

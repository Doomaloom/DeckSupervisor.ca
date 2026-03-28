import { describe, expect, it } from 'vitest'
import type { ExtractedClass, ExtractedSession } from '../../types/app'
import {
  filterExtractedSessionsByIdentity,
  findSingleMatchingExtractedSession,
  inferSessionWindowsFromClasses,
  inferSingleSessionWindowFromClasses,
} from './sessionTimeInference'

function buildClass(overrides: Partial<ExtractedClass>): ExtractedClass {
  return {
    sessionKey: 'Sa|winter|2026|pool|09:00|10:00',
    dayOfWeek: 'Sa',
    sessionSeason: 'Winter',
    sessionYear: 2026,
    courseCode: '100',
    serviceName: 'Splash',
    location: 'Pool',
    startTime24: '09:00',
    endTime24: '10:00',
    durationMinutes: 60,
    studentCount: 6,
    waitlistCount: 0,
    ...overrides,
  }
}

function buildSession(overrides: Partial<ExtractedSession>): ExtractedSession {
  return {
    sessionKey: 'Sa|winter|2026|pool|09:00|10:00',
    dayOfWeek: 'Sa',
    sessionSeason: 'Winter',
    sessionYear: 2026,
    startDate: '2026-01-01',
    endDate: '2026-03-01',
    location: 'Pool',
    sessionStartTime24: '09:00',
    sessionEndTime24: '10:00',
    classCount: 1,
    studentCount: 6,
    waitlistCount: 0,
    courseCodes: ['100'],
    ...overrides,
  }
}

describe('sessionTimeInference', () => {
  it('splits windows when the gap exceeds thirty minutes', () => {
    const windows = inferSessionWindowsFromClasses([
      buildClass({ courseCode: '100', startTime24: '09:00', endTime24: '10:00' }),
      buildClass({ courseCode: '200', startTime24: '10:31', endTime24: '11:00' }),
    ])

    expect(windows).toEqual([
      { sessionStartTime24: '09:00', sessionEndTime24: '10:00', classCount: 1 },
      { sessionStartTime24: '10:31', sessionEndTime24: '11:00', classCount: 1 },
    ])
  })

  it('keeps windows together when the gap is thirty minutes or less', () => {
    const window = inferSingleSessionWindowFromClasses([
      buildClass({ courseCode: '100', startTime24: '09:00', endTime24: '10:00' }),
      buildClass({ courseCode: '200', startTime24: '10:30', endTime24: '11:00' }),
    ])

    expect(window).toEqual({
      sessionStartTime24: '09:00',
      sessionEndTime24: '11:00',
      classCount: 2,
    })
  })

  it('uses the rolling end time before deciding to split', () => {
    const window = inferSingleSessionWindowFromClasses([
      buildClass({ courseCode: '100', startTime24: '09:00', endTime24: '10:00' }),
      buildClass({ courseCode: '200', startTime24: '09:45', endTime24: '11:00' }),
      buildClass({ courseCode: '300', startTime24: '11:20', endTime24: '12:00' }),
    ])

    expect(window).toEqual({
      sessionStartTime24: '09:00',
      sessionEndTime24: '12:00',
      classCount: 3,
    })
  })

  it('filters sessions by populated identity fields only', () => {
    const sessions = [
      buildSession({ sessionKey: '1', dayOfWeek: 'Sa', location: 'Pool' }),
      buildSession({ sessionKey: '2', dayOfWeek: 'Su', location: 'Pool' }),
      buildSession({ sessionKey: '3', dayOfWeek: 'Sa', location: 'Warm Pool' }),
    ]

    expect(
      filterExtractedSessionsByIdentity(sessions, {
        dayOfWeek: 'Sa',
        location: 'Pool',
      }).map(session => session.sessionKey),
    ).toEqual(['1'])
  })

  it('returns a single matching extracted session only when unambiguous', () => {
    const sessions = [
      buildSession({
        sessionKey: '1',
        sessionStartTime24: '09:00',
        sessionEndTime24: '10:00',
        location: 'Pool',
      }),
      buildSession({
        sessionKey: '2',
        sessionStartTime24: '16:00',
        sessionEndTime24: '17:00',
        location: 'Warm Pool',
      }),
    ]

    expect(
      findSingleMatchingExtractedSession(sessions, {
        dayOfWeek: 'Sa',
        sessionSeason: 'Winter',
        sessionYear: 2026,
      }),
    ).toBeNull()

    expect(
      findSingleMatchingExtractedSession(sessions, {
        dayOfWeek: 'Sa',
        sessionSeason: 'Winter',
        sessionYear: 2026,
        location: 'Other Pool',
      }),
    ).toBeNull()

    expect(
      findSingleMatchingExtractedSession(sessions, {
        location: 'Pool',
        dayOfWeek: 'Sa',
        sessionSeason: 'Winter',
        sessionYear: 2026,
      }),
    ).toMatchObject({ sessionKey: '1' })
  })
})

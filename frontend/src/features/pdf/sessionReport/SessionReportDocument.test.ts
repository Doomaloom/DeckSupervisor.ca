import { describe, expect, it } from 'vitest'
import { formatTimestamp } from './SessionReportDocument'

describe('historical session report formatting', () => {
  it('formats RFC3339 timestamps in UTC and preserves other values', () => {
    expect(formatTimestamp('2026-01-02T15:04:00Z')).toBe('Jan 2, 2026 3:04 PM')
    expect(formatTimestamp('legacy timestamp')).toBe('legacy timestamp')
    expect(formatTimestamp('')).toBe('Not provided')
  })
})

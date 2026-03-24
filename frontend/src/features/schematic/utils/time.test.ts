import { describe, expect, it } from 'vitest'
import { buildTimeLabels, timeToMinutes } from './time'

describe('time utils', () => {
  it('converts times to minutes and returns zero for invalid input', () => {
    expect(timeToMinutes('09:15')).toBe(555)
    expect(timeToMinutes('bad')).toBe(0)
  })

  it('builds 15-minute labels rounded to the nearest interval bounds', () => {
    expect(buildTimeLabels('09:10', '09:50')).toEqual(['09:00 AM', '09:15 AM', '09:30 AM', '09:45 AM'])
    expect(buildTimeLabels('', '09:50')).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { buildMasterlistRows, buildMasterlistTitle, normalizeMasterlistFontSize, sanitizeEventName } from './masterlistModel'
import type { MasterlistPdfRequest } from '../types'

const options = {
  time_headers: true,
  instructor_headers: true,
  course_headers: true,
  borders: true,
  center_time: false,
  bold_time: true,
  center_course: false,
  bold_course: true,
  font_size: 14,
}

describe('masterlist model', () => {
  it('builds headers and includes the age column', () => {
    const rows = buildMasterlistRows([
      {
        code: '100', time: '9:00 AM', serviceName: 'Swim Splash7', instructor: 'Alex',
        students: [{ name: 'Sam', age: '8', phone: '555', level: 'Splash 7' }],
      },
    ], options)
    expect(rows).toEqual([
      { kind: 'time', label: '9:00 AM' },
      { kind: 'course', label: 'Splash 7 - Alex' },
      { kind: 'data', cells: ['100', '9:00 AM', 'Alex', 'Splash 7', 'Sam', '8', '555'] },
    ])
  })

  it('sanitizes supported service names and clamps font sizes', () => {
    expect(sanitizeEventName('TeenAdult2')).toBe('Splash Adult 2')
    expect(sanitizeEventName('Group Private Lesson')).toBe('Group Private')
    expect(normalizeMasterlistFontSize(2)).toBe(8)
    expect(normalizeMasterlistFontSize(30)).toBe(18)
  })

  it('builds the session progress title', () => {
    const request = { options, rosters: [], sessionName: 'Summer', sessionWeek: 3, generatedDate: 'July 15' } satisfies MasterlistPdfRequest
    expect(buildMasterlistTitle(request)).toBe('Summer - Week 3 - July 15')
  })
})

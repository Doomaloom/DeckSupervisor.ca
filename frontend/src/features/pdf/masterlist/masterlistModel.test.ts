import { describe, expect, it } from 'vitest'
import { buildMasterlistRows, buildMasterlistTitle, normalizeMasterlistFontSize, sanitizeEventName } from './masterlistModel'
import type { MasterlistFormatOptions, MasterlistPdfRequest, MasterlistRoster } from '../types'

const options: MasterlistFormatOptions = {
  layout: 'class-time',
  alphabetical_name_basis: 'last-name',
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

const roster = (
  courseCode: string,
  students: MasterlistRoster['students'],
  overrides: Partial<MasterlistRoster> = {},
): MasterlistRoster => ({
  courseCode,
  serviceName: 'Splash 1',
  day: 'Mo',
  time: '9:00 AM',
  location: 'Pool',
  schedule: 'Weekly',
  instructor: 'Alex',
  students,
  ...overrides,
})

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

  it('uses courseCode from the canonical frontend payload', () => {
    const rows = buildMasterlistRows([
      roster('00100', [{ name: 'Sam', age: '8', phone: '555', instructor: 'Alex', level: 'Splash 1' }]),
    ], options)
    expect(rows.at(-1)).toEqual({
      kind: 'data',
      cells: ['00100', '9:00 AM', 'Alex', 'Splash 1', 'Sam', '8', '555'],
    })
  })

  it('globally groups and orders students by first name', () => {
    const rows = buildMasterlistRows([
      roster('C1', [
        { name: 'zoe Adams', phone: '1', instructor: 'Alex', level: 'Splash 1' },
        { name: '3ric Stone', phone: '2', instructor: 'Alex', level: 'Splash 1' },
      ]),
      roster('C2', [
        { name: 'Alice Brown', phone: '3', instructor: 'Beth', level: 'Splash 2' },
      ], { serviceName: 'Splash 2', instructor: 'Beth', time: '10:00 AM' }),
    ], { ...options, layout: 'alphabetical', alphabetical_name_basis: 'first-name' })

    expect(rows.map(row => row.kind === 'data' ? row.cells[4] : row.label)).toEqual([
      'A', 'Alice Brown', 'Z', 'zoe Adams', '#', '3ric Stone',
    ])
    expect(rows.find(row => row.kind === 'data' && row.cells[4] === 'Alice Brown')).toEqual({
      kind: 'data',
      cells: ['C2', '10:00 AM', 'Beth', 'Splash 2', 'Alice Brown', '', '3'],
    })
  })

  it('groups comma names, suffixes, hyphenated names, and single names by last name', () => {
    const names = [
      'Smith, Zoe',
      'Blake Jones Jr.',
      'Amy Van-Buren',
      'Prince',
      'Émile Zola',
      'Student 9',
    ]
    const rows = buildMasterlistRows([
      roster('C1', names.map(name => ({ name, phone: '', instructor: '', level: 'Splash 1' }))),
    ], { ...options, layout: 'alphabetical', alphabetical_name_basis: 'last-name' })

    expect(rows.map(row => row.kind === 'data' ? row.cells[4] : row.label)).toEqual([
      'J', 'Blake Jones Jr.',
      'P', 'Prince',
      'S', 'Smith, Zoe',
      'V', 'Amy Van-Buren',
      'Z', 'Émile Zola',
      '#', 'Student 9',
    ])
  })
})

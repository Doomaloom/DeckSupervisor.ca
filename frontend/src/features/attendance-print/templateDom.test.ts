import { describe, expect, it } from 'vitest'
import { loadAttendanceTemplate } from './templateRegistry'
import { extractAttendanceTemplateSections, fillAttendanceRoster } from './templateDom'

describe('historical attendance DOM preparation', () => {
  it('removes executable resources and preserves both page fragments', async () => {
    const template = await loadAttendanceTemplate('Splash1')
    const sections = extractAttendanceTemplateSections(template.key, template.html)
    expect(sections.frontFragment.querySelector('script')).toBeNull()
    expect(sections.backFragment.textContent).toContain('Enter and Exit Shallow Water')
    expect(sections.frontFragment.querySelector('#attendance-rows')).not.toBeNull()
  })

  it('injects safe student rows with the historical fields and cell count', async () => {
    const template = await loadAttendanceTemplate('Splash1')
    const sections = extractAttendanceTemplateSections(template.key, template.html)
    const header = sections.frontFragment.querySelector<HTMLTableRowElement>('#student-rows')!
    const expectedCells = header.children.length
    fillAttendanceRoster(sections.frontFragment, {
      code: '00123', level: 'Splash 1', serviceName: 'Splash 1', time: '9:00 AM',
      instructor: 'Alex', location: 'Main Pool', schedule: 'Mon 2026-07-06',
      students: [{ name: '<Avery & Blair>' }],
    }, 'Summer 2026')

    const row = sections.frontFragment.querySelector<HTMLTableRowElement>('[data-generated-attendance-row]')!
    expect(row.children).toHaveLength(expectedCells)
    expect(row.textContent).toContain('1. <Avery & Blair>')
    expect(row.querySelector('script')).toBeNull()
    expect(sections.frontFragment.querySelector('#instructor')?.textContent).toBe('Alex')
    expect(sections.frontFragment.querySelector('#start_time')?.textContent).toBe('2026-07-06 9:00 AM')
    expect(sections.frontFragment.querySelector('#session')?.textContent).toBe('Summer 2026')
    expect(row.textContent).toContain('[Day 14]')
  })

  it('does not synthesize a student row for an empty roster', async () => {
    const template = await loadAttendanceTemplate('SplashPrivate')
    const sections = extractAttendanceTemplateSections(template.key, template.html)
    fillAttendanceRoster(sections.frontFragment, {
      code: 'P', level: 'Private', serviceName: 'Private', time: '', instructor: '',
      location: '', schedule: '', students: [],
    }, 'Session')
    expect(sections.frontFragment.querySelectorAll('[data-generated-attendance-row]')).toHaveLength(0)
    expect(sections.backFragment.textContent).toContain('Little Splash 5')
  })
})

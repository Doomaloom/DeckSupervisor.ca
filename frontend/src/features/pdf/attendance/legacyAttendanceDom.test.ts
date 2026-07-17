import { describe, expect, it } from 'vitest'
import { fillLegacyAttendanceRoster, parseLegacyAttendanceTemplate, prepareLegacyAttendanceGroup } from './legacyAttendanceDom'
import type { AttendancePdfItem, AttendancePdfRoster } from '../types'

const roster = (students = [{ name: '<img src=x onerror=alert(1)>' }]): AttendancePdfRoster => ({
  code: '00123', level: 'Splash 1', serviceName: 'Splash 1', time: '9:00 AM',
  instructor: 'Alex', location: 'Main Pool', schedule: 'Mon 2026-07-06', students,
})
const item = (template: string, code = '00123'): AttendancePdfItem => ({ template, roster: { ...roster(), code } })

describe('historical attendance DOM preparation', () => {
  it('removes scripts and inserts roster data as text', async () => {
    const group = await prepareLegacyAttendanceGroup([item('Splash1')], 'Summer 2026')
    expect(group.headHtml).not.toContain('<script')
    expect(group.pages[0].html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(group.pages[0].html).not.toContain('<img src="x"')
    expect(group.pages.map(page => page.kind)).toEqual(['front', 'back'])
  })

  it('creates exactly one blank result cell for each template header cell after the name', () => {
    const document = parseLegacyAttendanceTemplate(`<!doctype html><table><tbody id="attendance-rows"><tr id="student-rows"><td>Name</td><td>A</td><td>B</td></tr></tbody></table><div class="templatePage"><i class="break-before-page"></i></div>`, roster([{ name: 'Student' }]), 'Session')
    const generated = document.querySelectorAll('#attendance-rows > tr')[1]
    expect(generated.children).toHaveLength(3)
    expect(generated.textContent).toContain('[Day 14]')
  })

  it('does not add a placeholder row for an empty roster', () => {
    const document = new DOMParser().parseFromString('<table><tbody id="attendance-rows"><tr id="student-rows"><td>Name</td><td>A</td></tr></tbody></table>', 'text/html')
    fillLegacyAttendanceRoster(document, roster([]), 'Session')
    expect(document.querySelectorAll('#attendance-rows > tr')).toHaveLength(1)
  })

  it('assembles paired front fragments before paired back fragments', async () => {
    const group = await prepareLegacyAttendanceGroup([item('Splash1'), item('Splash2A')], 'Session')
    expect(group.pages[0].templateKeys).toEqual(['Splash1', 'Splash2A'])
    expect(group.pages[0].html.match(/combined-slot/g)).toHaveLength(2)
    expect(group.pages[1].html.match(/combined-slot/g)).toHaveLength(2)
  })
})

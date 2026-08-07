// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import type { AttendancePdfItem } from '../types'
import { generateAttendancePdf } from './generateAttendancePdf'

const item = (code: string, template = 'Splash1'): AttendancePdfItem => ({
  template,
  roster: {
    code,
    level: template,
    serviceName: template,
    time: '9:00 AM',
    instructor: 'Alex Instructor',
    location: 'Main Pool',
    schedule: 'Mon 2026-07-06',
    students: [{ name: '<Avery & Blair>' }],
  },
})

describe('attendance PDF generation', () => {
  it('renders single and private sheets as two landscape vector pages', async () => {
    for (const template of ['Splash1', 'SplashPrivate']) {
      const artifact = await generateAttendancePdf({ rosters: [item('00123', template)], title: `${template} Attendance`, filename: `${template} / Attendance` })
      const document = await PDFDocument.load(await artifact.blob.arrayBuffer(), { updateMetadata: false })
      expect(document.getPageCount()).toBe(2)
      expect(document.getTitle()).toBe(`${template} Attendance`)
      expect(artifact.filename).toBe(`${template}-Attendance.pdf`)
      for (const page of document.getPages()) {
        expect(page.getSize()).toEqual({ width: 792, height: 612 })
        expect(page.getRotation().angle).toBe(0)
      }
    }
  }, 20_000)

  it('preserves paired, odd, and non-adjacent packet pagination', async () => {
    const cases = [
      { rosters: [item('A'), item('A', 'Splash2A')], pages: 2 },
      { rosters: [item('A'), item('A', 'Splash2A'), item('B', 'Splash3')], pages: 4 },
      { rosters: [item('A'), item('B', 'Splash2A'), item('A', 'Splash3')], pages: 6 },
    ]
    for (const testCase of cases) {
      const artifact = await generateAttendancePdf({ rosters: testCase.rosters })
      const document = await PDFDocument.load(await artifact.blob.arrayBuffer())
      expect(document.getPageCount()).toBe(testCase.pages)
    }
  }, 20_000)
})

// @vitest-environment node
import { mkdir, writeFile } from 'node:fs/promises'
import { describe, it } from 'vitest'
import { attendanceTemplates } from './attendance/attendanceTemplates'
import { generateAttendancePdf } from './attendance/generateAttendancePdf'
import type { AttendancePdfItem, AttendancePdfRoster } from './types'

const output = process.env.PDF_VISUAL_OUTPUT_DIR
const filter = process.env.ATTENDANCE_VISUAL_FILTER?.trim()
const baseRoster = (code: string, template: string, studentCount = 3): AttendancePdfRoster => ({
  code,
  level: template,
  serviceName: template,
  time: '9:00 AM',
  instructor: 'Alex Instructor',
  location: 'Main Pool',
  schedule: 'Mon 2026-07-06',
  students: Array.from({ length: studentCount }, (_, index) => ({ name: ['Avery Adams', 'Blair Brown', 'Casey Chen'][index] ?? `Student ${index + 1}` })),
})
const item = (code: string, template: string, studentCount = 3): AttendancePdfItem => ({ template, roster: baseRoster(code, template, studentCount) })
const shouldRender = (name: string) => !filter || filter === 'backs' || name.toLowerCase() === `attendance-${filter}`.toLowerCase()

describe.skipIf(!output)('PDF visual fixtures', () => {
  it('renders every historical attendance template', async () => {
    await mkdir(output!, { recursive: true })
    for (const template of attendanceTemplates) {
      const name = `attendance-${template.key}`
      if (!shouldRender(name)) continue
      const artifact = await generateAttendancePdf({
        template: template.key,
        session: 'Summer 2026',
        filename: name,
        title: template.key,
        roster: baseRoster('00123', template.key),
      })
      await writeFile(`${output}/${name}.pdf`, Buffer.from(await artifact.blob.arrayBuffer()))
    }

    const packets = [
      { name: 'attendance-paired', rosters: [item('PAIR', 'Splash1'), item('PAIR', 'Splash2A')] },
      { name: 'attendance-odd', rosters: [item('PAIR', 'Splash1'), item('PAIR', 'Splash2A'), item('ODD', 'Splash3')] },
      { name: 'attendance-non-adjacent', rosters: [item('A', 'Splash1'), item('B', 'Splash2A'), item('A', 'Splash3')] },
      { name: 'attendance-dense-paired', rosters: [item('DENSE', 'Splash7', 12), item('DENSE', 'Splash8', 12)] },
      { name: 'attendance-empty', rosters: [item('EMPTY', 'Splash1', 0)] },
      { name: 'attendance-private-paired', rosters: [item('PRIVATE', 'SplashPrivate'), item('PRIVATE', 'SplashPrivate')] },
    ]
    for (const packet of packets) {
      if (!shouldRender(packet.name)) continue
      const artifact = await generateAttendancePdf({ rosters: packet.rosters, session: 'Summer 2026', filename: packet.name, title: packet.name })
      await writeFile(`${output}/${packet.name}.pdf`, Buffer.from(await artifact.blob.arrayBuffer()))
    }
  }, 120_000)
})

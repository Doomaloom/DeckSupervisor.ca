// @vitest-environment node
import { mkdir, writeFile } from 'node:fs/promises'
import { describe, it } from 'vitest'
import { attendanceTemplates } from './attendance/attendanceTemplates'
import { generateAttendancePdf } from './attendance/generateAttendancePdf'

const output = process.env.PDF_VISUAL_OUTPUT_DIR
describe.skipIf(!output)('PDF visual fixtures', () => {
  it('renders every historical attendance template', async () => {
    await mkdir(output!, { recursive: true })
    for (const template of attendanceTemplates) {
      const artifact = await generateAttendancePdf({
        template: template.key,
        session: 'Summer 2026',
        filename: `attendance-${template.key}`,
        title: template.key,
        roster: {
          code: '00123', level: template.key, serviceName: template.key, time: '9:00 AM',
          instructor: 'Alex Instructor', location: 'Main Pool', schedule: 'Mon 2026-07-06',
          students: [{ name: 'Avery Adams' }, { name: 'Blair Brown' }, { name: 'Casey Chen' }],
        },
      })
      await writeFile(`${output}/attendance-${template.key}.pdf`, Buffer.from(await artifact.blob.arrayBuffer()))
    }
  }, 120_000)
})

import { buildAttendancePrintDocument } from './buildAttendancePrintDocument'
import { LEGACY_ATTENDANCE_TEMPLATE_KEYS } from './templateRegistry'
import type { AttendancePrintItem, AttendancePrintRequest } from './types'

declare global {
  interface Window {
    __ATTENDANCE_FIXTURE_READY__?: boolean
    __ATTENDANCE_FIXTURE_ERROR__?: string
  }
}

const students = [
  { name: 'Avery Adams' },
  { name: 'Blair Brown' },
  { name: 'Casey Chen' },
]

function item(template: string, code = '00123', instructor = 'Alex Instructor'): AttendancePrintItem {
  return {
    template,
    roster: {
      code,
      level: template,
      serviceName: template,
      time: '9:00 AM',
      instructor,
      location: 'Main Pool',
      schedule: 'Mon 2026-07-06',
      students,
    },
  }
}

function fixture(name: string): { request: AttendancePrintRequest; options?: Parameters<typeof buildAttendancePrintDocument>[1] } {
  const template = name.replace(/^attendance-/, '')
  if (LEGACY_ATTENDANCE_TEMPLATE_KEYS.includes(template as typeof LEGACY_ATTENDANCE_TEMPLATE_KEYS[number])) {
    const roster = item(template).roster
    return { request: { template, roster, session: 'Summer 2026', title: template } }
  }
  if (name === 'paired') {
    return { request: { rosters: [item('Splash2A'), item('Splash2B')], session: 'Summer 2026', title: 'Paired attendance' } }
  }
  if (name === 'odd') {
    return { request: { rosters: [item('Splash1', '100'), item('Splash2A', '100'), item('Splash3', '300')], session: 'Summer 2026', title: 'Odd attendance' } }
  }
  if (name === 'covers') {
    return {
      request: { rosters: [item('Splash1')], session: 'Summer 2026', title: 'Attendance with cover' },
      options: {
        schematicCover: {
          blankBack: true,
          request: {
            orientation: 'landscape', title: 'Monday Schematic', dateRange: 'Jul 6 – Aug 24, 2026',
            instructors: ['Alex Instructor'], columns: [[{ code: '00123', level: 'Splash 1', startMinutes: 540, durationMinutes: 30, studentCount: 3, capacity: 6 }]],
          },
        },
      },
    }
  }
  throw new Error(`Unknown attendance fixture: ${name}`)
}

async function mount() {
  const name = new URLSearchParams(window.location.search).get('fixture') || 'attendance-Splash1'
  const selected = fixture(name)
  const source = await buildAttendancePrintDocument(selected.request, selected.options)
  document.title = source.title
  document.head.replaceChildren(...Array.from(source.head.childNodes, node => document.importNode(node, true)))
  document.body.replaceChildren(...Array.from(source.body.childNodes, node => document.importNode(node, true)))
  await document.fonts.ready
  window.__ATTENDANCE_FIXTURE_READY__ = true
}

void mount().catch(error => {
  window.__ATTENDANCE_FIXTURE_ERROR__ = error instanceof Error ? error.message : String(error)
  document.body.textContent = window.__ATTENDANCE_FIXTURE_ERROR__
})

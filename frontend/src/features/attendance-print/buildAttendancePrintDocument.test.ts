import { describe, expect, it } from 'vitest'
import { buildAttendancePrintDocument, groupAttendancePrintItems } from './buildAttendancePrintDocument'
import type { AttendancePrintItem } from './types'

const item = (code: string, template = 'Splash1'): AttendancePrintItem => ({
  template,
  roster: {
    code, level: template, serviceName: template, time: '9:00 AM', instructor: 'Alex',
    location: 'Pool', schedule: 'Mon 2026-07-06', students: [{ name: 'Student' }],
  },
})

describe('attendance HTML print document', () => {
  it('pairs only adjacent same-code rosters', () => {
    expect(groupAttendancePrintItems([item('A'), item('A'), item('B'), item('A')]).map(group => group.length)).toEqual([2, 1, 1])
  })

  it('orders paired fronts before paired backs and keeps an odd roster separate', async () => {
    const document = await buildAttendancePrintDocument({
      session: 'Summer',
      rosters: [item('A', 'Splash1'), item('A', 'Splash2A'), item('B', 'SplashPrivate')],
    })
    expect(Array.from(document.querySelectorAll('.print-page')).map(page => page.getAttribute('data-page-kind'))).toEqual([
      'attendance-front', 'attendance-back', 'attendance-front', 'attendance-back',
    ])
    expect(document.querySelectorAll('.print-page')[0].querySelectorAll('.combined-slot')).toHaveLength(2)
    expect(document.querySelectorAll('script')).toHaveLength(0)
    expect(document.documentElement.outerHTML).not.toContain('cdn.tailwindcss.com')
  })
})

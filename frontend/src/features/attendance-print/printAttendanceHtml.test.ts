import { describe, expect, it, vi } from 'vitest'
import { openAttendancePrintWindow } from './openAttendancePrintWindow'
import { printAttendanceHtml } from './printAttendanceHtml'

const roster = {
  code: '123', level: 'Splash1', serviceName: 'Splash 1', time: '9:00 AM',
  instructor: 'Alex', location: 'Main Pool', schedule: 'Mon 2026-07-06', students: [{ name: 'Avery' }],
}

describe('attendance print window', () => {
  it('reports a synchronously blocked popup', () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    expect(openAttendancePrintWindow('Attendance')).toBeNull()
  })

  it('assembles HTML and calls the browser print dialog once', async () => {
    const popupDocument = document.implementation.createHTMLDocument('Preparing')
    const print = vi.fn()
    const close = vi.fn()
    const listeners = new Map<string, EventListener>()
    const popup = {
      document: popupDocument,
      closed: false,
      focus: vi.fn(),
      print,
      close,
      addEventListener: vi.fn((type: string, listener: EventListener) => listeners.set(type, listener)),
      removeEventListener: vi.fn((type: string) => listeners.delete(type)),
      requestAnimationFrame: (callback: FrameRequestCallback) => { callback(0); return 1 },
    } as unknown as Window

    const result = await printAttendanceHtml({ template: 'Splash1', roster, session: 'Summer 2026' }, popup)
    expect(result).toEqual({ status: 'printed' })
    expect(print).toHaveBeenCalledTimes(1)
    listeners.get('afterprint')?.(new Event('afterprint'))
    expect(close).toHaveBeenCalledTimes(1)
  })
})

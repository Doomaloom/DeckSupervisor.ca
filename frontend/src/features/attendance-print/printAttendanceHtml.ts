import { buildAttendancePrintDocument } from './buildAttendancePrintDocument'
import type { AttendancePrintOptions, AttendancePrintRequest, AttendancePrintResult } from './types'

const PREPARATION_TIMEOUT_MS = 15_000

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)
}

export function openAttendancePrintWindow(title = 'Attendance Sheets') {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return null
  printWindow.document.open()
  printWindow.document.write(`<title>${escapeHtml(title)}</title><p style="font-family:Arial,sans-serif">Preparing attendance sheets…</p>`)
  printWindow.document.close()
  return printWindow
}

function withTimeout<T>(promise: Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('Attendance print preparation timed out.')), PREPARATION_TIMEOUT_MS)
    promise.then(value => { window.clearTimeout(timeout); resolve(value) }, error => { window.clearTimeout(timeout); reject(error) })
  })
}

async function waitForLayout(printWindow: Window) {
  if (printWindow.document.fonts) await printWindow.document.fonts.ready
  await new Promise<void>(resolve => printWindow.requestAnimationFrame(() => printWindow.requestAnimationFrame(() => resolve())))
}

export async function printAttendanceHtml(
  request: AttendancePrintRequest,
  existingWindow: Window,
  options: AttendancePrintOptions = {},
): Promise<AttendancePrintResult> {
  try {
    const prepared = await withTimeout(buildAttendancePrintDocument(request, options))
    existingWindow.document.open()
    existingWindow.document.write(`<!doctype html>${prepared.documentElement.outerHTML}`)
    existingWindow.document.close()
    await withTimeout(waitForLayout(existingWindow))
    existingWindow.addEventListener('afterprint', () => existingWindow.close(), { once: true })
    existingWindow.focus()
    existingWindow.print()
    return { status: 'printed' }
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error('Unable to prepare attendance sheets.')
    try {
      existingWindow.document.body.innerHTML = ''
      const message = existingWindow.document.createElement('p')
      message.style.fontFamily = 'Arial, sans-serif'
      message.textContent = error.message
      existingWindow.document.body.append(message)
    } catch {
      // The caller still receives the original preparation error.
    }
    return { status: 'failed', error }
  }
}

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

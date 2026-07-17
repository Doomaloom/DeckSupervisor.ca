import type { AttendancePdfItem, AttendancePdfRequest, PdfArtifact } from '../types'
import { sanitizePdfFilename } from '../pdfUtils'
import { groupAttendanceItems } from './attendanceModel'
import { captureLegacyAttendanceGroup } from './legacyAttendanceCapture'
import { prepareLegacyAttendanceGroup } from './legacyAttendanceDom'

const toPdfBlob = (bytes: Uint8Array) => new Blob([bytes as BlobPart], { type: 'application/pdf' })

export async function generateAttendancePdf(request: AttendancePdfRequest): Promise<PdfArtifact> {
  const items: AttendancePdfItem[] = request.rosters?.length
    ? request.rosters
    : request.roster
      ? [{ template: request.template?.trim() || 'SplashFitness', roster: request.roster }]
      : []
  if (items.length === 0) throw new Error('No attendance rosters were provided.')

  const title = request.title?.trim() || `Attendance - ${items[0].roster.serviceName || items[0].roster.code || 'Roster'}`
  const filename = sanitizePdfFilename(request.filename?.trim() || items[0].roster.code || items[0].template, 'attendance')
  const session = request.session?.trim() || 'Session'
  const { PDFDocument } = await import('pdf-lib')
  const document = await PDFDocument.create()

  for (const group of groupAttendanceItems(items)) {
    const prepared = await prepareLegacyAttendanceGroup(group, session)
    const captures = await captureLegacyAttendanceGroup(prepared)
    for (const capture of captures) {
      const image = await document.embedPng(await capture.arrayBuffer())
      const page = document.addPage([792, 612])
      page.drawImage(image, { x: 0, y: 0, width: 792, height: 612 })
    }
  }

  document.setTitle(title)
  document.setAuthor('DeckSupervisor')
  document.setCreator('DeckSupervisor')
  document.setProducer('DeckSupervisor')
  document.setCreationDate(new Date())
  return { blob: toPdfBlob(await document.save()), filename, title }
}

import React from 'react'
import { renderPdfArtifact } from '../renderPdf'
import type { AttendancePdfItem, AttendancePdfRequest } from '../types'
import { sanitizePdfFilename } from '../pdfUtils'
import { AttendanceDocument } from './AttendanceDocument'

export async function generateAttendancePdf(request: AttendancePdfRequest) {
  const items: AttendancePdfItem[] = request.rosters?.length
    ? request.rosters
    : request.roster
      ? [{ template: request.template?.trim() || 'SplashFitness', roster: request.roster }]
      : []
  if (items.length === 0) {
    throw new Error('No attendance rosters were provided.')
  }

  const title = request.title?.trim() || `Attendance - ${items[0].roster.serviceName || items[0].roster.code || 'Roster'}`
  const filename = sanitizePdfFilename(
    request.filename?.trim() || items[0].roster.code || items[0].template,
    'attendance',
  )
  return renderPdfArtifact(<AttendanceDocument items={items} title={title} />, { title, filename })
}

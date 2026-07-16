import React from 'react'
import { renderPdfArtifact } from '../renderPdf'
import { sanitizePdfFilename } from '../pdfUtils'
import type { SessionReportPdfRequest } from '../types'
import { SessionReportDocument } from './SessionReportDocument'

export async function generateSessionReportPdf(request: SessionReportPdfRequest) {
  const title = typeof request.title === 'string' && request.title.trim() ? request.title.trim() : 'Session Report'
  return renderPdfArtifact(<SessionReportDocument request={request} />, {
    title,
    filename: sanitizePdfFilename(title, `session-report-${new Date().toISOString().slice(0, 10)}`),
  })
}

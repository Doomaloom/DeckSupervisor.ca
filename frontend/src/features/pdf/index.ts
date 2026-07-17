export type {
  AttendancePdfRequest,
  MasterlistPdfRequest,
  PdfArtifact,
  PdfOrientation,
  SchematicPdfRequest,
  SessionReportPdfRequest,
} from './types'
export { PDF_RENDERER_VERSION } from './types'
export { createBlankPdf, mergePdfs, rotatePdf } from './pdfUtils'

export async function generateAttendancePdf(...args: Parameters<typeof import('./attendance/generateAttendancePdf').generateAttendancePdf>) {
  const module = await import('./attendance/generateAttendancePdf')
  return module.generateAttendancePdf(...args)
}

export async function generateMasterlistPdf(...args: Parameters<typeof import('./masterlist/generateMasterlistPdf').generateMasterlistPdf>) {
  const module = await import('./masterlist/generateMasterlistPdf')
  return module.generateMasterlistPdf(...args)
}

export async function generateSchematicPdf(...args: Parameters<typeof import('./schematic/generateSchematicPdf').generateSchematicPdf>) {
  const module = await import('./schematic/generateSchematicPdf')
  return module.generateSchematicPdf(...args)
}

export async function generateSessionReportPdf(...args: Parameters<typeof import('./sessionReport/generateSessionReportPdf').generateSessionReportPdf>) {
  const module = await import('./sessionReport/generateSessionReportPdf')
  return module.generateSessionReportPdf(...args)
}

import React from 'react'
import { pdf } from '@react-pdf/renderer'
import type { PdfArtifact } from './types'
import { registerPdfFonts } from './pdfFonts'

export async function renderPdfArtifact(
  document: React.ReactElement,
  details: Omit<PdfArtifact, 'blob'>,
): Promise<PdfArtifact> {
  registerPdfFonts()
  const blob = await pdf(document).toBlob()
  return { ...details, blob }
}

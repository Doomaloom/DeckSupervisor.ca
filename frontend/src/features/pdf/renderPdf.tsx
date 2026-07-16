import React from 'react'
import { pdf } from '@react-pdf/renderer'
import type { PdfArtifact } from './types'

export async function renderPdfArtifact(
  document: React.ReactElement,
  details: Omit<PdfArtifact, 'blob'>,
): Promise<PdfArtifact> {
  const blob = await pdf(document).toBlob()
  return { ...details, blob }
}

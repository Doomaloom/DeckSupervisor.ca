import React from 'react'
import { renderPdfArtifact } from '../renderPdf'
import { rotatePdf } from '../pdfUtils'
import type { SchematicPdfRequest } from '../types'
import { SchematicDocument } from './SchematicDocument'

export async function generateSchematicPdf(request: SchematicPdfRequest) {
  if (!request.columns?.length) throw new Error('No schematic data found for the selected day.')
  const artifact = await renderPdfArtifact(<SchematicDocument request={request} />, {
    title: 'Schematic',
    filename: `schematic-${new Date().toISOString().slice(0, 10)}.pdf`,
  })
  if (request.rotateCounterClockwise90) {
    artifact.blob = await rotatePdf(artifact.blob, 270)
  }
  return artifact
}

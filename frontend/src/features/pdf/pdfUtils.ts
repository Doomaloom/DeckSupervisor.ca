import { PDFDocument, degrees } from 'pdf-lib'
import type { PdfOrientation } from './types'

const toBlob = (bytes: Uint8Array) => new Blob([bytes as BlobPart], { type: 'application/pdf' })

export async function createBlankPdf(options: {
  orientation: PdfOrientation
  rotateCounterClockwise90?: boolean
}) {
  const document = await PDFDocument.create()
  const size: [number, number] = options.orientation === 'landscape' ? [792, 612] : [612, 792]
  const page = document.addPage(size)
  if (options.rotateCounterClockwise90) {
    page.setRotation(degrees(270))
  }
  document.setTitle('Blank')
  document.setProducer('DeckSupervisor')
  return toBlob(await document.save())
}

export async function mergePdfs(
  inputs: Blob[],
  metadata: { title?: string; filename?: string } = {},
) {
  if (inputs.length === 0) {
    throw new Error('No PDFs were provided.')
  }

  const output = await PDFDocument.create()
  for (const input of inputs) {
    const source = await PDFDocument.load(await input.arrayBuffer())
    const pages = await output.copyPages(source, source.getPageIndices())
    pages.forEach(page => output.addPage(page))
  }
  output.setTitle(metadata.title?.trim() || metadata.filename?.trim() || 'DeckSupervisor PDF')
  output.setProducer('DeckSupervisor')
  output.setCreator('DeckSupervisor')
  output.setCreationDate(new Date())
  return toBlob(await output.save())
}

export async function rotatePdf(blob: Blob, angle: 90 | 180 | 270) {
  const document = await PDFDocument.load(await blob.arrayBuffer())
  document.getPages().forEach(page => {
    const current = page.getRotation().angle
    page.setRotation(degrees((current + angle) % 360))
  })
  return toBlob(await document.save())
}

export function sanitizePdfFilename(value: string, fallback = 'document') {
  const base = value
    .trim()
    .replace(/\.pdf$/i, '')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return `${base || fallback}.pdf`
}

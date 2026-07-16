import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { createBlankPdf, mergePdfs, rotatePdf, sanitizePdfFilename } from './pdfUtils'

describe('frontend PDF utilities', () => {
  it('creates, rotates, and merges vector pages with metadata', async () => {
    const portrait = await createBlankPdf({ orientation: 'portrait' })
    const landscape = await createBlankPdf({ orientation: 'landscape' })
    const rotated = await rotatePdf(landscape, 270)
    const merged = await mergePdfs([portrait, rotated], { title: 'Packet' })
    const document = await PDFDocument.load(await merged.arrayBuffer())
    expect(document.getPageCount()).toBe(2)
    expect(document.getTitle()).toBe('Packet')
    expect(document.getPage(1).getRotation().angle).toBe(270)
  })

  it('sanitizes filenames', () => {
    expect(sanitizePdfFilename('My Session / Report.pdf')).toBe('My-Session-Report.pdf')
  })
})

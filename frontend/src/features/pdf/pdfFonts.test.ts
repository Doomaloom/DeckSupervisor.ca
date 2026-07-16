import { describe, expect, it } from 'vitest'
import { registerPdfFonts } from './pdfFonts'

describe('PDF font registration', () => {
  it('is idempotent', () => {
    const first = registerPdfFonts()
    expect([true, false]).toContain(first)
    expect(registerPdfFonts()).toBe(false)
  })
})

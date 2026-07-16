import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchMasterlistPdf, fetchMasterlistPreviewPdf } from './printApi'

const mocks = vi.hoisted(() => ({
  generateMasterlistPdf: vi.fn(),
}))

vi.mock('../../pdf', () => ({
  generateMasterlistPdf: mocks.generateMasterlistPdf,
}))

describe('masterlist print API', () => {
  beforeEach(() => {
    mocks.generateMasterlistPdf.mockReset()
  })

  it('uses the same frontend document generator for preview and final output', async () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' })
    mocks.generateMasterlistPdf.mockResolvedValue({ blob, filename: 'masterlist.pdf', title: 'Masterlist' })
    const request = { rosters: [], options: {} }

    await expect(fetchMasterlistPreviewPdf(request)).resolves.toBe(blob)
    await expect(fetchMasterlistPdf(request)).resolves.toBe(blob)
    expect(mocks.generateMasterlistPdf).toHaveBeenNthCalledWith(1, request)
    expect(mocks.generateMasterlistPdf).toHaveBeenNthCalledWith(2, request)
  })
})

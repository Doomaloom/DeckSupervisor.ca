import type { MasterlistPdfRequest, SchematicPdfRequest } from '../../pdf/types'

type SchematicPdfPayload = Record<string, unknown>
type MasterlistPayload = Record<string, unknown>

export async function fetchSchematicPdf(payload: SchematicPdfPayload): Promise<Blob> {
  const { generateSchematicPdf } = await import('../../pdf')
  return (await generateSchematicPdf(payload as SchematicPdfRequest)).blob
}

export async function fetchMasterlistPdf(body: MasterlistPayload): Promise<Blob> {
  const { generateMasterlistPdf } = await import('../../pdf')
  return (await generateMasterlistPdf(body as unknown as MasterlistPdfRequest)).blob
}

export async function fetchMasterlistPreviewPdf(body: MasterlistPayload): Promise<Blob> {
  return fetchMasterlistPdf(body)
}

export async function fetchBlankPdf(payload: {
  orientation: 'portrait' | 'landscape'
  rotateCounterClockwise90?: boolean
}): Promise<Blob> {
  const { createBlankPdf } = await import('../../pdf')
  return createBlankPdf(payload)
}

type SchematicPdfPayload = Record<string, unknown>
type MasterlistPayload = Record<string, unknown>

export async function fetchSchematicPdf(payload: SchematicPdfPayload): Promise<Blob> {
  const response = await fetch('/api/schematic-pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Failed to generate schematic PDF.')
  }

  return response.blob()
}

export async function fetchMasterlistPdf(body: MasterlistPayload): Promise<Blob> {
  const response = await fetch('/api/masterlist-rosters', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Failed to generate masterlist.')
  }

  return response.blob()
}

export async function fetchBlankPdf(payload: { orientation: 'portrait' | 'landscape'; rotateCounterClockwise90?: boolean }): Promise<Blob> {
  const response = await fetch('/api/blank-pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Failed to generate blank page.')
  }

  return response.blob()
}

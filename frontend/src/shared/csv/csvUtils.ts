export type CsvRows = string[][]

export type CsvHeaderOptions = {
  stripNonAlphanumeric?: boolean
}

export function parseCsvText(text: string): CsvRows {
  const rows: string[][] = []
  let row: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"' && next === '"') {
      current += '"'
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(current)
      current = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1
      }
      row.push(current)
      current = ''
      if (row.length > 1 || row[0]?.trim()) {
        rows.push(row)
      }
      row = []
      continue
    }

    current += char
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current)
    if (row.length > 1 || row[0]?.trim()) {
      rows.push(row)
    }
  }

  return rows
}

export function normalizeCsvHeader(value: string, options: CsvHeaderOptions = {}) {
  const normalized = value.trim().replace(/^\uFEFF/, '').toLowerCase()
  if (!options.stripNonAlphanumeric) {
    return normalized
  }
  return normalized.replace(/[^a-z0-9]+/g, '')
}

export function buildCsvHeaderIndex(headerRow: string[], options: CsvHeaderOptions = {}) {
  const headerIndex = new Map<string, number>()
  headerRow.forEach((header, index) => {
    const normalized = normalizeCsvHeader(header, options)
    if (normalized) {
      headerIndex.set(normalized, index)
    }
  })
  return headerIndex
}

export function hasAnyCsvHeader(
  headerIndex: Map<string, number>,
  headers: string[],
  options: CsvHeaderOptions = {},
) {
  return headers.some(header => headerIndex.has(normalizeCsvHeader(header, options)))
}

export function getCsvHeaderValue(
  row: string[],
  headerIndex: Map<string, number>,
  headers: string[],
  options: CsvHeaderOptions = {},
) {
  for (const header of headers) {
    const index = headerIndex.get(normalizeCsvHeader(header, options))
    if (index !== undefined && index < row.length) {
      return row[index]?.trim() ?? ''
    }
  }
  return ''
}

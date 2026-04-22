import type { ClassRoster, CsvSessionCandidate, ExtractedClass } from '../types/app'
import { getStoredItem, setStoredItem } from './browserStorage'
import { getScopedKey } from './storageScope'

export type CsvImportDataset = {
  fileName: string
  importedAt: string
  candidates: CsvSessionCandidate[]
  classesBySession: Record<string, ExtractedClass[]>
  rostersByCandidate: Record<string, ClassRoster[]>
}

type CsvImportDatasetsBySession = Record<string, CsvImportDataset>

const csvImportDatasetsBySessionKey = () => getScopedKey('csvImportDatasetsBySession')

function loadAll(): CsvImportDatasetsBySession {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = getStoredItem(csvImportDatasetsBySessionKey())
    return raw ? (JSON.parse(raw) as CsvImportDatasetsBySession) : {}
  } catch (error) {
    console.error('Failed to parse csv import datasets by session', error)
    return {}
  }
}

function saveAll(value: CsvImportDatasetsBySession) {
  if (typeof window === 'undefined') {
    return
  }
  setStoredItem(csvImportDatasetsBySessionKey(), JSON.stringify(value))
}

export function getCsvImportDatasetForSession(sessionId: string): CsvImportDataset | null {
  if (!sessionId) {
    return null
  }
  const all = loadAll()
  return all[sessionId] ?? null
}

export function setCsvImportDatasetForSession(sessionId: string, dataset: CsvImportDataset) {
  if (!sessionId) {
    return
  }
  const all = loadAll()
  all[sessionId] = dataset
  saveAll(all)
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  clearCurrentTermKey,
  getCurrentTermKey,
  onCurrentTermChanged,
  setCurrentTermKey as setCurrentTermKeyStorage,
} from '../lib/termStorage'
import { onStorageScopeChanged } from '../lib/storageScope'

export type CurrentTerm = {
  key: string
  season: string
  year: number
  label: string
}

export function createTermKey(season: string, year: number) {
  const normalizedSeason = season.trim().toLowerCase()
  if (!normalizedSeason || !Number.isFinite(year) || year <= 0) {
    return ''
  }
  return `${normalizedSeason}-${year}`
}

export function formatTermLabel(season: string, year: number) {
  const normalizedSeason = season.trim()
  if (!normalizedSeason || !Number.isFinite(year) || year <= 0) {
    return ''
  }
  const seasonLabel = normalizedSeason.slice(0, 1).toUpperCase() + normalizedSeason.slice(1).toLowerCase()
  return `${seasonLabel} ${year}`
}

export function parseTermKey(key: string): CurrentTerm | null {
  const match = /^([a-z]+)-(\d{4})$/i.exec(key.trim())
  if (!match) {
    return null
  }
  const season = match[1].toLowerCase()
  const year = Number.parseInt(match[2], 10)
  if (!Number.isFinite(year) || year <= 0) {
    return null
  }
  return {
    key: `${season}-${year}`,
    season,
    year,
    label: formatTermLabel(season, year),
  }
}

export function useCurrentTerm() {
  const [currentTermKey, setCurrentTermKeyState] = useState(() => getCurrentTermKey())

  useEffect(() => {
    const unsubscribe = onCurrentTermChanged(key => setCurrentTermKeyState(key))
    const scopeUnsubscribe = onStorageScopeChanged(() => setCurrentTermKeyState(getCurrentTermKey()))
    return () => {
      unsubscribe()
      scopeUnsubscribe()
    }
  }, [])

  const setCurrentTermKey = useCallback((key: string) => {
    if (key) {
      setCurrentTermKeyStorage(key)
    } else {
      clearCurrentTermKey()
    }
    setCurrentTermKeyState(key)
  }, [])

  const clearCurrentTerm = useCallback(() => {
    clearCurrentTermKey()
    setCurrentTermKeyState('')
  }, [])

  const currentTerm = useMemo(() => parseTermKey(currentTermKey), [currentTermKey])

  return {
    currentTermKey,
    currentTerm,
    setCurrentTermKey,
    clearCurrentTerm,
  }
}

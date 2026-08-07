import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupLegacyInstructorPdfCache } from './legacyInstructorPdfCacheCleanup'

describe('cleanupLegacyInstructorPdfCache', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    })
  })

  it('deletes the obsolete database once without blocking startup', () => {
    const request = {} as IDBOpenDBRequest
    const deleteDatabase = vi.fn(() => request)
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: { deleteDatabase },
    })

    cleanupLegacyInstructorPdfCache()
    expect(deleteDatabase).toHaveBeenCalledWith('decksupervisor-pdf-cache')

    request.onsuccess?.(new Event('success') as IDBVersionChangeEvent)
    cleanupLegacyInstructorPdfCache()
    expect(deleteDatabase).toHaveBeenCalledTimes(1)
  })
})

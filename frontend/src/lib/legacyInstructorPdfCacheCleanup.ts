const LEGACY_DATABASE_NAME = 'decksupervisor-pdf-cache'
const CLEANUP_FLAG = 'decksupervisor:legacy-attendance-pdf-cache-cleaned-v1'

export function cleanupLegacyInstructorPdfCache(): void {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return
  }

  try {
    if (window.localStorage.getItem(CLEANUP_FLAG) === '1') {
      return
    }
  } catch {
    // Storage can be unavailable in private browsing; deletion is still safe to try.
  }

  const markComplete = () => {
    try {
      window.localStorage.setItem(CLEANUP_FLAG, '1')
    } catch {
      // Cleanup is best effort and must never prevent printing.
    }
  }

  try {
    const request = window.indexedDB.deleteDatabase(LEGACY_DATABASE_NAME)
    request.onsuccess = markComplete
    request.onerror = () => {
      console.warn('Could not delete the obsolete attendance PDF cache database.', request.error)
      markComplete()
    }
    request.onblocked = () => {
      console.warn('Attendance PDF cache cleanup was blocked by another open tab.')
      markComplete()
    }
  } catch (error) {
    console.warn('Could not start obsolete attendance PDF cache cleanup.', error)
    markComplete()
  }
}

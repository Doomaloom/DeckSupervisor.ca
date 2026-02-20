import { useMemo } from 'react'
import type { SessionReportData } from '../types'

export function useReportInstructorOptions(
  instructorNames: string[],
  reportDraft: SessionReportData,
) {
  return useMemo(() => {
    const names = new Set<string>(instructorNames)
    reportDraft.staff.performance.forEach(entry => {
      if (entry.instructor.trim()) {
        names.add(entry.instructor.trim())
      }
    })
    reportDraft.staff.strengthWeakness.forEach(entry => {
      if (entry.instructor.trim()) {
        names.add(entry.instructor.trim())
      }
    })
    reportDraft.staff.instructorCovers.forEach(entry => {
      if (entry.instructor.trim()) {
        names.add(entry.instructor.trim())
      }
    })
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
  }, [
    instructorNames,
    reportDraft.staff.instructorCovers,
    reportDraft.staff.performance,
    reportDraft.staff.strengthWeakness,
  ])
}

import type { Student } from '../types/app'
import { syncReportCards } from './serverApi'

const UNASSIGNED_LABEL = 'Unassigned'

type SyncReportCardsForDayParams = {
  day: string
  students: Student[]
  sessionLabel: string
  teamId: string | null
}

export type SyncReportCardsForDayResult =
  | { status: 'synced' }
  | { status: 'blocked_unassigned' }
  | { status: 'empty' }

function normalizeInstructor(value: string | null | undefined) {
  return (value ?? '').trim()
}

export function getSessionTermLabel(
  sessionSeason: string | null | undefined,
  sessionYear: number | null | undefined,
  startDate: string | null | undefined,
) {
  const season = sessionSeason?.trim() ?? ''
  const startYear = startDate ? new Date(startDate).getFullYear() : NaN
  const year = sessionYear ?? (Number.isFinite(startYear) ? startYear : null)
  const yearLabel = year ? String(year) : ''
  return [season, yearLabel].filter(Boolean).join(' ')
}

export async function syncReportCardsForDay({
  day,
  students,
  sessionLabel,
  teamId,
}: SyncReportCardsForDayParams): Promise<SyncReportCardsForDayResult> {
  let hasUnassignedInstructors = false

  students.forEach(student => {
    const instructor = normalizeInstructor(student.instructor)
    if (!instructor) {
      hasUnassignedInstructors = true
      return
    }
  })

  if (hasUnassignedInstructors) {
    return { status: 'blocked_unassigned' }
  }
  return syncReportCards({ day, students, sessionLabel, teamId })
}

export function isUnassignedInstructor(name: string) {
  return normalizeInstructor(name) === UNASSIGNED_LABEL
}

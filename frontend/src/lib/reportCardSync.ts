import type { Student } from '../types/app'
import { formatSessionTermLabel } from '../shared/session/sessionLabels'
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

export const getSessionTermLabel = formatSessionTermLabel

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

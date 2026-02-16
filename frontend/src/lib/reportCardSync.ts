import type { Student } from '../types/app'
import { supabase } from './supabaseClient'

const UNASSIGNED_LABEL = 'Unassigned'

type SyncReportCardsForDayParams = {
  day: string
  students: Student[]
  sessionLabel: string
  teamId: string | null
  userId: string
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
  userId,
}: SyncReportCardsForDayParams): Promise<SyncReportCardsForDayResult> {
  const totalsByInstructor = new Map<string, number>()
  let hasUnassignedInstructors = false

  students.forEach(student => {
    const instructor = normalizeInstructor(student.instructor)
    if (!instructor) {
      hasUnassignedInstructors = true
      return
    }
    totalsByInstructor.set(instructor, (totalsByInstructor.get(instructor) ?? 0) + 1)
  })

  if (hasUnassignedInstructors) {
    return { status: 'blocked_unassigned' }
  }

  let clearScope = supabase
    .from('report_cards')
    .delete()
    .eq('session', sessionLabel)
    .eq('day', day)
    .eq('created_by', userId)

  if (teamId) {
    clearScope = clearScope.eq('team_id', teamId)
  } else {
    clearScope = clearScope.is('team_id', null)
  }

  const { error: clearError } = await clearScope
  if (clearError) {
    throw clearError
  }

  if (totalsByInstructor.size === 0) {
    return { status: 'empty' }
  }

  const updatedAt = new Date().toISOString()
  const rows = Array.from(totalsByInstructor.entries()).map(([instructor, total]) => ({
    session: sessionLabel,
    day,
    instructor,
    number_of_report_cards: total,
    team_id: teamId,
    created_by: userId,
    updated_at: updatedAt,
  }))

  const { error: insertError } = await supabase.from('report_cards').insert(rows)
  if (insertError) {
    throw insertError
  }

  return { status: 'synced' }
}

export function isUnassignedInstructor(name: string) {
  return normalizeInstructor(name) === UNASSIGNED_LABEL
}

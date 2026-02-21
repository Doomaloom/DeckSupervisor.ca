import type { ParentFeedbackType, SafetyConcernType, TabConfig } from './types'

export const tabs: TabConfig[] = [
  { key: 'general', label: 'General Session Notes', type: 'note' },
  { key: 'recognition', label: 'Employee Recognition', type: 'note', showEmployee: true },
  { key: 'feedback', label: 'Employee Feedback', type: 'note', showEmployee: true },
  { key: 'coaching', label: 'Employee Coaching', type: 'note', showEmployee: true },
  { key: 'todo', label: 'Todo', type: 'todo' },
  { key: 'report', label: 'Report', type: 'report' },
]

export const SAFETY_CONCERN_TYPES: SafetyConcernType[] = [
  'supervision',
  'guarding',
  'location',
  'equipment',
  'process',
]

export const PARENT_FEEDBACK_TYPES: ParentFeedbackType[] = [
  'complaint',
  'question',
  'comment',
  'praise',
]

export const dayNames: Record<string, string> = {
  Mo: 'Monday',
  Tu: 'Tuesday',
  We: 'Wednesday',
  Th: 'Thursday',
  Fr: 'Friday',
  Sa: 'Saturday',
  Su: 'Sunday',
}

export const normalizeSeason = (value: string | null | undefined) => (value ?? '').trim().toLowerCase()

export const getSessionYear = (sessionYear: number | null, startDate: string | null) => {
  if (sessionYear && Number.isFinite(sessionYear) && sessionYear > 0) {
    return sessionYear
  }
  if (!startDate) {
    return null
  }
  const parsed = new Date(startDate).getFullYear()
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export const formatSessionContext = (
  day: string | null,
  location: string | null,
  season?: string | null,
  sessionYear?: number | null,
  startDate?: string | null,
) => {
  const dayLabel = day ? dayNames[day] ?? day : ''
  const seasonLabel = (season ?? '').trim()
  const year = getSessionYear(sessionYear ?? null, startDate ?? null)
  const yearLabel = year ? String(year) : ''
  const locationLabel = (location ?? '').trim()
  const sessionLabel = [dayLabel, seasonLabel, yearLabel].filter(Boolean).join(' ')
  if (!sessionLabel) {
    return locationLabel
  }
  if (!locationLabel) {
    return sessionLabel
  }
  return `${sessionLabel} | ${locationLabel}`
}

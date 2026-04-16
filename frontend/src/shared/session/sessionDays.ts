export const SESSION_DAY_LABELS: Record<string, string> = {
  Mo: 'Monday',
  Tu: 'Tuesday',
  We: 'Wednesday',
  Th: 'Thursday',
  Fr: 'Friday',
  Sa: 'Saturday',
  Su: 'Sunday',
  'Mo,Tu,We,Th,Fr': 'Mo,Tu,We,Th,Fr',
  'Mini Session 1': 'Mini Session 1',
  'Mini Session 2': 'Mini Session 2',
  'Mini Session 3': 'Mini Session 3',
  'Mini Session 4': 'Mini Session 4',
}

export const SESSION_DAY_ORDER = [
  'Mo',
  'Tu',
  'We',
  'Th',
  'Fr',
  'Sa',
  'Su',
  'Mo,Tu,We,Th,Fr',
  'Mini Session 1',
  'Mini Session 2',
  'Mini Session 3',
  'Mini Session 4',
] as const

const MANUAL_SESSION_DAY_VALUES = [
  'Mo',
  'Tu',
  'We',
  'Th',
  'Fr',
  'Sa',
  'Su',
  'Mini Session 1',
  'Mini Session 2',
  'Mini Session 3',
  'Mini Session 4',
] as const

export const MANUAL_SESSION_DAY_OPTIONS = MANUAL_SESSION_DAY_VALUES.map(value => ({
  value,
  label: SESSION_DAY_LABELS[value] ?? value,
}))

export function isMiniSessionDay(day: string | null | undefined) {
  const trimmed = (day ?? '').trim()
  return (
    trimmed === 'Mini Session 1' ||
    trimmed === 'Mini Session 2' ||
    trimmed === 'Mini Session 3' ||
    trimmed === 'Mini Session 4'
  )
}

export function compareSessionDays(left: string, right: string) {
  const leftTrimmed = left.trim()
  const rightTrimmed = right.trim()
  const leftIndex = SESSION_DAY_ORDER.indexOf(leftTrimmed as (typeof SESSION_DAY_ORDER)[number])
  const rightIndex = SESSION_DAY_ORDER.indexOf(rightTrimmed as (typeof SESSION_DAY_ORDER)[number])

  if (leftIndex === -1 && rightIndex === -1) {
    return leftTrimmed.localeCompare(rightTrimmed, 'en', { sensitivity: 'base' })
  }
  if (leftIndex === -1) {
    return 1
  }
  if (rightIndex === -1) {
    return -1
  }
  return leftIndex - rightIndex
}

export function sortSessionDays(days: string[]) {
  return [...days].sort(compareSessionDays)
}

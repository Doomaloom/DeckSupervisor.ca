import type { RequestAssignment } from '../../../types/app'
import { getDayLabel } from '../../../shared/session/sessionLabels'

export function formatDayLabel(day: string) {
  return getDayLabel(day)
}

export function buildRosterClassKey(day: string, eventId: string, location: string) {
  return [day.trim(), eventId.trim(), location.trim().toLowerCase()].join('::')
}

export function buildAssignmentKey(eventId: string, term: string, location: string) {
  return [
    eventId.trim(),
    term.trim().replace(/\s+/g, ' '),
    location.trim().toLowerCase(),
  ].join('::')
}

export function sortAssignments(assignments: RequestAssignment[]) {
  return [...assignments].sort((left, right) => {
    if (left.term !== right.term) {
      return right.term.localeCompare(left.term)
    }
    if (left.location !== right.location) {
      return left.location.localeCompare(right.location)
    }
    return left.eventId.localeCompare(right.eventId)
  })
}

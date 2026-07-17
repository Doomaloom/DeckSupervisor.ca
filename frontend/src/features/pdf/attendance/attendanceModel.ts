import type { AttendancePdfItem } from '../types'

export function groupAttendanceItems(items: AttendancePdfItem[]) {
  const groups: AttendancePdfItem[][] = []
  for (let index = 0; index < items.length;) {
    const next = items[index + 1]
    if (next && next.roster.code === items[index].roster.code) {
      groups.push([items[index], next])
      index += 2
    } else {
      groups.push([items[index]])
      index += 1
    }
  }
  return groups
}

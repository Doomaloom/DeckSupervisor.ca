import type { PlannerClass, PlannerClassStatus } from '../../../types/app'
import { getPlannerClassCapacityBand } from '../../../lib/sessionPlanner'
import { extractEndTime, extractStartTime, getRunningMinutes } from '../../../lib/time'
import { SESSION_DAY_LABELS, SESSION_DAY_ORDER } from '../../../shared/session/sessionDays'
import { timeToMinutes } from '../../schematic/utils/time'

export const PLANNER_SLOT_HEIGHT_REM = 3.4

export const dayNames = SESSION_DAY_LABELS

export const dayOrder = SESSION_DAY_ORDER

export function statusClasses(status: PlannerClassStatus) {
  switch (status) {
    case 'planned_move':
      return 'border-sky-400 bg-sky-50 text-sky-900'
    case 'pending_cancellation':
      return 'border-amber-400 bg-amber-50 text-amber-900'
    case 'cancelled':
      return 'border-rose-400 bg-rose-50 text-rose-900'
    default:
      return 'border-emerald-400 bg-emerald-50 text-emerald-900'
  }
}

export function capacityClasses(plannerClass: PlannerClass) {
  switch (getPlannerClassCapacityBand(plannerClass)) {
    case 'red':
      return 'bg-rose-100 text-rose-900'
    case 'yellow':
      return 'bg-amber-100 text-amber-900'
    case 'green':
      return 'bg-emerald-100 text-emerald-900'
    default:
      return 'bg-secondary/10 text-secondary'
  }
}

export type PlannerBoardCourse = {
  classKey: string
  serviceName: string
  eventId: string
  eventTime: string
  facility: string
  bookedCount: number
  maximumCapacity: number
  waitlistCount: number
  laneIndex: number
  planningStatus: PlannerClassStatus
  startTime: string
  endTime: string
  startMinutes: number
  endMinutes: number
  runningTime: number
}

export function buildPlannerBoardCourses(classes: PlannerClass[]): PlannerBoardCourse[] {
  return classes
    .map(plannerClass => {
      const startTime = extractStartTime(plannerClass.eventTime)
      const endTime = extractEndTime(plannerClass.eventTime)
      const startMinutes = timeToMinutes(startTime)
      const rawEndMinutes = timeToMinutes(endTime)
      const endMinutes = rawEndMinutes >= startMinutes ? rawEndMinutes : rawEndMinutes + 24 * 60
      return {
        classKey: plannerClass.classKey,
        serviceName: plannerClass.serviceName,
        eventId: plannerClass.eventId,
        eventTime: plannerClass.eventTime,
        facility: plannerClass.facility,
        bookedCount: plannerClass.bookedCount,
        maximumCapacity: plannerClass.maximumCapacity,
        waitlistCount: plannerClass.waitlistCount,
        laneIndex: plannerClass.laneIndex,
        planningStatus: plannerClass.planningStatus,
        startTime,
        endTime,
        startMinutes,
        endMinutes,
        runningTime: getRunningMinutes(plannerClass.eventTime),
      }
    })
    .sort((left, right) => {
      if (left.startMinutes !== right.startMinutes) {
        return left.startMinutes - right.startMinutes
      }
      return left.endMinutes - right.endMinutes
    })
}

export function buildPlannerBoardColumns(courses: PlannerBoardCourse[]) {
  const columns: PlannerBoardCourse[][] = []
  courses.forEach(course => {
    while (columns.length <= course.laneIndex) {
      columns.push([])
    }

    const preferredColumn = columns[course.laneIndex]
    const preferredLast = preferredColumn[preferredColumn.length - 1]
    if (!preferredLast || preferredLast.endMinutes <= course.startMinutes) {
      preferredColumn.push(course)
      return
    }

    for (const column of columns) {
      const last = column[column.length - 1]
      if (!last || last.endMinutes <= course.startMinutes) {
        column.push(course)
        return
      }
    }

    columns.push([course])
  })
  return columns.filter(column => column.length > 0)
}

export function getPlannerBoardStatusClasses(status: PlannerClassStatus, isSelected: boolean) {
  const selectedRing = isSelected ? 'ring-2 ring-secondary ring-inset' : ''
  switch (status) {
    case 'planned_move':
      return `${selectedRing} border-sky-500 bg-sky-100 text-sky-950`
    case 'pending_cancellation':
      return `${selectedRing} border-amber-500 bg-amber-100 text-amber-950`
    case 'cancelled':
      return `${selectedRing} border-rose-500 bg-rose-100 text-rose-950`
    default:
      return `${selectedRing} border-black text-black`
  }
}

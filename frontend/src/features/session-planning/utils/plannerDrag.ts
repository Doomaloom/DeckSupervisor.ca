import type { PlannerBoardCourse } from './plannerPresentation'

function coursesOverlap(left: PlannerBoardCourse, right: PlannerBoardCourse) {
  return left.startMinutes < right.endMinutes && right.startMinutes < left.endMinutes
}

export function findPlannerContiguousSwapIndices(column: PlannerBoardCourse[], course: PlannerBoardCourse) {
  const overlapping = column
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => coursesOverlap(entry, course))
    .sort((left, right) => left.entry.startMinutes - right.entry.startMinutes)

  if (overlapping.length === 0) {
    return []
  }

  if (overlapping[0].entry.startMinutes !== course.startMinutes) {
    return []
  }

  for (let index = 1; index < overlapping.length; index += 1) {
    if (overlapping[index - 1].entry.endMinutes !== overlapping[index].entry.startMinutes) {
      return []
    }
  }

  const last = overlapping[overlapping.length - 1].entry
  if (last.endMinutes !== course.endMinutes) {
    return []
  }

  return overlapping.map(item => item.index)
}

export function canReplacePlannerByStart(
  column: PlannerBoardCourse[],
  course: PlannerBoardCourse,
  targetIndex: number,
) {
  const target = column[targetIndex]
  if (!target || target.startMinutes !== course.startMinutes) {
    return false
  }
  return !column.some((entry, index) => index !== targetIndex && coursesOverlap(entry, course))
}

export function canPlacePlannerCourses(column: PlannerBoardCourse[], courses: PlannerBoardCourse[]) {
  return courses.every(course => !column.some(entry => coursesOverlap(entry, course)))
}

export function canSwapSinglePlannerCourses(
  sourceColumn: PlannerBoardCourse[],
  targetColumn: PlannerBoardCourse[],
  sourceCourse: PlannerBoardCourse,
  targetCourse: PlannerBoardCourse,
) {
  const nextSource = sourceColumn.filter(course => course.classKey !== sourceCourse.classKey)
  const nextTarget = targetColumn.filter(course => course.classKey !== targetCourse.classKey)
  return canPlacePlannerCourses(nextSource, [targetCourse]) && canPlacePlannerCourses(nextTarget, [sourceCourse])
}


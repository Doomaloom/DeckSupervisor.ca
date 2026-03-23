import type { Course } from '../types'
import { normalizeCourseCodeForCompare } from './courseCode'
import { coursesOverlap } from './courses'
import { canPlaceCourses } from './drag'

export type StoredCourseLayout = {
    codes: string[]
    instructors: string[]
}

export type RequestAwareLayout = {
    columns: Course[][]
    instructors: string[]
    lockedInstructors: string[]
}

type ColumnFitScore = {
    columnIndex: number
    totalGap: number
    exactTouchCount: number
    largestGap: number
    blockSize: number
}

function getStoredCourseOrder(courses: Course[], stored: StoredCourseLayout | null) {
    if (!stored || stored.codes.length === 0) {
        return courses
    }
    const courseMap = new Map(courses.map(course => [normalizeCourseCodeForCompare(course.code), course]))
    const ordered: Course[] = []
    const seen = new Set<string>()

    stored.codes.forEach(value => {
        value
            .split(',')
            .map(code => courseMap.get(normalizeCourseCodeForCompare(code)))
            .filter(Boolean)
            .forEach(course => {
                if (!course || seen.has(course.code)) {
                    return
                }
                seen.add(course.code)
                ordered.push(course)
            })
    })

    courses.forEach(course => {
        if (!seen.has(course.code)) {
            ordered.push(course)
        }
    })

    return ordered
}

function getBestFitColumnIndex(
    columns: Course[][],
    course: Course,
    options?: { lockedInstructor?: string; lockedInstructors?: string[] },
) {
    return getBestFitColumnIndexForBlock(columns, [course], options)
}

function getBestFitColumnIndexForBlock(
    columns: Course[][],
    courses: Course[],
    options?: { lockedInstructor?: string; lockedInstructors?: string[] },
) {
    if (courses.length === 0) {
        return -1
    }

    const scores: ColumnFitScore[] = []
    const firstCourse = courses[0]
    const lastCourse = courses[courses.length - 1]

    columns.forEach((column, columnIndex) => {
        const lockedInstructor = options?.lockedInstructor?.trim() ?? ''
        const columnLockedInstructor = options?.lockedInstructors?.[columnIndex]?.trim() ?? ''
        if (lockedInstructor && columnLockedInstructor !== lockedInstructor) {
            return
        }
        if (!canPlaceCourses(column, courses)) {
            return
        }

        const previousCourse = [...column]
            .filter(entry => entry.endMinutes <= firstCourse.startMinutes)
            .sort((left, right) => right.endMinutes - left.endMinutes)[0]
        const nextCourse = [...column]
            .filter(entry => entry.startMinutes >= lastCourse.endMinutes)
            .sort((left, right) => left.startMinutes - right.startMinutes)[0]

        const gapBefore = previousCourse ? firstCourse.startMinutes - previousCourse.endMinutes : Number.POSITIVE_INFINITY
        const gapAfter = nextCourse ? nextCourse.startMinutes - lastCourse.endMinutes : Number.POSITIVE_INFINITY
        const exactTouchCount = Number(gapBefore === 0) + Number(gapAfter === 0)
        const finiteGaps = [gapBefore, gapAfter].filter(value => Number.isFinite(value))
        const totalGap =
            finiteGaps.length > 0 ? finiteGaps.reduce((sum, value) => sum + value, 0) : Number.MAX_SAFE_INTEGER
        const largestGap =
            finiteGaps.length > 0 ? finiteGaps.reduce((largest, value) => Math.max(largest, value), 0) : Number.MAX_SAFE_INTEGER

        scores.push({
            columnIndex,
            totalGap,
            exactTouchCount,
            largestGap,
            blockSize: courses.length,
        })
    })

    scores.sort((left, right) => {
        if (left.blockSize !== right.blockSize) {
            return right.blockSize - left.blockSize
        }
        if (left.exactTouchCount !== right.exactTouchCount) {
            return right.exactTouchCount - left.exactTouchCount
        }
        if (left.totalGap !== right.totalGap) {
            return left.totalGap - right.totalGap
        }
        if (left.largestGap !== right.largestGap) {
            return left.largestGap - right.largestGap
        }
        return left.columnIndex - right.columnIndex
    })

    return scores[0]?.columnIndex ?? -1
}

function getMaxCompatiblePrefix(courses: Course[]) {
    if (courses.length === 0) {
        return []
    }
    const block: Course[] = [courses[0]]
    for (let index = 1; index < courses.length; index += 1) {
        const nextCourse = courses[index]
        const lastCourse = block[block.length - 1]
        if (coursesOverlap(lastCourse, nextCourse)) {
            break
        }
        block.push(nextCourse)
    }
    return block
}

function sortCoursesByStart(courses: Course[]) {
    return [...courses].sort((left, right) => left.startTime.localeCompare(right.startTime))
}

export function createRequestAwareLayout(
    courses: Course[],
    stored: StoredCourseLayout | null = null,
): RequestAwareLayout {
    const orderedCourses = getStoredCourseOrder(courses, stored)
    const lockedCourses = orderedCourses.filter(course => course.isLockedToInstructor && course.assignedInstructor)
    const flexibleCourses = orderedCourses.filter(course => !course.isLockedToInstructor || !course.assignedInstructor)
    const columns: Course[][] = []
    const instructors: string[] = []
    const lockedInstructors: string[] = []

    lockedCourses.forEach(course => {
        const targetIndex = getBestFitColumnIndex(columns, course, {
            lockedInstructor: course.assignedInstructor,
            lockedInstructors,
        })

        if (targetIndex >= 0) {
            columns[targetIndex].push(course)
            columns[targetIndex] = sortCoursesByStart(columns[targetIndex])
            instructors[targetIndex] = course.assignedInstructor ?? ''
            lockedInstructors[targetIndex] = course.assignedInstructor ?? ''
            return
        }

        columns.push([course])
        instructors.push(course.assignedInstructor ?? '')
        lockedInstructors.push(course.assignedInstructor ?? '')
    })

    const remainingFlexible = [...flexibleCourses]
    while (remainingFlexible.length > 0) {
        const compatiblePrefix = getMaxCompatiblePrefix(remainingFlexible)
        let placed = false

        for (let size = compatiblePrefix.length; size >= 1; size -= 1) {
            const block = compatiblePrefix.slice(0, size)
            const targetIndex = getBestFitColumnIndexForBlock(columns, block, { lockedInstructors })
            if (targetIndex >= 0) {
                columns[targetIndex].push(...block)
                columns[targetIndex] = sortCoursesByStart(columns[targetIndex])
                remainingFlexible.splice(0, size)
                placed = true
                break
            }
        }

        if (placed) {
            continue
        }

        const fallbackCourse = remainingFlexible.shift()
        if (!fallbackCourse) {
            break
        }
        columns.push([fallbackCourse])
        instructors.push('')
        lockedInstructors.push('')
    }

    if (stored?.instructors?.length) {
        instructors.forEach((value, index) => {
            if (value || lockedInstructors[index]) {
                return
            }
            instructors[index] = stored.instructors[index] ?? ''
        })
    }

    return {
        columns,
        instructors: instructors.map((value, index) => lockedInstructors[index] || value || ''),
        lockedInstructors,
    }
}

export function getLockedInstructorForColumn(column: Course[]) {
    const locked = Array.from(new Set(column.map(course => course.assignedInstructor).filter(Boolean)))
    return locked[0] ?? ''
}

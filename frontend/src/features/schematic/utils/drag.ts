import type { Course } from '../types'
import { coursesOverlap } from './courses'

export function findContiguousSwapIndices(column: Course[], course: Course) {
    const overlapping = column
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => coursesOverlap(entry, course))
        .sort((a, b) => a.entry.startMinutes - b.entry.startMinutes)

    if (overlapping.length === 0) {
        return []
    }

    if (overlapping[0].entry.startMinutes !== course.startMinutes) {
        return []
    }

    for (let i = 1; i < overlapping.length; i += 1) {
        if (overlapping[i - 1].entry.endMinutes !== overlapping[i].entry.startMinutes) {
            return []
        }
    }

    const last = overlapping[overlapping.length - 1].entry
    if (last.endMinutes !== course.endMinutes) {
        return []
    }

    return overlapping.map(item => item.index)
}

export function canReplaceByStart(column: Course[], course: Course, targetIndex: number) {
    const target = column[targetIndex]
    if (!target || target.startMinutes !== course.startMinutes) {
        return false
    }
    return !column.some((entry, index) => index !== targetIndex && coursesOverlap(entry, course))
}

export function canPlaceCourses(column: Course[], courses: Course[]) {
    return courses.every(course => !column.some(entry => coursesOverlap(entry, course)))
}

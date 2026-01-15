import { extractEndTime, extractStartTime, getRunningMinutes } from '../../../lib/time'
import type { Student } from '../../../types/app'
import type { Course } from '../types'
import { timeToMinutes } from './time'

export function buildCourses(students: Student[]): Course[] {
    const map = new Map<string, Course>()
    students.forEach(student => {
        const existing = map.get(student.code)
        if (existing) {
            existing.studentCount += 1
            return
        }
        const startTime = extractStartTime(student.time)
        const endTime = extractEndTime(student.time)
        const startMinutes = timeToMinutes(startTime)
        const endMinutes = timeToMinutes(endTime)
        map.set(student.code, {
            code: student.code,
            level: student.level || student.service_name,
            runningTime: getRunningMinutes(student.time),
            startTime,
            endTime,
            startMinutes,
            endMinutes,
            studentCount: 1,
        })
    })

    return Array.from(map.values()).sort((a, b) => {
        if (a.startTime === b.startTime) {
            return a.endTime.localeCompare(b.endTime)
        }
        return a.startTime.localeCompare(b.startTime)
    })
}

export function buildColumns(courses: Course[]): Course[][] {
    const columns: Course[][] = []
    courses.forEach(course => {
        let added = false
        for (const column of columns) {
            const lastCourse = column[column.length - 1]
            if (lastCourse.endTime <= course.startTime) {
                column.push(course)
                added = true
                break
            }
        }
        if (!added) {
            columns.push([course])
        }
    })
    return columns
}

export function coursesMatchTime(a: Course, b: Course) {
    return a.startMinutes === b.startMinutes && a.endMinutes === b.endMinutes
}

export function coursesOverlap(a: Course, b: Course) {
    return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes
}

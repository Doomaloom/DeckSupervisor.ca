import { extractEndTime, extractStartTime, getRunningMinutes } from '../../../lib/time'
import type { Student } from '../../../types/app'
import type { Course } from '../types'
import { timeToMinutes } from './time'

export type BuildCoursesOptions = {
    assignedInstructorByCode?: Map<string, string>
    requestInstructorByCode?: Map<string, string>
    requestHighlightOnlyCodes?: Set<string>
}

function normalizeBuildCoursesOptions(input?: Map<string, string> | BuildCoursesOptions): BuildCoursesOptions {
    if (!input) {
        return {}
    }
    if (input instanceof Map) {
        return {
            assignedInstructorByCode: input,
            requestInstructorByCode: input,
        }
    }
    return input
}

export function buildCourses(students: Student[], optionsInput?: Map<string, string> | BuildCoursesOptions): Course[] {
    const options = normalizeBuildCoursesOptions(optionsInput)
    const map = new Map<string, Course>()
    students.forEach(student => {
        const existing = map.get(student.code)
        if (existing) {
            if (!student.waitlist) {
                existing.studentCount += 1
                if (!existing.studentName) {
                    existing.studentName = student.name
                }
            }
            return
        }
        const rosterInstructor = options.assignedInstructorByCode?.get(student.code) ?? ''
        const requestInstructor = options.requestInstructorByCode?.get(student.code) ?? ''
        const requestHighlightOnly = Boolean(options.requestHighlightOnlyCodes?.has(student.code))
        const assignedInstructor = requestHighlightOnly ? rosterInstructor : requestInstructor || rosterInstructor
        const startTime = extractStartTime(student.time)
        const endTime = extractEndTime(student.time)
        const startMinutes = timeToMinutes(startTime)
        const endMinutes = timeToMinutes(endTime)
        map.set(student.code, {
            code: student.code,
            level: student.service_name || student.level,
            runningTime: getRunningMinutes(student.time),
            startTime,
            endTime,
            startMinutes,
            endMinutes,
            studentCount: student.waitlist ? 0 : 1,
            studentName: student.waitlist ? undefined : student.name,
            assignedInstructor: assignedInstructor || undefined,
            requestInstructor: requestInstructor || undefined,
            requestHighlightOnly,
            isRequested: Boolean(requestInstructor),
            isLockedToInstructor: Boolean(requestInstructor) && !requestHighlightOnly,
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

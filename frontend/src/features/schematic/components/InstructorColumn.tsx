import React from 'react'
import { SLOT_HEIGHT_REM, SLOT_MINUTES } from '../constants'
import type { Course } from '../types'
import { getCapacity, getCapacityClass } from '../utils/capacity'
import CourseCard from './CourseCard'

type InstructorColumnProps = {
    column: Course[]
    columnIndex: number
    instructor: string
    scheduleHeightRem: number
    scheduleStartMinutes: number
    onInstructorChange: (columnIndex: number, value: string) => void
    onColumnDrop: (columnIndex: number) => void
    onCourseDrop: (course: Course, columnIndex: number) => void
    onCourseDragStart: (event: React.DragEvent<HTMLDivElement>, course: Course, columnIndex: number) => void
}

function InstructorColumn({
    column,
    columnIndex,
    instructor,
    scheduleHeightRem,
    scheduleStartMinutes,
    onInstructorChange,
    onColumnDrop,
    onCourseDrop,
    onCourseDragStart,
}: InstructorColumnProps) {
    return (
        <div
            className="flex min-w-[220px] flex-1 flex-col"
            onDragOver={event => event.preventDefault()}
            onDrop={() => onColumnDrop(columnIndex)}
        >
            <div className="rounded-t-xl border-2 border-secondary bg-accent p-2">
                <input
                    className="w-full rounded-lg border-2 border-secondary bg-bg px-2 py-1 text-sm text-primary"
                    type="text"
                    value={instructor}
                    placeholder={`Instructor ${columnIndex + 1}`}
                    onChange={event => onInstructorChange(columnIndex, event.target.value)}
                />
            </div>
            <div
                className="relative rounded-b-xl border-2 border-secondary bg-bg"
                style={{ height: `${scheduleHeightRem}rem` }}
            >
                {column.map(course => {
                    const startOffset = (course.startMinutes - scheduleStartMinutes) / SLOT_MINUTES
                    const courseHeight = course.runningTime / SLOT_MINUTES
                    const capacity = getCapacity(course)
                    const capacityClass = getCapacityClass(course, capacity)
                    return (
                        <CourseCard
                            key={course.code}
                            course={course}
                            capacity={capacity}
                            capacityClass={capacityClass}
                            onDragStart={event => onCourseDragStart(event, course, columnIndex)}
                            onDrop={() => onCourseDrop(course, columnIndex)}
                            style={{
                                top: `${startOffset * SLOT_HEIGHT_REM}rem`,
                                height: `${courseHeight * SLOT_HEIGHT_REM}rem`,
                            }}
                        />
                    )
                })}
            </div>
        </div>
    )
}

export default InstructorColumn

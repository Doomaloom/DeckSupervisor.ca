import React from 'react'
import { COLUMN_MIN_WIDTH_PX, SLOT_HEIGHT_REM, SLOT_MINUTES } from '../constants'
import type { Course } from '../types'
import { getCapacity, getCapacityClass } from '../utils/capacity'
import CourseCard from './CourseCard'

type InstructorColumnProps = {
    column: Course[]
    columnIndex: number
    instructor: string
    instructorOptions: string[]
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
    instructorOptions,
    scheduleHeightRem,
    scheduleStartMinutes,
    onInstructorChange,
    onColumnDrop,
    onCourseDrop,
    onCourseDragStart,
}: InstructorColumnProps) {
    const columnBorderClass = columnIndex === 0 ? 'border-black' : 'border-black border-l-0'
    return (
        <div
            className="flex flex-1 flex-col"
            style={{ minWidth: `${COLUMN_MIN_WIDTH_PX}px` }}
            onDragOver={event => event.preventDefault()}
            onDrop={() => onColumnDrop(columnIndex)}
        >
            <div className={`border border-black bg-accent p-2 ${columnBorderClass}`}>
                <select
                    className="w-full rounded-none border border-black bg-white px-2 py-1 text-sm text-black"
                    value={instructor}
                    onChange={event => onInstructorChange(columnIndex, event.target.value)}
                >
                    <option value="">{`Instructor ${columnIndex + 1}`}</option>
                    {instructorOptions.map(name => (
                        <option key={`${columnIndex}-${name}`} value={name}>
                            {name}
                        </option>
                    ))}
                </select>
            </div>
            <div
                className={`relative border border-black border-t-0 bg-bg ${columnBorderClass}`}
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

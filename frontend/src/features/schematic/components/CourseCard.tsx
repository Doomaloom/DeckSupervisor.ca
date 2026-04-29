import React from 'react'
import type { Course } from '../types'

type CourseCardProps = {
    course: Course
    capacity: number
    capacityClass: string
    style: React.CSSProperties
    selected?: boolean
    draggable?: boolean
    onClick: () => void
    onDragStart: (event: React.DragEvent<HTMLDivElement>) => void
    onDrop: () => void
}

function CourseCard({
    course,
    capacity,
    capacityClass,
    style,
    selected = false,
    draggable = true,
    onClick,
    onDragStart,
    onDrop,
}: CourseCardProps) {
    const requestClass = course.requestHighlightOnly
        ? 'bg-yellow-50 ring-1 ring-yellow-300'
        : course.isRequested
            ? 'bg-yellow-200 ring-2 ring-yellow-500'
            : 'bg-white'
    const selectedClass = selected ? 'ring-4 ring-secondary ring-offset-1' : ''

    return (
        <div
            className={`absolute left-0 right-0 flex cursor-pointer flex-col overflow-hidden border border-black text-xs text-black ${requestClass} ${selectedClass}`}
            draggable={draggable}
            onClick={onClick}
            onDragStart={onDragStart}
            onDragOver={event => event.preventDefault()}
            onDrop={onDrop}
            style={style}
        >
            <div className="flex flex-1 flex-col items-center justify-center gap-1 px-2 py-1 text-center">
                <p className="font-semibold">{course.level}</p>
                <p>{course.code}</p>
                {course.isRequested && (course.requestInstructor || course.assignedInstructor) ? (
                    <p className={`${course.requestHighlightOnly ? 'bg-yellow-200' : 'bg-yellow-400'} rounded-full px-2 py-0.5 text-[0.65rem] font-semibold`}>
                        Request: {course.requestInstructor || course.assignedInstructor}
                    </p>
                ) : null}
                {course.studentName && course.level.toLowerCase().includes('private') && (
                    <p className="text-[0.7rem] font-semibold">{course.studentName}</p>
                )}
            </div>
            <div className={`border-t border-black px-2 py-0.5 text-center text-[0.7rem] font-semibold ${capacityClass}`}>
                {course.studentCount} of {capacity}
            </div>
        </div>
    )
}

export default CourseCard

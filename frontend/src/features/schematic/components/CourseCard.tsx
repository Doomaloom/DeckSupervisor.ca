import React from 'react'
import type { Course } from '../types'

type CourseCardProps = {
    course: Course
    capacity: number
    capacityClass: string
    style: React.CSSProperties
    onDragStart: (event: React.DragEvent<HTMLDivElement>) => void
    onDrop: () => void
}

function CourseCard({ course, capacity, capacityClass, style, onDragStart, onDrop }: CourseCardProps) {
    return (
        <div
            className="absolute left-0 right-0 flex flex-col overflow-hidden border border-black bg-white text-xs text-black"
            draggable
            onDragStart={onDragStart}
            onDragOver={event => event.preventDefault()}
            onDrop={onDrop}
            style={style}
        >
            <div className="flex flex-1 flex-col items-center justify-center gap-1 px-2 py-1 text-center">
                <p className="font-semibold">{course.level}</p>
                <p>{course.code}</p>
            </div>
            <div className={`border-t border-black px-2 py-0.5 text-center text-[0.7rem] font-semibold ${capacityClass}`}>
                {course.studentCount} of {capacity}
            </div>
        </div>
    )
}

export default CourseCard

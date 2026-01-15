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
            className="absolute left-2 right-2 flex flex-col gap-2 rounded-xl border-2 border-secondary bg-accent p-2 text-xs shadow-md"
            draggable
            onDragStart={onDragStart}
            onDragOver={event => event.preventDefault()}
            onDrop={onDrop}
            style={style}
        >
            <div className="flex flex-col gap-1">
                <p className="font-semibold text-secondary">{course.level}</p>
                <p className="text-primary">{course.code}</p>
            </div>
            <div className={`mt-auto w-fit rounded-md border px-2 py-1 text-[0.7rem] font-semibold ${capacityClass}`}>
                {course.studentCount} of {capacity}
            </div>
        </div>
    )
}

export default CourseCard

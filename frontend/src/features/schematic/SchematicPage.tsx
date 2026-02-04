import React from 'react'
import { useDay } from '../../app/DayContext'
import { dayNames } from './constants'
import SchematicBoard from './components/SchematicBoard'
import { useSchematicSchedule } from './hooks/useSchematicSchedule'

function SchematicPage() {
    const { selectedDay } = useDay()
    const {
        columns,
        instructors,
        timeLabels,
        scheduleHeightRem,
        scheduleStartMinutes,
        instructorOptions,
        handleDragStart,
        handleDrop,
        handleDropOnCourse,
        handleSaveSchedule,
        setInstructorAt,
    } = useSchematicSchedule(selectedDay)

    const dayLabel = selectedDay ? (dayNames[selectedDay] ?? selectedDay) : 'Select Day'
    const sessionLabel = `${dayLabel} Winter 2026`

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <SchematicBoard
                columns={columns}
                instructors={instructors}
                timeLabels={timeLabels}
                scheduleHeightRem={scheduleHeightRem}
                scheduleStartMinutes={scheduleStartMinutes}
                instructorOptions={instructorOptions}
                sessionLabel={sessionLabel}
                onInstructorChange={setInstructorAt}
                onColumnDrop={handleDrop}
                onCourseDrop={handleDropOnCourse}
                onCourseDragStart={handleDragStart}
            />

            <div className="flex justify-center">
                <button
                    className="rounded-2xl bg-primary px-6 py-3 text-white transition hover:-translate-y-0.5 hover:bg-secondary"
                    onClick={handleSaveSchedule}
                >
                    Save Schedule
                </button>
            </div>
        </div>
    )
}

export default SchematicPage

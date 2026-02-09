import React from 'react'
import { useDay } from '../../app/DayContext'
import { useCurrentSession } from '../../app/useCurrentSession'
import { dayNames } from './constants'
import SchematicBoard from './components/SchematicBoard'
import { useSchematicSchedule } from './hooks/useSchematicSchedule'

function SchematicPage() {
    const { selectedDay } = useDay()
    const { access, session } = useCurrentSession()
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
    const seasonLabel = session?.session_season?.trim() ?? ''
    const yearLabel = session?.start_date ? new Date(session.start_date).getFullYear() : NaN
    const sessionLabel = [dayLabel, seasonLabel, Number.isFinite(yearLabel) ? String(yearLabel) : '']
        .filter(Boolean)
        .join(' ')
    const isReadOnly = access.mode === 'shared'

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
                onInstructorChange={isReadOnly ? () => {} : setInstructorAt}
                onColumnDrop={isReadOnly ? () => {} : handleDrop}
                onCourseDrop={isReadOnly ? () => {} : handleDropOnCourse}
                onCourseDragStart={isReadOnly ? () => {} : handleDragStart}
            />

            <div className="flex justify-center">
                <button
                    className="rounded-2xl bg-primary px-6 py-3 text-white transition hover:-translate-y-0.5 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleSaveSchedule}
                    disabled={isReadOnly}
                >
                    {isReadOnly ? 'View Only' : 'Save Schedule'}
                </button>
            </div>
        </div>
    )
}

export default SchematicPage

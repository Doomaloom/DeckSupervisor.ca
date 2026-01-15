import React from 'react'
import { useDay } from '../../app/DayContext'
import { HEADER_HEIGHT_REM, dayNames } from './constants'
import InstructorColumn from './components/InstructorColumn'
import TimeRail from './components/TimeRail'
import { useSchematicSchedule } from './hooks/useSchematicSchedule'

function SchematicPage() {
    const { selectedDay } = useDay()
    const {
        columns,
        instructors,
        timeLabels,
        scheduleHeightRem,
        scheduleStartMinutes,
        handleDragStart,
        handleDrop,
        handleDropOnCourse,
        handleSaveSchedule,
        setInstructorAt,
    } = useSchematicSchedule(selectedDay)

    const dayLabel = selectedDay ? (dayNames[selectedDay] ?? selectedDay) : 'Select Day'

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <div className="flex w-full flex-col gap-4 overflow-x-auto">
                <div className="flex flex-wrap gap-3">
                    <span className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-accent">
                        Schematic
                    </span>
                    <span className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-accent">
                        {dayLabel} Winter 2026
                    </span>
                </div>

                <div className="flex w-full items-start justify-center gap-4">
                    <TimeRail
                        className="mt-8 flex min-w-[70px] flex-col items-center text-xs text-secondary"
                        headerHeightRem={HEADER_HEIGHT_REM}
                        labels={timeLabels}
                        keyPrefix="left"
                    />

                    <div className="flex flex-col gap-3" id="main-content">
                        {columns.length === 0 && (
                            <p className="text-secondary">
                                No schedule data loaded. Upload a CSV file to generate the schedule.
                            </p>
                        )}
                        <div className="rounded-xl bg-primary px-4 py-2 text-center font-semibold text-accent">
                            Instructors/Level
                        </div>
                        <div className="flex gap-4">
                            {columns.map((column, columnIndex) => (
                                <InstructorColumn
                                    key={`column-${columnIndex}`}
                                    column={column}
                                    columnIndex={columnIndex}
                                    instructor={instructors[columnIndex] ?? ''}
                                    scheduleHeightRem={scheduleHeightRem}
                                    scheduleStartMinutes={scheduleStartMinutes}
                                    onInstructorChange={setInstructorAt}
                                    onColumnDrop={handleDrop}
                                    onCourseDrop={handleDropOnCourse}
                                    onCourseDragStart={handleDragStart}
                                />
                            ))}
                        </div>
                    </div>

                    <TimeRail
                        className="mt-8 flex min-w-[70px] flex-col items-center text-xs text-secondary"
                        headerHeightRem={HEADER_HEIGHT_REM}
                        labels={timeLabels}
                        keyPrefix="right"
                    />
                </div>
            </div>

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

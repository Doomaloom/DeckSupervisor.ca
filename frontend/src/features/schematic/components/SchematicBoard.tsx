import React from 'react'
import { HEADER_HEIGHT_REM, SLOT_HEIGHT_REM } from '../constants'
import type { Course } from '../types'
import InstructorColumn from './InstructorColumn'
import TimeRail from './TimeRail'

type SchematicBoardProps = {
    columns: Course[][]
    instructors: string[]
    timeLabels: string[]
    scheduleHeightRem: number
    scheduleStartMinutes: number
    instructorOptions: string[]
    sessionLabel: string
    readOnly?: boolean
    onInstructorChange: (columnIndex: number, value: string) => void
    onColumnDrop: (columnIndex: number) => void
    onCourseDrop: (course: Course, columnIndex: number) => void
    onCourseDragStart: (event: React.DragEvent<HTMLDivElement>, course: Course, columnIndex: number) => void
}

function SchematicBoard({
    columns,
    instructors,
    timeLabels,
    scheduleHeightRem,
    scheduleStartMinutes,
    instructorOptions,
    sessionLabel,
    readOnly = false,
    onInstructorChange,
    onColumnDrop,
    onCourseDrop,
    onCourseDragStart,
}: SchematicBoardProps) {
    return (
        <div className="flex w-full flex-col gap-4">
            <div className="flex flex-wrap gap-3">
                <span className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-accent">
                    Schematic
                </span>
                <span className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-accent">
                    {sessionLabel}
                </span>
            </div>

            <div className="flex w-full items-start justify-center gap-4">
                <TimeRail
                    className="mt-8 flex min-w-[70px] flex-col items-center text-xs text-secondary"
                    headerHeightRem={HEADER_HEIGHT_REM}
                    slotHeightRem={SLOT_HEIGHT_REM}
                    labels={timeLabels}
                    keyPrefix="left"
                />

                <div className="flex-1 overflow-x-auto">
                    <div className="flex flex-col gap-3" id="main-content">
                        {columns.length === 0 && (
                            <p className="text-secondary">
                                No schedule data loaded. Upload a CSV file to generate the schedule.
                            </p>
                        )}
                        <div className="rounded-xl bg-primary px-4 py-2 text-center font-semibold text-accent">
                            Instructors/Level
                        </div>
                        <div className="flex">
                            {columns.map((column, columnIndex) => (
                                <InstructorColumn
                                    key={`column-${columnIndex}`}
                                    column={column}
                                    columnIndex={columnIndex}
                                    instructor={instructors[columnIndex] ?? ''}
                                    instructorOptions={instructorOptions}
                                    scheduleHeightRem={scheduleHeightRem}
                                    scheduleStartMinutes={scheduleStartMinutes}
                                    readOnly={readOnly}
                                    onInstructorChange={onInstructorChange}
                                    onColumnDrop={onColumnDrop}
                                    onCourseDrop={onCourseDrop}
                                    onCourseDragStart={onCourseDragStart}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <TimeRail
                    className="mt-8 flex min-w-[70px] flex-col items-center text-xs text-secondary"
                    headerHeightRem={HEADER_HEIGHT_REM}
                    slotHeightRem={SLOT_HEIGHT_REM}
                    labels={timeLabels}
                    keyPrefix="right"
                />
            </div>
        </div>
    )
}

export default SchematicBoard

import React from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import {
    HEADER_HEIGHT_REM,
    SCHEDULE_HEADER_HEIGHT,
    SCHEDULE_SLOT_HEIGHT,
    SLOT_HEIGHT_REM,
} from "../constants";
import type { Course } from "../types";
import InstructorColumn from "./InstructorColumn";
import TimeRail from "./TimeRail";

type SchematicBoardProps = {
    columns: Course[][];
    instructors: string[];
    instructorIds?: (string | null)[];
    lockedInstructors?: string[];
    selectedCourseCodes?: string[];
    timeLabels: string[];
    scheduleHeightRem: number;
    scheduleStartMinutes: number;
    instructorOptions: (string | { id: string; name: string; label: string })[];
    sessionLabel: string;
    readOnly?: boolean;
    onAddColumn?: () => void;
    onRemoveColumn?: (columnIndex: number) => void;
    onInstructorChange: (columnIndex: number, value: string) => void;
    onCourseSelect: (course: Course, columnIndex: number) => void;
    onColumnDrop: (columnIndex: number) => void;
    onCourseDrop: (course: Course, columnIndex: number) => void;
    onCourseDragStart: (
        event: React.DragEvent<HTMLDivElement>,
        course: Course,
        columnIndex: number,
    ) => void;
};

function SchematicBoard({
    columns,
    instructors,
    instructorIds,
    lockedInstructors = [],
    selectedCourseCodes = [],
    timeLabels,
    scheduleHeightRem,
    scheduleStartMinutes,
    instructorOptions,
    sessionLabel,
    readOnly = false,
    onAddColumn,
    onRemoveColumn,
    onInstructorChange,
    onCourseSelect,
    onColumnDrop,
    onCourseDrop,
    onCourseDragStart,
}: SchematicBoardProps) {
    return (
        <div className="flex min-w-0 w-full flex-col gap-4">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-semibold text-secondary">
                        Schematic
                    </h2>
                    <p className="text-sm text-secondary/75">{sessionLabel}</p>
                </div>
                {!readOnly && onAddColumn && (
                    <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-xl border border-secondary/30 bg-accent px-3 py-2 text-sm font-semibold text-secondary transition hover:border-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        onClick={onAddColumn}
                    >
                        <PlusIcon className="h-4 w-4" aria-hidden="true" />
                        Add column
                    </button>
                )}
            </header>

            {columns.length === 0
                ? (
                    <p className="text-secondary">
                        No schedule data loaded. Upload a CSV file to generate
                        the schedule.
                    </p>
                )
                : (
                    <div
                        id="main-content"
                        className="min-w-0 overflow-x-auto rounded-2xl border border-secondary/20 bg-accent text-secondary shadow-sm"
                        aria-label="Class schematic"
                    >
                        <div
                            className="w-full"
                            style={{
                                minWidth: `${8 + columns.length * 6}rem`,
                            }}
                        >
                            <div className="flex">
                                <TimeRail
                                    labels={timeLabels}
                                    headerHeightRem={HEADER_HEIGHT_REM}
                                    slotHeightRem={SLOT_HEIGHT_REM}
                                    className="sticky left-0 z-10 w-16 shrink-0 bg-accent text-[clamp(0.6875rem,0.7vw,0.8125rem)] font-medium"
                                    headerClassName="bg-primary"
                                    headerHeight={SCHEDULE_HEADER_HEIGHT}
                                    slotHeight={SCHEDULE_SLOT_HEIGHT}
                                    rowBorderClassName="border-secondary/20"
                                    keyPrefix="left"
                                />
                                {columns.map((column, columnIndex) => (
                                    <InstructorColumn
                                        key={`column-${columnIndex}`}
                                        column={column}
                                        columnIndex={columnIndex}
                                        instructor={instructors[columnIndex] ?? ""}
                                        instructorId={instructorIds?.[columnIndex]}
                                        lockedInstructor={lockedInstructors[
                                            columnIndex
                                        ] ?? ""}
                                        selectedCourseCodes={selectedCourseCodes}
                                        instructorOptions={instructorOptions}
                                        scheduleHeightRem={scheduleHeightRem}
                                        scheduleStartMinutes={scheduleStartMinutes}
                                        slotCount={timeLabels.length}
                                        readOnly={readOnly}
                                        onRemoveColumn={onRemoveColumn}
                                        onInstructorChange={onInstructorChange}
                                        onCourseSelect={onCourseSelect}
                                        onColumnDrop={onColumnDrop}
                                        onCourseDrop={onCourseDrop}
                                        onCourseDragStart={onCourseDragStart}
                                    />
                                ))}
                                <div
                                    className="sticky right-0 z-10 shrink-0 bg-accent"
                                    aria-hidden="true"
                                >
                                    <TimeRail
                                        labels={timeLabels}
                                        headerHeightRem={HEADER_HEIGHT_REM}
                                        slotHeightRem={SLOT_HEIGHT_REM}
                                        className="w-16 bg-accent text-[clamp(0.6875rem,0.7vw,0.8125rem)] font-medium"
                                        headerClassName="bg-primary"
                                        headerHeight={SCHEDULE_HEADER_HEIGHT}
                                        slotHeight={SCHEDULE_SLOT_HEIGHT}
                                        rowBorderClassName="border-secondary/20 border-l"
                                        keyPrefix="right"
                                    />
                                </div>
                            </div>
                            <div className="h-3 bg-primary" aria-hidden="true" />
                        </div>
                    </div>
                )}
        </div>
    );
}

export default SchematicBoard;

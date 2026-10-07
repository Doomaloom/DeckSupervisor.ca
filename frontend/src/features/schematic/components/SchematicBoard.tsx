import React from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import {
    HEADER_HEIGHT_REM,
    SCHEDULE_HEADER_HEIGHT,
    SCHEDULE_SLOT_HEIGHT,
    SLOT_HEIGHT_REM,
} from "../constants";
import type { Course } from "../types";
import {
    canPlaceCourses,
    canReplaceByStart,
    canSwapSingleCourses,
    findContiguousSwapIndices,
} from "../utils/drag";
import InstructorColumn from "./InstructorColumn";
import TimeRail from "./TimeRail";

type SchematicBoardProps = {
    columns: Course[][];
    instructors: string[];
    instructorIds?: (string | null)[];
    lockedInstructors?: string[];
    selectedCourseCodes?: string[];
    draggedCourseCodes?: string[];
    draggedColumnIndex?: number | null;
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
    draggedCourseCodes = [],
    draggedColumnIndex = null,
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
    const boardRef = React.useRef<HTMLDivElement>(null);
    const [hoveredCourseCodes, setHoveredCourseCodes] = React.useState<string[]>([]);
    const findDropTarget = (x: number, y: number) => {
        const target = document.elementFromPoint(x, y);
        if (!target || !boardRef.current?.contains(target)) return null;
        const column = target.closest<HTMLElement>("[data-schematic-column]");
        if (!column) return null;
        const columnIndex = Number(column.dataset.schematicColumn);
        const card = target.closest<HTMLElement>("[data-course-code]");
        const course = columns[columnIndex]?.find(
            (entry) => entry.code === card?.dataset.courseCode,
        );
        return { columnIndex, course };
    };
    const handleHoverAt = (x: number | null, y: number | null) => {
        if (x === null || y === null || draggedColumnIndex === null) {
            setHoveredCourseCodes([]);
            return;
        }
        const target = findDropTarget(x, y);
        if (!target || target.columnIndex === draggedColumnIndex) {
            setHoveredCourseCodes([]);
            return;
        }
        const sourceColumn = columns[draggedColumnIndex] ?? [];
        const movingCourses = sourceColumn.filter((course) =>
            draggedCourseCodes.includes(course.code)
        );
        const sourceAfterMove = sourceColumn.filter((course) =>
            !draggedCourseCodes.includes(course.code)
        );
        const targetColumn = columns[target.columnIndex] ?? [];
        let affectedCourses: Course[] = [];
        if (
            movingCourses.length !== draggedCourseCodes.length ||
            movingCourses.some((course) => course.isLockedToInstructor)
        ) {
            setHoveredCourseCodes([]);
            return;
        }
        if (target.course && movingCourses.length === 1) {
            const moving = movingCourses[0];
            const targetIndex = targetColumn.findIndex((course) =>
                course.code === target.course?.code
            );
            if (!target.course.isLockedToInstructor && targetIndex !== -1) {
                const swapIndices = findContiguousSwapIndices(
                    targetColumn,
                    moving,
                );
                const swapCourses = swapIndices.map((index) =>
                    targetColumn[index]
                );
                if (swapCourses.length > 0) {
                    if (canPlaceCourses(sourceAfterMove, swapCourses)) {
                        affectedCourses = [moving, ...swapCourses];
                    }
                } else if (
                    canReplaceByStart(targetColumn, moving, targetIndex)
                ) {
                    if (canPlaceCourses(sourceAfterMove, [target.course])) {
                        affectedCourses = [moving, target.course];
                    }
                } else if (
                    canSwapSingleCourses(
                        sourceAfterMove,
                        targetColumn,
                        moving,
                        target.course,
                    )
                ) {
                    affectedCourses = [moving, target.course];
                }
            }
        } else if (canPlaceCourses(targetColumn, movingCourses)) {
            affectedCourses = movingCourses;
        } else {
            const overlappingCourses = targetColumn.filter((course) =>
                movingCourses.some((moving) =>
                    moving.startMinutes < course.endMinutes &&
                    course.startMinutes < moving.endMinutes
                )
            );
            if (
                overlappingCourses.length > 0 &&
                overlappingCourses.every((course) =>
                    !course.isLockedToInstructor
                )
            ) {
                const remainingTarget = targetColumn.filter((course) =>
                    !overlappingCourses.some((entry) => entry.code === course.code)
                );
                if (
                    canPlaceCourses(remainingTarget, movingCourses) &&
                    canPlaceCourses(sourceAfterMove, overlappingCourses)
                ) {
                    affectedCourses = [...movingCourses, ...overlappingCourses];
                }
            }
        }
        const nextCodes = affectedCourses.map((course) => course.code);
        setHoveredCourseCodes((current) =>
            current.length === nextCodes.length &&
                    current.every((code) => nextCodes.includes(code))
                ? current
                : nextCodes
        );
    };
    const handleDropAt = (x: number, y: number) => {
        const target = findDropTarget(x, y);
        if (!target) return;
        if (target.course) onCourseDrop(target.course, target.columnIndex);
        else onColumnDrop(target.columnIndex);
    };

    return (
        <div ref={boardRef} className="flex min-w-0 w-full flex-col gap-4">
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
                                        highlightedCourseCodes={hoveredCourseCodes}
                                        instructorOptions={instructorOptions}
                                        scheduleHeightRem={scheduleHeightRem}
                                        scheduleStartMinutes={scheduleStartMinutes}
                                        readOnly={readOnly}
                                        onRemoveColumn={onRemoveColumn}
                                        onInstructorChange={onInstructorChange}
                                        onCourseSelect={onCourseSelect}
                                        onCourseDragStart={onCourseDragStart}
                                        onDropAt={handleDropAt}
                                        onHoverAt={handleHoverAt}
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

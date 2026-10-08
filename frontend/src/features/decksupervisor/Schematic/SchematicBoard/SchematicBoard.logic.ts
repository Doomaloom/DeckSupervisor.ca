import React from "react";

import type { Course } from "../types";

import { canPlaceCourses, canReplaceByStart, canSwapSingleCourses, findContiguousSwapIndices, } from "../utils/drag";

export type SchematicBoardProps = {
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
export function useSchematicBoardLogic({
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

    return {
        view: "ready" as const,
        boardRef,
        sessionLabel,
        readOnly,
        onAddColumn,
        columns,
        timeLabels,
        instructors,
        instructorIds,
        lockedInstructors,
        selectedCourseCodes,
        hoveredCourseCodes,
        instructorOptions,
        scheduleHeightRem,
        scheduleStartMinutes,
        onRemoveColumn,
        onInstructorChange,
        onCourseSelect,
        onCourseDragStart,
        handleDropAt,
        handleHoverAt,
    };

}

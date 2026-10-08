import React from "react";

import type { PlannerClass } from "../../../../types/app";

import { type PlannerBoardCourse } from "../utils/plannerPresentation";

import { canPlacePlannerCourses, canReplacePlannerByStart, canSwapSinglePlannerCourses, findPlannerContiguousSwapIndices, } from "../utils/plannerDrag";

export type PlannerBoardProps = {
    availableDays: string[];
    availableLocations: string[];
    boardColumns: PlannerBoardCourse[][];
    scheduleHeightRem: number;
    scheduleStartMinutes: number;
    selectedClassKey: string;
    selectedDay: string;
    selectedLocation: string;
    setClassLanes: (
        laneIndexes: Record<string, number>,
    ) => void | Promise<void>;
    setIsInfoPanelOpen: (value: boolean) => void;
    setSelectedClassKey: (value: string) => void;
    setSelectedDay: (value: string) => void;
    setSelectedLocation: (value: string) => void;
    timeLabels: string[];
    visibleClasses: PlannerClass[];
    columnMinWidthPx: number;
    headerHeightRem: number;
    slotHeightRem: number;
    slotMinutes: number;
};
export function usePlannerBoardLogic({
    availableDays,
    availableLocations,
    boardColumns,
    scheduleHeightRem,
    scheduleStartMinutes,
    selectedClassKey,
    selectedDay,
    selectedLocation,
    setClassLanes,
    setIsInfoPanelOpen,
    setSelectedClassKey,
    setSelectedDay,
    setSelectedLocation,
    timeLabels,
    visibleClasses,
    columnMinWidthPx,
    headerHeightRem,
    slotHeightRem,
    slotMinutes,
}: PlannerBoardProps) {
    const [dragged, setDragged] = React.useState<
        { classKey: string; columnIndex: number } | null
    >(null);

    const handleDragStart = (
        event: React.DragEvent<HTMLButtonElement>,
        course: PlannerBoardCourse,
        columnIndex: number,
    ) => {
        setDragged({ classKey: course.classKey, columnIndex });
        const target = event.currentTarget;
        const rect = target.getBoundingClientRect();
        event.dataTransfer.setDragImage(
            target,
            event.clientX - rect.left,
            event.clientY - rect.top,
        );
    };

    const handleColumnDrop = async (columnIndex: number) => {
        if (!dragged) {
            return;
        }
        const sourceColumn = boardColumns[dragged.columnIndex] ?? [];
        const sourceCourse = sourceColumn.find((course) =>
            course.classKey === dragged.classKey
        );
        if (!sourceCourse) {
            setDragged(null);
            return;
        }
        if (dragged.columnIndex === columnIndex) {
            setDragged(null);
            return;
        }

        const targetColumn = boardColumns[columnIndex] ?? [];
        const swapIndices = findPlannerContiguousSwapIndices(
            targetColumn,
            sourceCourse,
        );
        if (swapIndices.length > 0) {
            const swapCourses = swapIndices.map((index) => targetColumn[index])
                .filter(Boolean);
            if (
                canPlacePlannerCourses(
                    sourceColumn.filter((course) =>
                        course.classKey !== sourceCourse.classKey
                    ),
                    swapCourses,
                )
            ) {
                await setClassLanes({
                    [sourceCourse.classKey]: columnIndex,
                    ...Object.fromEntries(
                        swapCourses.map((
                            course,
                        ) => [course.classKey, dragged.columnIndex]),
                    ),
                });
            }
            setDragged(null);
            return;
        }

        if (
            !targetColumn.some((target) =>
                target.startMinutes < sourceCourse.endMinutes &&
                sourceCourse.startMinutes < target.endMinutes
            )
        ) {
            await setClassLanes({ [sourceCourse.classKey]: columnIndex });
        }
        setDragged(null);
    };

    const handleCourseDrop = async (
        targetCourse: PlannerBoardCourse,
        targetColumnIndex: number,
    ) => {
        if (!dragged) {
            return;
        }
        if (
            dragged.columnIndex === targetColumnIndex &&
            dragged.classKey === targetCourse.classKey
        ) {
            setDragged(null);
            return;
        }

        const sourceColumn = boardColumns[dragged.columnIndex] ?? [];
        const sourceCourse = sourceColumn.find((course) =>
            course.classKey === dragged.classKey
        );
        const targetColumn = boardColumns[targetColumnIndex] ?? [];
        const targetIndex = targetColumn.findIndex((course) =>
            course.classKey === targetCourse.classKey
        );
        if (!sourceCourse || targetIndex === -1) {
            setDragged(null);
            return;
        }

        const swapIndices = findPlannerContiguousSwapIndices(
            targetColumn,
            sourceCourse,
        );
        if (swapIndices.length > 0) {
            const swapCourses = swapIndices.map((index) => targetColumn[index])
                .filter(Boolean);
            if (
                canPlacePlannerCourses(
                    sourceColumn.filter((course) =>
                        course.classKey !== sourceCourse.classKey
                    ),
                    swapCourses,
                )
            ) {
                await setClassLanes({
                    [sourceCourse.classKey]: targetColumnIndex,
                    ...Object.fromEntries(
                        swapCourses.map((
                            course,
                        ) => [course.classKey, dragged.columnIndex]),
                    ),
                });
            }
            setDragged(null);
            return;
        }

        if (canReplacePlannerByStart(targetColumn, sourceCourse, targetIndex)) {
            const destinationCourse = targetColumn[targetIndex];
            if (
                destinationCourse &&
                canPlacePlannerCourses(
                    sourceColumn.filter((course) =>
                        course.classKey !== sourceCourse.classKey
                    ),
                    [destinationCourse],
                )
            ) {
                await setClassLanes({
                    [sourceCourse.classKey]: targetColumnIndex,
                    [destinationCourse.classKey]: dragged.columnIndex,
                });
            }
            setDragged(null);
            return;
        }

        const destinationCourse = targetColumn[targetIndex];
        if (
            destinationCourse &&
            canSwapSinglePlannerCourses(
                sourceColumn,
                targetColumn,
                sourceCourse,
                destinationCourse,
            )
        ) {
            await setClassLanes({
                [sourceCourse.classKey]: targetColumnIndex,
                [destinationCourse.classKey]: dragged.columnIndex,
            });
        }
        setDragged(null);
    };

    return {
        view: "ready" as const,
        visibleClasses,
        boardColumns,
        availableDays,
        selectedDay,
        setSelectedDay,
        availableLocations,
        selectedLocation,
        setSelectedLocation,
        columnMinWidthPx,
        headerHeightRem,
        slotHeightRem,
        timeLabels,
        handleColumnDrop,
        scheduleHeightRem,
        scheduleStartMinutes,
        slotMinutes,
        selectedClassKey,
        setSelectedClassKey,
        setIsInfoPanelOpen,
        handleDragStart,
        setDragged,
        handleCourseDrop,
    };

}

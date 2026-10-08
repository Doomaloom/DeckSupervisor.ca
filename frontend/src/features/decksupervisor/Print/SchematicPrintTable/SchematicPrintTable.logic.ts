import { useMemo } from "react";

import type { Course } from "../../Schematic/types";

import { getCapacity, getCapacityClass } from "../../Schematic/utils/capacity";

export type SchematicPrintTableProps = {
    columns: Course[][];
    instructors: string[];
    title: string;
    dateRange: string;
    weeksLabel: string;
    deckSupervisorName?: string;
};

export type Cell = {
    course: Course;
    rowSpan: number;
    capacity: number;
    capacityClass: string;
};

export const formatTimeLabel = (minutes: number) => {
    const total = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
    const h = Math.floor(total / 60);
    const m = total % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
};

export const buildSlots = (courses: Course[], interval = 30) => {
    if (courses.length === 0) {
        return [];
    }
    const starts = courses.map((course) => course.startMinutes);
    const ends = courses.map((course) => course.endMinutes);
    const start = Math.min(...starts);
    const end = Math.max(...ends);
    const slots: number[] = [];
    for (let t = start; t < end; t += interval) {
        slots.push(t);
    }
    return slots;
};
export function useSchematicPrintTableLogic({
    columns,
    instructors,
    title,
    dateRange,
    weeksLabel,
    deckSupervisorName,
}: SchematicPrintTableProps) {
    const allCourses = useMemo(() => columns.flat(), [columns]);
    const slots = useMemo(() => buildSlots(allCourses, 30), [allCourses]);
    const columnCount = Math.max(columns.length, instructors.length, 1);

    const grid = useMemo(() => {
        const cellMap = new Map<string, Cell>();
        const skipMap = new Set<string>();
        const baseStart = slots[0] ?? 0;

        columns.forEach((column, colIndex) => {
            column.forEach((course) => {
                const rowIndex = Math.round(
                    (course.startMinutes - baseStart) / 30,
                );
                if (rowIndex < 0) {
                    return;
                }
                const rowSpan = Math.max(1, Math.ceil(course.runningTime / 30));
                const capacity = getCapacity(course);
                const capacityClass = getCapacityClass(course, capacity);
                cellMap.set(`${rowIndex}-${colIndex}`, {
                    course,
                    rowSpan,
                    capacity,
                    capacityClass,
                });
                for (let offset = 1; offset < rowSpan; offset += 1) {
                    skipMap.add(`${rowIndex + offset}-${colIndex}`);
                }
            });
        });

        return { cellMap, skipMap };
    }, [columns, slots]);

    const leftSpan = 1 + Math.ceil(columnCount / 2);
    const totalColumns = columnCount + 2;
    const rightSpan = totalColumns - leftSpan;

    return {
        view: "ready" as const,
        totalColumns,
        title,
        dateRange,
        leftSpan,
        deckSupervisorName,
        rightSpan,
        weeksLabel,
        columnCount,
        instructors,
        slots,
        grid,
    };

}

import type { Course } from "../types";

export type InstructorColumnProps = {
    column: Course[];
    columnIndex: number;
    instructor: string;
    instructorId?: string | null;
    lockedInstructor?: string;
    selectedCourseCodes?: string[];
    highlightedCourseCodes: string[];
    instructorOptions: (string | { id: string; name: string; label: string })[];
    scheduleHeightRem: number;
    scheduleStartMinutes: number;
    readOnly?: boolean;
    onRemoveColumn?: (columnIndex: number) => void;
    onInstructorChange: (columnIndex: number, value: string) => void;
    onCourseSelect: (course: Course, columnIndex: number) => void;
    onDropAt: (x: number, y: number) => void;
    onHoverAt: (x: number | null, y: number | null) => void;
    onCourseDragStart: (
        course: Course,
        columnIndex: number,
    ) => void;
};
export function useInstructorColumnLogic({
    column,
    columnIndex,
    instructor,
    instructorId,
    lockedInstructor,
    selectedCourseCodes = [],
    highlightedCourseCodes,
    instructorOptions,
    scheduleHeightRem,
    scheduleStartMinutes,
    readOnly = false,
    onRemoveColumn,
    onInstructorChange,
    onCourseSelect,
    onCourseDragStart,
    onDropAt,
    onHoverAt,
}: InstructorColumnProps) {
    const canRemove = !readOnly && column.length === 0 &&
        !instructor.trim() && !instructorId && !lockedInstructor &&
        Boolean(onRemoveColumn);
    return {
        view: "ready" as const,
        columnIndex,
        canRemove,
        onRemoveColumn,
        readOnly,
        lockedInstructor,
        instructor,
        instructorId,
        onInstructorChange,
        instructorOptions,
        scheduleHeightRem,
        column,
        scheduleStartMinutes,
        selectedCourseCodes,
        highlightedCourseCodes,
        onCourseSelect,
        onCourseDragStart,
        onDropAt,
        onHoverAt,
    };

}

import type { FullTimeInstructorAssignments, FullTimeInstructorPeriod, } from "../types";

export type DayPeriod = {
    key: FullTimeInstructorPeriod;
    label: string;
    splitMinute: number | null;
};

export type FullTimeInstructorAssignmentsPanelProps = {
    dayKeys: string[];
    periodMap: Record<string, DayPeriod[]>;
    assignments: FullTimeInstructorAssignments;
    onInstructorChange: (
        day: string,
        period: FullTimeInstructorPeriod,
        index: number,
        value: string,
    ) => void;
    onAddInstructor: (day: string, period: FullTimeInstructorPeriod) => void;
    onRemoveInstructor: (
        day: string,
        period: FullTimeInstructorPeriod,
        index: number,
    ) => void;
};
export function useFullTimeInstructorAssignmentsPanelLogic({
    dayKeys,
    periodMap,
    assignments,
    onInstructorChange,
    onAddInstructor,
    onRemoveInstructor,
}: FullTimeInstructorAssignmentsPanelProps) {
    if (dayKeys.length === 0) {
        return { view: "hidden" as const };
    }

    return {
        view: "ready" as const,
        dayKeys,
        assignments,
        periodMap,
        onAddInstructor,
        onInstructorChange,
        onRemoveInstructor,
    };

}

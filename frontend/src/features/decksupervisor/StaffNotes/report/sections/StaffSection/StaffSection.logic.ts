import type { ReportSectionProps } from "../../types";

import { parseStrengthWeakness, serializeStrengthWeakness } from "../../../utils/reportData";

export type StaffSectionProps = ReportSectionProps & {
    reportInstructorOptions: string[];
};
export function useStaffSectionLogic({
    reportDraft,
    updateReportDraft,
    canEditSelectedReport,
    isReportInputDisabled,
    reportInstructorOptions,
}: StaffSectionProps) {
    const updateStrengthWeakness = (
        instructorIndex: number,
        updater: (value: { strengths: string[]; weaknesses: string[] }) => {
            strengths: string[];
            weaknesses: string[];
        },
    ) => {
        updateReportDraft((current) => ({
            ...current,
            staff: {
                ...current.staff,
                strengthWeakness: current.staff.strengthWeakness.map(
                    (row, rowIndex) => {
                        if (rowIndex !== instructorIndex) {
                            return row;
                        }
                        const parsed = parseStrengthWeakness(row.text);
                        const next = updater(parsed);
                        return {
                            ...row,
                            text: serializeStrengthWeakness(next),
                        };
                    },
                ),
            },
        }));
    };

    const successionInstructorOptions = Array.from(
        new Set([
            ...reportDraft.staff.performance.map((entry) =>
                entry.instructor.trim()
            ),
            ...reportDraft.staff.successionPlans.map((entry) =>
                entry.instructor.trim()
            ),
        ]).values(),
    ).filter(Boolean);

    const successionPlanByInstructor = new Map(
        reportDraft.staff.successionPlans.map(
            (entry) => [entry.instructor, entry.text],
        ),
    );

    const selectedSuccessionRows = successionInstructorOptions
        .filter((instructor) => successionPlanByInstructor.has(instructor))
        .map((instructor) => ({
            instructor,
            text: successionPlanByInstructor.get(instructor) ?? "",
        }));

    return {
        view: "ready" as const,
        reportDraft,
        updateReportDraft,
        isReportInputDisabled,
        canEditSelectedReport,
        updateStrengthWeakness,
        successionInstructorOptions,
        successionPlanByInstructor,
        selectedSuccessionRows,
        reportInstructorOptions,
    };

}

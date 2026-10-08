import type { RosterGroup } from "../types";

export type RosterCardProps = {
    roster: RosterGroup;
    isCustom?: boolean;
    onPrint: (roster: RosterGroup) => void;
    onRosterLevelChange: (code: string, level: string) => void;
    onCustomRosterLevelChange?: (id: string, level: string) => void;
    onStudentLevelChange: (studentId: string, level: string) => void;
    allowStudentLevelEdits: boolean;
    onToggleStudentLevelEdits: () => void;
};
export function useRosterCardLogic({
    roster,
    isCustom = false,
    onPrint,
    onRosterLevelChange,
    onCustomRosterLevelChange,
    onStudentLevelChange,
    allowStudentLevelEdits,
    onToggleStudentLevelEdits,
}: RosterCardProps) {
    const containerClass = isCustom
        ? "rounded-2xl border-2 border-blue-200 bg-blue-100 p-6 shadow-md"
        : "rounded-2xl border-2 border-secondary/20 bg-accent p-6 shadow-md";
    const isReadOnly = isCustom;
    const customId = roster.customRosterId ??
        roster.code.replace(/^custom-/, "");

    const actionButtonClass =
        "rounded-lg bg-primary px-3 py-1 text-white transition hover:-translate-y-0.5 hover:bg-secondary";
    const toggleButtonClass = `${actionButtonClass} ${allowStudentLevelEdits ? "ring-2 ring-accent/70" : ""
        }`;

    return {
        view: "ready" as const,
        containerClass,
        roster,
        toggleButtonClass,
        onToggleStudentLevelEdits,
        allowStudentLevelEdits,
        actionButtonClass,
        onPrint,
        isCustom,
        customId,
        onCustomRosterLevelChange,
        onRosterLevelChange,
        onStudentLevelChange,
        isReadOnly,
    };

}

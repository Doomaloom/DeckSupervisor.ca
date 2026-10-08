import type { InstructorEntry } from "../types";

export type InstructorListEditorProps = {
    instructors: InstructorEntry[];
    onAddInstructor: () => void;
    onUpdateInstructor: (index: number, value: string) => void;
    onRemoveInstructor?: (index: number) => void;
    currentSessionId?: string;
};
export function useInstructorListEditorLogic({
    instructors,
    onAddInstructor,
    onUpdateInstructor,
    onRemoveInstructor,
    currentSessionId = "new-session",
}: InstructorListEditorProps) {
    const showRemove = typeof onRemoveInstructor === "function";

    return {
        view: "ready" as const,
        showRemove,
        instructors,
        currentSessionId,
        onUpdateInstructor,
        onRemoveInstructor,
        onAddInstructor,
    };

}

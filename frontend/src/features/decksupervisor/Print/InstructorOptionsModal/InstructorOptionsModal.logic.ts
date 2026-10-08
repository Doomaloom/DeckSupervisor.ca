import React from "react";

export type InstructorOptionsModalProps = {
    open: boolean;
    instructorNames: string[];
    busyInstructors: Record<string, boolean>;
    isPrintingAll: boolean;
    notice?: React.ReactNode;
    extras: {
        schematicCoverPage: boolean;
        highlightCoverInstructor: boolean;
    };
    coverOrientation: "portrait" | "landscape";
    schematicScalePercent: number;
    scaleMin: number;
    scaleMax: number;
    scaleStep: number;
    onClose: () => void;
    onPrintAll: () => void;
    onPrintInstructor: (name: string) => void;
    onToggleCover: () => void;
    onToggleCoverHighlight: () => void;
    onSelectCoverOrientation: (value: "portrait" | "landscape") => void;
    onChangeSchematicScale: (value: number) => void;
    onResetSchematicScale: () => void;
};
export function useInstructorOptionsModalLogic({
    open,
    instructorNames,
    busyInstructors,
    isPrintingAll,
    notice,
    extras,
    coverOrientation,
    schematicScalePercent,
    scaleMin,
    scaleMax,
    scaleStep,
    onClose,
    onPrintAll,
    onPrintInstructor,
    onToggleCover,
    onToggleCoverHighlight,
    onSelectCoverOrientation,
    onChangeSchematicScale,
    onResetSchematicScale,
}: InstructorOptionsModalProps) {
    if (!open) {
        return { view: "hidden" as const };
    }

    return {
        view: "ready" as const,
        notice,
        onClose,
        onPrintAll,
        isPrintingAll,
        instructorNames,
        extras,
        onToggleCover,
        coverOrientation,
        onSelectCoverOrientation,
        onToggleCoverHighlight,
        schematicScalePercent,
        scaleMin,
        scaleMax,
        scaleStep,
        onChangeSchematicScale,
        onResetSchematicScale,
        busyInstructors,
        onPrintInstructor,
    };

}

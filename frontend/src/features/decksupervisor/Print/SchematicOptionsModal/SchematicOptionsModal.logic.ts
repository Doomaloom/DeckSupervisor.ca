import React from "react";

export type SchematicOptions = {
    highlightInstructor: boolean;
    selectedInstructor: string;
    orientation: "portrait" | "landscape";
};

export type SchematicOptionsModalProps = {
    open: boolean;
    options: SchematicOptions;
    instructorNames: string[];
    scalePercent: number;
    scaleMin: number;
    scaleMax: number;
    scaleStep: number;
    notice?: React.ReactNode;
    previewUrl: string | null;
    isPreviewLoading: boolean;
    previewError: string | null;
    onClose: () => void;
    onToggleHighlight: () => void;
    onSelectInstructor: (value: string) => void;
    onSelectOrientation: (value: "portrait" | "landscape") => void;
    onChangeScale: (value: number) => void;
    onResetScale: () => void;
    onPrint: () => void;
};
export function useSchematicOptionsModalLogic({
    open,
    options,
    instructorNames,
    scalePercent,
    scaleMin,
    scaleMax,
    scaleStep,
    notice,
    previewUrl,
    isPreviewLoading,
    previewError,
    onClose,
    onToggleHighlight,
    onSelectInstructor,
    onSelectOrientation,
    onChangeScale,
    onResetScale,
    onPrint,
}: SchematicOptionsModalProps) {
    if (!open) {
        return { view: "hidden" as const };
    }

    return {
        view: "ready" as const,
        notice,
        onClose,
        options,
        onToggleHighlight,
        onSelectOrientation,
        onSelectInstructor,
        instructorNames,
        scalePercent,
        scaleMin,
        scaleMax,
        scaleStep,
        onChangeScale,
        onResetScale,
        isPreviewLoading,
        previewError,
        previewUrl,
        onPrint,
    };

}

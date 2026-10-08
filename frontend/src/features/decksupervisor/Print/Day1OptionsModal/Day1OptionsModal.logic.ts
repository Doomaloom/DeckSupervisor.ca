import React from "react";

import type { BooleanFormatOptionKey, FormatOptions, MasterlistAlphabeticalNameBasis, MasterlistLayout, } from "../../../../types/app";

export type Day1Options = {
    schematicCoverPage: boolean;
    highlightInstructorName: boolean;
    customMasterlistFormat: boolean;
};

export type Day1OptionsModalProps = {
    open: boolean;
    options: Day1Options;
    formatOptions: FormatOptions;
    schematicScalePercent: number;
    scaleMin: number;
    scaleMax: number;
    scaleStep: number;
    notice?: React.ReactNode;
    onClose: () => void;
    onToggle: (key: keyof Day1Options) => void;
    onToggleFormat: (key: BooleanFormatOptionKey) => void;
    onChangeLayout: (layout: MasterlistLayout) => void;
    onChangeAlphabeticalNameBasis: (
        basis: MasterlistAlphabeticalNameBasis,
    ) => void;
    onChangeFontSize: (value: string) => void;
    onChangeSchematicScale: (value: number) => void;
    onResetSchematicScale: () => void;
    onPrint: () => void;
};
export function useDay1OptionsModalLogic({
    open,
    options,
    formatOptions,
    schematicScalePercent,
    scaleMin,
    scaleMax,
    scaleStep,
    notice,
    onClose,
    onToggle,
    onToggleFormat,
    onChangeLayout,
    onChangeAlphabeticalNameBasis,
    onChangeFontSize,
    onChangeSchematicScale,
    onResetSchematicScale,
    onPrint,
}: Day1OptionsModalProps) {
    if (!open) {
        return { view: "hidden" as const };
    }

    return {
        view: "ready" as const,
        notice,
        onClose,
        options,
        onToggle,
        schematicScalePercent,
        scaleMin,
        scaleMax,
        scaleStep,
        onChangeSchematicScale,
        onResetSchematicScale,
        formatOptions,
        onChangeLayout,
        onChangeAlphabeticalNameBasis,
        onToggleFormat,
        onChangeFontSize,
        onPrint,
    };

}

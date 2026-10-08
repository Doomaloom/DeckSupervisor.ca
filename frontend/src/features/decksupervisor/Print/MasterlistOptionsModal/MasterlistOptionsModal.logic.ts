import React, { useEffect, useState } from "react";

import type { BooleanFormatOptionKey, FormatOptions, MasterlistAlphabeticalNameBasis, MasterlistLayout, } from "../../../../types/app";

export type MasterlistExtras = {
    schematicCoverPage: boolean;
};

export type MasterlistOptionsModalProps = {
    open: boolean;
    extras: MasterlistExtras;
    coverOrientation: "portrait" | "landscape";
    schematicScalePercent: number;
    scaleMin: number;
    scaleMax: number;
    scaleStep: number;
    formatOptions: FormatOptions;
    notice?: React.ReactNode;
    previewUrl: string | null;
    isPreviewLoading: boolean;
    previewError: string | null;
    onToggleFormat: (key: BooleanFormatOptionKey) => void;
    onChangeLayout: (layout: MasterlistLayout) => void;
    onChangeAlphabeticalNameBasis: (
        basis: MasterlistAlphabeticalNameBasis,
    ) => void;
    onChangeFontSize: (value: string) => void;
    onClose: () => void;
    onToggle: (key: keyof MasterlistExtras) => void;
    onSelectCoverOrientation: (value: "portrait" | "landscape") => void;
    onChangeSchematicScale: (value: number) => void;
    onResetSchematicScale: () => void;
    onPrint: () => void;
};

export type OptionsGroupKey = "cover" | "format" | "time" | "course";

export function useMasterlistOptionsModalLogic({
    open,
    extras,
    coverOrientation,
    schematicScalePercent,
    scaleMin,
    scaleMax,
    scaleStep,
    formatOptions,
    notice,
    previewUrl,
    isPreviewLoading,
    previewError,
    onToggleFormat,
    onChangeLayout,
    onChangeAlphabeticalNameBasis,
    onChangeFontSize,
    onClose,
    onToggle,
    onSelectCoverOrientation,
    onChangeSchematicScale,
    onResetSchematicScale,
    onPrint,
}: MasterlistOptionsModalProps) {
    const [openGroups, setOpenGroups] = useState<
        Record<OptionsGroupKey, boolean>
    >({
        cover: false,
        format: true,
        time: formatOptions.time_headers,
        course: formatOptions.course_headers,
    });

    useEffect(() => {
        setOpenGroups((current) => {
            if (
                current.time === formatOptions.time_headers &&
                current.course === formatOptions.course_headers
            ) {
                return current;
            }
            return {
                ...current,
                time: formatOptions.time_headers,
                course: formatOptions.course_headers,
            };
        });
    }, [formatOptions.course_headers, formatOptions.time_headers]);

    const toggleOptionsGroup = (group: OptionsGroupKey) => {
        setOpenGroups((current) => ({
            ...current,
            [group]: !current[group],
        }));
    };

    if (!open) {
        return { view: "hidden" as const };
    }

    return {
        view: "ready" as const,
        notice,
        onClose,
        open,
        openGroups,
        onToggle,
        toggleOptionsGroup,
        extras,
        coverOrientation,
        onSelectCoverOrientation,
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
        isPreviewLoading,
        previewError,
        previewUrl,
        onPrint,
    };

}
